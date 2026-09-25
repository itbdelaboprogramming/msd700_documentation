---
outline: deep
search: false
---

# HTTP API (Web)

<RoleBadge role="developer" />

Every HTTP endpoint the dashboard, the Admin Console and the robot call: `backend_node` (Express),
its mounted routers (`/admin/api`, `/enroll`, `/sync`), and `media-server`. Endpoints that command
the robot are thin wrappers around an MQTT envelope; for what the robot receives, follow the link on
each endpoint to [MQTT Commands](/development/message-contracts/mqtt-commands).

## Conventions {#conventions}

### Base URLs {#base-urls}

| Environment | `backend_node` | `media-server` |
| --- | --- | --- |
| Production cloud | `https://msd.nglobal.jp/services/rosbackend` (Apache → `localhost:5000`) | `NEXT_PUBLIC_MEDIA_URL` (container `nakayama_media`, port `3003`) |
| Development cloud | `http://<server-ip>:5001` | dev media container |
| Unit local dashboard | `http://<unit-ip>:5002` (`backend_local`) | `media_local`, port `3003` |

In local mode the dashboard swaps the host of every built URL for the host the browser is actually
on (`withBrowserHost` in `src/config/apiConfig.ts`), so the same build works on any LAN address.

### Authentication {#authentication}

Protected routes take a JWT in the `Authorization` header:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Tokens are HS256, verified against the shared keyring (`/run/secrets/jwt_keyring` in the container;
production falls back to `JWT_SECRET_KEY`/`JWT_SECRET`). The active key signs, recently rotated keys
still verify during a grace period.

![Authentication and Authorization](./diagrams/api-reference-authentication-and-authorization.drawio)

| Token `typ` | Accepted on | Refused on |
| --- | --- | --- |
| `access` (or no `typ`, a pre-refresh token) | every operator route | nothing else |
| `refresh` | `/user/refresh` only | every other route, `401` |
| `admin` | `/admin/api/*` | operator routes, `401` (it carries no `user_id`) |

### Unit authorization (`attachUnit`) {#attach-unit}

Any request that carries `unit_id` (body or query) is checked right after the token: the caller must
hold an **active rental profile** that includes that unit. No handler can skip it, because
`verifyToken` chains straight into `attachUnit`.

![Unit Authorization Middleware (attachUnit)](./diagrams/api-reference-unit-authorization-middleware-attachunit.drawio)

| Result | Status | Body |
| --- | --- | --- |
| `unit_id` is not a ULID | `400` | `{ success: false, msg: "Invalid unit id" }` |
| No active rental includes the unit | `403` | `{ success: false, msg: "This unit is not assigned to you" }` |
| Lookup error | `500` | fails closed |

Access decisions are cached for 60 s per user and unit.

### Response envelopes {#envelopes}

Data endpoints answer `{ success: true, data, msg? }` or `{ success: false, msg }`.

Endpoints that command the robot (every `POST` under `/api/hardware`, `/api/navigation`,
`/api/mapping` except stop, `/api/boustrophedon`, `/api/autoalign`, `/api/manual`, `/api/autopilot`,
`/api/emergency_stop`) share one shape, set by `sendCommandAndWaitForFeedback()`:

| Situation | Status | Body |
| --- | --- | --- |
| Robot answered `data.status: true` | `200` | `{ success: true, msg: <data.message>, details: <whole feedback envelope> }` |
| Robot answered `data.status: false` | `200` | `{ success: false, msg: <data.message>, error_details: <whole feedback envelope> }` |
| Feedback had no `data.status` | `500` | `{ success: false, msg: "Received malformed feedback from robot.", details }` |
| No feedback within 30 s | `504` | `{ success: false, msg: "Request timed out. No feedback received from robot for request ID: ..." }` |

A robot refusal is a `200` with `success: false` on purpose: `4xx` is kept for requests the backend
itself rejects. The feedback envelope inside `details` is specified in
[MQTT Commands § Feedback envelope](/development/message-contracts/mqtt-commands#feedback-envelope).

## Accounts {#accounts}

### `POST /user/login` {#user-login}

```json
{ "username": "operator1", "password": "SecurePassword123" }
```

```json
{
  "success": true,
  "msg": "Login user success",
  "username": "operator1",
  "full_name": "Operator One",
  "user_id": "01JZ7YV5CQUSER00000000000",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

There is no role or profile in the response. Which units the caller may touch is resolved per
request by [`attachUnit`](#attach-unit).

### `POST /user/refresh` {#user-refresh}

Body `{ "refresh_token": "..." }`. Returns `{ success: true, username, user_id, token, refresh_token }`.
`400` without a token, `401` when it is invalid, expired, not a `refresh` token, or its account no
longer exists.

### `POST /user/logout` {#user-logout}

Body (all optional): `{ "force": false, "ignore_autopilot": false }`. Releases every lease the user
holds, stops the user's legacy per-unit containers (`force` removes them), and keeps any unit in
autopilot running unless `ignore_autopilot` is `true`.

```json
{ "success": true, "msg": "Logged out", "remaining": [], "retained": [] }
```

`GET /api/unit/shutdown-status` returns `{ success, running, containers }` and
`POST /api/unit/force-stop` (`{ ignore_autopilot }`) kills whatever is left; the logout flow in
`shutdownFlow.ts` uses both.

### Registration checks {#user-register}

| Endpoint | Body | Answer |
| --- | --- | --- |
| `POST /user/register` | `{ username, email, full_name, password }` | `201 { data: { user_id } }`, `409` on a duplicate |
| `POST /user/check-username` | `{ username }` | `200 "Username available"` or a refusal |
| `POST /user/check-email` | `{ email }` | `200 "Email available"` or a refusal |

## Units and lease {#units}

### `GET /unit/all` {#unit-list}

The units the caller may drive, through their active rental profiles. Live status (battery, activity)
is not here; it comes from the [ping response](/development/message-contracts/heartbeat-and-lease#ping-response).

```json
{
  "success": true,
  "data": [
    {
      "id": "01JZ8P9WZ0UNIT00000000000",
      "unit_name": "Unit 01",
      "topic_root": "/unit_01JZ8P9WZ0UNIT00000000000",
      "profile_name": "Nakayama",
      "created_at": "2026-08-10T14:20:00Z"
    }
  ]
}
```

### `POST /api/hardware/ping` {#hardware-ping}

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
  "claim": true,
  "release": false,
  "page": "navigation",
  "force_takeover": false
}
```

Becomes MQTT [`hardware.ping`](/development/message-contracts/heartbeat-and-lease#ping-request); the
backend adds `user_id` (from the JWT) and `origin` (its own `DEPLOYMENT_MODE`), neither of which a
client can set. Never retried. The answer is the command shape above, with the
[ping response](/development/message-contracts/heartbeat-and-lease#ping-response) in
`details.data` plus four fields the backend merges in:

| Field | Meaning |
| --- | --- |
| `intended_mode` | What the backend last asked this unit to be in: `idle`, `navigation`, `mapping` |
| `map_id` | The map that mode was started with |
| `sync_status` | `synced` when the robot's `robot_activity` matches `intended_mode`, else `out_of_sync` |
| `needs_recovery` | `true` when out of sync; the dashboard then re-sends the init |

### `POST /api/unit/heartbeat` {#unit-heartbeat}

Body `{ unit_id }`, answer `{ success: true }`. Keeps the unit's legacy cloud container alive and
resets its idle timer. Does not touch MQTT, so it answers at once. The dashboard sends it every 15 s
while an operating page is open.

### Hardware commands {#hardware-commands}

Body `{ unit_id }` for each; the answer is the [command shape](#envelopes).

| Endpoint | MQTT command | Notes |
| --- | --- | --- |
| `POST /api/hardware/check` | [`hardware.check`](/development/message-contracts/mqtt-commands#hardware) | |
| `POST /api/hardware/init` | [`hardware.init`](/development/message-contracts/mqtt-commands#hardware) | |
| `POST /api/hardware/stop` | [`hardware.stop`](/development/message-contracts/mqtt-commands#hardware) | |
| `POST /api/hardware/idle` | [`hardware.idle`](/development/message-contracts/mqtt-commands#hardware) | Also clears the unit's intended mode, so the next login starts from idle. Sent on a non-autopilot logout. |

### `POST /api/lidar` (legacy) {#lidar}

Body `{ unit_id, enable, use_own_map }`. Publishes the body as-is on MQTT
`/unit_<ULID>/lidar_command` and answers immediately. Nothing on the current robot image subscribes to
that topic, so it has no effect; the Mapping page still calls it.

## Navigation and motion {#navigation}

### `POST /api/navigation/init` {#navigation-init}

```json
{ "unit_id": "01JZ8P9WZ0UNIT00000000000", "map_id": "01JZ8QK2H0000000000000MAP" }
```

The map must be one this unit recorded, inside a rental the caller is on; otherwise `404`
`"That map does not belong to this unit. Pick a map recorded by this robot."` The backend adds the
map's stored home base and sends [`navigation.init`](/development/message-contracts/mqtt-commands#navigation).
`400` when `map_id` is missing or not a ULID.

### `POST /api/navigation/deactivate` {#navigation-deactivate}

Body `{ unit_id }`. Sends [`navigation.deactivate`](/development/message-contracts/mqtt-commands#navigation)
and clears the intended mode.

### `POST /api/navigation/pointstamped` {#navigation-pointstamped}

```json
{ "unit_id": "01JZ8P9WZ0UNIT00000000000", "x": 5.25, "y": -3.1, "z": 0.0 }
```

Lower-case `x`, `y`, `z`, all numbers (`400` otherwise), rounded to 4 decimals and sent as
`config.resource.X/Y/Z` in [`navigation.pointstamped`](/development/message-contracts/mqtt-commands#navigation).
The robot republishes it on `/clicked_point`. The current dashboard does not call this endpoint:
pinpoints travel as `move_base` goals over [rosbridge](/development/message-contracts/rosbridge#move-base-action).

### `POST /api/emergency_stop` {#emergency-stop}

Body `{ unit_id, enable }`. `enable: true` sends
[`emergency_stop.activate`](/development/message-contracts/mqtt-commands#emergency-stop) and clears the
intended mode; `false` sends `deactivate`.

### `POST /api/manual` {#manual}

Body `{ unit_id, enable }`. Sends [`manual.enable`](/development/message-contracts/mqtt-commands#manual)
or `manual.disable`. The driving itself is not HTTP: see
[rosbridge § Publications](/development/message-contracts/rosbridge#publications) (`server/key_vel`).

### `POST /api/autopilot` {#autopilot}

Body `{ unit_id, enable }`. Sends [`autopilot.enable`](/development/message-contracts/mqtt-commands#autopilot)
or `autopilot.disable`. The backend pins the new value for 5 s so a ping already in flight cannot
report the old one back over it, and disabling also ends container retention at once.

## Coverage (boustrophedon) {#coverage}

### `POST /api/boustrophedon/init` {#boustrophedon-init}

One endpoint, three forms. `use_autocover` must be a boolean (`400` otherwise).

```json
// Auto coverage: the whole map
{ "unit_id": "01JZ8P9WZ0UNIT00000000000", "use_autocover": true }

// One custom area (legacy single polygon)
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "use_autocover": false,
  "polygon": [ { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 }, { "x": 10.0, "y": 5.0 } ]
}

// Playlist: ordered cover areas plus keep-out polygons
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "use_autocover": false,
  "areas": [
    [ { "x": 0.0, "y": 0.0 }, { "x": 12.0, "y": 0.0 }, { "x": 12.0, "y": 6.0 }, { "x": 0.0, "y": 6.0 } ]
  ],
  "exclusions": [
    [ { "x": 4.0, "y": 2.0 }, { "x": 6.0, "y": 2.0 }, { "x": 6.0, "y": 4.0 }, { "x": 4.0, "y": 4.0 } ]
  ]
}
```

Points are metres in the `map` frame. The dashboard also sends `start: true, pause: false, stop: false`,
which the backend ignores. Forwarded as
[`boustrophedon.init`](/development/message-contracts/mqtt-commands#boustrophedon) with
`ensure_unpaused: true`. The answer arrives only after the robot's `/switch_mode` has brought the
coverage stack up.

### `POST /api/boustrophedon/pause` {#boustrophedon-pause}

Body `{ unit_id, pause }`, `pause` a boolean (`true` pauses, `false` resumes). The dashboard appends
`?t=<timestamp>` to keep the URL unique.

### `POST /api/boustrophedon/deactivate` {#boustrophedon-deactivate}

Body `{ unit_id, use_autocover }`. `use_autocover` must match the value the run was started with, so
the robot stops the right feature. Clears the intended mode.

## Auto Align {#autoalign}

`POST /api/autoalign/start`, `POST /api/autoalign/status`, `POST /api/autoalign/reset`, each with body
`{ unit_id }`. They map one-to-one onto
[`autoalign.start` / `status` / `reset`](/development/message-contracts/mqtt-commands#autoalign), and the
answer is the [command shape](#envelopes). The dashboard polls `status` while an alignment runs.

## Mapping (SLAM) {#mapping}

### `POST /api/mapping` {#mapping-control}

One endpoint drives the session; exactly one of `start`, `pause`, `stop` is `true` (`400` otherwise).

```json
// Save: stop the run, store the map, with the home base captured on the canvas
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "stop": true,
  "map_name": "Warehouse Sector 4",
  "homebase_x": 0.0, "homebase_y": 0.0, "homebase_z": 0.0,
  "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
}
```

| Flag | MQTT | Answer |
| --- | --- | --- |
| `start` | [`mapping.start`](/development/message-contracts/mqtt-commands#mapping) | [command shape](#envelopes) |
| `pause` | [`mapping.pause`](/development/message-contracts/mqtt-commands#mapping) | [command shape](#envelopes) |
| `stop` | [`mapping.stop`](/development/message-contracts/mqtt-commands#mapping) | immediately `200 { success, request_id, map_ulid, msg }`, progress over [SSE](#mapping-progress) |

On `stop` the backend mints the map ULID (the file name on disk), uses `map_name` as the display name
(or a `YYYY-MM-DD_HH-MM-SS` timestamp when empty), records the caller as `created_by`, and passes any
finite `homebase_*` numbers through to the robot so the home base is stored in the same upload that
creates the map row.

### `POST /api/mapping/discard` {#mapping-discard}

Body `{ unit_id }`. Sends [`mapping.discard`](/development/message-contracts/mqtt-commands#mapping).

### `GET /api/mapping/progress/:request_id?token=<jwt>` {#mapping-progress}

Server-Sent Events for the save started by `stop`. The token is in the query string because
`EventSource` cannot set headers. Each event is the `data` block of a
[`mapping_progress`](/development/message-contracts/mqtt-commands#mapping-progress) message:

```text
data: {"status":true,"progress":50,"stage":"uploading","message":"Saving to the robot...","terminal":false}

data: {"status":true,"progress":100,"stage":"completed","message":"Saved on the robot and the server.","terminal":true,"outcome":"completed"}
```

Events already sent are replayed to a late subscriber. A `: heartbeat` comment goes out every 15 s.
If the robot is silent for 90 s the stream ends with a synthetic terminal event
(`stage: "no_response"`, `progress: -1`, `outcome: "failed"`) that says the map may still be saving.

## Maps {#maps}

### `GET /api/maps_data` {#maps-list}

Query `unit_id` (optional on the wire, required in practice). With it, only the maps that unit
recorded; without it, every map in the caller's rental scope. A unit the caller has no rental on is a
`403`.

```json
{
  "success": true,
  "data": [
    {
      "id": "01JZ8QK2H0000000000000MAP",
      "map_name": "Warehouse Ground Floor",
      "unit_id": "01JZ7K3M9QA0B1C2D3E4F5G6H7",
      "unit_name": "unit1",
      "created_by": "01JZ7YV5CQUSER00000000000",
      "created_by_username": "operator1",
      "modified_by": "01JZ7YV5CQUSER00000000000",
      "modified_by_username": "operator1",
      "created_at": "2026-08-10T14:20:00Z",
      "modified_at": "2026-08-10T14:20:00Z",
      "file_size_pgm": 262159,
      "file_size_yaml": 131,
      "file_size_image": 20480,
      "homebase_x": 0.0, "homebase_y": 0.0, "homebase_z": 0.0,
      "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
    }
  ]
}
```

`*_username` is `null` when the account was deleted. `GET /api/maps/:mapId` (same optional `unit_id`)
returns one such object bare, without the envelope, or `404`.

::: warning Map names are only unique per unit and rental
Two units on one rental can each hold a map called `hazard test`. Deduplicate by `id`, scope by
`unit_id`; never by name.
:::

### `POST /api/maps_data/check` {#map-check}

Body `{ map_name }` (plus optional `unit_id`). Answer `{ success, exists, map_name, msg }`.

### `PUT /api/maps_data/rename/:mapId` {#map-rename}

Body `{ new_map_name }`. `409` when the name is taken, `404` when the map is out of scope.

```json
{
  "success": true,
  "msg": "Map 'Old' renamed to 'New' successfully",
  "data": { "mapId": "01JZ...", "old_map_name": "Old", "new_map_name": "New", "updated": true }
}
```

### `PUT /api/maps_data/homebase/:mapId` {#map-homebase}

Body `{ x, y, z, ox, oy, oz, ow }`; `x` and `y` are required numbers, the rest default to
`0, 0, 0, 0, 1`. Answer `{ success, msg, data: { mapId, homebase: { x, y, z, ox, oy, oz, ow } } }`.

### `DELETE /api/maps_data` {#map-delete}

Body `{ map_id }` (a bare `map_name` is still accepted only when it is unambiguous; otherwise `409`
with the candidates `[{ map_id, unit_name }]`). Deletes the row (routes, areas and playlists cascade),
records a deletion tombstone for sync, and removes `pgm/<id>.pgm`, `yaml/<id>.yaml`, `images/<id>.png`.

```json
{
  "success": true,
  "msg": "Map 'Hall A' deleted successfully",
  "data": { "mapId": "01JZ...", "deleted": true, "files": { "pgm": true, "yaml": true, "image": true } },
  "warnings": []
}
```

## Routes, areas, playlists {#saved-items}

All three hang off a map, are scoped by the same rental rule, and share these rules: create returns
`201`, a duplicate name on create is `409`, rename strips whitespace and appends `(1)`, `(2)`, ... when
the name is taken instead of failing.

### Routes {#routes}

| Endpoint | Body | Answer |
| --- | --- | --- |
| `POST /api/routes` | `{ route_name, map_id, route_points }` | `201 { data: { route_id } }` |
| `GET /api/routes/:map_id` | | `{ data: [{ id, route_name, map_id, created_at, modified_at, route_points }] }` |
| `PUT /api/routes/:id` | `{ route_name }` | `{ data: { id, route_name } }` |
| `DELETE /api/routes/:id` | | `{ success, msg }` |

`route_points` is the pinpoint list exactly as the canvas holds it, one ROS pose per waypoint:

```json
[
  { "position": { "x": 1.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } },
  { "position": { "x": 5.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.707, "w": 0.707 } }
]
```

Route mode (Basic, Round Trip, Loop) is not stored. The thumbnail is a separate upload to
[`/api/media/uploadRouteImage`](#media-server) with the returned `route_id`; its failure does not fail
the save.

### Areas {#areas}

| Endpoint | Body | Answer |
| --- | --- | --- |
| `POST /api/areas` | `{ area_name, map_id, area_type, polygon_points }` | `201 { data: { area_id } }` |
| `GET /api/areas/:map_id` | | `{ data: [{ id, area_name, map_id, area_type, created_at, modified_at, polygon_points }] }` |
| `PUT /api/areas/:id` | `{ area_name }` | `{ data: { id, area_name } }` |
| `DELETE /api/areas/:id` | | `{ success, msg }` |

`area_type` is `cover` (default) or `no_cover` (`400` otherwise). `polygon_points` is `[{ x, y }]` in
metres.

### Playlists {#playlists}

| Endpoint | Body | Answer |
| --- | --- | --- |
| `POST /api/playlists` | `{ playlist_name, map_id, items }` | `201 { data: { playlist_id } }` |
| `GET /api/playlists/:map_id` | | `{ data: [{ id, playlist_name, map_id, created_at, modified_at, items }] }` |
| `PUT /api/playlists/:id` | `{ playlist_name?, items? }` (at least one) | `{ data: { playlist_name } }` |
| `DELETE /api/playlists/:id` | | `{ success, msg }` |

Each item snapshots its polygon, so a playlist still runs after the source area is renamed or deleted:

```json
{ "area_id": "01JZ...", "area_name": "Aisle3", "area_type": "cover", "polygon_points": [ { "x": 0, "y": 0 } ] }
```

## Media server {#media-server}

`media-server` stores map files and thumbnails. Full reference:
[Media Server Reference](/development/webui/database/media-server-reference). The calls the operator
flow makes:

| Endpoint | Caller | Contract |
| --- | --- | --- |
| `POST /api/media/uploadMap` | robot, during `mapping.stop` | multipart: `id` (map ULID), `map_name`, `created_by`, `unit_id`, the optional `homebase_*` fields, and exactly two files in `mapFiles` (`.yaml` + `.pgm`); writes the map row and renders the PNG. Sent to the unit's media server first (required), then the cloud's (best effort) |
| `GET /api/media/maps/:id/download` | robot, during `navigation.init` when the files are not on disk | map bundle |
| `GET /api/media/checkMapName` | Mapping save dialog | query `map_name` (and `unit_id`); answer `data.available`. The dashboard sends `user_id`, which the server does not read. |
| `POST /api/media/uploadRouteImage` | Save Route | multipart `id` (the route ULID) + `imageFile`; stored as `images/<id>.jpg` |
| `GET /api/media/images/:filename` | map and route thumbnails | `<map ULID>.png`, `<route ULID>.jpg`; **no token required** |

## Unit-local endpoints {#local-endpoints}

Only mounted on a unit's own backend (`DEPLOYMENT_MODE=local`), for the local dashboard's status badge
and Wi-Fi panel:

| Endpoint | Purpose |
| --- | --- |
| `GET /local/status` | Deployment mode, bound rental profile, last sync time and error, cloud URL |
| `POST /local/sync` | Trigger a sync now (`{ full: true }` for a full pass); `429` while one runs |
| `GET /local/robot-token` | Short-lived token the robot uses against the local media server |
| `POST /local/archive` | Write a unit archive of the local data |
| `GET /local/wifi/status`, `/scan`, `/saved`, `/hotspot` | Wi-Fi state, proxied to the host helper |
| `POST /local/wifi/connect`, `/disconnect`, `/forget`, `/hotspot` | Wi-Fi changes (`{ ssid, password }`, `{ name }`) |

## Admin API {#admin-api}

Mounted at `/admin/api`, only accepts `admin` tokens (from `POST /admin/api/login`). Functional
description per tab: [Admin Console](/development/webui/admin-console/overview).

| Group | Endpoints (body) |
| --- | --- |
| Session | `POST /login` (`username, password`), `GET /me`, `PATCH /me` (`username, fullname`), `POST /me/password` (`current_password, new_password`) |
| Admins (superadmin) | `GET/POST /admins` (`username, fullname, password, role`), `PATCH /admins/:id/password`, `PATCH /admins/:id/status` (`status`), `DELETE /admins/:id` |
| Operators | `GET/POST /users` (`username, email, fullname, password`), `PATCH /users/:id/status`, `PATCH /users/:id/password` |
| Units | `GET/POST /units` (`unit_name, unit_id?`), `PATCH /units/:id` (`unit_name`), `DELETE /units/:id`, `DELETE /units/:id/device`, `POST /units/:id/enrollment-code` |
| Pending robots | `GET /pending-units`, `POST /pending-units/:id/register` (`unit_name`), `POST /pending-units/:id/adopt` (`unit_id, confirm?`), `DELETE /pending-units/:id` |
| Unit data | `POST /units/:id/transfer` (`target_unit_id, profile_id \| all_profiles`), `POST /units/:id/swap` (`target_unit_id` + scope), `POST /units/:id/backups` (scope), `DELETE /units/:id/data` (scope) |
| Rentals | `GET/POST /profiles` (`profile_name, tenant_name, notes`), `GET/PATCH/DELETE /profiles/:id`, `POST /profiles/:id/members` (`user_id`), `DELETE /profiles/:id/members/:userId`, `POST /profiles/:id/units` (`unit_id`), `DELETE /profiles/:id/units/:unitId` |
| Backups | `GET /backups`, `POST /profiles/:id/backups`, `GET /backups/:id/download`, `DELETE /backups/:id`, `POST /backups/upload` (raw archive), `POST /backups/:id/plan`, `POST /backups/:id/restore` |

"Scope" is `{ profile_id }` or `{ all_profiles: true }`; one of them is required.

## Enrolment router {#enrol-api}

Called by the robot, not the browser: `POST /enroll/claim`, `POST /enroll/status`,
`POST /enroll/token`. Bodies and answers are in
[Firmware & Enrolment § Enrolment](/development/message-contracts/firmware-and-enrolment#enrolment).

## Sync router {#sync-api}

Called by the unit's `sync_agent` against the cloud, with a robot token bound to a rental:

| Endpoint | Body | Purpose |
| --- | --- | --- |
| `POST /sync/handshake` | | Confirms the rental binding and clock offset |
| `POST /sync/pull` | `{ since }` | Rows and tombstones changed on the cloud since `since` |
| `POST /sync/push` | `{ payload, clock_offset_ms }` | Rows and tombstones changed on the unit |
| `POST /sync/ack` | `{ up_to }` | Marks pulled changes as applied |
| `GET/PUT /sync/file/:mapId/:kind` | raw file | Map files (`pgm`, `yaml`, image) |
| `GET/PUT /sync/route-file/:routeId/:kind` | raw file | Route thumbnails |

Semantics (ordering, conflict rules): [Data Sync](/development/data-sync).

## Related documentation

- [MQTT Commands](/development/message-contracts/mqtt-commands): what each command endpoint sends to the robot.
- [Security and Auth](/development/security-and-auth): token lifetimes and the keyring.
- [Database Schema](/development/database-schema): the tables these endpoints read and write.
