---
outline: deep
search: false
---

# Navigation: ROS Integration

<RoleBadge role="developer" />

What the Navigation page sends and receives, grouped by transport. Every payload is specified once, in
[Message Contracts](/development/message-contracts/); this page says which of those contracts the
Navigation page uses and why, and links to the exact section. For one row per button, see
[Message Contracts § Navigation page](/development/message-contracts/#trace-navigation).

For the feature-level behavior these wire calls implement, see
[Overview](/development/webui/navigation/overview),
[Map Sync & Auto Align](/development/webui/navigation/map-sync-and-alignment),
[Coverage Cleaning](/development/webui/navigation/coverage-cleaning),
[Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes), and
[Manual & Autopilot](/development/webui/navigation/manual-and-autopilot).

## Two paths to the robot {#two-paths}

The page uses both control paths described in
[Message Contracts § Two control paths](/development/message-contracts/#two-control-paths):

- **Command channel (HTTP → MQTT `system_command`)** for everything that changes mode or needs a
  yes/no answer: opening a map, starting, pausing and stopping coverage, Auto Align, Manual Override,
  Autopilot, emergency stop.
- **Streaming channel (rosbridge → MQTT `string/*`)** for pinpoint and route goals, WASD teleop, the
  operation supervisor mirror, the ACKs, and every overlay drawn on the canvas.

## MQTT commands: Navigation subsystem {#mqtt-commands-navigation-subsystem}

| Command | Sent by | What it does on the robot | Contract |
| --- | --- | --- | --- |
| `navigation.init` | Opening a map from the Database page, or the page's own auto-resume | `/map/retire`, `/switch_mode(navigation)`, then the stored home base on `/initialpose` | [`navigation`](/development/message-contracts/mqtt-commands#navigation) |
| `navigation.deactivate` | Leaving navigation (idle, switching maps) | `/switch_mode(idle)`, `/map/reset` | same |
| `navigation.pointstamped` | nothing in the current dashboard | publishes `/clicked_point` | same |

`map_id` in the HTTP body and `map_name` in the MQTT payload are the same map ULID; the field is only
renamed at the HTTP boundary.

::: warning Pinpoints are not `pointstamped`
Single and multiple pinpoints, routes and home-base drives are `move_base` goals over rosbridge (see
[below](#move-base-goals)). `POST /api/navigation/pointstamped` still exists but the dashboard does not
call it.
:::

## MQTT commands: Boustrophedon subsystem {#mqtt-commands-boustrophedon-subsystem}

| Command | Sent by | Payload | Contract |
| --- | --- | --- | --- |
| `boustrophedon.init` | Auto Coverage | `use_autocover: true` | [`boustrophedon`](/development/message-contracts/mqtt-commands#boustrophedon) |
| `boustrophedon.init` | Custom Range Coverage | `use_autocover: false`, `polygon` | same |
| `boustrophedon.init` | Operation Playlist | `use_autocover: false`, `areas` (cover entries, in order), `exclusions` (keep-out entries) | same |
| `boustrophedon.pause` | Pause / resume | `pause: true` or `false` | same |
| `boustrophedon.deactivate` | Cancel / Finish | `use_autocover` matching the run | same |

The algorithm that turns these polygons into a sweep path is in
[Boustrophedon Coverage & Zero-Spin Alignment Architecture](/development/ros/boustrophedon-and-alignment).

## REST endpoints {#rest-endpoints}

| Endpoint | Used for | Contract |
| --- | --- | --- |
| `POST /api/navigation/init` | Opening a map; refused with `404` when the map was recorded by a different unit | [HTTP API](/development/message-contracts/http-api#navigation-init) |
| `POST /api/navigation/deactivate` | Leaving navigation | [HTTP API](/development/message-contracts/http-api#navigation-deactivate) |
| `POST /api/boustrophedon/init`, `/pause`, `/deactivate` | Coverage (`coverageApi.ts`) | [HTTP API](/development/message-contracts/http-api#coverage) |
| `POST /api/autoalign/start`, `/status`, `/reset` | Map Sync's Auto Align (`autoAlignApi.ts`) | [HTTP API](/development/message-contracts/http-api#autoalign) |
| `POST /api/manual`, `POST /api/autopilot` | The two toggles in `ManualAutopilotPanel` | [HTTP API](/development/message-contracts/http-api#manual) |
| `POST /api/emergency_stop` | The emergency button | [HTTP API](/development/message-contracts/http-api#emergency-stop) |
| `POST /api/routes`, `GET /api/routes/:map_id`, `PUT`/`DELETE /api/routes/:id` | Save, Load, rename, delete a route (`route_name`, `map_id`, `route_points`) | [HTTP API](/development/message-contracts/http-api#routes) |
| `/api/areas`, `/api/playlists` | Coverage areas and playlists | [HTTP API](/development/message-contracts/http-api#areas) |
| `PUT /api/maps_data/homebase/:mapId` | Set Home Base | [HTTP API](/development/message-contracts/http-api#map-homebase) |

## `move_base` goals {#move-base-goals}

Pinpoints, routes, Return to Home Base and the drive to a new home base all go through the roslibjs
`ActionClient` on `<root>/server/move_base`, built in `public/script/Nav2D.js`. The cloud relay turns
each goal and cancel into JSON on `string/move_base/goal` and `/cancel`, and the robot's
`action_client.py` turns them back into `/move_base/goal` and `/move_base/cancel`.

- Delivery: the same goal is resent every second until any status or result for it arrives.
- Completion: the first terminal code from `/status` or `/result` decides Arrived, Failed or Cancelled.
- Every result is ACKed on `string/move_base/result_ack`; the robot resends results until then.

Full contract: [rosbridge § move_base action client](/development/message-contracts/rosbridge#move-base-action),
[Bridge Topics § Goal](/development/message-contracts/bridge-topics#json-goal).

## Heartbeat and lease {#heartbeat-lease}

The page pings `POST /api/hardware/ping` every second with `page: "navigation"` and `claim: true`, as
opposed to the unit list's read-only `claim: false`, and sends `release: true` on the way out. The
answer drives the page:

- `robot_activity` and `active_page` route the operator and feed the stuck detector;
- `manual_override` and `autopilot` set the two toggles in
  [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot);
- `in_use` and `origin_conflict` decide whether this tab may issue commands at all;
- `motion_locked` shows that `/emergency_pause` is holding the robot;
- `intended_mode` and `needs_recovery` (added by the backend) trigger the auto-resume.

Full contract: [Heartbeat & Lease](/development/message-contracts/heartbeat-and-lease).

## Operation supervisor sync {#operation-sync}

Every run the page starts is mirrored to `operation_supervisor.py` on `string/operation_sync`:

| Page action | Sync messages |
| --- | --- |
| Play, single or multiple pinpoints | `batch` (`single_pinpoint` / `multi_pinpoint`, `route_mode`, `waypoints`), `progress` per waypoint, `complete` at the end |
| Pause, Stop | `pause`, `stop` |
| Autopilot on / off | `batch` + `takeover`, confirmed by a snapshot; `release` |
| Set Home Base drive | `batch` with `homebase` (record only) |
| Auto Coverage, Custom Range, Playlist | `batch` with `coverage`, `custom_coverage`, `playlist` (record only: coverage already runs on the robot) |
| Page load, reconnect | `resync`, answered by `operation_snapshot` |

Full contract: [Operation Sync](/development/message-contracts/operation-sync).

## Streaming telemetry {#streaming-telemetry}

Everything the canvas draws arrives through rosbridge. Topic names include the unit prefix
(`<root>` = `/unit_<ULID>`); one rosbridge connection serves every unit, so the prefix is what selects
the robot.

| rosbridge topic | Type | Canvas role |
| --- | --- | --- |
| `<root>/server/robot_pose` | `geometry_msgs/Pose` | Robot icon, and the pose stream behind [Show/Hide Trace](/development/webui/navigation/coverage-cleaning#show-hide-trace) |
| `<root>/server/slam/map` | `nav_msgs/OccupancyGrid` | The map. Requested on mount over `string/map_request` instead of waiting for the next send; "Loading map from robot..." until one is drawn. See [Bridge Topics § Map delivery](/development/message-contracts/bridge-topics#map-delivery). |
| `<root>/server/scan`, `<root>/server/scan_holes` | `sensor_msgs/LaserScan` | Lidar points, live holes |
| `<root>/server/hazard_cells` | `nav_msgs/Path` | Hole trail of the run |
| `<root>/server/move_base/NavfnROS/plan`, `.../TebLocalPlannerROS/local_plan` | `nav_msgs/Path` | Global and local plan lines |
| `<root>/server/boustrophedon_path` | `nav_msgs/Path` | The [coverage-path overlay](/development/webui/navigation/coverage-cleaning#the-coverage-path-overlay), ACKed per revision |
| `<root>/server/skipped_waypoints`, `<root>/string/uncovered_regions` | `nav_msgs/Path`, `std_msgs/String` | Coverage leftovers |
| `<root>/string/operation_snapshot`, `<root>/string/operation_progress` | `std_msgs/String` | Run recovery and supervisor progress |

Rates depend on the unit's egress profile (idle, watching, driving); see
[Bridge Topics § Presence and egress profiles](/development/message-contracts/bridge-topics#egress-profiles).
Subscription details: [rosbridge § Subscriptions](/development/message-contracts/rosbridge#subscriptions).

## Related

- [Message Contracts § Navigation page](/development/message-contracts/#trace-navigation): every message, one row per button.
- [Overview](/development/webui/navigation/overview): the Navigation page and its full Mode List.
- [Map Sync & Auto Align](/development/webui/navigation/map-sync-and-alignment): pose correction and Auto Align.
- [Coverage Cleaning](/development/webui/navigation/coverage-cleaning): the boustrophedon feature.
- [Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes): pinpoint driving and saved routes.
- [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot): teleop, autopilot, recovery.
- [Boustrophedon Coverage & Zero-Spin Alignment Architecture](/development/ros/boustrophedon-and-alignment):
  the sweep algorithm and the in-place rotation guard.
