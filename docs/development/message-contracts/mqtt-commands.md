---
outline: deep
search: false
---

# MQTT Commands

<RoleBadge role="developer" />

The command channel ([path A](/development/message-contracts/#two-control-paths)): one MQTT topic from
the cloud to a unit, one back. Every mode change, start, stop, save and toggle the dashboard makes
goes through here, wrapped by an [HTTP endpoint](/development/message-contracts/http-api).

## Topics {#topics}

| MQTT topic | Direction | Producer | Consumer | Robot ROS topic |
| --- | --- | --- | --- | --- |
| `/unit_<ULID>/system_command` | cloud → robot | `backend_node` | `system_command.py` | `/system_command` (`std_msgs/String`) |
| `/unit_<ULID>/system_feedback` | robot → cloud | `system_command.py` | `backend_node` | `/system_feedback` (`std_msgs/String`) |

Both carry a JSON document as the string payload. On the unit's local dashboard the browser also
publishes one frame type straight onto `system_command` over MQTT-over-WebSocket: the
[`hardware.heartbeat`](/development/message-contracts/heartbeat-and-lease#heartbeat-frame).

## Command envelope {#command-envelope}

Built by `createMSDSystemData()` in `backend_node`:

```json
{
  "header": "navigation",
  "command": "init",
  "config": {
    "resource": { "map_name": "01JZ8QK2H0000000000000MAP" }
  },
  "metadata": {
    "timestamp": "2026-08-12T04:11:52.913Z",
    "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10"
  }
}
```

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `header` | string | yes | Which handler on the robot: `hardware`, `navigation`, `mapping`, `boustrophedon`, `autoalign`, `emergency_stop`, `manual`, `autopilot` |
| `command` | string | yes | The action within that handler. Unknown values are logged and dropped, with no feedback (the HTTP call then times out). |
| `config` | object | per command | Parameters, usually under `config.resource` |
| `data` | object | `hardware.ping` only | The lease fields |
| `metadata.request_id` | UUID v4 | yes | Minted per HTTP request, echoed in the feedback |
| `metadata.timestamp` | ISO 8601 | yes | Sender time, for tracing only |

## Feedback envelope {#feedback-envelope}

```json
{
  "header": "navigation",
  "command": "init",
  "data": { "status": true, "message": "Navigation started" },
  "metadata": { "timestamp": 1786503112.913, "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10" }
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `data.status` | boolean | `true` done, `false` refused or failed. The backend also accepts the string `"true"`. |
| `data.message` | string | Human-readable reason, shown to the operator |
| `metadata.timestamp` | float | Robot time, `rospy.get_time()` seconds |
| `metadata.request_id` | UUID v4 | Copied from the command; `"NaN"` when the command had none |

How the backend turns this into an HTTP answer: [HTTP API § Response envelopes](/development/message-contracts/http-api#envelopes).

## Correlation and retry {#correlation-and-retry}

![Command Correlation and Retry Architecture](./diagrams/message-contracts-command-correlation-and-retry-architectu.drawio)

| Parameter | Default | Where | Meaning |
| --- | --- | --- | --- |
| `DEFAULT_TIMEOUT` | `30000` ms | `backend_node` | How long the HTTP request waits for feedback before `504` |
| `COMMAND_RETRY_INTERVAL` | `1500` ms (env) | `backend_node` | Resend period while no feedback has arrived |
| dedupe window | last 512 `request_id`s | `system_command.py` | A resend with a known `request_id` is not executed again; its cached feedback is replayed |

The backend resends the **identical** envelope (same `request_id`) until feedback arrives. The robot
executes each `request_id` once and answers repeats from its cache, so a resend can never re-run a
launch or a save.

::: danger `hardware.*` is never deduplicated, and `ping` is never retried
The robot skips deduplication for every `header: "hardware"` command, because a lost ping must reach
the watchdog. The backend never retries `hardware.ping` for the same reason. The other `hardware`
commands (`check`, `init`, `stop`, `idle`) are still retried by the backend, so a slow answer can make
the robot execute them more than once. They are written to be safe to repeat.
:::

## Command catalogue {#catalogue}

Each subsection lists the verbs, the parameters the robot reads, and the ROS side effect, so a
command can be traced into the robot stack. `/switch_mode` is `msd700_msgs/SwitchMode` with
`mode, open_rviz, use_simulator, map_file, point_mode, use_autocover`; see
[Dynamic Mode Switching](/development/ros/mode-switching).

### `hardware` {#hardware}

| Command | Parameters | Robot side | Sent by |
| --- | --- | --- | --- |
| `ping` | `data` lease block | Lease, watchdog, status report | [`POST /api/hardware/ping`](/development/message-contracts/http-api#hardware-ping); full contract in [Heartbeat & Lease](/development/message-contracts/heartbeat-and-lease#ping-request) |
| `heartbeat` | `{ "page": "navigation" }` | Refreshes the 2 s presence tier only | browser, MQTT over WebSocket, [5 Hz](/development/message-contracts/heartbeat-and-lease#heartbeat-frame) |
| `check` | none | `/hardware_node/check_hardware` (`Trigger`) | [`POST /api/hardware/check`](/development/message-contracts/http-api#hardware-commands) |
| `init` | none | `/hardware_node/init_all` (`SetBool`) | [`POST /api/hardware/init`](/development/message-contracts/http-api#hardware-commands) |
| `stop` | none | `/hardware_node/shutdown_all_hardware` (`SetBool`) | [`POST /api/hardware/stop`](/development/message-contracts/http-api#hardware-commands) |
| `idle` | none | `/switch_mode(mode=idle)`: tears navigation/mapping down, robot stays powered | [`POST /api/hardware/idle`](/development/message-contracts/http-api#hardware-commands) |
| `battery_update` | `config.resource.value` | Overrides the reported battery percentage | no current caller |

### `navigation` {#navigation}

```json
// init: open a map and bring navigation up
{
  "header": "navigation",
  "command": "init",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "default_save_path": "/home/ubuntu/ros_maps",
      "homebase_x": 1.25, "homebase_y": -0.5, "homebase_z": 0.0,
      "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
    },
    "ensure_unpaused": true
  },
  "metadata": { "timestamp": "...", "request_id": "..." }
}

// pointstamped: a single point (legacy path, see below)
{
  "header": "navigation",
  "command": "pointstamped",
  "config": { "resource": { "X": 3.1416, "Y": -1.2, "Z": 0.0 } },
  "metadata": { "timestamp": "...", "request_id": "..." }
}
```

| Command | Parameters | Robot side |
| --- | --- | --- |
| `init` | `config.resource.map_name` (map ULID = `<ULID>.pgm/.yaml`), `homebase_*` when the map has one, `config.ensure_unpaused` | Releases a stale manual override, clears path overlays and every motion lock, calls `/map/retire` (see [map delivery](/development/message-contracts/bridge-topics#map-delivery)), downloads the map files from the media server if they are not on disk, calls `/switch_mode(mode=navigation, map_file=<ULID>)`, then publishes the home base on `/initialpose`. Activity `navigation_ready`. |
| `deactivate` | none | `/switch_mode(mode=idle)`, `/map/reset`. Activity `idle`. |
| `pointstamped` | `config.resource.X/Y/Z` | Publishes `geometry_msgs/PointStamped` (`frame_id: map`) on `/clicked_point`. Activity `navigation_point_published`. |

`default_save_path` is still sent for older robot images; current images use their own `MAPS_FOLDER`.
Pinpoint navigation in the current dashboard does **not** use `pointstamped`; it sends `move_base`
goals over [rosbridge](/development/message-contracts/rosbridge#move-base-action).

HTTP entry points: [`/api/navigation/init`](/development/message-contracts/http-api#navigation-init),
[`/deactivate`](/development/message-contracts/http-api#navigation-deactivate),
[`/pointstamped`](/development/message-contracts/http-api#navigation-pointstamped).

### `mapping` {#mapping}

```json
// stop: save the map and upload it
{
  "header": "mapping",
  "command": "stop",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "display_map_name": "Production Hall Level 1",
      "map_ulid": "01JZ8QK2H0000000000000MAP",
      "created_by": "01JZ7YV5CQUSER00000000000",
      "default_save_path": "/home/ubuntu/ros_maps",
      "unit_id": "01JZ8P9WZ0UNIT00000000000",
      "homebase_x": 1.2, "homebase_y": 0.5, "homebase_z": 0.0,
      "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
    }
  },
  "metadata": { "timestamp": "...", "request_id": "..." }
}
```

| Command | Parameters | Robot side |
| --- | --- | --- |
| `start` | none | Checks the robot can store a map, then `/switch_mode(mode=explore)`. Activity `mapping_active`. |
| `pause` | none | Holds the `operator_pause` motion lock (`/emergency_pause`); the SLAM session stays open. Activity `mapping_paused`. |
| `stop` | the block above | `/mapsaver/full_path` writes `<map_name>.pgm/.yaml`, uploads them to the unit's media server (required) and the cloud's (best effort) through [`/api/media/uploadMap`](/development/message-contracts/http-api#media-server), switches to idle. Reports through [`mapping_progress`](#mapping-progress), not through plain feedback. |
| `discard` | none | Holds the `mapping_teardown` lock, `/switch_mode(mode=idle)`, `/map/reset`. Activity `idle`. |

`map_name` and `map_ulid` are the same ULID (the file name); `display_map_name` is what the operator
typed. HTTP entry points: [`/api/mapping`](/development/message-contracts/http-api#mapping-control),
[`/api/mapping/discard`](/development/message-contracts/http-api#mapping-discard).

#### `mapping_progress` {#mapping-progress}

Saving outlives the 30 s HTTP timeout, so `mapping.stop` answers the HTTP call at once and the robot
reports on `system_feedback` with `header: "mapping_progress"`. The backend forwards each `data` block
to the [SSE stream](/development/message-contracts/http-api#mapping-progress) and never resolves a
pending request with it.

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
  "metadata": { "timestamp": 1734000000.0, "request_id": "..." }
}
```

| `progress` | `stage` | Meaning |
| --- | --- | --- |
| 15 | `saving_map` | `map_saver` is writing the files |
| 30 | `map_saved` | Files on disk, preparing the upload |
| 50 | `uploading` | Uploading to the unit's media server |
| 85 | `upload_complete` or `cloud_pending` | Stored on the unit; cloud copy done, or left to sync |
| 95 | `switching_mode` | Returning to idle |
| 100 | `completed` | Final event (`terminal: true`) |
| -1 | `save_failed` | Final event, nothing stored |

`terminal` is `true` on the last event only, and only that event carries `outcome`:

| `outcome` | Meaning |
| --- | --- |
| `completed` | Stored on the unit and the cloud |
| `cloud_pending` | Stored on the unit; the cloud copy follows through [data sync](/development/data-sync) |
| `failed` | Stored nowhere; the SLAM session stays open for a retry |

An older robot image answers `stop` with a plain `header: "mapping"` feedback; the backend converts it
into one terminal progress event (`100`/`completed` or `-1`/`error`).

### `boustrophedon` {#boustrophedon}

```json
{
  "header": "boustrophedon",
  "command": "init",
  "config": {
    "use_autocover": false,
    "polygon": [],
    "areas": [
      [ { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 }, { "x": 10.0, "y": 5.0 }, { "x": 0.0, "y": 5.0 } ]
    ],
    "exclusions": [
      [ { "x": 3.0, "y": 2.0 }, { "x": 5.0, "y": 2.0 }, { "x": 5.0, "y": 4.0 }, { "x": 3.0, "y": 4.0 } ]
    ],
    "ensure_unpaused": true
  },
  "metadata": { "timestamp": "...", "request_id": "..." }
}
```

| Command | Parameters | Robot side |
| --- | --- | --- |
| `init` | `use_autocover`, and for custom coverage either `areas` + `exclusions` (playlist, takes precedence) or `polygon` (one area) | Releases manual override and motion locks, activity `boustrophedon_initializing`, `/switch_mode(mode=boustrophedon, use_autocover)`. A playlist goes out as JSON `{ areas, exclusions }` on `/msd700/coverage_plan` (`std_msgs/String`, latched); a single area as `geometry_msgs/Polygon` on `/msd700/coverage_polygon`. Polygons with fewer than 3 points are dropped. |
| `pause` | `config.pause` (`true` pause, `false` resume) | `/path_coverage/pause` or `/path_coverage/resume` (`Empty`); an older coverage node without them falls back to the `operator_pause` motion lock. Activity `paused` while paused. |
| `deactivate` | `config.use_autocover` (must match `init`) | Cancels the goal on `/move_base/cancel`, clears plan and polygon, `/path_coverage/cancel`, `/switch_mode(mode=stop_additional_feature)`. |

The generated path comes back as an overlay on
[`string/boustrophedon_path`](/development/message-contracts/bridge-topics#topic-map) and is ACKed by the
browser; the lifecycle as a plain string (`running`, `complete`, `aborted`; a cancelled run publishes nothing) on `string/coverage_status`.

HTTP entry points: [`init`](/development/message-contracts/http-api#boustrophedon-init),
[`pause`](/development/message-contracts/http-api#boustrophedon-pause),
[`deactivate`](/development/message-contracts/http-api#boustrophedon-deactivate).

### `autoalign` {#autoalign}

No parameters; each answers with `data.status` and `data.message`.

| Command | Robot side |
| --- | --- |
| `start` | `/alignment/start` (`Trigger`): solve the robot pose against the map. Activity `auto_aligning`. |
| `status` | `/check_alignment` (`Trigger`): read-only, no activity change |
| `reset` | `/alignment/reset` (`Trigger`): discard the solve and return to navigation |

HTTP entry point: [`/api/autoalign/*`](/development/message-contracts/http-api#autoalign).

### `emergency_stop` {#emergency-stop}

| Command | Robot side |
| --- | --- |
| `activate` | `std_msgs/Bool(true)` on `/emergency_stop` (latched), `/switch_mode(mode=idle)`, `/map/reset`. Activity `emergency_stopped`. |
| `deactivate` | `std_msgs/Bool(false)` on `/emergency_stop`, cancels any goal on `/move_base/cancel`. The motion stack is not restarted. Activity `emergency_cleared`. |

HTTP entry point: [`/api/emergency_stop`](/development/message-contracts/http-api#emergency-stop).

### `manual` {#manual}

Teleop is an overlay on top of whatever mode is running: it never calls `/switch_mode`, so navigation
stays up. The driving itself arrives on
[`string/key_vel`](/development/message-contracts/bridge-topics#json-twist).

| Command | Robot side |
| --- | --- |
| `enable` | Cancels the active goal, pauses coverage through its own service, releases the emergency-pause lock, sets `/msd700/manual_state` to `true`, opens the `/mux/key_vel` channel (twist_mux priority 90). Activity `manual`. |
| `disable` | Publishes a zero twist and closes the channel so the robot stops at once, sets `/msd700/manual_state` to `false`, resumes coverage if it was paused by the override, restores the previous activity. |

HTTP entry point: [`/api/manual`](/development/message-contracts/http-api#manual).

### `autopilot` {#autopilot}

| Command | Robot side |
| --- | --- |
| `enable` | `/msd700/autopilot_state` `true`: `operation_supervisor` takes over waypoint dispatch (see [Operation Sync](/development/message-contracts/operation-sync)). Suspends the ping-loss watchdog and releases only the watchdog's own hold, never an operator pause. |
| `disable` | `/msd700/autopilot_state` `false`: dispatch returns to the browser loop, the ping-loss watchdog is armed again. |

HTTP entry point: [`/api/autopilot`](/development/message-contracts/http-api#autopilot).

## Robot activity values {#robot-activity}

`robot_activity` in the [ping response](/development/message-contracts/heartbeat-and-lease#ping-response)
is set by the handlers above. The values a dashboard sees most:

| Value | Set by |
| --- | --- |
| `idle` | `hardware.idle`, `navigation.deactivate`, `mapping.discard` |
| `navigation_ready`, `navigation_point_published` | `navigation.init`, `navigation.pointstamped` |
| `mapping_active`, `mapping_paused` | `mapping.start`, `mapping.pause` |
| `boustrophedon_initializing`, `paused` | `boustrophedon.init`, `boustrophedon.pause` |
| `auto_aligning` | `autoalign.start` |
| `manual` | `manual.enable` |
| `emergency_stopped`, `emergency_cleared` | `emergency_stop.*` |
| `stuck` | the stuck detector, not a command |
| `*_failed` (for example `mapping_failed`) | the matching command, on failure |

## Related documentation

- [HTTP API](/development/message-contracts/http-api): the endpoints that send these commands.
- [State and Behavior](/development/state-and-behavior): how activities and modes move.
- [Safety Watchdog](/development/ros/safety-watchdog): the tiers `ping` and `heartbeat` feed.
