---
outline: deep
search: false
---

# Rename and Delete

<RoleBadge role="developer" />

The two mutating actions available directly from the Database page (`DatabaseComponent.tsx`):
renaming a map in place, and deleting one. For how the map list itself behaves, see
[Overview](/development/webui/database/overview); for the schema and endpoints these actions
touch, see [ROS Integration](/development/webui/database/ros-integration).

## Inline rename

Double-clicking a map's name in the table opens it for inline editing, which calls
`updateMapName` (`services.ts`) on commit.

A duplicate name is rejected outright rather than silently accepted. This is different from the
rename behavior used elsewhere in the dashboard for routes, areas, and playlists, which
auto-suffix a duplicate name instead of rejecting it. Maps are scoped to `(unit_id, profile_id)`
in the schema (see [ROS Integration § Tables](/development/webui/database/ros-integration#tables)),
so a rejected duplicate there is more likely to be a genuine naming mistake than a natural
collision.

**Contracts:** [`PUT /api/maps_data/rename/:mapId`](/development/message-contracts/http-api#map-rename) with
`{ new_map_name }`; a taken name is a `409`. Backend only; the unit receives the new name through
[data sync](/development/data-sync).

## Cascade delete

Deleting a map goes through a `ConfirmDelete` confirmation dialog before anything is sent.
Confirming deletes the map row and, per the foreign keys on `maps_data`, cascades to every route,
area, and playlist attached to it, plus the map's stored files. See
[ROS Integration § Foreign keys](/development/webui/database/ros-integration#foreign-keys) for
which tables cascade and which are only nulled out.

There is no undo. Because routes, areas, and playlists are not separately listed on this page
(see [Overview § Scope](/development/webui/database/overview#scope)), an operator deleting a map
is not shown an itemized list of what it is about to take with it beyond the confirmation prompt
itself.

**Contracts:** [`DELETE /api/maps_data`](/development/message-contracts/http-api#map-delete) with `{ map_id }` in the body. The
answer lists which files were removed (`data.files`), and a deletion tombstone goes to the unit
through [data sync](/development/data-sync).

## Session-conflict guard

Opening a map (see
[Overview § Opening a map into Navigation](/development/webui/database/overview#opening-a-map-into-navigation))
while a mapping session is currently running or paused on the unit is handled differently
depending on which map is being opened:

- Opening the map that is currently being recorded proceeds normally.
- Opening a *different* map raises `ConfirmSaving` and `MapSaving`, offering the operator a choice
  instead of silently discarding the in-progress map:
  - **Save**: the in-progress map is saved before the new one loads. This follows the same
    stop-and-save path documented in
    [HTTP API § `POST /api/mapping`](/development/message-contracts/http-api#mapping-control)
    (`POST /api/mapping` with `stop: true`).
  - **Discard**: the in-progress map is dropped without saving.
  - **Cancel**: the operator stays on the current map and the mapping session continues
    unchanged.

**Contracts:** Save is [`POST /api/mapping`](/development/message-contracts/http-api#mapping-control) `{ stop: true, map_name }`
followed by the [progress stream](/development/message-contracts/http-api#mapping-progress); Discard is
[`POST /api/mapping/discard`](/development/message-contracts/http-api#mapping-discard) → [`mapping.discard`](/development/message-contracts/mqtt-commands#mapping).
Opening the new map is then [`POST /api/navigation/init`](/development/message-contracts/http-api#navigation-init).

## Related

- [Message Contracts § Database page](/development/message-contracts/#trace-database): every call these actions make
- [Overview](/development/webui/database/overview): the map list, search/sort/pagination, and states this feature sits on top of
- [ROS Integration](/development/webui/database/ros-integration): the schema and REST endpoints behind these actions
- [Architecture](/development/architecture)
- [Database Schema](/development/database-schema): the full schema reference for `ROS_DB`
