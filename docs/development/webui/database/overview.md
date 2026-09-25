---
outline: deep
search: false
---

# Database Overview

<RoleBadge role="developer" />

The Database feature is the Map DB page at `unit/database` in the dashboard
(`pages/unit/database/index.tsx`, component `DatabaseComponent.tsx`): the place an operator sees
every map recorded on the current unit and picks one to load into Navigation, or cleans up an old
one. This document describes how the page behaves, for a frontend engineer working on it, not as an
end-user tutorial. For the rename and delete flows, see
[Rename and Delete](/development/webui/database/rename-and-delete). For the schema and REST
endpoints underneath the page, see [ROS Integration](/development/webui/database/ros-integration).

## Scope

The page lists maps as first-class rows only. Routes, saved cover/no-cover areas, and operation
playlists are attributes that travel with a map rather than rows of their own here: a map's
`modified_by_username` covers changes to "the map, its routes, its saved areas, or its playlists"
as one value, and all three cascade-delete with their map (see
[Rename and Delete § Cascade delete](/development/webui/database/rename-and-delete#cascade-delete)),
but none of them get their own list, search box, or rename control on this page. Rental profiles
are not touched here either.

## Map list

`DatabaseTable.tsx` renders one row per map, with these columns:

| Column | Notes |
| --- | --- |
| Name | `map_name` |
| Last modified | `modified_at` |
| Last modified by | `modified_by_username`, covering edits to the map itself or to any route, area, or playlist attached to it |
| File sizes | sizes of the map's stored assets |
| Homebase pose | `homebase_x`, `homebase_y` |

A map name is only unique per `(unit_id, profile_id)`, not globally, so two robots on the same
rental can each hold a map with the same name and different `id`. The table must scope by
`unit_id` and key everything off `id`, never deduplicate rows by name. See
[ROS Integration § Tables](/development/webui/database/ros-integration#tables) for the schema
constraint behind this.

**Contracts:** the list is [`GET /api/maps_data?unit_id=<unit>`](/development/message-contracts/http-api#maps-list) (always scoped by
unit); thumbnails are [`GET /api/media/images/<map ULID>.png`](/development/message-contracts/http-api#media-server), which needs no
token.

## Search, sort, and pagination

`DatabaseSearch.tsx` filters the visible rows. Sorting is by name or by date, ascending or
descending, with only one sort active at a time: choosing a new sort key or flipping direction
replaces whatever was active before rather than adding a secondary sort. `DatabasePagination.tsx`
pages through whatever the search filter and sort leave behind.

## Selecting a map

A radio or checkbox control on each row sets an app-wide "selected map" context. Selecting a row
does not load anything into Navigation by itself, it only marks which map is the current target
for the rename and delete actions described in
[Rename and Delete](/development/webui/database/rename-and-delete).

## Opening a map into Navigation

Opening a map routes to `/unit/navigation?index=<id>`. If a mapping session is currently running
or paused on the unit and the operator opens a *different* map than the one being recorded, the
page does not silently drop the in-progress map. See
[Rename and Delete § Session-conflict guard](/development/webui/database/rename-and-delete#session-conflict-guard).

**Contracts:** the Navigation page opens the map with
[`POST /api/navigation/init`](/development/message-contracts/http-api#navigation-init) → [`navigation.init`](/development/message-contracts/mqtt-commands#navigation).

## Empty and loading states

`LoadingOverlay` covers the table while the map list is being fetched. `NoDataOverlay` replaces
the table when the unit has no maps recorded yet, or when no row survives the current search
filter.

## Related

- [Message Contracts § Database page](/development/message-contracts/#trace-database): every call this page makes.
- [Rename and Delete](/development/webui/database/rename-and-delete): the two mutating actions on this page, in detail
- [ROS Integration](/development/webui/database/ros-integration): the schema and REST endpoints behind this feature
- [Media Server Reference](/development/webui/database/media-server-reference): the map-asset API (upload, thumbnails, legacy-ID mapper)
- [Architecture](/development/architecture)
- [Database Schema](/development/database-schema): the full schema reference for `ROS_DB`
