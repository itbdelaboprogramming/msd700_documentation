---
outline: deep
search: false
---

# ROS Integration

<RoleBadge role="developer" />

The wire contract behind the [Mapping](/development/webui/mapping/overview) page: the REST calls
that start and stop a SLAM session, the MQTT command/feedback envelope carrying that same request to
`system_command.py`, and what the robot actually does on disk and across the network when a map is
saved. For the page's own behavior, see [Overview](/development/webui/mapping/overview) and
[Manual Override and Autonomous Exploration](/development/webui/mapping/manual-and-autonomous).

## Starting and stopping a mapping session {#starting-and-stopping-a-mapping-session}

One endpoint, [`POST /api/mapping`](/development/message-contracts/http-api#mapping-control), drives the whole session; exactly
one of `start`, `pause`, `stop` is `true` per call. Discard has its own endpoint.

| Button | HTTP | MQTT to the robot | Robot side |
| --- | --- | --- | --- |
| Play | `POST /api/mapping` `{ unit_id, start: true }` | [`mapping.start`](/development/message-contracts/mqtt-commands#mapping) | `/switch_mode(explore)`; activity `mapping_active` |
| Pause | `POST /api/mapping` `{ unit_id, pause: true }` | [`mapping.pause`](/development/message-contracts/mqtt-commands#mapping) | `operator_pause` motion lock; activity `mapping_paused` |
| Stop, then Save | `POST /api/mapping` `{ unit_id, stop: true, map_name, homebase_* }` | [`mapping.stop`](/development/message-contracts/mqtt-commands#mapping) | save and upload, below |
| Stop, then Discard | [`POST /api/mapping/discard`](/development/message-contracts/http-api#mapping-discard) `{ unit_id }` | [`mapping.discard`](/development/message-contracts/mqtt-commands#mapping) | `/switch_mode(idle)`, `/map/reset` |

The save request the `ConfirmSaving` dialog sends once the operator names the map:

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "stop": true,
  "map_name": "Warehouse Sector 4",
  "homebase_x": 0.0, "homebase_y": 0.0, "homebase_z": 0.0,
  "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
}
```

The `homebase_*` pose is the one captured automatically when mapping started (see
[Overview § Saving the map](/development/webui/mapping/overview#saving-the-map-stop-flow)), not a value
the operator enters. The backend mints the map ULID, keeps `map_name` as the display name, and passes
the pose through to the robot so it is stored in the same upload that creates the map row.

::: info Save is asynchronous
Saving takes longer than the 30-second HTTP budget used for other commands (see
[MQTT Commands § Correlation and retry](/development/message-contracts/mqtt-commands#correlation-and-retry)). The stop call
therefore answers at once:

```json
{
  "success": true,
  "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "map_ulid": "01JZ8QK2H0000000000000MAP",
  "msg": "Map save initiated. Track progress via /api/mapping/progress/:request_id"
}
```

The `MapSaving` overlay then opens
[`GET /api/mapping/progress/:request_id?token=<jwt>`](/development/message-contracts/http-api#mapping-progress) (Server-Sent
Events) and follows it to the terminal event.
:::

## MQTT command envelope (`header: "mapping"`)

The stop request reaches the robot as `mapping.stop` on `/unit_<ULID>/system_command`, in the shared
[command envelope](/development/message-contracts/mqtt-commands#command-envelope). `config.resource` carries `map_name` and
`map_ulid` (both the new ULID, which is the file name on disk), `display_map_name` (what the operator
typed), `created_by`, `unit_id` and the seven `homebase_*` fields. The full payload is in
[MQTT Commands § `mapping`](/development/message-contracts/mqtt-commands#mapping); `navigation.init` later reads the same home
base back out.

### Mapping progress feedback (`header: "mapping_progress"`)

The robot reports the save on `system_feedback` with `header: "mapping_progress"` and the stop
command's `request_id`; the backend forwards each `data` block to the SSE stream:

| `progress` | `stage` |
| --- | --- |
| 15 | `saving_map` |
| 30 | `map_saved` |
| 50 | `uploading` |
| 85 | `upload_complete` or `cloud_pending` |
| 95 | `switching_mode` |
| 100 | `completed` (terminal) |
| -1 | `save_failed` (terminal) |

The last event carries `terminal: true` and an `outcome`:

| Outcome | Description |
| --- | --- |
| `completed` | Written to both the unit's media server and the cloud's. |
| `cloud_pending` | Written to the unit's media server only; the cloud copy follows through sync. |
| `failed` | Nothing stored. The session stays open for a retry (activity `mapping_stop_failed`). |

If the robot goes silent for 90 s the backend ends the stream itself with `stage: "no_response"`. Full
contract: [MQTT Commands § `mapping_progress`](/development/message-contracts/mqtt-commands#mapping-progress).

## Robot-side save: `map_saver` and preflight checks

When `mapping` / `stop` reaches the robot, it does not upload blindly. A preflight health check
verifies the local disk and media endpoints are reachable before anything is written:

![Robot-side save: mapsaver and preflight checks](./diagrams/ros-integration-robot-side-save-mapsaver-and-preflight-c.drawio)

If the local disk is unwritable, the save is refused outright rather than attempted, to avoid
leaving a corrupt or partial run on disk. Once preflight passes, `map_saver` generates the
occupancy grid assets: a `.pgm` image, a `.yaml` metadata file, and a thumbnail.

## Two-tier upload and cloud replication

`map_saver`'s output is then uploaded to two independent targets, with different requirement levels:

| Storage Target | Requirement Level | Failure Implication |
| --- | --- | --- |
| **Unit Local media-server** (`media_local`, `:3003`) | **Mandatory** | If local save fails, the robot cannot navigate this map. The SLAM session remains active (`mapping_stop_failed`) so the operator can retry saving. |
| **Cloud Central media-server** (`media-server`, `:3003`) | **Best Effort** | If cloud upload fails (e.g. the robot is offline), the map is marked `cloud_pending`. The background `sync_agent` replicates the map files automatically once internet connectivity returns. |

This dual-target design is why a map recorded in a warehouse with no internet is still immediately
usable for navigation on the unit itself: only the mandatory local upload gates that. Cloud
availability (needed for viewing the map from elsewhere, or for a backup that spans units) follows later
via `sync_agent` without blocking the operator.

For the robot activity state machine and session-recovery behavior this save flow interacts with
(not repeated here), see [Navigation: Manual Override & Autopilot](/development/webui/navigation/manual-and-autopilot)
and [Safety Watchdog](/development/ros/safety-watchdog).

## Related

- [Message Contracts § Mapping page](/development/message-contracts/#trace-mapping): every message a mapping session sends.
- [Overview](/development/webui/mapping/overview): Play/Pause/Stop, the live map view, and the
  save-on-stop UI flow
- [Manual Override and Autonomous Exploration](/development/webui/mapping/manual-and-autonomous):
  the two driving modes during a mapping session
- [Architecture](/development/architecture)
- [State & Behavior](/development/state-and-behavior): the robot activity state machine and session
  reconnection/recovery behavior
