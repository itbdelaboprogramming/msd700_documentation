---
outline: deep
search: false
---

# Accounts & Access: Security & Tokens

<RoleBadge role="developer" />

The backend mechanics behind the [Accounts & Access screens](/development/webui/accounts/overview):
the JWT keyring that signs and verifies tokens, the three independent trust domains those tokens
live in, and the TLS termination that protects them in transit. For how a robot first acquires its
own credentials, see [Hardware Enrolment](/development/webui/accounts/enrolment); for how those
credentials reach the robot host, see [ROS Integration](/development/webui/accounts/ros-integration).

## Trust domain architecture

MSD700 enforces defense-in-depth across the web frontend, cloud backend, message broker, and
physical Jetson single-board computers (SBCs).

```mermaid
flowchart TB
  subgraph Public["Public Internet Ingress"]
    HTTPS["HTTPS / WSS (:443)<br/>Apache TLS Termination"]
    MQTTS["MQTT TLS (:8883)<br/>HiveMQ CE Encrypted Ingress"]
  end

  subgraph CloudDomain["Cloud Server Trust Domain"]
    KEYRING["JWT Secret Keyring<br/>/srv/msd/secrets/jwt_keyring"]
    AUTH_MW["Express verifyToken Middleware"]
    ATTACH_MW["attachUnit Authorization Middleware"]
    MYSQL[("Central MySQL DB (:3307)<br/>Bcrypt Passwords")]
  end

  subgraph RobotDomain["Physical Robot Trust Domain (Jetson)"]
    DEV_SECRET["Device Secret (HMAC-SHA256)<br/>Certificates/robot/device.json"]
    ROBOT_TOKEN["Onboard Token Cache (12h TTL)<br/>Certificates/robot/token.cred"]
    LOCAL_KEYRING["Unit Local Keyring<br/>Isolated from Cloud Secrets"]
  end

  HTTPS --> AUTH_MW
  AUTH_MW --> ATTACH_MW
  ATTACH_MW --> MYSQL
  KEYRING -.-> AUTH_MW

  MQTTS <--> ROBOT_TOKEN
  DEV_SECRET --> ROBOT_TOKEN
  LOCAL_KEYRING -.->|"Local Auth Only"| RobotDomain
```

## Three independent trust domains

Security boundaries are separated into three non-interchangeable trust domains:

| Trust Domain | Issuer Authority | Token Purpose | Validation Endpoint | Isolation Rule |
| --- | --- | --- | --- | --- |
| **Operator Domain** | Cloud Server Backend (`backend_node`) | Authenticates human operators accessing the web dashboard. | `verifyToken` on all `/api/*` routes | Cannot be used directly by robots; rejected on `/local/*` routes. |
| **Robot Cloud Domain** | Cloud Enrolment Service (`/enroll/token`) | Authenticates physical robots connecting to HiveMQ and cloud media servers. | HiveMQ TLS + cloud `media-server` | Scoped strictly to the robot's assigned ULID; valid for 12 hours. |
| **Unit Local Domain** | Onboard Local Backend (`backend_local`) | Authenticates local LAN operators and onboard video streaming clients. | `/local/*` endpoints | Cloud tokens are strictly rejected to ensure local offline sovereignty. |

The Operator Domain row above is the trust boundary for the operator login described in
[Overview](/development/webui/accounts/overview): a token from it works across `/api/*` but is
rejected outright on `/local/*`. This model does not itemize a separate row for the admin console's
own login; what it does establish is that the robot itself never accepts a browser-issued token of
any kind, only credentials minted through the enrolment flow covered in
[Hardware Enrolment](/development/webui/accounts/enrolment).

## JWT keyring and zero-downtime secret rotation

Authentication tokens are verified against a **JWT Keyring** stored in
`/srv/msd/secrets/jwt_keyring` rather than a single static environment variable.

```json
{
  "active_kid": "key_2026_08_a",
  "keys": {
    "key_2026_08_a": {
      "secret": "9a8b7c6d5e4f3a2b1c0d...",
      "created_at": "2026-08-01T00:00:00Z"
    },
    "key_2026_07_b": {
      "secret": "1f2e3d4c5b6a7f8e9d0c...",
      "created_at": "2026-07-01T00:00:00Z"
    }
  }
}
```

### Keyring rotation rules

1. **Active Signing Key**: All newly minted access and refresh tokens are signed with the key
   identified by `active_kid`.
2. **Grace Window Verification**: When an incoming token arrives, `verifyToken` checks its
   signature against `active_kid`. If verification fails, it tests previous keys in the keyring
   before rejecting with HTTP 401.
3. **Zero Session Disruption**: Rotating secrets in production does not force all active operators
   to re-login simultaneously.

## Network security and TLS termination

1. **Apache Reverse Proxy**: All external HTTP, SSE, and WebSocket traffic terminates TLS at Apache
   port 443 using certificates from Let's Encrypt (`/etc/letsencrypt/live/`).
2. **HiveMQ Mutual Transport Security**: Robots connect to HiveMQ on port 8883 over TLS. Keystore
   PKCS#12 certificates reside in `/srv/msd/secrets/hivemq/keystore.p12`.
3. **Container Isolation**: Backend containers communicate across internal Docker bridge networks
   (`ros_backend_net`), exposing no internal database or rosbridge ports directly to the public
   internet.

## Related

- [Overview](/development/webui/accounts/overview): the four Accounts & Access screens and how
  they relate.
- [Hardware Enrolment](/development/webui/accounts/enrolment): the nonce protocol a robot uses to
  register itself.
- [ROS Integration](/development/webui/accounts/ros-integration): how tokens and the operating
  lease reach the robot.
- [Architecture](/development/architecture): full platform topology and trust domains.
- [State & Behavior](/development/state-and-behavior): the robot-side state machine, including
  lease enforcement.
