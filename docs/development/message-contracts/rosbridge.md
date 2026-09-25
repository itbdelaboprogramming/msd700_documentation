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
| Development cloud | `ws://<server-ip>:9091` | dev rosbridge |
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

## Related documentation

- [Bridge Topics](/development/message-contracts/bridge-topics): what each topic carries between cloud and robot.
- [Operation Sync](/development/message-contracts/operation-sync): the `operation_*` topics.
- [Navigation: ROS Integration](/development/webui/navigation/ros-integration): the page-level view of these topics.
