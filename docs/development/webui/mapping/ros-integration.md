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

## Starting and stopping a mapping session

From [API Reference § Mapping (SLAM) Operations](/development/api-reference#mapping-slam-operations):

### Start

`POST /api/mapping/start` initiates SLAM (gmapping) mode on the target unit.

```json
{ "unit_id": "01JZ8P9WZ0UNIT00000000000" }
```

### Stop and save

`POST /api/mapping/stop` saves the active occupancy grid, generates thumbnail metadata, and uploads
assets. This is the request the `ConfirmSaving` dialog sends once the operator names the map:

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "display_map_name": "Warehouse Sector 4",
  "homebase_x": 0.0,
  "homebase_y": 0.0
}
```

`homebase_x` / `homebase_y` here are the pose captured automatically when mapping started (see
[Overview § Saving the map](/development/webui/mapping/overview#saving-the-map-stop-flow)), not a
value the operator enters.

::: info Save is asynchronous
Saving a SLAM map takes longer than the standard 30-second HTTP timeout budget used elsewhere on
this platform (see [Message Contracts § Command Correlation and Retry Architecture](/development/message-contracts#command-correlation-and-retry-architecture)).
`POST /api/mapping/stop` therefore returns `200 OK` immediately with a `request_id` and `map_ulid`:

```json
{
  "success": true,
  "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "map_ulid": "01JZ8QK2H0000000000000MAP"
}
```

The frontend then connects to an SSE stream on `GET /api/mapping/progress/:request_id` to follow the
save through to completion. This is presumably what backs the `MapSaving` progress overlay described
in [Overview](/development/webui/mapping/overview#saving-the-map-stop-flow); the exact client-side
subscription code is not covered in the source material available for this page. See
[Message Contracts § Mapping Subsystem](/development/message-contracts#_3-mapping-subsystem-header-mapping).
:::

## MQTT command envelope (`header: "mapping"`)

The HTTP stop request above is relayed to the robot as a `mapping` / `stop` command on
`/unit_<ULID>/system_command`, using the shared
[command envelope](/development/message-contracts#command-payload-envelope):

```json
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

Note that the full homebase pose here carries an orientation quaternion (`homebase_o{x,y,z,w}`) in
addition to the `x`/`y` position the REST body and the `maps_data` table carry. This is the same
shape `navigation` / `init` later reads back out when the map is loaded (see
[Message Contracts § Navigation Subsystem](/development/message-contracts#_2-navigation-subsystem-header-navigation)),
which is out of scope for this page.

::: warning Only `stop` is documented in the command catalogue
[State & Behavior](/development/state-and-behavior)'s activity state machine implies `pause`,
`resume`, and `discard` transitions exist for a mapping session (`mapping_active` ↔
`mapping_paused`, and `mapping_active` → `idle` on discard). The Mapping Subsystem entry in the
Command Reference Catalogue only documents `stop` in this level of detail; the exact command verbs
and payloads for pause/resume/discard are not spelled out there and are not guessed at here.
:::

### Mapping progress feedback (`header: "mapping_progress"`)

Progress on a save streams back as `mapping_progress` feedback, matching the `request_id` from the
stop command:

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
| `cloud_pending` | Written to local Unit media-server only. Cloud replication completes on the next sync interval. |
| `failed` | Mapping save failed. Session remains open for retry (robot activity reports `mapping_stop_failed`). |

See [Message Contracts § Mapping Progress Feedback](/development/message-contracts#mapping-progress-feedback-header-mapping-progress)
for the source of this table.

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
availability (needed for viewing the map from elsewhere, or for a fleet-wide backup) follows later
via `sync_agent` without blocking the operator.

For the robot activity state machine and session-recovery behavior this save flow interacts with
(not repeated here), see [Navigation: Manual Override & Autopilot](/development/webui/navigation/manual-and-autopilot)
and [Safety Watchdog](/development/ros/safety-watchdog).

## Related

- [Overview](/development/webui/mapping/overview): Play/Pause/Stop, the live map view, and the
  save-on-stop UI flow
- [Manual Override and Autonomous Exploration](/development/webui/mapping/manual-and-autonomous):
  the two driving modes during a mapping session
- [Architecture](/development/architecture)
- [State & Behavior](/development/state-and-behavior): the robot activity state machine and session
  reconnection/recovery behavior
