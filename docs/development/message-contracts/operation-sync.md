---
outline: deep
search: false
---

# Operation Sync

<RoleBadge role="developer" />

Multi-waypoint runs are driven by the browser (the `Nav2D` loop sends one `move_base` goal at a time).
`operation_supervisor.py` on the robot keeps a copy of the run so that it can take over dispatch when
Autopilot is on, keep going after the tab closes, and hand the run back to a returning dashboard.
This page is the protocol between the two.

![Operation Supervisor Synchronization](./diagrams/message-contracts-operation-supervisor-synchronization.drawio)

## Topics {#topics}

| Robot topic | MQTT / cloud (`/unit_<ULID>/...`) | Direction | Type |
| --- | --- | --- | --- |
| `/string/operation_sync` | `string/operation_sync` | browser → supervisor | `std_msgs/String`, JSON |
| `/string/operation_progress` | `string/operation_progress` | supervisor → browser | `std_msgs/String`, JSON |
| `/string/operation_snapshot` | `string/operation_snapshot` | supervisor → browser | `std_msgs/String`, JSON, latched |
| `/msd700/supervisor_status` | (robot only) | supervisor → `system_command.py` | `std_msgs/String`, `{ active, detail }`, latched |
| `/msd700/autopilot_state`, `/msd700/manual_state` | (robot only) | `system_command.py` → supervisor | `std_msgs/Bool`, latched |

The browser publishes through rosbridge on `<root>/string/operation_sync`
([publications](/development/message-contracts/rosbridge#publications)) and subscribes to the other two.

## Browser → supervisor: `operation_sync` {#sync-messages}

Every message is a JSON object with a `type` and the browser's `timestamp` (seconds). The supervisor
re-publishes its [snapshot](#snapshot) after processing **any** message, which is how the browser
confirms a message arrived.

### `batch` {#batch}

Records a run. Sent whenever a run starts or restarts; replaces any previous batch.

```json
{
  "type": "batch",
  "operation": "multi_pinpoint",
  "route_mode": "round-trip",
  "waypoints": [
    { "position": { "x": 1.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } },
    { "position": { "x": 4.5, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } }
  ],
  "current_index": 0,
  "direction": "forward",
  "map_name": "01JZ8QK2H0000000000000MAP",
  "coverage": null,
  "timestamp": 1786503112.913
}
```

| Field | Values | Meaning |
| --- | --- | --- |
| `operation` | `single_pinpoint`, `multi_pinpoint`, `homebase`, `coverage`, `custom_coverage`, `playlist`, `automap` | What kind of run. Only the pinpoint kinds are ever dispatched by the supervisor; the others are **record only** so a returning tab can restore the view. |
| `route_mode` | `basic`, `round-trip`, `loop` | What happens after the last waypoint |
| `waypoints` | ROS poses | Same shape as a saved route's `route_points` |
| `current_index` | integer | Waypoint the run is at |
| `direction` | `forward`, `backward` | Only meaningful on Round Trip: index 2 of A-B-C-D heading out is not index 2 heading home |
| `map_name` | map ULID | The map the run belongs to |
| `coverage` | object or `null` | Record only: `{ use_autocover: true }`, `{ polygon }`, or `{ areas, exclusions }` |

### `progress` {#progress}

`{ "type": "progress", "current_index": 3, "direction": "forward" }`, sent each time the browser
dispatches a waypoint. Ignored while the supervisor itself is driving.

### `takeover` {#takeover}

`{ "type": "takeover", "current_index": 3, "direction": "backward" }`. Autopilot was switched on: the
supervisor starts dispatching from this index in this direction. The browser sends `batch` followed by
`takeover`, waits up to 2.5 s for a snapshot that echoes the same waypoint count and `paused: false`, and
retries up to three times; if the robot never confirms, the browser keeps driving itself.

### `release` {#release}

`{ "type": "release" }`. Autopilot was switched off; the supervisor stands down and the browser loop
resumes from the last [`operation_progress`](#progress-out).

### `pause` {#pause}

`{ "type": "pause" }`. The operator paused: dispatch stops, the batch is kept, `paused` becomes `true`.

### `stop` and `complete` {#stop-complete}

`{ "type": "stop" }` (the operator stopped, or the browser gave up on a run it cannot resume) and
`{ "type": "complete" }` (the route finished) both clear the batch.

### `resync` {#resync}

`{ "type": "resync" }`. Changes nothing; asks the supervisor to publish its snapshot again. Sent by a
dashboard that just connected, because the latched copy is not guaranteed to survive the MQTT hop to a
new subscriber.

## Supervisor → browser {#supervisor-to-browser}

### `operation_progress` {#progress-out}

Published while the supervisor drives, and when it finishes:

```json
{
  "type": "progress",
  "current_index": 2,
  "active": true,
  "operation": "multi_pinpoint",
  "direction": "forward",
  "timestamp": 1786503150.2
}
```

`type` is `progress` or `complete`. The browser uses a jump of more than one index to report a skipped
pinpoint, and resumes its own loop from `current_index` and `direction` on release.

### `operation_snapshot` {#snapshot}

The full state of the run, latched, re-published after every sync message:

```json
{
  "type": "snapshot",
  "operation": "multi_pinpoint",
  "route_mode": "loop",
  "waypoints": [ { "position": { "x": 1.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } } ],
  "current_index": 0,
  "direction": "forward",
  "map_name": "01JZ8QK2H0000000000000MAP",
  "coverage": null,
  "active": true,
  "driving": false,
  "paused": false,
  "autopilot": false,
  "manual": false,
  "timestamp": 1786503150.2
}
```

| Field | Meaning |
| --- | --- |
| `active` | A run is set up: the supervisor is driving, or a batch is recorded |
| `driving` | The supervisor itself is dispatching goals (autopilot takeover) |
| `paused` | The operator paused; batch kept, nothing dispatching |
| `autopilot`, `manual` | Mirrors of the robot's flags |

A dashboard opened in a new tab has lost its `sessionStorage`, so it rebuilds pins, route mode and
coverage overlays from this message.

## Robot-side behaviour {#robot-side}

| Parameter | Default | Meaning |
| --- | --- | --- |
| `~goal_timeout` | 300 s | A dispatched goal that has not finished by then counts as failed |
| `~state_max_age` | 3600 s | A persisted run older than this is not restored after a restart |

The supervisor drives only while it holds a batch, Autopilot is on, manual override is off and the run is
not paused. It persists its state to disk so a restarted node can resume.

## Related documentation

- [Navigation: Manual & Autopilot](/development/webui/navigation/manual-and-autopilot): the UI side of takeover and release.
- [MQTT Commands § autopilot](/development/message-contracts/mqtt-commands#autopilot): the flag that allows the supervisor to drive.
- [rosbridge § move_base action client](/development/message-contracts/rosbridge#move-base-action): how the browser loop dispatches goals.
