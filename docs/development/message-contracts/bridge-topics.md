---
outline: deep
search: false
---

# Bridge Topics (MQTT ↔ ROS)

<RoleBadge role="developer" />

The streaming channel ([path B](/development/message-contracts/#two-control-paths)) between a robot and
the cloud. `topic2string` turns typed ROS messages into JSON (or compressed) strings, `aws_mqtt` carries
each string as a `std_msgs/String` passthrough (`primitive: true`), and the other side turns it back.
What the browser does with the typed result is in [rosbridge](/development/message-contracts/rosbridge).

![Streaming Telemetry Topics](./diagrams/message-contracts-streaming-telemetry-topics.drawio)

Bridge configuration: robot `aws_mqtt/launch/nakayama_msd.launch`; cloud
`aws_mqtt/scripts/gen_bridge_params.py` (the unit relay, one entry per unit in the roster) or
`nakayama_cloud.launch` (legacy per-unit container). Relays: robot `topic2string/launch/msd.launch`,
cloud `topic2string/launch/cloud_multi.launch`.

## Topic map {#topic-map}

### Robot → cloud {#robot-to-cloud}

| Robot source | Robot string topic | MQTT (`/unit_<ULID>/...`) | Cloud typed topic (`/unit_<ULID>/...`) | Format |
| --- | --- | --- | --- | --- |
| `/client/robotpose` | `/string/robotpose` | `string/robotpose` | `server/robot_pose` (`geometry_msgs/Pose`, latched) | [pose JSON](#json-pose) |
| `/map` | `/string/map` | `string/map` | `server/slam/map` (`nav_msgs/OccupancyGrid`) | [compressed grid](#compressed-formats), see [map delivery](#map-delivery) |
| `/scan` | `/string/laserscan` | `string/laserscan` | `server/scan` (`sensor_msgs/LaserScan`) | [compressed scan](#compressed-formats) |
| `/scan_holes` | `/string/laserscan_holes` | `string/laserscan_holes` | `server/scan_holes` (`sensor_msgs/LaserScan`) | compressed scan |
| `/msd700/hazard_cells` | `/string/hazard_cells` | `string/hazard_cells` | `server/hazard_cells` (`nav_msgs/Path`) | [compressed path](#compressed-formats) |
| `/move_base/NavfnROS/plan` | `/string/move_base/NavfnROS/plan` | same | `server/move_base/NavfnROS/plan` (`nav_msgs/Path`) | compressed path |
| `/move_base/TebLocalPlannerROS/local_plan` | `/string/move_base/TebLocalPlannerROS/local_plan` | same | `server/move_base/TebLocalPlannerROS/local_plan` (`nav_msgs/Path`) | compressed path, reframed `odom` → `map` on the robot |
| `/msd700/boustrophedon_path` | `/string/boustrophedon_path` | `string/boustrophedon_path` | `server/boustrophedon_path` (`nav_msgs/Path`) | compressed path; `header.seq` is the revision the browser [ACKs](#acks) |
| `/msd700/skipped_waypoints` | `/string/skipped_waypoints` | `string/skipped_waypoints` | `server/skipped_waypoints` (`nav_msgs/Path`) | compressed path |
| `/msd700/coverage_debug` | (none) | `string/coverage_debug` | stays a string | plain JSON |
| `/msd700/uncovered_regions` | (none) | `string/uncovered_regions` | stays a string | plain JSON |
| `/msd700/coverage_status` | (none) | `string/coverage_status` | stays a string | `running`, `complete`, `aborted` |
| `/move_base/status` | `/string/move_base/status` | `string/move_base/status` | `server/move_base/status` (`actionlib_msgs/GoalStatusArray`) | [status JSON](#json-status) |
| `/move_base/result` | `/string/move_base/result` | `string/move_base/result` | `server/move_base/result` (`move_base_msgs/MoveBaseActionResult`) | [result JSON](#json-result), resent until [ACKed](#acks) |
| `operation_supervisor` | `/string/operation_progress` | `string/operation_progress` | stays a string | [Operation Sync](/development/message-contracts/operation-sync#progress-out) |
| `operation_supervisor` | `/string/operation_snapshot` | `string/operation_snapshot` | stays a string, latched on the relay | [Operation Sync](/development/message-contracts/operation-sync#snapshot) |
| `system_command.py` | `/system_feedback` | `system_feedback` | (read by `backend_node` over MQTT) | [feedback envelope](/development/message-contracts/mqtt-commands#feedback-envelope) |

The relay latches `string/map`, the plan and coverage overlays, `hazard_cells` and
`operation_snapshot`, so a browser that subscribes late still gets the last value.

### Cloud → robot {#cloud-to-robot}

| Cloud typed topic (`/unit_<ULID>/...`) | Cloud string topic | MQTT (`/unit_<ULID>/...`) | Robot topic | Format |
| --- | --- | --- | --- | --- |
| `server/move_base/goal` (`move_base_msgs/MoveBaseActionGoal`) | `string/move_base/goal` | same | `/string/move_base/goal` → `/move_base/goal` | [goal JSON](#json-goal) |
| `server/move_base/cancel` (`actionlib_msgs/GoalID`) | `string/move_base/cancel` | same | `/string/move_base/cancel` → `/move_base/cancel` | [cancel JSON](#json-cancel) |
| `initialpose` (`geometry_msgs/PoseWithCovarianceStamped`) | `string/initialpose` | same | `/string/initialpose` → `/initialpose` | [initialpose JSON](#json-initialpose) |
| `server/key_vel` (`geometry_msgs/Twist`) | `string/key_vel` | same | `/string/key_vel` → `/mux/key_vel` | [twist JSON](#json-twist) |
| (browser publishes the string) | `string/move_base/result_ack` | same | `/string/move_base/result_ack` | [ACK](#acks) |
| (browser publishes the string) | `string/boustrophedon_path_ack` | same | `/string/boustrophedon_path_ack` | [ACK](#acks) |
| (browser publishes the string) | `string/operation_sync` | same | `/string/operation_sync` | [Operation Sync](/development/message-contracts/operation-sync) |
| (browser publishes the string) | `string/map_request` | same | `/string/map_request` | [map request](#map-delivery) |
| (`backend_node` over MQTT) | | `system_command` | `/system_command` | [command envelope](/development/message-contracts/mqtt-commands#command-envelope) |

Stamps in goals, initial poses and paths are rewritten to the receiving side's clock at the boundary
(`clock_boundary.BoundaryPublisher`), because the robot and the cloud run different ROS clocks.
Results and statuses are matched by `goal_id.id` and pass through unchanged.

## JSON string formats {#json-formats}

### Pose {#json-pose}

`/string/robotpose`, compact JSON, positions rounded to 3 decimals and quaternions to 6:

```json
{"position":{"x":1.234,"y":-0.5,"z":0.0},"orientation":{"x":0.0,"y":0.0,"z":0.382683,"w":0.92388}}
```

Sent at up to 25 Hz, but only when the pose moved past a deadband; while nobody is watching a parked
robot it is repeated at most every 25 s (`max_silence.idle`).

### Goal {#json-goal}

`string/move_base/goal`, written by the cloud `action_server.py` from the browser's
`MoveBaseActionGoal`:

```json
{
  "header": { "seq": 2, "stamp": { "secs": 0, "nsecs": 0 }, "frame_id": "" },
  "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" },
  "goal": {
    "target_pose": {
      "header": { "seq": 0, "stamp": { "secs": 1758547188, "nsecs": 323692321 }, "frame_id": "map" },
      "pose": {
        "position": { "x": 6.01, "y": 0.95, "z": 0.0 },
        "orientation": { "x": 0.0, "y": 0.0, "z": -0.0157, "w": -0.9999 }
      }
    }
  }
}
```

The browser resends the same goal (same `goal_id`) every second until any status or result for it
arrives; the robot's `action_client.py` drops a `goal_id` it has already seen.

### Cancel {#json-cancel}

```json
{ "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" } }
```

The browser cancels its own goal by `id`. An empty `id` cancels every goal; the robot's own handlers (manual override, coverage stop, emergency release) publish that directly on `/move_base/cancel`.

### Status {#json-status}

```json
{
  "header": { "seq": 51, "stamp": { "secs": 1758547190, "nsecs": 0 }, "frame_id": "" },
  "status_list": [
    { "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" }, "status": 1, "text": "" }
  ]
}
```

Sent when the list changes (hashed on `id`, `status`, `text`), otherwise repeated at most every 2 s (`status_heartbeat`).
`status` is the actionlib code: `1` active, `2` preempted, `3` succeeded, `4` aborted, `5` rejected,
`8` recalled, `9` lost.

### Result {#json-result}

```json
{
  "header": { "seq": 3, "stamp": { "secs": 1758547230, "nsecs": 0 }, "frame_id": "" },
  "status": {
    "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" },
    "status": 3,
    "text": "Goal reached."
  }
}
```

### Initial pose {#json-initialpose}

`geometry_msgs/PoseWithCovarianceStamped` as JSON: `header`, then `pose.pose.position`,
`pose.pose.orientation` and the 36-value `pose.covariance`, in the same key layout as the ROS message.

### Twist {#json-twist}

```json
{ "linear": { "x": 0.4, "y": 0.0, "z": 0.0 }, "angular": { "x": 0.0, "y": 0.0, "z": 1.0 } }
```

The robot republishes it on `/mux/key_vel` (twist_mux priority 90). The channel is open only while
[`manual.enable`](/development/message-contracts/mqtt-commands#manual) is in force; a 0.5 s gap zeroes
the robot.

### Compressed formats {#compressed-formats}

| Stream | Encoding |
| --- | --- |
| Paths (`plan`, `local_plan`, `boustrophedon_path`, `hazard_cells`, `skipped_waypoints`) | `base64(zlib(JSON))`, JSON = `{ header, poses: [{ header, pose }] }` |
| Laser scans (`laserscan`, `laserscan_holes`) | `base64(zlib(Q1))`, a quantised scan (`q1_encode`); with quantising off, the ROS-serialized `LaserScan` |
| Map | `base64(zlib(M1))`, cells packed as raw int8; the decoder still accepts the older `base64(zlib(JSON))` |

## Reliability ACKs {#acks}

| ACK topic | Payload (`std_msgs/String`) | Closes the loop on |
| --- | --- | --- |
| `string/move_base/result_ack` | the `goal_id.id` of the result | `action_client.py` republishes each terminal result every 1 s (for up to 300 s) until it is ACKed, so a dropped result cannot strand a multi-waypoint run |
| `string/boustrophedon_path_ack` | the path revision (`header.seq`) as a decimal string | the coverage node resends the path overlay until the revision it holds is ACKed |

## Map delivery {#map-delivery}

The map is the largest payload on the link and the only one an operator cannot work without. The
robot content-hashes the grid and sends it only when it changes, plus a heartbeat every 60 s while
somebody is watching and every 300 s while nobody is. In navigation mode the grid comes from
`map_server` and never changes, so in practice that is one message per heartbeat. Three mechanisms
make a single QoS 0 message survivable:

| Mechanism | Where | Covers |
| --- | --- | --- |
| The relay latches `/unit_<ULID>/string/map` | `aws_mqtt/scripts/gen_bridge_params.py` | A browser that connects between two sends; a relay restart (whenever the unit roster changes) |
| A burst of `burst_sends` (3) repeats, `burst_interval` (2 s) apart, after a map reset or retire | `topic2string` map compressor (nodelet `map_compression.cpp`, Python twin `map_compression_pipeline.py`) | The map an operator just opened, sent while the robot restarts its navigation stack; also a new mapping run |
| The pull channel `string/map_request` | browser → robot | Everything else: a dropped packet, a page that mounted at the wrong moment |

The dashboard publishes on `/unit_<ULID>/string/map_request` as soon as the canvas mounts and keeps
asking until a map is drawn:

```json
{ "reason": "map-init", "at": 1758547188322 }
```

The robot rate-limits requests (`request_min_interval`, default 2 s), so several tabs cost one extra
send, not one each.

A **0x0 grid is not a corrupt message**. The robot publishes one to retire the grid the relay is
latching; without it, a dashboard that just opened a different map would be handed the previous
session's room. The canvas treats it as "no map yet" and asks again.

| Service | Called from | Effect |
| --- | --- | --- |
| `/map/reset` | mapping stop or discard, navigation deactivate, emergency stop | The robot forgets its map; what the dashboard already draws is left alone |
| `/map/retire` | `navigation.init` only | The same, plus the 0x0 sentinel, because a different map was just opened |

Both arm the burst. A robot without `/map/retire` falls back to a plain reset.

::: warning
Do not lengthen `change_heartbeat` in `topic2string/config/egress.yaml` without checking all three
mechanisms are in place. With change-gating alone, a dashboard that missed the send waited a measured
~52 s for the next one.
:::

## Presence and egress profiles {#egress-profiles}

To keep an unwatched robot from spending bandwidth, `system_command.py` publishes a latched
`std_msgs/String` on the robot-local `/msd700/viewers` once a second: `idle`, `watching` or `driving`.
It never leaves the unit. `topic2string`'s `presence_gate.py` reads it and applies
`topic2string/config/egress.yaml`:

| Stream | `idle` | `watching` | `driving` |
| --- | --- | --- | --- |
| `laserscan` | 0 Hz (off) | 1 Hz | node default |
| `robotpose` repeat of an unchanged pose | every 25 s | node default | node default |
| map heartbeat | 300 s, changes held | node default (60 s) | node default |
| global / local plan | off | node default | node default |
| `move_base` result retry and status | off | on (status heartbeat 2 s) | on |

A viewer counts as gone after 15 s of silence. When the signal is missing or older than 8 s every gate
fails open to `driving`.

## Related documentation

- [rosbridge (WebSocket)](/development/message-contracts/rosbridge): the browser end of these topics.
- [Unit Container Lifecycle](/development/unit-container-lifecycle): the unit relay that hosts the cloud relays.
- [Navigation: ROS Integration](/development/webui/navigation/ros-integration): how the overlays are drawn.
