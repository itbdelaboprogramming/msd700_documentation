---
outline: deep
search: false
---

# Firmware & Enrolment

<RoleBadge role="developer" />

Two contracts at the edges of the system: the serial link between the STM32 firmware and the Jetson,
and the HTTPS handshake a new robot uses to become a unit.

## Firmware link (rosserial) {#firmware-link}

The STM32H7 firmware (`firmware-msd700`) talks to the Jetson over rosserial on a USB serial link
(`/dev/stm32` on the prototype robot). Two topics, both defined in `msd700_msgs`:

| Topic | Direction | Type | Content |
| --- | --- | --- | --- |
| `/hardware_state` | STM32 → Jetson | `msd700_msgs/HardwareState` | Eight ultrasonic distances, left/right motor pulse deltas, heading/pitch/roll, accelerometer, gyro and magnetometer triples, UWB distance/deviation/rho/theta |
| `/hardware_command` | Jetson → STM32 | `msd700_msgs/HardwareCommand` | `movement_command`, `cam_angle_command`, `right_motor_speed`, `left_motor_speed` |

This is the low end of the [`hardware`](/development/message-contracts/mqtt-commands#hardware) command
handler: `hardware.check`, `init` and `stop` act on this link through `hardware_node`, and
`/hardware_state` feeds odometry and sensor fusion. Details:
[Firmware & Hardware](/development/ros/firmware-and-hardware).

## Enrolment {#enrolment}

A robot with no credentials registers itself through the `/enroll` router on `backend_node`. No token
is needed; the proof is a 32-byte nonce only the robot knows.

![Robot Enrolment Handshake](./diagrams/message-contracts-robot-enrolment-handshake.drawio)

### `POST /enroll/claim` {#enroll-claim}

```json
{
  "fingerprint": "<sha256 hex of the hardware identity>",
  "nonce_hash": "<sha256 hex of the 32-byte nonce>",
  "nonce": "<the nonce, only on a self-heal recovery>",
  "hostname": "msd700-jetson",
  "mac": "aa:bb:cc:dd:ee:ff",
  "agent_version": "2.4.0",
  "bootstrap_key": "<optional>",
  "enrollment_code": "<optional 10-character voucher>"
}
```

`fingerprint` and `nonce_hash` must be 64-character lowercase hex (`400` otherwise).

| Outcome | Status | `data` |
| --- | --- | --- |
| New or known hardware, waiting for an administrator | `202` | `{ claim_code: "K7M2QP4R", status: "pending" }` |
| Valid voucher (`enrollment_code`) | `200` | the [credential](#credential) |
| Self-heal: already claimed, raw nonce matches, binding still live | `200` | the [credential](#credential) |
| Invalid, used or expired voucher | `404` | |

### `POST /enroll/status` {#enroll-status}

Body `{ fingerprint, nonce, agent_version }`, polled by the robot until an administrator registers or
adopts it in the [Admin Console](/development/webui/admin-console/units). `202` with
`{ claim_code, status }` while waiting; once approved, the credential is handed over only if
`sha256(nonce)` matches the stored `nonce_hash`.

### Credential {#credential}

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "unit_name": "Unit 01",
  "topic_root": "/unit_01JZ8P9WZ0UNIT00000000000",
  "device_secret": "<32 random bytes, shown once>",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": "12h",
  "key_id": "k2026-09"
}
```

The robot stores it as `device.json`. The cloud keeps only a bcrypt hash of `device_secret`.

### `POST /enroll/token` {#enroll-token}

Body `{ unit_id, device_secret, agent_version, reason }`, where `reason` is `boot`, `refresh` or
`recovery`. Answers `{ unit_id, unit_name, topic_root, access_token, expires_in, key_id }`. The access
token has `role: "robot"` and is what the robot uses against `/sync` and the media server. Presenting
the current secret also retires the previous one (`secret_prev_hash`).

::: tip Why the nonce
MAC addresses and serials are visible on the network and in the admin console. The nonce proves the
caller is the machine that asked, so a spoofed MAC cannot collect an approved credential while the real
robot is off. Full protocol, vouchers and self-heal:
[Hardware Enrolment](/development/webui/accounts/enrolment).
:::

## Related documentation

- [Hardware Enrolment](/development/webui/accounts/enrolment): the protocol in depth.
- [Admin Console: Units](/development/webui/admin-console/units): the Pending view that approves a claim.
- [Security and Auth](/development/security-and-auth): token types and the keyring.
