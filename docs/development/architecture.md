---
search: false
---

# Architecture

<RoleBadge role="developer" />

High-level overview of how MSD700 is put together. See [Repository Structure](/development/repository-structure) for where each of these lives in source, and [System Setup](/setup/system-setup) for the deployment-time view of the same components.

## Components

| Component | Responsibility | Where |
| --- | --- | --- |
| **Frontend** (`ROS-dashboard-next-ts`) | Operator dashboard (Next.js). Two builds from one codebase: `frontend_prod`/`frontend_dev` served by the Server, and a build baked into every Unit for its own local dashboard. | `ros-web-ui/source/dependencies/ROS-dashboard-next-ts` |
| **backend_node** (`ROS-dashboard-backend`) | Express API: auth, maps/routes/areas/playlists CRUD, unit control endpoints, the admin console API, enrolment, and cross-device sync. Also runs `unit_manager.js`, which starts/stops one Docker container per unit on demand. | `ros-web-ui/source/dependencies/ROS-dashboard-backend` |
| **rosbridge** | WebSocket bridge from ROS topics/services to the browser: the frontend's live map, robot pose, and topic subscriptions all go through it. | Part of the `nakayama_cloud`/`nakayama_cloud_dev` container (`rosbridge_suite`) |
| **HiveMQ (MQTT)** | The only channel between a Unit and the cloud. Carries `/system_command` / `/system_feedback` and everything bridged onto them; TLS, one broker for prod, one for dev. | `hivemq` / `hivemq_dev` containers |
| **MySQL** | Accounts, profiles, units, maps/routes/areas/playlists metadata, backup manifests. | `db` / `db_dev` containers |
| **media-server** | Serves map images and receives uploaded map data. | `ros-web-ui/source/dependencies/media-server` |
| **signalling_server** | WebRTC signalling for the live camera feed (peer negotiation only; video itself is peer-to-peer, relayed through `coturn` when a direct path isn't possible). | `ros-web-ui/source/dependencies/signalling_server` |
| **coturn** | TURN/STUN relay for WebRTC, production only, `network_mode: host` (a relay allocates one port per session; bridging that many ports through Docker's proxy doesn't scale). | `docker-compose.yml` service `coturn` |
| **ROS packages** (`msd700_robot`, plus `ros-web-ui`'s own `msd700_webui_*` packages) | Navigation, SLAM, area coverage, hardware drivers, and the web-facing glue (MQTT bridge, camera client, `topic2string`) that runs on a Unit. | `msd700_robot/`, `ros-web-ui/source/` |

## Data flow

```
Operator's browser
   │  HTTPS + WSS (rosbridge, signalling)
   ▼
Apache (TLS termination, reverse proxy)  ──►  backend_node  ──►  MySQL
   │                                              │
   │  WSS /services/rosbridge                     │ starts/stops on demand
   ▼                                              ▼
rosbridge (in nakayama_cloud/_dev)          rosweb_unit_<ULID>_nakayama container
   │  ROS topics, same roscore as backend        (one per actively-open unit)
   ▼
                    MQTT (TLS, HiveMQ) ◄──────────┘
                          │
                          ▼
                 Unit's local MQTT bridge
                          │
                          ▼
                 Unit's own roscore ── navigation, SLAM, hardware drivers
```

Two things about this that aren't obvious from a single glance at the diagram:

- **The backend and rosbridge share one roscore, but a unit's ROS topics don't exist on the cloud
  master until that unit's per-unit container is running.** `unit_manager.js` starts
  `rosweb_unit_<ULID>_nakayama` the moment an operator opens that unit in the dashboard, and reaps it
  after `UNIT_IDLE_TIMEOUT_MS` of inactivity (30 minutes by default). A unit that's enrolled and
  online over MQTT can still show nothing on the map if nobody has opened it recently enough for its
  container to still be up.
- **MQTT is a clock-domain boundary.** Timestamps in geometric data crossing from the Unit's roscore
  to the cloud's are restamped to the cloud's local ROS clock on ingress, via a shared
  `BoundaryPublisher`. Skipping this produces `TF_OLD_DATA` warnings and, if `/use_sim_time` ever
  disagrees between the two sides, silent staleness rather than an obvious error.

## Local vs. cloud, per Unit

Every Unit runs the **entire** server stack itself (its own backend, rosbridge, MySQL, MQTT broker,
and dashboard build), in addition to the cloud link rather than as an alternative to it. Both MQTT
bridges (local and cloud) run unconditionally. This means:

- A Unit works fully offline for local operation.
- A Unit's *identity and accounts* still come only from the cloud: it cannot start until it has
  enrolled at least once (see [Unit Setup](/setup/unit-setup)), after which it boots from a cached
  identity regardless of connectivity.
- A single lease state machine on the robot (`system_command.py`) arbitrates between a local operator
  and a cloud operator: there's one "who's driving" answer, not two independent ones.

## Related

- [Repository Structure](/development/repository-structure)
- [API Reference](/development/api-reference)
- [System Setup](/setup/system-setup): the deployment-time view of these same components
