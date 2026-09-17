---
outline: deep
search: false
---

# Referensi Media Server

<RoleBadge role="developer" />

`media-server` menyimpan aset peta (PGM/YAML/PNG) dan gambar rute, membuat thumbnail, dan menjaga peta ID-legacy untuk instalasi hasil migrasi. Ia jalan dua kali: `nakayama_media` di cloud dan `media_local` di unit (`DEPLOYMENT_MODE` cloud/local, port `3003` di keduanya). Direktori upload `/srv/msd/media/map`, database di `DB_PORT` (3307 cloud).

## Endpoint

Semua memakai JWT Bearer kecuali dinyatakan lain. Error seragam `{ success: false, msg }`. Rate limit: 100 req/15 mnt/IP umum, 10 upload/15 mnt/IP (kode menjalankan cap umum yang lebih lebar — nilai doc adalah kontraknya).

| Method + path | Auth | Tujuan |
| --- | --- | --- |
| `GET /health` | none | Liveness (`success/msg/timestamp/version`) |
| `POST /api/media/uploadMap` | JWT | Multipart: `id, map_name, user_id, robot_id` (ULID) + tepat 2 file (`.yaml/.yml` + `.pgm`), 50 MB/file, 100 MB total. Otomatis PGM→PNG, menulis baris DB |
| `PUT /api/media/updateMap/:id` | JWT | Timpa YAML+PGM+PNG, atomik dengan backup+rollback, hanya pemilik, nama unik per user |
| `GET /api/media/maps` | JWT | List berpaginasi (query `user_id` atau JWT, `page=1`, `limit=10`) |
| `GET /api/media/maps/:id/download` | JWT | Unduh bundle peta |
| `GET /api/media/checkMapName` | JWT | Cek ketersediaan nama sebelum simpan |
| `DELETE /api/media/maps/:id` | JWT | Hapus peta + PGM/YAML/PNG (query `user_id` atau JWT) |
| `GET /api/media/images/:filename` | **none di kode** | Sajikan biner PNG, di-cache immutable setahun. Doc API bilang JWT — route-nya tanpa `verifyToken` (`Tidak perlu cek user_id dan JWT`). Perlakukan PNG peta sebagai publik |
| `POST /api/media/uploadRouteImage` | JWT | Satu `imageFile` + `id`, disimpan sebagai `<UPLOAD_DIR>/images/{id}.jpg` (baris log bilang `.png`; filenya `.jpg`) |
| `GET/POST/PUT/DELETE /api/legacy-id-mapper` | JWT | Lookup/buat/ubah/hapus baris legacy-int-ID ↔ ULID (`entity_type` + `legacy_int_id`/`new_ulid`) |

::: warning PNG peta bersifat publik
`GET /api/media/images/:filename` menjawab tanpa token dan menyuruh cache menyimpan file setahun. Jangan taruh apa pun di PNG peta yang belum terlihat siapa pun yang punya daftar peta.
:::

## Thumbnail dan local mode

Upload mem-parsing header PGM dan me-render PNG via `sharp` (quality 80, progressive). Kegagalan membersihkan file parsial saat upload, atau memulihkan backup saat update. Gambar rute melewati `sharp` (tulis buffer mentah).

Di unit (`DEPLOYMENT_MODE=local`) server memercayai `Origin` browser begitu saja dengan `credentials: false`; cloud memakai daftar `ALLOWED_ORIGINS` statis. Keyring yang sama dengan yang lain (`shared/jwt_keyring`).

## Terkait

- [Database](/id/development/webui/database/overview): Layar Map DB yang membaca API ini.
- [Mapping: ROS Integration](/id/development/webui/mapping/ros-integration): Jalur simpan yang berakhir di upload.
- [API Reference](/id/development/api-reference): REST API backend (service terpisah).
