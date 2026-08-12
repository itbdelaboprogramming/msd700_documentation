---
outline: deep
search: false
---

# API Reference

<RoleBadge role="developer" />

`backend_node` (Express) exposes the endpoints below. This page is an index of what exists and
where. For exact request/response bodies, read the handler directly in
`ros-web-ui/source/dependencies/ROS-dashboard-backend/scripts/` (`backend_node`, `admin_api.js`,
`enroll_api.js`, `sync_api.js`); this list is generated from route definitions, not from a schema, so
treat it as a map rather than a contract.

## Authentication

Sessions are signed JWTs, sent as `Authorization: Bearer <token>` on subsequent requests. Tokens are
verified against a **keyring** (`/run/secrets/jwt_keyring`, HS256), not a single secret: the active
key signs new tokens, but recently-rotated keys are still accepted for a grace window, so rotating
the keyring doesn't invalidate every session at once. See
[Setup &gt; Maintenance](/setup/maintenance#rotating-secrets) for the operational side of this, and
`scripts/secrets.sh` / `jwt_keyring.js` for the implementation.

The admin console (`/admin/api/*`) uses the same token mechanism with an admin-scoped login
(`POST /admin/api/login`), separate from regular user accounts.

## Auth & accounts (`/user`)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/user/register` | Create a new user account |
| `POST` | `/user/login` | Log in, receive a session token |
| `POST` | `/user/logout` | Invalidate the current session |
| `POST` | `/user/refresh` | Refresh a session token before it expires |
| `POST` | `/user/check-email` | Availability check used by the sign-up form |
| `POST` | `/user/check-username` | Availability check used by the sign-up form |

## Unit listing

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/unit/all` | List units the authenticated account has access to (via its profile) |

## Unit control & operation (`/api`)

These are what the dashboard calls while actively driving or managing a unit.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/manual` | Manual drive command (W-A-S-D style) |
| `POST` | `/api/navigation/init` | Start navigation mode |
| `POST` | `/api/navigation/deactivate` | Stop navigation mode |
| `POST` | `/api/navigation/pointstamped` | Send a single navigation goal (click-to-navigate) |
| `POST` | `/api/autopilot` | Toggle autopilot (waypoint playlist execution) |
| `POST` | `/api/mapping` | Start autonomous mapping |
| `POST` | `/api/mapping/discard` | Discard an in-progress mapping session |
| `GET` | `/api/mapping/progress/:request_id` | Poll mapping progress |
| `POST` | `/api/boustrophedon/init` | Start area coverage |
| `POST` | `/api/boustrophedon/pause` | Pause area coverage |
| `POST` | `/api/boustrophedon/deactivate` | Stop area coverage |
| `POST` | `/api/autoalign/start` | Start Auto Align |
| `POST` | `/api/autoalign/status` | Poll Auto Align status |
| `POST` | `/api/autoalign/reset` | Reset Auto Align |
| `POST` | `/api/lidar` | Lidar-related control/query |
| `POST` | `/api/emergency_stop` | Emergency stop, bypasses normal command arbitration |
| `POST` | `/api/hardware/init` \| `/check` \| `/ping` \| `/idle` \| `/stop` | Hardware monitor lifecycle for a unit |
| `POST` | `/api/unit/heartbeat` | Dashboard connectivity heartbeat (drives the automatic safety-pause behavior) |
| `POST` | `/api/unit/force-stop` | Administrative force-stop of a unit |
| `GET` | `/api/unit/shutdown-status` | Poll a unit's shutdown/verification state |

## Maps, routes, areas, playlists (`/api`)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/maps_data` | List saved maps |
| `POST` | `/api/maps_data/check` | Validate/check map data |
| `GET` | `/api/maps/:mapId` | Get a specific map |
| `PUT` | `/api/maps_data/rename/:mapId` | Rename a map |
| `PUT` | `/api/maps_data/homebase/:mapId` | Set a map's homebase point |
| `GET` | `/api/routes/:map_id` | List routes for a map |
| `POST` | `/api/routes` | Create a route |
| `PUT` | `/api/routes/:id` | Rename/update a route |
| `GET` | `/api/areas/:map_id` | List custom areas for a map |
| `POST` | `/api/areas` | Create a custom area |
| `PUT` | `/api/areas/:id` | Rename/update a custom area |
| `GET` | `/api/playlists/:map_id` | List playlists for a map |
| `POST` | `/api/playlists` | Create a playlist |
| `PUT` | `/api/playlists/:id` | Rename/update a playlist |

## Unit-local endpoints (`/local`)

Served by a **unit's own** `backend_local`, not the cloud backend. These are what a unit's local
dashboard and the robot's own MQTT bridge talk to.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/local/robot-token` | Issue a token scoped to this unit's own local services (rejects tokens minted by the cloud, see [Architecture](/development/architecture)) |
| `GET` | `/local/status` | This unit's live status, read from `device.json`, not from environment config |
| `POST` | `/local/sync` | Trigger a sync cycle against the cloud (see [Sync](#sync-sync)) |

## Enrolment (`/enroll`)

Used by `scripts/enroll.py` on first boot, and by the admin console to approve a pending unit. See
[Setup &gt; Unit Setup](/setup/unit-setup#4-bring-the-robot-up) for the operator-facing flow.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/enroll/claim` | Robot announces itself and receives a claim code |
| `POST` | `/enroll/status` | Robot polls whether its claim code has been approved yet |
| `POST` | `/enroll/token` | Exchange an approved claim for the robot's credential |

## Sync (`/sync`)

Keeps a unit's local cache and the cloud's copy of maps/routes/etc. consistent. See
`migrate_sync.js` and `sync_engine.js`. Runs on **both** sides: the unit's `sync_agent.js` calls into
the cloud's `/sync/*`, and the cloud can pull from a unit the same way.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/sync/handshake` | Negotiate sync state between a unit and the cloud |
| `POST` | `/sync/push` | Push local changes up |
| `POST` | `/sync/pull` | Pull remote changes down |
| `POST` | `/sync/ack` | Acknowledge a completed sync step |
| `GET` / `PUT` | `/sync/file/:mapId/:kind` | Transfer a map file |
| `GET` / `PUT` | `/sync/route-file/:routeId/:kind` | Transfer a route file |

## Admin console (`/admin/api`)

Everything the admin console UI uses. All of it requires an admin-scoped token.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/admin/api/login` | Admin login |
| `GET` / `PATCH` | `/admin/api/me` | Current admin's profile |
| `POST` | `/admin/api/me/password` | Change own password |
| `GET` | `/admin/api/admins` | List admin accounts |
| `POST` | `/admin/api/admins` | Create an admin account |
| `PATCH` | `/admin/api/admins/:id/password` \| `/status` | Manage an admin account |
| `DELETE` | `/admin/api/admins/:id` | Remove an admin account |
| `GET` | `/admin/api/users` | List user accounts |
| `POST` | `/admin/api/users` | Create a user account |
| `PATCH` | `/admin/api/users/:id/password` \| `/status` | Manage a user account |
| `GET` | `/admin/api/pending-units` | List units awaiting enrolment approval |
| `POST` | `/admin/api/pending-units/:id/register` | Approve a new pending unit |
| `POST` | `/admin/api/pending-units/:id/adopt` | Adopt a pending claim onto an existing unit's ULID (hardware swap) |
| `DELETE` | `/admin/api/pending-units/:id` | Reject/remove a pending claim |
| `GET` | `/admin/api/units` | List registered units |
| `POST` | `/admin/api/units` | Register a unit manually |
| `PATCH` | `/admin/api/units/:id` | Update a unit's metadata |
| `DELETE` | `/admin/api/units/:id` | Remove a unit |
| `DELETE` | `/admin/api/units/:id/device` | Clear a unit's cached device identity (forces re-enrolment) |
| `DELETE` | `/admin/api/units/:id/data` | Delete a unit's stored data |
| `POST` | `/admin/api/units/:id/swap` | Swap hardware onto an existing unit id |
| `POST` | `/admin/api/units/:id/transfer` | Transfer a unit between profiles |
| `POST` | `/admin/api/units/:id/enrollment-code` | Mint a single-use enrolment code (bypasses the pending pool) |
| `GET` | `/admin/api/profiles` | List rental profiles |
| `POST` | `/admin/api/profiles` | Create a profile |
| `GET` / `PATCH` | `/admin/api/profiles/:id` | Get/update a profile |
| `DELETE` | `/admin/api/profiles/:id` | Delete a profile |
| `POST` | `/admin/api/profiles/:id/units` | Grant a profile access to a unit |
| `DELETE` | `/admin/api/profiles/:id/units/:unitId` | Revoke a profile's access to a unit |
| `POST` | `/admin/api/profiles/:id/members` | Add a user to a profile |
| `DELETE` | `/admin/api/profiles/:id/members/:userId` | Remove a user from a profile |
| `GET` | `/admin/api/backups` | List backup archives |
| `POST` | `/admin/api/profiles/:id/backups` | Create a profile-scoped backup |
| `POST` | `/admin/api/units/:id/backups` | Create a unit-scoped backup |
| `GET` | `/admin/api/backups/:id/download` | Download a backup archive |
| `POST` | `/admin/api/backups/upload` | Upload a backup archive |
| `POST` | `/admin/api/backups/:id/plan` | Preview what restoring a backup would do (unit remapping, conflicts) |
| `POST` | `/admin/api/backups/:id/restore` | Restore a backup (additive) |
| `DELETE` | `/admin/api/backups/:id` | Delete a backup archive |

## Error responses

Standard HTTP status codes: `400` for malformed/invalid input, `401`/`403` for missing or
insufficient auth, `404` for a missing resource, `500` for unhandled server errors. There's no
single custom error envelope documented here; check the specific handler for the exact response
shape.

## Related

- [Architecture](/development/architecture)
- [Contributing](/development/contributing)
