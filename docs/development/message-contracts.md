---
outline: deep
search: false
---

# Message Contracts

<RoleBadge role="developer" />

This document provides the complete, authoritative specification for all machine-to-machine data payloads in the MSD700 system. It covers the MQTT command and feedback channels, serialized ROS streaming topics, the operation supervisor synchronization protocol, WebRTC signalling, and the hardware enrolment exchange.

For the HTTP surface, see [API Reference](/development/api-reference). For finite state machines, see [State and Behavior](/development/state-and-behavior). For the overall system design, see [Architecture](/development/architecture).

::: info Contract Verification Notice
Payload shapes are derived directly from active source code (`backend_node`, `system_command.py`, `operation_supervisor.py`, `topic2string`, `enroll_api.js`). Any field changes in the codebase must be updated here in the same commit.
:::

## Communication Surfaces

Every machine-to-machine interface in MSD700, and where its contract is specified. This page is the
authoritative reference for all of them; the two links point at the pages that own the HTTP and
rosbridge detail so it is not duplicated here.

| Surface | Transport | Direction | Contract |
| --- | --- | --- | --- |
| Command and feedback | MQTT 3.1.1 over TLS 8883 | cloud ↔ robot | [Command and Control Channel](#command-and-control-channel) |
| Telemetry, overlays and ACKs | MQTT → cloud ROS → rosbridge | robot → browser | [Telemetry and Overlay Topics](#telemetry-and-overlay-topics) |
| Watchdog ping / pong | MQTT over TLS 8883 | robot → cloud | [Watchdog Ping and Pong](#watchdog-ping-and-pong) |
| Presence and egress profiles | robot-local ROS | robot-internal | [Presence and Egress Profiles](#presence-and-egress-profiles) |
| Map delivery and control | MQTT, robot ROS services | both | [Map delivery](#map-delivery) |
| Operation supervisor | MQTT | both | [Operation Supervisor Synchronization](#operation-supervisor-synchronization) |
| Robot enrolment | HTTPS (device secret) | robot → cloud | [Robot Enrolment Handshake](#robot-enrolment-handshake) |
| Hardware link | rosserial over USB serial | STM32 ↔ Jetson | [Firmware Link (rosserial)](#firmware-link-rosserial) |
| WebRTC signalling | WSS | browser ↔ signalling_server | [WebRTC Signalling](#webrtc-signalling) |
| Camera video | WebRTC (SRTP) | robot → browser | [WebRTC Signalling](#webrtc-signalling) |
| Fleet HTTP API | HTTPS (REST) | browser / robot → cloud | [API Reference](/development/api-reference) |
| rosbridge WebSocket | WSS | browser ↔ cloud ROS | [rosbridge Protocol](/development/rosbridge-protocol) |
| Media assets | HTTPS | browser ↔ media-server | [Media Server Reference](/development/webui/database/media-server-reference) |

## Fleet Addressing Scheme

Every physical robot is addressed by a unique prefix: `/unit_<ULID>/...`. The ULID (Universally Unique Lexicographically Sortable Identifier) is the primary key assigned to the robot in the central `units` database table upon registration.

![Fleet Addressing Scheme](./diagrams/message-contracts-fleet-addressing-scheme.drawio)

| Hop Location | Topic Format | Engineering Purpose |
| --- | --- | --- |
| **Robot Local ROS Master** | `/string/robotpose` | Unscoped local namespace (one robot per onboard roscore). |
| **Central MQTT Broker** | `/unit_<ULID>/string/robotpose` | Fleet-scoped topic namespace multiplexing all robots over HiveMQ. |
| **Cloud ROS Master** | `/unit_<ULID>/string/robotpose` | Namespaced topic consumed by per-unit cloud relays and rosbridge. |

::: warning Mandatory `unit_` Prefix Rule
ROS graph resource names must begin with an alphabetic character, a tilde, or a forward slash. Because ULIDs begin with numbers (e.g. `01JZ...`), `/01JZ.../string/map` is invalid syntax and rejected by ROS. The `unit_` prefix ensures strict ROS compliance while maintaining a 1:1 mapping with MQTT topics.
:::

## Command and Control Channel

Two dedicated MQTT topics handle all bidirectional request and response interactions between the cloud server and a physical unit:

| MQTT Topic | Direction | Producer Node | Consumer Node | Description |
| --- | --- | --- | --- | --- |
| `/unit_<ULID>/system_command` | Cloud to Robot | `backend_node` (Express) | `system_command.py` (ROS) | Dispatches control commands, navigation goals, and mode changes. |
| `/unit_<ULID>/system_feedback` | Robot to Cloud | `system_command.py` (ROS) | `backend_node` (Express) | Returns execution status, error messages, and telemetry pings. |

### Command Payload Envelope

```json
{
  "header": "navigation",
  "command": "pointstamped",
  "config": {
    "resource": {
      "X": 3.1416,
      "Y": -1.2,
      "Z": 0.0
    }
  },
  "metadata": {
    "timestamp": "2026-08-12T04:11:52.913Z",
    "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10"
  }
}
```

| Field Name | Type | Mandatory | Description |
| --- | --- | --- | --- |
| `header` | string | Yes | Target subsystem handler: `hardware`, `navigation`, `mapping`, `boustrophedon`, `manual`, `autopilot`, `emergency_stop`, `autoalign`. |
| `command` | string | Yes | Specific action verb within the handler. Unrecognized verbs are logged and dropped. |
| `config` | object | Conditional | Command parameters (typically inside `config.resource`). |
| `data` | object | Conditional | Alternate parameter block used by `hardware.ping`. |
| `metadata.request_id` | UUID v4 | Yes | Unique correlation token generated per HTTP request by `backend_node`. |
| `metadata.timestamp` | ISO 8601 | Yes | Sender timestamp string for diagnostic tracing. |

### Feedback Payload Envelope

```json
{
  "header": "navigation",
  "command": "pointstamped",
  "data": {
    "status": true,
    "message": "Goal published to move_base"
  },
  "metadata": {
    "timestamp": 1786503112.913,
    "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10"
  }
}
```

| Field Name | Type | Description |
| --- | --- | --- |
| `data.status` | boolean | `true` indicates command accepted/executed; `false` indicates execution rejection. |
| `data.message` | string | Human-readable diagnostic description from the robot. |
| `metadata.timestamp` | float | Wall-clock epoch seconds (`rospy.get_time()`) from the robot. |
| `metadata.request_id` | UUID v4 | Matches the original `request_id` from the command envelope. |

### Command Correlation and Retry Architecture

![Command Correlation and Retry Architecture](./diagrams/message-contracts-command-correlation-and-retry-architectu.drawio)

| Parameter | Default Value | Config Location | Purpose |
| --- | --- | --- | --- |
| `DEFAULT_TIMEOUT` | `30000` ms (30 s) | `backend_node` | Maximum duration an HTTP request waits for feedback before responding with `504 Gateway Timeout`. |
| `COMMAND_RETRY_INTERVAL` | `1500` ms (1.5 s) | `backend_node` | Resend period while a mutating command remains unacknowledged. |

::: danger Ping Heartbeat Exclusion
`header: "hardware", command: "ping"` is transmitted strictly **once** per interval and is never retried. Heartbeat loss is the primary trigger for the robot safety watchdog. Retrying lost pings would mask network dropouts and defeat the automatic emergency stop mechanism.
:::

## Command Reference Catalogue

### 1. Hardware Subsystem (`header: "hardware"`)

```json
// Command: "check"
{ "header": "hardware", "command": "check", "metadata": { ... } }

// Command: "idle"
{ "header": "hardware", "command": "idle", "metadata": { ... } }
```

| Command Verb | Payload Content | Purpose |
| --- | --- | --- |
| `ping` | See [Heartbeat Ping Section](#heartbeat-ping-and-lease-contract) | Heartbeat, lease acquisition, telemetry retrieval, and watchdog refresh. |
| `heartbeat` | `{ "page": "navigation" }` only. Published by the browser at 5 Hz, QoS 0, over MQTT-over-WebSocket straight to the unit's Mosquitto (local dashboard only) | Presence proof for the 2 s watchdog tier. Grants nothing: no lease, no claim/release, no `origin`, no feedback. See [Safety Watchdog](/development/ros/safety-watchdog#two-presence-signals). |
| `check` | None | Queries status of low-level motor drivers and microcontrollers. |
| `init` | None | Initialises hardware interfaces and power lines. |
| `stop` | None | Shuts down hardware peripherals and power stages. |
| `idle` | None | Tears down running navigation/mapping nodes while keeping robot powered. |
| `battery_update` | `{ "config": { ... } }` | Manually updates power telemetry levels. |

### 2. Navigation Subsystem (`header: "navigation"`)

```json
// Command: "init"
{
  "header": "navigation",
  "command": "init",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "default_save_path": "/home/ubuntu/ros_maps",
      "homebase_x": 1.25,
      "homebase_y": -0.5,
      "homebase_z": 0.0,
      "homebase_ox": 0.0,
      "homebase_oy": 0.0,
      "homebase_oz": 0.0,
      "homebase_ow": 1.0
    }
  },
  "ensure_unpaused": true
}

// Command: "pointstamped" (Single Goal)
{
  "header": "navigation",
  "command": "pointstamped",
  "config": {
    "resource": { "X": 3.1416, "Y": -1.2, "Z": 0.0 }
  }
}
```

- `map_name`: The map ULID identifier corresponding to `<ULID>.pgm` and `<ULID>.yaml` on disk.
- `ensure_unpaused: true`: Instructs the robot to automatically clear any standing `/emergency_pause` lock when launching navigation.
- `command: "deactivate"`: Terminates the active navigation stack (takes no payload).

### 3. Mapping Subsystem (`header: "mapping"`)

```json
// Command: "stop" (Save and Upload Map)
{
  "header": "mapping",
  "command": "stop",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "display_map_name": "Production Hall Level 1",
      "map_ulid": "01JZ8QK2H0000000000000MAP",
      "created_by": "01JZ7YV5CQUSER00000000000",
      "unit_id": "01JZ8P9WZ0UNIT00000000000",
      "homebase_x": 1.2,
      "homebase_y": 0.5,
      "homebase_z": 0.0,
      "homebase_ox": 0.0,
      "homebase_oy": 0.0,
      "homebase_oz": 0.0,
      "homebase_ow": 1.0
    }
  }
}
```

Mapping command verbs:

| Command Verb | Payload | Purpose |
| --- | --- | --- |
| `start` | none (only `metadata`) | Begins a SLAM run, after checking the robot can actually store a map. |
| `pause` | none | Holds the motion lock; the SLAM session stays open. |
| `stop` | the `config.resource` block above | Saves the map locally and pushes it to the cloud, then reports through the progress stream below. |
| `discard` | none | Switches the robot to `idle` without saving, dropping the SLAM session. |

Saving a SLAM map takes longer than the standard 30-second HTTP timeout. Therefore, `mapping stop` immediately returns an HTTP 200 with `{ request_id, map_ulid }`. The frontend connects to an SSE stream on `GET /api/mapping/progress/:request_id` to monitor progress.

#### Mapping Progress Feedback (`header: "mapping_progress"`)

```json
{
  "header": "mapping_progress",
  "command": "stop",
  "data": {
    "status": true,
    "progress": 100,
    "stage": "completed",
    "message": "Saved on the robot and the server.",
    "terminal": true,
    "outcome": "completed"
  },
  "metadata": {
    "timestamp": 1734000000.0,
    "request_id": "..."
  }
}
```

| Outcome Value | Description |
| --- | --- |
| `completed` | Successfully written to both the local Unit media-server and the cloud server. |
| `cloud_pending` | Written to local Unit media-server only. Cloud replication will complete on the next sync interval. |
| `failed` | Mapping save failed. Session remains open for retry. |

### 4. Boustrophedon Area Coverage (`header: "boustrophedon"`)

```json
// Command: "init"
{
  "header": "boustrophedon",
  "command": "init",
  "config": {
    "use_autocover": false,
    "polygon": [
      { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 },
      { "x": 10.0, "y": 5.0 }, { "x": 0.0, "y": 5.0 }
    ],
    "areas": [
      [ { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 }, { "x": 10.0, "y": 5.0 }, { "x": 0.0, "y": 5.0 } ]
    ],
    "exclusions": [
      [ { "x": 3.0, "y": 2.0 }, { "x": 5.0, "y": 2.0 }, { "x": 5.0, "y": 4.0 }, { "x": 3.0, "y": 4.0 } ]
    ],
    "ensure_unpaused": true
  }
}
```

- `areas`: Ordered array of polygons forming the target operation playlist.
- `exclusions`: Keep-out obstacle zones subtracted from coverage sweeps.
- `command: "pause"`: Accepts `{ "pause": true }` or `{ "pause": false }`.
- `command: "deactivate"`: Stops coverage planning.

### 5. Auto-Align (`header: "autoalign"`)

Payload-less commands (only `metadata`); each answers with `data.status` / `data.message`.

| Command Verb | Purpose |
| --- | --- |
| `start` | Calls the `/alignment/start` service to solve the robot pose against the map. Sets activity `auto_aligning`. |
| `reset` | Calls `/alignment/reset`, discarding the solve and returning to navigation. |
| `status` | Calls `/check_alignment`; a read-only query, no activity change. |

### 6. Emergency Stop (`header: "emergency_stop"`)

| Command Verb | Payload | Purpose |
| --- | --- | --- |
| `activate` | none | Publishes `std_msgs/Bool(true)` on the emergency-stop topic, switches the stack to `idle`, and calls `/map/reset`. |
| `deactivate` | none | Publishes `std_msgs/Bool(false)` and clears the stop; the motion stack is not restarted. |

### 7. Manual Override (`header: "manual"`)

Teleop is a non-destructive control overlay: it does **not** call `/switch_mode`, so the navigation
stack stays up. The browser sends `Twist` over `/unit_<ULID>/string/key_vel` (see
[Telemetry and Overlay Topics](#telemetry-and-overlay-topics)).

| Command Verb | Payload | Purpose |
| --- | --- | --- |
| `enable` | none | Cancels autonomous motion (pausing coverage through its own service), releases the emergency-pause lock, and opens the manual mux channel. |
| `disable` | none | Zeroes and releases the manual mux channel, so the robot stops the moment control is released, then restores the previous activity. |

### 8. Autopilot (`header: "autopilot"`)

| Command Verb | Payload | Purpose |
| --- | --- | --- |
| `enable` | none | Hands waypoint sequencing to `operation_supervisor` and suspends the ping-loss watchdog; it releases only the watchdog's own hold, never an operator pause. |
| `disable` | none | Returns sequencing to the browser loop and re-arms the ping-loss watchdog. |

## Heartbeat Ping and Lease Contract

The heartbeat ping message manages the robot operating lease, the safety watchdog timer, and status telemetry.

### Request Payload (`data` block)

```json
{
  "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
  "user_id": "01JZ7YV5CQUSER00000000000",
  "claim": true,
  "release": false,
  "page": "navigation",
  "origin": "cloud",
  "force_takeover": false
}
```

| Parameter | Source | Description |
| --- | --- | --- |
| `session_id` | Browser tab | Unique UUID per browser tab. |
| `user_id` | Backend JWT | Extracted strictly from the authenticated JWT token by the server backend. |
| `claim` | Browser | `true` from operational pages (Navigation, Mapping); `false` when browsing the read-only fleet list. |
| `release` | Browser | Explicitly relinquishes the operating lease upon page exit. |
| `page` | Browser | Origin page: `dashboard`, `login`, `navigation`, `mapping`. |
| `origin` | Backend env | `cloud` or `local`, determined by server configuration. |
| `force_takeover` | Browser | `true` when operator confirms taking over an existing lease. |

### Response Payload (`data` block)

```json
{
  "status": true,
  "robot_activity": "navigation_point_published",
  "active_page": "navigation",
  "battery": 87.5,
  "uptime": 42.3,
  "hw_status": "ready",
  "manual_override": false,
  "autopilot": false,
  "active_map_id": "01JZ8QK2H0000000000000MAP",
  "in_use": false,
  "in_use_by": null,
  "origin_conflict": false,
  "origin_conflict_side": null
}
```

| Response Field | Description |
| --- | --- |
| `robot_activity` | Filtered activity state (e.g. `idle`, `navigating`, `mapping`, `stuck`). |
| `active_page` | Raw active page before stuck-detector evaluation, ensuring correct routing. |
| `battery` | Battery state of charge percentage (float). |
| `uptime` | System uptime in minutes. |
| `hw_status` | Status reported by hardware monitoring subsystem (`ready`, `fault`). |
| `manual_override` | `true` when manual teleop mode is engaged. |
| `autopilot` | `true` when autonomous autopilot sequencer is active. |
| `in_use` | Account-level lock: indicates another user account holds the lease. |
| `origin_conflict` | Session-level conflict: indicates another tab of the same account is active. |

## Telemetry and Overlay Topics

Telemetry is serialized to JSON strings on the unit via `topic2string`, routed over MQTT, and
converted back to typed ROS messages on the server for `rosbridge`. The browser never speaks MQTT
for these: it subscribes through `rosbridge` (see [rosbridge Protocol](/development/rosbridge-protocol)).

![Streaming Telemetry Topics](./diagrams/message-contracts-streaming-telemetry-topics.drawio)

### Telemetry Stream Definitions

| Robot Topic | Cloud Server Topic | Update Rate | Content Description |
| --- | --- | --- | --- |
| `/string/robotpose` | `/unit_<ULID>/server/robot_pose` | 25 Hz | Robot position and orientation in `map` frame (`geometry_msgs/PoseStamped`). |
| `/string/map` | `/unit_<ULID>/server/slam/map` | On change, plus a heartbeat | Compressed occupancy grid, `base64(zlib(M1))` with the cells packed as raw int8. The older `base64(zlib(JSON))` form is still accepted by the decoder. See [Map delivery](#map-delivery). |
| `/string/laserscan` | `/unit_<ULID>/server/scan` | 2 Hz | Compressed 2D laser scan data (`sensor_msgs/LaserScan`). |
| `/string/move_base/NavfnROS/plan` | `/unit_<ULID>/server/move_base/NavfnROS/plan` | On plan | Global path coordinates (`nav_msgs/Path`). |
| `/string/move_base/TebLocalPlannerROS/local_plan` | `/unit_<ULID>/server/move_base/TebLocalPlannerROS/local_plan` | Continuous | Local trajectory (`nav_msgs/Path`). |
| `/string/boustrophedon_path` | `/unit_<ULID>/server/boustrophedon_path` | On plan | Coverage sweep line coordinates (`nav_msgs/Path`). |
| `/string/operation_snapshot` | `/unit_<ULID>/string/operation_snapshot` | Latched | Full active mission snapshot for reconnect recovery. |

Rates are the node defaults. Several are gated per egress profile (idle / watching / driving) in
`topic2string/config/egress.yaml`; see [Presence and Egress Profiles](#presence-and-egress-profiles).

### Complete Bridge Topic Map

The cloud relay (`gen_bridge_params.py` / `nakayama_cloud_multi.launch`) carries the topics below for
every unit in the fleet, using the same names the per-unit bridge used. All payloads are JSON strings
in `std_msgs/String` unless noted.

Robot to cloud:

| Topic (`/unit_<ULID>/...`) | Content | Latched on the relay |
| --- | --- | --- |
| `string/robotpose` | Pose in the `map` frame. | no |
| `string/map` | Compressed occupancy grid (see [Map delivery](#map-delivery)). | yes |
| `string/laserscan` | Compressed 2D laser scan. | no |
| `string/laserscan_holes` | Hole / drop-off overlay drawn on the scan. | no |
| `string/hazard_cells` | Cumulative hole trail for the current run. | yes |
| `string/move_base/NavfnROS/plan` | Global plan overlay. | yes |
| `string/move_base/TebLocalPlannerROS/local_plan` | Local trajectory overlay. | yes |
| `string/boustrophedon_path` | Coverage path overlay (accumulated). | yes |
| `string/coverage_debug` | Coverage planner diagnostics. | yes |
| `string/uncovered_regions` | Unswept regions. | yes |
| `string/coverage_status` | Coverage lifecycle events. | yes |
| `string/move_base/status` | Goal status stream (`actionlib_msgs/GoalStatusArray`). | no |
| `string/move_base/result` | Goal result; reliable delivery closed by `result_ack`. | no |
| `string/operation_progress` | Operation supervisor progress. | no |
| `string/operation_snapshot` | Latched full-operation snapshot. | yes |
| `string/skipped_waypoints` | Waypoints a run could not reach. | no |
| `server/pong` | Watchdog reply (see [Watchdog Ping and Pong](#watchdog-ping-and-pong)). | no |

Cloud to robot:

| Topic (`/unit_<ULID>/...`) | Content | Note |
| --- | --- | --- |
| `server/ping` (MQTT `msd/ping`) | Watchdog ping. The one asymmetric pair: the ROS name is `server/ping`, the MQTT name is `msd/ping`. | see below |
| `string/move_base/goal` | Navigation goal. | |
| `string/move_base/cancel` | Cancel the active goal. | |
| `string/initialpose` | Reset AMCL's initial pose. | |
| `string/move_base/result_ack` | Reliability ACK for `move_base/result`. | |
| `string/boustrophedon_path_ack` | Reliability ACK for the coverage path. | |
| `string/key_vel` | Manual teleop `Twist` as JSON (WASD). | 0.5 s timeout zeroes the robot |
| `string/operation_sync` | Operation supervisor batch/progress/takeover. | see [Operation Supervisor Synchronization](#operation-supervisor-synchronization) |
| `string/map_request` | "I have no map, send me one" (pull channel). | rate-limited on the robot |

## Watchdog Ping and Pong

Independent of the `hardware.ping` command, the robot publishes a periodic presence ping that the
cloud uses to mark a unit online. On the robot it is ROS `/msd/ping`; on the cloud side the bridge
maps ROS `/unit_<ULID>/server/ping` to MQTT `/unit_<ULID>/msd/ping` (the single asymmetric pair in
the bridge), and the reply returns as `/unit_<ULID>/server/pong`. The exact per-unit mapping lives in
`aws_mqtt/launch/nakayama_msd.launch` and `nakayama_cloud.launch`; the fleet relay reproduces it in
`gen_bridge_params.py`.

## Presence and Egress Profiles

To keep an idle robot from spending bandwidth, `system_command.py` publishes a latched
`std_msgs/String` on the robot-local `/msd700/viewers` topic once a second with one of three
profiles: `idle`, `watching`, or `driving`. It never leaves the unit. `topic2string`'s
`presence_gate.py` reads it to throttle egress per `topic2string/config/egress.yaml` (for example
`laserscan` drops to 0 Hz when idle, the map's heartbeat stretches to 300 s, and planner overlays
stop entirely); when the signal is missing or stale, every gate fails open at full rate.

### Map delivery

The map is the largest payload on the link and the only one an operator cannot work without, so it
is the one stream that does not simply repeat. The robot content-hashes the grid and sends it only
when it actually changes, plus a heartbeat every 60 s while somebody is watching and every 300 s
while nobody is. In navigation mode the grid comes from `map_server` and never changes at all, so
in practice that is one message per heartbeat.

That leaves a single message to carry something a browser cannot do without, over a QoS 0 hop with
no broker retain. Three mechanisms make it survivable, and none of them is optional:

| Mechanism | Where | What it covers |
| --- | --- | --- |
| The cloud relay latches `/unit_<ULID>/string/map` | `aws_mqtt/scripts/gen_bridge_params.py` | A browser that connects between two sends, and a relay that restarts (which happens whenever the fleet roster changes). |
| A burst of `burst_sends` repeats, `burst_interval` apart, after a map reset or retire | `topic2string/src/nodelets/map_compression.cpp` (Python twin: `scripts/map_compression_pipeline.py`) | The map an operator just opened, delivered at the exact moment the robot is restarting its navigation stack. Starting a new mapping run is covered too. |
| The pull channel `/string/map_request` | Browser to robot, same path as the ACK topics | Everything else: a dropped packet, a dashboard whose page mounted at the wrong instant, a local-mode relay that ate the first message while learning the topic type. |

The dashboard publishes a `std_msgs/String` on `/unit_<ULID>/string/map_request` as soon as the
Navigation canvas mounts, and keeps asking until a map is drawn. The robot rate-limits requests
(`request_min_interval`, default 2 s), so several tabs on one unit cost one extra send rather than
one each.

A **0x0 grid is not a corrupt message**. The robot publishes one to retire the grid the relay is
latching: without it, a dashboard that has just opened a *different* map would be handed the
previous session's room and draw it with full confidence. The canvas treats it as "no map yet",
shows that it is loading, and asks for the new one.

The compressor advertises two services, and the difference between them is which situation it is:

| Service | Called from | Effect |
| --- | --- | --- |
| `/map/reset` | Mapping stopped or discarded, navigation deactivated, emergency stop | The robot forgets its map. Whatever the dashboard is already drawing is left alone, because the operator is on their way out of that page and blanking their canvas buys nothing. |
| `/map/retire` | `navigation.init` only | The same, plus the 0x0 sentinel. This is the one case where the latched copy is actively wrong: a different map was just opened. |

Both arm the burst. A robot that predates `/map/retire` falls back to a plain reset, so a rolling
deploy loses the stale-map fix rather than the reset itself.

::: warning
Do not lengthen `change_heartbeat` in `topic2string/config/egress.yaml` without checking all three
mechanisms above are still in place. With change-gating alone and none of them, a dashboard that
missed the send waited a measured ~52 s for the next one.
:::

## Operation Supervisor Synchronization

`operation_supervisor.py` manages autonomous mission execution on the robot so that missions continue uninterrupted if the browser tab is closed.

![Operation Supervisor Synchronization](./diagrams/message-contracts-operation-supervisor-synchronization.drawio)

### Operation Sync Payload (`/string/operation_sync`)

```json
{
  "type": "batch",
  "operation": "multi_pinpoint",
  "route_mode": "round-trip",
  "waypoints": [
    {
      "position": { "x": 1.0, "y": 2.0, "z": 0.0 },
      "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
    },
    {
      "position": { "x": 4.5, "y": 2.0, "z": 0.0 },
      "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
    }
  ],
  "current_index": 0,
  "map_name": "01JZ8QK2H0000000000000MAP",
  "coverage": null,
  "timestamp": 1786503112.913
}
```

| Action Type (`type`) | Purpose |
| --- | --- |
| `batch` | Uploads full waypoint sequence when mission starts. |
| `progress` | Updates current waypoint index during operator-guided runs. |
| `takeover` | Engages Autopilot mode, handing waypoint sequencing to supervisor. |
| `release` | Disengages Autopilot mode, returning control to browser loop. |
| `pause` | Pauses execution while preserving the waypoint queue. |
| `stop` | Stops mission and clears the waypoint batch. |
| `resync` | Requests an immediate re-broadcast of the mission snapshot. |

## WebRTC Signalling

The signalling server (`signalling_server`, `wss://<host>/services/signalling`) relays WebRTC
negotiation between a browser peer and the camera peer (`camera_client.py`). A client authenticates,
then every message carries a `type` and a `target` peer id; the server forwards it to that peer.
There is no media through this channel - only SDP and ICE.

| `type` | Direction | Payload | Purpose |
| --- | --- | --- | --- |
| `authenticate` | client → server | `{ type, token }` | First message. The server verifies the JWT and answers `auth_success` (`userId`) or `auth_error`. |
| `offer` | peer → target | `{ type, target, offer }` | SDP offer. |
| `answer` | peer → target | `{ type, target, answer }` | SDP answer. |
| `candidate` | peer → target | `{ type, target, candidate }` | ICE candidate. |
| `client_ready` | peer → target | `{ type, target, ... }` | Readiness beacon, forwarded to the target. |
| `ping` | client → server | `{ type }` | Keepalive; the server replies `{ type: "pong" }`. |
| `error` | server → client | `{ type, message }` | Relay or validation error. |
| `server_shutdown` | server → all | `{ type, message }` | Graceful shutdown notice. |

The camera peer answers an `offer` with local video from the robot camera over SRTP; see
[Camera Streaming](/development/webui/camera/overview) for the device and bitrate behaviour.

## Firmware Link (rosserial)

The STM32H7 firmware (`firmware-msd700`) talks to the Jetson over rosserial on a USB serial link.
Two topics, both defined in `msd700_msgs`:

| Topic | Direction | Type | Content |
| --- | --- | --- | --- |
| `/hardware_state` | STM32 → Jetson | `msd700_msgs/HardwareState` | Eight ultrasonic distances, left/right motor pulse deltas, heading/pitch/roll, accelerometer/gyro/magnetometer triples, and UWB distance/deviation/rho/theta. |
| `/hardware_command` | Jetson → STM32 | `msd700_msgs/HardwareCommand` | `movement_command`, `cam_angle_command`, `right_motor_speed`, `left_motor_speed`. |

This is the low-level half of the `hardware` command handler: `hardware.check`, `hardware.init` and
`hardware.stop` drive this link, and `hardware_state` feeds the robot's odometry and sensor fusion.

## Robot Enrolment Handshake

Unenrolled robots register themselves with the cloud server via a secure three-stage cryptographic handshake.

![Robot Enrolment Handshake](./diagrams/message-contracts-robot-enrolment-handshake.drawio)

::: tip Nonce Security Purpose
The 32-byte secret nonce guarantees that MAC address spoofing cannot hijack an approved robot registration while the physical robot is powered off. The device secret is transmitted only when the genuine robot reveals the original plaintext nonce matching the pre-registered hash.
:::

## Related Documentation

- [API Reference](/development/api-reference): the fleet HTTP/REST surface.
- [rosbridge Protocol](/development/rosbridge-protocol): the WebSocket JSON protocol and canvas rendering.
- [Media Server Reference](/development/webui/database/media-server-reference): map asset HTTP routes.
- [Camera Streaming](/development/webui/camera/overview): the WebRTC video pipeline.
- [State and Behavior](/development/state-and-behavior): state machines and failure transitions.
- [Architecture](/development/architecture): system topology and trust boundaries.
