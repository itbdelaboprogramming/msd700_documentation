---
outline: deep
search: false
---

# Message Contracts

<RoleBadge role="developer" />

Every payload that crosses a process boundary in MSD700 is specified in this section: the HTTP API
the web dashboard calls, the MQTT command channel between the cloud and a unit, the ROS topics the
bridge carries, the rosbridge WebSocket the browser draws from, the operation supervisor protocol,
WebRTC signalling, the firmware link and the enrolment handshake.

Terms used throughout: a **unit** is one registered robot as the software sees it (a row in `units`,
addressed as `/unit_<ULID>`); the **robot** is the physical machine. There is no separate group
object above units.

::: info Contract verification
Shapes are taken from the running source (`backend_node`, `system_command.py`,
`operation_supervisor.py`, `topic2string`, `aws_mqtt`, `media-server`, the dashboard's `src/`).
A change to any field in the code must be reflected here in the same commit.
:::

## Pages in this section {#pages}

| Page | Transport | What it specifies |
| --- | --- | --- |
| [HTTP API (Web)](/development/message-contracts/http-api) | HTTPS REST, SSE | Every endpoint the dashboard, admin console and robot call on `backend_node` and `media-server` |
| [MQTT Commands](/development/message-contracts/mqtt-commands) | MQTT 3.1.1 over TLS 8883 | `system_command` / `system_feedback` envelope, retry, and every `header`/`command` pair |
| [Heartbeat & Lease](/development/message-contracts/heartbeat-and-lease) | HTTP → MQTT, MQTT over WebSocket | `hardware.ping` lease fields, the 5 Hz `hardware.heartbeat` frame |
| [Bridge Topics (MQTT ↔ ROS)](/development/message-contracts/bridge-topics) | MQTT, ROS | The full robot ↔ cloud topic map, JSON string formats, map delivery, egress profiles |
| [rosbridge (WebSocket)](/development/message-contracts/rosbridge) | WSS | What the browser subscribes to, publishes, and sends through the `move_base` action client |
| [Operation Sync](/development/message-contracts/operation-sync) | ROS over MQTT | `operation_sync`, `operation_progress`, `operation_snapshot` |
| [WebRTC Signalling](/development/message-contracts/webrtc-signalling) | WSS, SRTP | Camera negotiation messages |
| [Firmware & Enrolment](/development/message-contracts/firmware-and-enrolment) | rosserial, HTTPS | STM32 ↔ Jetson topics, the `/enroll` handshake |

## Two control paths {#two-control-paths}

An operator action reaches the robot along one of two paths, and knowing which one an action uses is
most of what it takes to trace it.

![Two Control Paths](./diagrams/message-contracts-two-control-paths.drawio)

- **Path A, command channel.** The browser calls an HTTP endpoint; `backend_node` wraps it in a
  `system_command` envelope, publishes it over MQTT, and holds the HTTP request open until the
  matching `system_feedback` arrives (or 30 s pass). Used for anything that changes mode or needs a
  yes/no answer: navigation init, mapping start/save, coverage start/pause/stop, manual override,
  autopilot, emergency stop, auto align. See [MQTT Commands](/development/message-contracts/mqtt-commands).
- **Path B, streaming channel.** The browser publishes and subscribes through rosbridge on the
  cloud's ROS master. `topic2string` relays turn typed messages into JSON strings, the MQTT bridge
  carries them, and the robot's `topic2string` turns them back into typed messages. Used for
  navigation goals, teleop, ACKs, operation sync, and every overlay drawn on the map. See
  [rosbridge](/development/message-contracts/rosbridge) and
  [Bridge Topics](/development/message-contracts/bridge-topics).

Data that never touches the robot (maps list, routes, areas, playlists, accounts) is plain HTTP to
`backend_node` or `media-server` and ends in MySQL or on disk.

## Unit addressing {#unit-addressing}

Every unit is addressed by the prefix `/unit_<ULID>`, where the ULID is the primary key of its row in
`units`. `GET /unit/all` hands the browser a ready-made `topic_root` so the dashboard never has to
build the prefix itself.

![Unit Addressing Scheme](./diagrams/message-contracts-unit-addressing-scheme.drawio)

| Hop | Topic form | Notes |
| --- | --- | --- |
| Robot ROS master | `/string/robotpose` | Unprefixed: one robot per onboard `roscore`. |
| MQTT broker | `/unit_<ULID>/string/robotpose` | The robot's `aws_mqtt` bridge adds the prefix. |
| Cloud ROS master | `/unit_<ULID>/string/robotpose`, then `/unit_<ULID>/server/robot_pose` | The unit relay keeps the prefix and republishes a typed topic under `server/`. |

::: warning Why the `unit_` prefix is mandatory
ROS graph names must start with a letter, `~` or `/`. ULIDs start with a digit (`01JZ...`), so
`/01JZ.../string/map` is rejected by ROS. The prefix keeps a 1:1 mapping between MQTT and ROS names.
:::

## Action trace {#action-trace}

Each row is one thing an operator does in the dashboard, with every message it causes. Follow a link
to the exact contract. Actions marked *client only* send nothing until a later action (usually
Play) uses what they prepared.

### Session and unit list {#trace-session}

| Action | Browser sends | Robot side | Answer comes back as |
| --- | --- | --- | --- |
| Log in | [`POST /user/login`](/development/message-contracts/http-api#user-login) | none | tokens in the HTTP body |
| Token refresh | [`POST /user/refresh`](/development/message-contracts/http-api#user-refresh) | none | new token pair |
| Open the unit list | [`GET /unit/all`](/development/message-contracts/http-api#unit-list), then [`POST /api/hardware/ping`](/development/message-contracts/http-api#hardware-ping) per unit with `claim: false` | [`hardware.ping`](/development/message-contracts/heartbeat-and-lease#ping-request) | [ping response](/development/message-contracts/heartbeat-and-lease#ping-response) inside `details.data` |
| Stay on an operating page | [`hardware.ping`](/development/message-contracts/heartbeat-and-lease#ping-request) with `claim: true` every second, [`POST /api/unit/heartbeat`](/development/message-contracts/http-api#unit-heartbeat) every 15 s; on the unit's local dashboard also the [5 Hz `hardware.heartbeat`](/development/message-contracts/heartbeat-and-lease#heartbeat-frame) | lease refresh, watchdog tiers | lease state in the ping response |
| Leave an operating page | ping with `release: true`, `page: "other"` | lease released | none (fire and forget) |
| Take over from another session | ping with `force_takeover: true` | lease handed over | `in_use`, `origin_conflict` cleared |
| Log out | [`POST /api/hardware/idle`](/development/message-contracts/http-api#hardware-commands) (not in autopilot), [`POST /user/logout`](/development/message-contracts/http-api#user-logout) | [`hardware.idle`](/development/message-contracts/mqtt-commands#hardware) | `{ success, remaining, retained }` |

### Navigation page {#trace-navigation}

| Action | Browser sends | Robot side | Answer comes back as |
| --- | --- | --- | --- |
| Open a map for navigation | [`POST /api/navigation/init`](/development/message-contracts/http-api#navigation-init) | [`navigation.init`](/development/message-contracts/mqtt-commands#navigation): `/switch_mode(navigation)`, `/map/retire`, home base to `/initialpose` | HTTP 200; the map then arrives on [`server/slam/map`](/development/message-contracts/rosbridge#subscriptions) after a [`map_request`](/development/message-contracts/bridge-topics#map-delivery) |
| Place a pinpoint, add waypoints, Delete All Pinpoints | *client only* | none | none |
| Play, single pinpoint | [`move_base` goal](/development/message-contracts/rosbridge#move-base-action) on `server/move_base/goal`, [`operation_sync` `batch`](/development/message-contracts/operation-sync#batch) with `single_pinpoint` | [`string/move_base/goal`](/development/message-contracts/bridge-topics#json-goal) → `/move_base/goal` | [`server/move_base/status` and `/result`](/development/message-contracts/rosbridge#move-base-action), each result ACKed on [`result_ack`](/development/message-contracts/bridge-topics#acks) |
| Play, multiple pinpoints (Basic, Round Trip, Loop) | one goal per waypoint, [`batch`](/development/message-contracts/operation-sync#batch) with `multi_pinpoint` and `route_mode`, [`progress`](/development/message-contracts/operation-sync#progress) per waypoint, [`complete`](/development/message-contracts/operation-sync#stop-complete) at the end | same as above, per waypoint | same as above |
| Pause | goal cancel on [`server/move_base/cancel`](/development/message-contracts/rosbridge#move-base-action), [`operation_sync` `pause`](/development/message-contracts/operation-sync#pause) | [`string/move_base/cancel`](/development/message-contracts/bridge-topics#json-cancel) → `/move_base/cancel` | goal status `PREEMPTED` |
| Stop | goal cancel, [`operation_sync` `stop`](/development/message-contracts/operation-sync#stop-complete) | same as Pause, batch cleared | goal status, [snapshot](/development/message-contracts/operation-sync#snapshot) with `active: false` |
| Save Route | [`POST /api/routes`](/development/message-contracts/http-api#routes), then [`POST /api/media/uploadRouteImage`](/development/message-contracts/http-api#media-server) | none | `201 { data: { route_id } }` |
| Load / rename / delete a route | [`GET`, `PUT`, `DELETE /api/routes`](/development/message-contracts/http-api#routes) | none | route list / `{ success }` |
| Set Home Base | [`PUT /api/maps_data/homebase/:mapId`](/development/message-contracts/http-api#map-homebase), then a `move_base` goal to it with [`batch` `homebase`](/development/message-contracts/operation-sync#batch) | goal as above | goal status |
| Return to Home Base | [`move_base` goal](/development/message-contracts/rosbridge#move-base-action) to the stored home base | goal as above | goal status |
| Pose estimate / home base seed | publish on [`/unit_<ULID>/initialpose`](/development/message-contracts/rosbridge#publications) | [`string/initialpose`](/development/message-contracts/bridge-topics#json-initialpose) → `/initialpose` | robot pose moves on `server/robot_pose` |
| Manual Override on / off | [`POST /api/manual`](/development/message-contracts/http-api#manual) | [`manual.enable` / `disable`](/development/message-contracts/mqtt-commands#manual) | HTTP 200; `manual_override` in the ping response |
| Drive with WASD | [`geometry_msgs/Twist` on `server/key_vel`](/development/message-contracts/rosbridge#publications) at 10 Hz | [`string/key_vel`](/development/message-contracts/bridge-topics#json-twist) → `/mux/key_vel` | robot pose |
| Autopilot on / off | [`POST /api/autopilot`](/development/message-contracts/http-api#autopilot), [`batch` + `takeover`](/development/message-contracts/operation-sync#takeover) or [`release`](/development/message-contracts/operation-sync#release) | [`autopilot.enable` / `disable`](/development/message-contracts/mqtt-commands#autopilot) | [`operation_progress`](/development/message-contracts/operation-sync#progress-out), [snapshot](/development/message-contracts/operation-sync#snapshot) |
| Emergency stop / release | [`POST /api/emergency_stop`](/development/message-contracts/http-api#emergency-stop) | [`emergency_stop.activate` / `deactivate`](/development/message-contracts/mqtt-commands#emergency-stop) | HTTP 200 |
| Auto Align | [`POST /api/autoalign/start`, `/status`, `/reset`](/development/message-contracts/http-api#autoalign) | [`autoalign.*`](/development/message-contracts/mqtt-commands#autoalign) | HTTP 200 per call |

### Coverage cleaning {#trace-coverage}

| Action | Browser sends | Robot side | Answer comes back as |
| --- | --- | --- | --- |
| Start auto coverage | [`POST /api/boustrophedon/init`](/development/message-contracts/http-api#boustrophedon-init) with `use_autocover: true`, [`batch` `coverage`](/development/message-contracts/operation-sync#batch) | [`boustrophedon.init`](/development/message-contracts/mqtt-commands#boustrophedon): `/switch_mode(boustrophedon)` | HTTP 200, then the path on [`server/boustrophedon_path`](/development/message-contracts/rosbridge#subscriptions) |
| Start a custom area | same endpoint with `polygon`, [`batch` `custom_coverage`](/development/message-contracts/operation-sync#batch) | polygon on `/msd700/coverage_polygon` | same |
| Start a playlist (areas + keep-outs) | same endpoint with `areas` and `exclusions`, [`batch` `playlist`](/development/message-contracts/operation-sync#batch) | plan JSON on `/msd700/coverage_plan` | same |
| Coverage path received | [`boustrophedon_path_ack`](/development/message-contracts/bridge-topics#acks) with the path revision | robot stops resending | none |
| Pause / resume | [`POST /api/boustrophedon/pause`](/development/message-contracts/http-api#boustrophedon-pause) | [`boustrophedon.pause`](/development/message-contracts/mqtt-commands#boustrophedon): `/path_coverage/pause` or `/resume` | HTTP 200 |
| Stop | [`POST /api/boustrophedon/deactivate`](/development/message-contracts/http-api#boustrophedon-deactivate), [`operation_sync` `stop`](/development/message-contracts/operation-sync#stop-complete) | [`boustrophedon.deactivate`](/development/message-contracts/mqtt-commands#boustrophedon) | HTTP 200 |
| Save / rename / delete an area | [`/api/areas`](/development/message-contracts/http-api#areas) | none | `{ success, data }` |
| Save / edit / delete a playlist | [`/api/playlists`](/development/message-contracts/http-api#playlists) | none | `{ success, data }` |

### Mapping page {#trace-mapping}

| Action | Browser sends | Robot side | Answer comes back as |
| --- | --- | --- | --- |
| Start mapping | [`POST /api/mapping`](/development/message-contracts/http-api#mapping-control) `{ start: true }` | [`mapping.start`](/development/message-contracts/mqtt-commands#mapping): `/switch_mode(explore)` | HTTP 200; the growing map on [`server/slam/map`](/development/message-contracts/rosbridge#subscriptions) |
| Pause | `POST /api/mapping` `{ pause: true }` | [`mapping.pause`](/development/message-contracts/mqtt-commands#mapping) | HTTP 200 |
| Check the map name | [`GET /api/media/checkMapName`](/development/message-contracts/http-api#media-server) | none | `data.available` |
| Save (stop) | `POST /api/mapping` `{ stop: true, map_name, homebase_* }`, then [`GET /api/mapping/progress/:request_id`](/development/message-contracts/http-api#mapping-progress) | [`mapping.stop`](/development/message-contracts/mqtt-commands#mapping): `/mapsaver/full_path`, upload to [`/api/media/uploadMap`](/development/message-contracts/http-api#media-server) | immediate `{ request_id, map_ulid }`, then [`mapping_progress`](/development/message-contracts/mqtt-commands#mapping-progress) events over SSE |
| Discard | [`POST /api/mapping/discard`](/development/message-contracts/http-api#mapping-discard) | [`mapping.discard`](/development/message-contracts/mqtt-commands#mapping) | HTTP 200 |

### Database page {#trace-database}

| Action | Browser sends | Robot side | Answer comes back as |
| --- | --- | --- | --- |
| List maps | [`GET /api/maps_data?unit_id=`](/development/message-contracts/http-api#maps-list) | none | `{ data: [map] }` |
| Thumbnail | [`GET /api/media/images/<map ULID>.png`](/development/message-contracts/http-api#media-server) | none | PNG |
| Rename a map | [`PUT /api/maps_data/rename/:mapId`](/development/message-contracts/http-api#map-rename) | none (the unit picks the change up through [data sync](/development/data-sync)) | `{ data: { old_map_name, new_map_name } }` |
| Delete a map | [`DELETE /api/maps_data`](/development/message-contracts/http-api#map-delete) with `map_id` | none | `{ data: { mapId, files } }` |
| Navigate on a map | [`POST /api/navigation/init`](/development/message-contracts/http-api#navigation-init) | see the Navigation table | see the Navigation table |

### Admin console, enrolment, camera {#trace-other}

| Action | Contract |
| --- | --- |
| Any Admin Console tab | [`/admin/api/*`](/development/message-contracts/http-api#admin-api) with an `admin` token |
| Robot enrolment, token refresh on boot | [`/enroll/claim`, `/status`, `/token`](/development/message-contracts/firmware-and-enrolment#enrolment) |
| Unit ↔ cloud data sync | [`/sync/*`](/development/message-contracts/http-api#sync-api) |
| Live camera | [WebRTC signalling](/development/message-contracts/webrtc-signalling) |

## Related documentation

- [Architecture](/development/architecture): system topology and trust boundaries.
- [State and Behavior](/development/state-and-behavior): the state machines these messages drive.
- [ROS Web UI](/development/webui/): the functional description of every page traced above.
