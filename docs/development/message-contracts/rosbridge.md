---
outline: deep
search: false
---

# rosbridge (WebSocket)

<RoleBadge role="developer" />

The browser end of the streaming channel ([path B](/development/message-contracts/#two-control-paths)).
The dashboard holds one rosbridge v2 WebSocket to the cloud's ROS master (or the unit's own, on the
local dashboard) and uses roslibjs over it. It makes **no** rosbridge service calls: everything that
needs an answer goes through the [HTTP API](/development/message-contracts/http-api) instead.

![rosbridge Architecture Overview](./diagrams/rosbridge-protocol-rosbridge-architecture-overview.drawio)

## Endpoints {#endpoints}

| Environment | URL | Backend |
| --- | --- | --- |
| Production cloud | `wss://msd.nglobal.jp/services/rosbridge` | Apache → `localhost:9090` |
| Development cloud | `ws://<server-ip>:9091/?ticket=<ticket>` | the [live link gateway](#gateway) in `backend_node`; the dev server runs no ROS since 2026-10-03 |
| Unit local dashboard | `ws://<unit-ip>:9090` | the unit's `rosbridge_suite` |

Configured at build time as `NEXT_PUBLIC_WS_ROSBRIDGE_URL`. All topic names below are prefixed with the
unit's `topic_root` from [`GET /unit/all`](/development/message-contracts/http-api#unit-list); written
here as `<root>`.

## Wire operations {#operations}

roslibjs speaks the standard rosbridge v2 JSON operations:

```json
{ "op": "subscribe", "id": "subscribe:/unit_01JZ.../server/robot_pose:1",
  "topic": "/unit_01JZ.../server/robot_pose", "type": "geometry_msgs/Pose", "throttle_rate": 40 }

{ "op": "advertise", "id": "advertise:/unit_01JZ.../server/key_vel:2",
  "topic": "/unit_01JZ.../server/key_vel", "type": "geometry_msgs/Twist" }

{ "op": "publish", "id": "publish:/unit_01JZ.../server/key_vel:3",
  "topic": "/unit_01JZ.../server/key_vel",
  "msg": { "linear": { "x": 0.4, "y": 0, "z": 0 }, "angular": { "x": 0, "y": 0, "z": 0 } } }

{ "op": "publish", "topic": "/unit_01JZ.../server/slam/map", "msg": { "...": "..." } }
```

`throttle_rate` is the minimum gap in ms (40 = 25 Hz). The map subscription asks for
`compression: "png"`, so rosbridge sends the grid as a PNG-encoded payload.

::: tip Advertise once, publish many times
A topic advertised and published in the same instant can lose that first message: the new ROS
publisher is not yet connected to the relay that subscribes to it. The dashboard therefore keeps one
advertised `ROSLIB.Topic` per name for the whole session (`operation_sync`, `boustrophedon_path_ack`,
`result_ack`) and advertises `operation_sync` as soon as the socket opens.
:::

## Subscriptions {#subscriptions}

| Topic | Type | Drawn as / used for | Source contract |
| --- | --- | --- | --- |
| `<root>/server/robot_pose` | `geometry_msgs/Pose` | robot marker and heading, 25 Hz | [pose](/development/message-contracts/bridge-topics#json-pose) |
| `<root>/server/slam/map` | `nav_msgs/OccupancyGrid` | the map; a 0x0 grid means "no map yet" | [map delivery](/development/message-contracts/bridge-topics#map-delivery) |
| `<root>/server/scan` | `sensor_msgs/LaserScan` | lidar points | [compressed scan](/development/message-contracts/bridge-topics#compressed-formats) |
| `<root>/server/scan_holes` | `sensor_msgs/LaserScan` | live hole / drop-off marks | same |
| `<root>/server/hazard_cells` | `nav_msgs/Path` | cumulative hole trail of the run | [compressed path](/development/message-contracts/bridge-topics#compressed-formats) |
| `<root>/server/move_base/NavfnROS/plan` | `nav_msgs/Path` | global plan line | same |
| `<root>/server/move_base/TebLocalPlannerROS/local_plan` | `nav_msgs/Path` | short-term local plan | same |
| `<root>/server/boustrophedon_path` | `nav_msgs/Path` | coverage lanes; `header.seq` is ACKed | same |
| `<root>/server/skipped_waypoints` | `nav_msgs/Path` | waypoints the coverage run could not reach | same |
| `<root>/string/uncovered_regions` | `std_msgs/String` | unswept regions (plain JSON) | [topic map](/development/message-contracts/bridge-topics#robot-to-cloud) |
| `<root>/string/operation_progress` | `std_msgs/String` | supervisor progress while autopilot drives | [Operation Sync](/development/message-contracts/operation-sync#progress-out) |
| `<root>/string/operation_snapshot` | `std_msgs/String` | recovery of a run after a reload or in a new tab | [Operation Sync](/development/message-contracts/operation-sync#snapshot) |
| `<root>/server/move_base/status`, `/result`, `/feedback` | actionlib | through the action client below | [status](/development/message-contracts/bridge-topics#json-status), [result](/development/message-contracts/bridge-topics#json-result) |

## Publications {#publications}

| Topic | Type | Sent when | Robot receives |
| --- | --- | --- | --- |
| `<root>/server/key_vel` | `geometry_msgs/Twist` | While manual override is on: continuously at 10 Hz (a zero twist when no key is held), plus a zero twist on window blur and when manual is turned off. `linear.x` ±0.4 m/s and `angular.z` ±1.0 rad/s (Shift: 0.2 and 0.5). | [`/mux/key_vel`](/development/message-contracts/bridge-topics#json-twist) |
| `<root>/initialpose` | `geometry_msgs/PoseWithCovarianceStamped` | pose estimate, home base pose seed | [`/initialpose`](/development/message-contracts/bridge-topics#json-initialpose) |
| `<root>/string/move_base/result_ack` | `std_msgs/String` | every `move_base` result seen, data = `goal_id.id` | [ACK](/development/message-contracts/bridge-topics#acks) |
| `<root>/string/boustrophedon_path_ack` | `std_msgs/String` | every coverage path revision drawn, data = revision | [ACK](/development/message-contracts/bridge-topics#acks) |
| `<root>/string/map_request` | `std_msgs/String` | from canvas mount until a map is drawn, data = `{"reason","at"}` | [map delivery](/development/message-contracts/bridge-topics#map-delivery) |
| `<root>/string/operation_sync` | `std_msgs/String` | every run start, waypoint, pause, stop, autopilot change | [Operation Sync](/development/message-contracts/operation-sync) |

The `initialpose` topic is a sibling of `server/`, not a child: the cloud relay subscribes to
`<root>/initialpose`.

## `move_base` action client {#move-base-action}

Pinpoints, routes and home-base drives are `move_base` goals sent through a roslibjs `ActionClient`
(`serverName: <root>/server/move_base`, `actionName: move_base_msgs/MoveBaseAction`) in
`public/script/Nav2D.js`. Under the hood that is five topics:

| Topic | Direction | Type |
| --- | --- | --- |
| `<root>/server/move_base/goal` | browser → cloud | `move_base_msgs/MoveBaseActionGoal` |
| `<root>/server/move_base/cancel` | browser → cloud | `actionlib_msgs/GoalID` |
| `<root>/server/move_base/status` | cloud → browser | `actionlib_msgs/GoalStatusArray` |
| `<root>/server/move_base/result` | cloud → browser | `move_base_msgs/MoveBaseActionResult` |
| `<root>/server/move_base/feedback` | cloud → browser | `move_base_msgs/MoveBaseActionFeedback` (not produced by the relay) |

The goal message the browser builds:

```json
{
  "target_pose": {
    "header": { "frame_id": "map" },
    "pose": {
      "position": { "x": 4.5, "y": 2.0, "z": 0.0 },
      "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
    }
  }
}
```

| Behaviour | Rule |
| --- | --- |
| Delivery | The same goal (same `goal_id`) is resent every 1 s, up to 60 times, until any status or result for it arrives. |
| Completion | The first terminal code wins, from either `/result` or `/status`: `3` → Arrived, `4`/`5`/`9` → Failed, `2`/`8` → Cancelled. A 2 s poll covers a terminal message that arrived before the listener was attached. |
| Result ACK | Every result is ACKed on `string/move_base/result_ack`, including results that arrive after a reconnect. |
| Multi-waypoint | The browser sends one goal at a time and advances on completion; Round Trip reverses at the last waypoint, Loop restarts from the first. Each dispatch is mirrored with an [`operation_sync` `progress`](/development/message-contracts/operation-sync#progress). |
| Pause / Stop | `goal.cancel()` on the current goal; the result is `PREEMPTED` (2) and is not reported as Arrived. |

On the robot the goal and cancel become [`string/move_base/goal`](/development/message-contracts/bridge-topics#json-goal)
and [`/cancel`](/development/message-contracts/bridge-topics#json-cancel), then `/move_base/goal` and
`/move_base/cancel`.

## Connection behaviour {#connection}

- One shared connection per page (`window.__msdRos`); the map component, operation sync and the
  coverage overlay all use it. The teleop panel reuses it when present and opens its own otherwise.
- A dropped socket is reconnected softly; the reconnect indicator appears only after a short grace
  period, so a brief network blip does not flicker the UI.
- After a reconnect the dashboard re-subscribes, restarts the `map_request` loop, and sends an
  [`operation_sync` `resync`](/development/message-contracts/operation-sync#resync) to recover the run.

Canvas drawing on top of these topics: [Frontend Canvas](/development/frontend-canvas) and
[Navigation Overview](/development/webui/navigation/overview#canvas-rendering-pipeline).

## Live link gateway {#gateway}

The server is moving off ROS. The replacement for rosbridge and the cloud relays is
`unit_gateway.js`, a module inside `backend_node` that speaks the same rosbridge v2 protocol, so
roslibjs stays the client library. Since 2026-10-03 it is the only live link of the development
cloud, whose server runs no ROS at all (no roscore, rosbridge or relay), and the dev dashboard is
built for it (see [below](#gateway-dashboard)). Production and the unit local dashboards still use
rosbridge, which everything above describes.

| | rosbridge (today) | Live link gateway |
| --- | --- | --- |
| Topics | `<root>/server/*`, typed, decoded on the server | `<root>/string/*` only, every one a `std_msgs/String` |
| Payload | re-encoded from the decoded ROS message | the MQTT payload byte for byte; the browser decodes it ([formats](/development/message-contracts/bridge-topics#compressed-formats)) |
| Who may connect | anyone who reaches the port | one [ticket](/development/message-contracts/http-api#link-ticket) per connection, bound to one account and one unit |
| What a connection reaches | every topic of every unit | that unit's topics from `shared/unit_topics.json`, each in its own direction only |
| Operations | full rosbridge v2 | `subscribe`, `unsubscribe`, `advertise`, `unadvertise`, `publish`; anything else gets a `status` error and the connection stays open |

Rules a client can rely on:

| Behaviour | Rule |
| --- | --- |
| Direction | A browser subscribes to topics the robot sends and publishes topics the robot reads. A subscribe to a robot-bound topic, or a publish to a robot-sent one, is refused with `{"op":"status","level":"error"}`. |
| Type | `type` must be `std_msgs/String` or absent. A typed subscribe such as `nav_msgs/OccupancyGrid` is refused. |
| Latched topics | `map`, `move_base/NavfnROS/plan`, `move_base/TebLocalPlannerROS/local_plan`, `boustrophedon_path`, `hazard_cells`, `coverage_debug`, `uncovered_regions`, `coverage_status`, `operation_snapshot`: the last value is sent on every subscribe. The gateway receives these for every unit at all times, so a unit enrolled a minute ago is covered without a restart. |
| `throttle_rate` | Honoured on stream topics, with a trailing send: inside the window only the newest message is kept, and it goes out when the window ends, so the last pose of a robot that stopped is never lost. Ignored on reliable topics. |
| Slow browser | Stream topics (`robotpose`, `move_base/status`, `map`, `laserscan`, `laserscan_holes`, `hazard_cells`, the two plans) skip to the newest message while the socket is backed up. Every other topic (results, coverage and operation messages) is delivered in full and in order. A browser 16 MB behind is closed with code `4008`. |
| Access | Re-checked every minute; once the unit has left the caller's rentals the connection closes with code `4403`, within about two minutes. |
| Refused upgrade | A missing, unknown, expired or reused ticket gets HTTP `401`. |
| Keepalive | A WebSocket ping every 10 s; a browser that does not answer is dropped, as with rosbridge's `websocket_ping_interval`. |
| Compression | `permessage-deflate`, as rosbridge had with `use_compression`. A `compression` field on subscribe is ignored. |
| Health | `GET /health` on the same port: session and topic counts and per-topic totals, with no unit ids. |

Enabled by `LINK_GATEWAY_PORT`; `LINK_GATEWAY_HOST` defaults to `0.0.0.0`. The dev compose sets it
to `9091`, the port rosbridge used, so the dashboard URL did not change when the dev server dropped
ROS. Production does not set it yet.

Every [ping](/development/message-contracts/http-api#hardware-ping) sends the `DUMMY_INIT_DATA_`
priming messages straight to MQTT, on every server, gateway or not. The robot discards them;
receiving them is what creates its ROS publisher for the goal, cancel and initial pose topics before
the first real message.

### In the dashboard {#gateway-dashboard}

The dashboard opens every topic through one adapter, `src/services/unitLink`, so one code base can
talk to either end. The build arg `NEXT_PUBLIC_UNIT_LINK` picks which:

| Value | Talks to | Effect |
| --- | --- | --- |
| unset or `typed` (default; production and unit local dashboards) | rosbridge | none: the adapter is `new ROSLIB.Topic(...)` and `new ROSLIB.ActionClient(...)` |
| `string` (development cloud, `frontend_dev`) | the gateway | a typed name such as `<root>/server/robot_pose` is carried on its `<root>/string/*` topic and decoded in the browser; every connect, reconnects included, first fetches a [ticket](/development/message-contracts/http-api#link-ticket) |

Code that opens a topic uses `unitTopic()` and `unitActionClient()` from `@/services/unitLink`; the
vendored `public/script/ros2d.js` and `Nav2D.js` use `ROS2D.topic()`, `NAV2D.topic()` and
`NAV2D.actionClient()`. A bare `new ROSLIB.Topic` bypasses the adapter and would break a `string`
build. In `string` mode a typed name the gateway does not carry (another planner's plan,
`move_base/feedback`) becomes a topic that never fires, which is what it did before: nothing
published it.

The browser decoders are checked against the payload examples listed in
[Bridge Topics § Compressed formats](/development/message-contracts/bridge-topics#compressed-formats):
`npm run unit-link:sync` copies them and `shared/unit_topics.json` into the dashboard, and `npm test`
runs the check.

## Related documentation

- [Bridge Topics](/development/message-contracts/bridge-topics): what each topic carries between cloud and robot.
- [Operation Sync](/development/message-contracts/operation-sync): the `operation_*` topics.
- [Navigation: ROS Integration](/development/webui/navigation/ros-integration): the page-level view of these topics.
