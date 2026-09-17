---
outline: deep
search: false
---

# Media Server Reference

<RoleBadge role="developer" />

`media-server` stores map assets (PGM/YAML/PNG) and route images, generates thumbnails, and keeps a legacy-ID map for migrated installs. It runs twice: `nakayama_media` on the cloud and `media_local` on the unit (`DEPLOYMENT_MODE` cloud/local, port `3003` both). Upload directory `/srv/msd/media/map`, database on `DB_PORT` (3307 cloud).

## Endpoints

All take JWT Bearer unless noted. Errors are uniform `{ success: false, msg }`. Rate limits: 100 req/15 min/IP general, 10 uploads/15 min/IP (code runs a wider general cap — the doc values are the contract).

| Method + path | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | Liveness (`success/msg/timestamp/version`) |
| `POST /api/media/uploadMap` | JWT | Multipart: `id, map_name, user_id, robot_id` (ULIDs) + exactly 2 files (`.yaml/.yml` + `.pgm`), 50 MB/file, 100 MB total. Auto PGM→PNG, writes the DB row |
| `PUT /api/media/updateMap/:id` | JWT | Overwrite YAML+PGM+PNG, atomic with backup+rollback, owner-only, name unique per user |
| `GET /api/media/maps` | JWT | Paginated list (`user_id` query or JWT, `page=1`, `limit=10`) |
| `GET /api/media/maps/:id/download` | JWT | Download the map bundle |
| `GET /api/media/checkMapName` | JWT | Name-availability check before save |
| `DELETE /api/media/maps/:id` | JWT | Delete map + PGM/YAML/PNG (`user_id` query or JWT) |
| `GET /api/media/images/:filename` | **none in code** | Serve PNG binary, cached immutable for a year. The API doc says JWT — the route has no `verifyToken` (`Tidak perlu cek user_id dan JWT`). Treat map PNGs as public |
| `POST /api/media/uploadRouteImage` | JWT | Single `imageFile` + `id`, stored as `<UPLOAD_DIR>/images/{id}.jpg` (the log line says `.png`; the file is `.jpg`) |
| `GET/POST/PUT/DELETE /api/legacy-id-mapper` | JWT | Lookup/create/change/delete legacy-int-ID ↔ ULID rows (`entity_type` + `legacy_int_id`/`new_ulid`) |

::: warning Map PNGs are public
`GET /api/media/images/:filename` answers without a token and tells caches to keep the file for a year. Never put anything in a map PNG that isn't already visible to anyone with the map list.
:::

## Thumbnails and local mode

Upload parses the PGM header and renders PNG via `sharp` (quality 80, progressive). Failure cleans up the partial files on upload, or restores the backup on update. Route images skip `sharp` (raw buffer write).

On the unit (`DEPLOYMENT_MODE=local`) the server trusts the browser `Origin` outright with `credentials: false`; cloud uses a static `ALLOWED_ORIGINS` list. Same keyring as everything else (`shared/jwt_keyring`).

## Related Documentation

- [Database](/development/webui/database/overview): The Map DB screen that reads this API.
- [Mapping: ROS Integration](/development/webui/mapping/ros-integration): Save paths that end in an upload.
- [API Reference](/development/api-reference): The backend REST API (separate service).
