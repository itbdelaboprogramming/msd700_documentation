---
outline: deep
search: false
---

# HTTP API (Web)

<RoleBadge role="developer" />

Semua endpoint HTTP yang dipanggil dashboard, Konsol Admin, dan robot: `backend_node` (Express),
router yang di-mount di dalamnya (`/admin/api`, `/enroll`, `/sync`), dan `media-server`. Endpoint
yang memerintah robot hanyalah pembungkus tipis di atas amplop MQTT; untuk apa yang diterima robot,
ikuti tautan di tiap endpoint ke [Perintah MQTT](/id/development/message-contracts/mqtt-commands).

## Konvensi {#conventions}

### Base URL {#base-urls}

| Environment | `backend_node` | `media-server` |
| --- | --- | --- |
| Cloud produksi | `https://msd.nglobal.jp/services/rosbackend` (Apache → `localhost:5000`) | `NEXT_PUBLIC_MEDIA_URL` (container `nakayama_media`, port `3003`) |
| Cloud development | `http://<server-ip>:5001` | container media dev |
| Dashboard lokal unit | `http://<unit-ip>:5002` (`backend_local`) | `media_local`, port `3003` |

Di mode lokal dashboard mengganti host setiap URL hasil build dengan host yang sedang dipakai browser
(`withBrowserHost` di `src/config/apiConfig.ts`), sehingga build yang sama bekerja di alamat LAN mana pun.

### Autentikasi {#authentication}

Route yang dilindungi menerima JWT di header `Authorization`:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Token memakai HS256 dan diverifikasi terhadap keyring bersama (`/run/secrets/jwt_keyring` di dalam
container; produksi fallback ke `JWT_SECRET_KEY`/`JWT_SECRET`). Key aktif yang menandatangani, key yang
baru dirotasi masih lolos verifikasi selama masa tenggang.

![Autentikasi dan Otorisasi](../../../development/message-contracts/diagrams/api-reference-authentication-and-authorization.drawio)

| `typ` token | Diterima di | Ditolak di |
| --- | --- | --- |
| `access` (atau tanpa `typ`, token sebelum ada refresh) | semua route operator | tidak ada |
| `refresh` | hanya `/user/refresh` | semua route lain, `401` |
| `admin` | `/admin/api/*` | route operator, `401` (tidak membawa `user_id`) |

### Otorisasi unit (`attachUnit`) {#attach-unit}

Setiap request yang membawa `unit_id` (body atau query) diperiksa tepat setelah token: pemanggil harus
memegang **rental profile aktif** yang mencakup unit itu. Tidak ada handler yang bisa melewatinya,
karena `verifyToken` langsung dirangkai ke `attachUnit`.

![Middleware Otorisasi Unit (attachUnit)](../../../development/message-contracts/diagrams/api-reference-unit-authorization-middleware-attachunit.drawio)

| Hasil | Status | Body |
| --- | --- | --- |
| `unit_id` bukan ULID | `400` | `{ success: false, msg: "Invalid unit id" }` |
| Tidak ada rental aktif yang mencakup unit | `403` | `{ success: false, msg: "This unit is not assigned to you" }` |
| Lookup error | `500` | gagal tertutup (fail closed) |

Keputusan akses di-cache 60 detik per user dan unit.

### Amplop respons {#envelopes}

Endpoint data menjawab `{ success: true, data, msg? }` atau `{ success: false, msg }`.

Endpoint yang memerintah robot (setiap `POST` di bawah `/api/hardware`, `/api/navigation`,
`/api/mapping` kecuali stop, `/api/boustrophedon`, `/api/autoalign`, `/api/manual`, `/api/autopilot`,
`/api/emergency_stop`) berbagi satu bentuk, ditentukan oleh `sendCommandAndWaitForFeedback()`:

| Situasi | Status | Body |
| --- | --- | --- |
| Robot menjawab `data.status: true` | `200` | `{ success: true, msg: <data.message>, details: <seluruh amplop feedback> }` |
| Robot menjawab `data.status: false` | `200` | `{ success: false, msg: <data.message>, error_details: <seluruh amplop feedback> }` |
| Feedback tanpa `data.status` | `500` | `{ success: false, msg: "Received malformed feedback from robot.", details }` |
| Tidak ada feedback dalam 30 detik | `504` | `{ success: false, msg: "Request timed out. No feedback received from robot for request ID: ..." }` |

Penolakan dari robot sengaja berupa `200` dengan `success: false`: `4xx` disisakan untuk request yang
ditolak backend sendiri. Amplop feedback di dalam `details` dispesifikasikan di
[Perintah MQTT § Amplop feedback](/id/development/message-contracts/mqtt-commands#feedback-envelope).

## Akun {#accounts}

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

Tidak ada role atau profil di respons. Unit mana yang boleh disentuh pemanggil ditentukan per request
oleh [`attachUnit`](#attach-unit).

### `POST /user/refresh` {#user-refresh}

Body `{ "refresh_token": "..." }`. Mengembalikan `{ success: true, username, user_id, token, refresh_token }`.
`400` tanpa token, `401` bila token tidak valid, kedaluwarsa, bukan token `refresh`, atau akunnya sudah
tidak ada.

### `POST /user/logout` {#user-logout}

Body (semuanya opsional): `{ "force": false, "ignore_autopilot": false }`. Melepas semua lease milik
user, menghentikan container per-unit legacy milik user (`force` menghapusnya), dan membiarkan unit
yang sedang autopilot tetap berjalan kecuali `ignore_autopilot` bernilai `true`.

```json
{ "success": true, "msg": "Logged out", "remaining": [], "retained": [] }
```

`GET /api/unit/shutdown-status` mengembalikan `{ success, running, containers }` dan
`POST /api/unit/force-stop` (`{ ignore_autopilot }`) mematikan sisanya; alur logout di
`shutdownFlow.ts` memakai keduanya.

### Pengecekan registrasi {#user-register}

| Endpoint | Body | Jawaban |
| --- | --- | --- |
| `POST /user/register` | `{ username, email, full_name, password }` | `201 { data: { user_id } }`, `409` bila duplikat |
| `POST /user/check-username` | `{ username }` | `200 "Username available"` atau penolakan |
| `POST /user/check-email` | `{ email }` | `200 "Email available"` atau penolakan |

## Unit dan lease {#units}

### `GET /unit/all` {#unit-list}

Unit yang boleh dikemudikan pemanggil, lewat rental profile aktifnya. Status live (baterai, aktivitas)
tidak ada di sini; itu datang dari [respons ping](/id/development/message-contracts/heartbeat-and-lease#ping-response).

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

Menjadi MQTT [`hardware.ping`](/id/development/message-contracts/heartbeat-and-lease#ping-request);
backend menambahkan `user_id` (dari JWT) dan `origin` (`DEPLOYMENT_MODE` miliknya), keduanya tidak bisa
diisi klien. Tidak pernah di-retry. Jawabannya berbentuk respons perintah di atas, dengan
[respons ping](/id/development/message-contracts/heartbeat-and-lease#ping-response) di `details.data`
ditambah empat field yang digabungkan backend:

| Field | Arti |
| --- | --- |
| `intended_mode` | Mode terakhir yang diminta backend untuk unit ini: `idle`, `navigation`, `mapping` |
| `map_id` | Peta yang dipakai saat mode itu dimulai |
| `sync_status` | `synced` bila `robot_activity` robot cocok dengan `intended_mode`, selain itu `out_of_sync` |
| `needs_recovery` | `true` bila tidak sinkron; dashboard lalu mengirim ulang init |

### `POST /api/unit/heartbeat` {#unit-heartbeat}

Body `{ unit_id }`, jawaban `{ success: true }`. Menjaga container cloud legacy milik unit tetap hidup
dan mereset idle timer-nya. Tidak menyentuh MQTT, jadi langsung dijawab. Dashboard mengirimnya tiap
15 detik selama halaman operasional terbuka.

### Perintah hardware {#hardware-commands}

Body `{ unit_id }` untuk masing-masing; jawabannya [bentuk respons perintah](#envelopes).

| Endpoint | Perintah MQTT | Catatan |
| --- | --- | --- |
| `POST /api/hardware/check` | [`hardware.check`](/id/development/message-contracts/mqtt-commands#hardware) | |
| `POST /api/hardware/init` | [`hardware.init`](/id/development/message-contracts/mqtt-commands#hardware) | |
| `POST /api/hardware/stop` | [`hardware.stop`](/id/development/message-contracts/mqtt-commands#hardware) | |
| `POST /api/hardware/idle` | [`hardware.idle`](/id/development/message-contracts/mqtt-commands#hardware) | Juga menghapus intended mode unit, sehingga login berikutnya mulai dari idle. Dikirim saat logout tanpa autopilot. |

### `POST /api/lidar` (legacy) {#lidar}

Body `{ unit_id, enable, use_own_map }`. Mempublish body apa adanya di MQTT `/unit_<ULID>/lidar_command`
dan langsung menjawab. Tidak ada node di image robot saat ini yang subscribe topik itu, jadi tidak
berefek; halaman Pemetaan masih memanggilnya.

## Navigasi dan gerak {#navigation}

### `POST /api/navigation/init` {#navigation-init}

```json
{ "unit_id": "01JZ8P9WZ0UNIT00000000000", "map_id": "01JZ8QK2H0000000000000MAP" }
```

Peta harus direkam unit ini, di dalam rental yang diikuti pemanggil; selain itu `404`
`"That map does not belong to this unit. Pick a map recorded by this robot."` Backend menambahkan home
base tersimpan milik peta dan mengirim [`navigation.init`](/id/development/message-contracts/mqtt-commands#navigation).
`400` bila `map_id` kosong atau bukan ULID.

### `POST /api/navigation/deactivate` {#navigation-deactivate}

Body `{ unit_id }`. Mengirim [`navigation.deactivate`](/id/development/message-contracts/mqtt-commands#navigation)
dan menghapus intended mode.

### `POST /api/navigation/pointstamped` {#navigation-pointstamped}

```json
{ "unit_id": "01JZ8P9WZ0UNIT00000000000", "x": 5.25, "y": -3.1, "z": 0.0 }
```

`x`, `y`, `z` huruf kecil, semuanya angka (`400` bila tidak), dibulatkan ke 4 desimal dan dikirim
sebagai `config.resource.X/Y/Z` di [`navigation.pointstamped`](/id/development/message-contracts/mqtt-commands#navigation).
Robot mempublish ulang di `/clicked_point`. Dashboard saat ini tidak memanggil endpoint ini: pinpoint
dikirim sebagai goal `move_base` lewat [rosbridge](/id/development/message-contracts/rosbridge#move-base-action).

### `POST /api/emergency_stop` {#emergency-stop}

Body `{ unit_id, enable }`. `enable: true` mengirim
[`emergency_stop.activate`](/id/development/message-contracts/mqtt-commands#emergency-stop) dan menghapus
intended mode; `false` mengirim `deactivate`.

### `POST /api/manual` {#manual}

Body `{ unit_id, enable }`. Mengirim [`manual.enable`](/id/development/message-contracts/mqtt-commands#manual)
atau `manual.disable`. Mengemudinya sendiri bukan HTTP: lihat
[rosbridge § Publikasi](/id/development/message-contracts/rosbridge#publications) (`server/key_vel`).

### `POST /api/autopilot` {#autopilot}

Body `{ unit_id, enable }`. Mengirim [`autopilot.enable`](/id/development/message-contracts/mqtt-commands#autopilot)
atau `autopilot.disable`. Backend mem-pin nilai baru selama 5 detik agar ping yang sedang di jalan tidak
bisa melaporkan nilai lama menimpanya, dan menonaktifkan juga langsung mengakhiri retensi container.

## Coverage (boustrophedon) {#coverage}

### `POST /api/boustrophedon/init` {#boustrophedon-init}

Satu endpoint, tiga bentuk. `use_autocover` harus boolean (`400` bila tidak).

```json
// Auto coverage: seluruh peta
{ "unit_id": "01JZ8P9WZ0UNIT00000000000", "use_autocover": true }

// Satu area custom (polygon tunggal legacy)
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "use_autocover": false,
  "polygon": [ { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 }, { "x": 10.0, "y": 5.0 } ]
}

// Playlist: area cover berurutan plus polygon keep-out
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

Titik dalam meter di frame `map`. Dashboard juga mengirim `start: true, pause: false, stop: false`,
yang diabaikan backend. Diteruskan sebagai
[`boustrophedon.init`](/id/development/message-contracts/mqtt-commands#boustrophedon) dengan
`ensure_unpaused: true`. Jawaban baru datang setelah `/switch_mode` di robot selesai menyalakan stack
coverage.

### `POST /api/boustrophedon/pause` {#boustrophedon-pause}

Body `{ unit_id, pause }`, `pause` boolean (`true` menjeda, `false` melanjutkan). Dashboard menambahkan
`?t=<timestamp>` agar URL tetap unik.

### `POST /api/boustrophedon/deactivate` {#boustrophedon-deactivate}

Body `{ unit_id, use_autocover }`. `use_autocover` harus sama dengan nilai saat run dimulai, supaya robot
menghentikan fitur yang benar. Menghapus intended mode.

## Auto Align {#autoalign}

`POST /api/autoalign/start`, `POST /api/autoalign/status`, `POST /api/autoalign/reset`, masing-masing
dengan body `{ unit_id }`. Dipetakan satu-satu ke
[`autoalign.start` / `status` / `reset`](/id/development/message-contracts/mqtt-commands#autoalign), dan
jawabannya [bentuk respons perintah](#envelopes). Dashboard mem-poll `status` selama alignment berjalan.

## Pemetaan (SLAM) {#mapping}

### `POST /api/mapping` {#mapping-control}

Satu endpoint menggerakkan sesi; tepat satu dari `start`, `pause`, `stop` bernilai `true` (`400` bila tidak).

```json
// Simpan: hentikan run, simpan peta, bersama home base yang ditangkap di canvas
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "stop": true,
  "map_name": "Warehouse Sector 4",
  "homebase_x": 0.0, "homebase_y": 0.0, "homebase_z": 0.0,
  "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
}
```

| Flag | MQTT | Jawaban |
| --- | --- | --- |
| `start` | [`mapping.start`](/id/development/message-contracts/mqtt-commands#mapping) | [bentuk respons perintah](#envelopes) |
| `pause` | [`mapping.pause`](/id/development/message-contracts/mqtt-commands#mapping) | [bentuk respons perintah](#envelopes) |
| `stop` | [`mapping.stop`](/id/development/message-contracts/mqtt-commands#mapping) | langsung `200 { success, request_id, map_ulid, msg }`, progres lewat [SSE](#mapping-progress) |

Saat `stop` backend membuat ULID peta (nama file di disk), memakai `map_name` sebagai nama tampilan
(atau timestamp `YYYY-MM-DD_HH-MM-SS` bila kosong), mencatat pemanggil sebagai `created_by`, dan
meneruskan angka `homebase_*` yang valid ke robot agar home base tersimpan dalam upload yang sama yang
membuat baris peta.

### `POST /api/mapping/discard` {#mapping-discard}

Body `{ unit_id }`. Mengirim [`mapping.discard`](/id/development/message-contracts/mqtt-commands#mapping).

### `GET /api/mapping/progress/:request_id?token=<jwt>` {#mapping-progress}

Server-Sent Events untuk penyimpanan yang dimulai oleh `stop`. Token ada di query string karena
`EventSource` tidak bisa mengatur header. Setiap event adalah blok `data` dari pesan
[`mapping_progress`](/id/development/message-contracts/mqtt-commands#mapping-progress):

```text
data: {"status":true,"progress":50,"stage":"uploading","message":"Saving to the robot...","terminal":false}

data: {"status":true,"progress":100,"stage":"completed","message":"Saved on the robot and the server.","terminal":true,"outcome":"completed"}
```

Event yang sudah terkirim diputar ulang untuk subscriber yang terlambat. Komentar `: heartbeat` dikirim
tiap 15 detik. Bila robot diam selama 90 detik, stream diakhiri dengan event terminal sintetis
(`stage: "no_response"`, `progress: -1`, `outcome: "failed"`) yang menyatakan peta mungkin masih
tersimpan.

## Peta {#maps}

### `GET /api/maps_data` {#maps-list}

Query `unit_id` (opsional di wire, wajib dalam praktik). Dengan parameter itu, hanya peta yang direkam
unit tersebut; tanpa itu, semua peta dalam cakupan rental pemanggil. Unit yang tidak ada rental-nya
untuk pemanggil menghasilkan `403`.

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

`*_username` bernilai `null` bila akunnya sudah dihapus. `GET /api/maps/:mapId` (dengan `unit_id`
opsional yang sama) mengembalikan satu objek seperti itu tanpa amplop, atau `404`.

::: warning Nama peta hanya unik per unit dan rental
Dua unit dalam satu rental masing-masing bisa punya peta bernama `hazard test`. Deduplikasi berdasarkan
`id`, batasi dengan `unit_id`; jangan pernah berdasarkan nama.
:::

### `POST /api/maps_data/check` {#map-check}

Body `{ map_name }` (plus `unit_id` opsional). Jawaban `{ success, exists, map_name, msg }`.

### `PUT /api/maps_data/rename/:mapId` {#map-rename}

Body `{ new_map_name }`. `409` bila nama sudah dipakai, `404` bila peta di luar cakupan.

```json
{
  "success": true,
  "msg": "Map 'Old' renamed to 'New' successfully",
  "data": { "mapId": "01JZ...", "old_map_name": "Old", "new_map_name": "New", "updated": true }
}
```

### `PUT /api/maps_data/homebase/:mapId` {#map-homebase}

Body `{ x, y, z, ox, oy, oz, ow }`; `x` dan `y` wajib berupa angka, sisanya default `0, 0, 0, 0, 1`.
Jawaban `{ success, msg, data: { mapId, homebase: { x, y, z, ox, oy, oz, ow } } }`.

### `DELETE /api/maps_data` {#map-delete}

Body `{ map_id }` (`map_name` saja masih diterima hanya bila tidak ambigu; selain itu `409` dengan
kandidat `[{ map_id, unit_name }]`). Menghapus baris (rute, area, dan playlist ikut ter-cascade),
mencatat tombstone penghapusan untuk sync, dan menghapus `pgm/<id>.pgm`, `yaml/<id>.yaml`, `images/<id>.png`.

```json
{
  "success": true,
  "msg": "Map 'Hall A' deleted successfully",
  "data": { "mapId": "01JZ...", "deleted": true, "files": { "pgm": true, "yaml": true, "image": true } },
  "warnings": []
}
```

## Rute, area, playlist {#saved-items}

Ketiganya melekat ke sebuah peta, dibatasi aturan rental yang sama, dan berbagi aturan ini: create
mengembalikan `201`, nama duplikat saat create adalah `409`, rename menghapus spasi dan menambahkan
`(1)`, `(2)`, ... bila nama sudah dipakai alih-alih gagal.

### Rute {#routes}

| Endpoint | Body | Jawaban |
| --- | --- | --- |
| `POST /api/routes` | `{ route_name, map_id, route_points }` | `201 { data: { route_id } }` |
| `GET /api/routes/:map_id` | | `{ data: [{ id, route_name, map_id, created_at, modified_at, route_points }] }` |
| `PUT /api/routes/:id` | `{ route_name }` | `{ data: { id, route_name } }` |
| `DELETE /api/routes/:id` | | `{ success, msg }` |

`route_points` adalah daftar pinpoint persis seperti yang dipegang canvas, satu pose ROS per waypoint:

```json
[
  { "position": { "x": 1.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } },
  { "position": { "x": 5.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.707, "w": 0.707 } }
]
```

Mode rute (Basic, Round Trip, Loop) tidak disimpan. Thumbnail adalah upload terpisah ke
[`/api/media/uploadRouteImage`](#media-server) dengan `route_id` yang dikembalikan; kegagalannya tidak
menggagalkan penyimpanan.

### Area {#areas}

| Endpoint | Body | Jawaban |
| --- | --- | --- |
| `POST /api/areas` | `{ area_name, map_id, area_type, polygon_points }` | `201 { data: { area_id } }` |
| `GET /api/areas/:map_id` | | `{ data: [{ id, area_name, map_id, area_type, created_at, modified_at, polygon_points }] }` |
| `PUT /api/areas/:id` | `{ area_name }` | `{ data: { id, area_name } }` |
| `DELETE /api/areas/:id` | | `{ success, msg }` |

`area_type` bernilai `cover` (default) atau `no_cover` (`400` bila lain). `polygon_points` adalah
`[{ x, y }]` dalam meter.

### Playlist {#playlists}

| Endpoint | Body | Jawaban |
| --- | --- | --- |
| `POST /api/playlists` | `{ playlist_name, map_id, items }` | `201 { data: { playlist_id } }` |
| `GET /api/playlists/:map_id` | | `{ data: [{ id, playlist_name, map_id, created_at, modified_at, items }] }` |
| `PUT /api/playlists/:id` | `{ playlist_name?, items? }` (minimal satu) | `{ data: { playlist_name } }` |
| `DELETE /api/playlists/:id` | | `{ success, msg }` |

Setiap item menyimpan snapshot polygon-nya, sehingga playlist tetap berjalan setelah area sumber di-rename
atau dihapus:

```json
{ "area_id": "01JZ...", "area_name": "Aisle3", "area_type": "cover", "polygon_points": [ { "x": 0, "y": 0 } ] }
```

## Media server {#media-server}

`media-server` menyimpan file peta dan thumbnail. Referensi lengkap:
[Referensi Media Server](/id/development/webui/database/media-server-reference). Panggilan yang dibuat
alur operator:

| Endpoint | Pemanggil | Kontrak |
| --- | --- | --- |
| `POST /api/media/uploadMap` | robot, saat `mapping.stop` | multipart: `id` (ULID peta), `map_name`, `created_by`, `unit_id`, field `homebase_*` opsional, dan tepat dua file di `mapFiles` (`.yaml` + `.pgm`); menulis baris peta dan merender PNG. Dikirim ke media server unit dulu (wajib), lalu ke cloud (best effort) |
| `GET /api/media/maps/:id/download` | robot, saat `navigation.init` bila file tidak ada di disk | bundel peta |
| `GET /api/media/checkMapName` | dialog simpan Pemetaan | query `map_name` (dan `unit_id`); jawaban `data.available`. Dashboard mengirim `user_id`, yang tidak dibaca server. |
| `POST /api/media/uploadRouteImage` | Save Route | multipart `id` (ULID rute) + `imageFile`; disimpan sebagai `images/<id>.jpg` |
| `GET /api/media/images/:filename` | thumbnail peta dan rute | `<ULID peta>.png`, `<ULID rute>.jpg`; **tanpa token** |

## Endpoint khusus unit lokal {#local-endpoints}

Hanya di-mount di backend milik unit sendiri (`DEPLOYMENT_MODE=local`), untuk badge status dan panel
Wi-Fi di dashboard lokal:

| Endpoint | Fungsi |
| --- | --- |
| `GET /local/status` | Mode deployment, rental profile yang terikat, waktu dan error sync terakhir, URL cloud |
| `POST /local/sync` | Memicu sync sekarang (`{ full: true }` untuk pass penuh); `429` saat sync berjalan |
| `GET /local/robot-token` | Token berumur pendek yang dipakai robot ke media server lokal |
| `POST /local/archive` | Menulis arsip unit dari data lokal |
| `GET /local/wifi/status`, `/scan`, `/saved`, `/hotspot` | Status Wi-Fi, diteruskan ke helper di host |
| `POST /local/wifi/connect`, `/disconnect`, `/forget`, `/hotspot` | Perubahan Wi-Fi (`{ ssid, password }`, `{ name }`) |

## Admin API {#admin-api}

Di-mount di `/admin/api`, hanya menerima token `admin` (dari `POST /admin/api/login`). Deskripsi
fungsional per tab: [Konsol Admin](/id/development/webui/admin-console/overview).

| Grup | Endpoint (body) |
| --- | --- |
| Sesi | `POST /login` (`username, password`), `GET /me`, `PATCH /me` (`username, fullname`), `POST /me/password` (`current_password, new_password`) |
| Admin (superadmin) | `GET/POST /admins` (`username, fullname, password, role`), `PATCH /admins/:id/password`, `PATCH /admins/:id/status` (`status`), `DELETE /admins/:id` |
| Operator | `GET/POST /users` (`username, email, fullname, password`), `PATCH /users/:id/status`, `PATCH /users/:id/password` |
| Unit | `GET/POST /units` (`unit_name, unit_id?`), `PATCH /units/:id` (`unit_name`), `DELETE /units/:id`, `DELETE /units/:id/device`, `POST /units/:id/enrollment-code` |
| Robot tertunda | `GET /pending-units`, `POST /pending-units/:id/register` (`unit_name`), `POST /pending-units/:id/adopt` (`unit_id, confirm?`), `DELETE /pending-units/:id` |
| Data unit | `POST /units/:id/transfer` (`target_unit_id, profile_id \| all_profiles`), `POST /units/:id/swap` (`target_unit_id` + cakupan), `POST /units/:id/backups` (cakupan), `DELETE /units/:id/data` (cakupan) |
| Rental | `GET/POST /profiles` (`profile_name, tenant_name, notes`), `GET/PATCH/DELETE /profiles/:id`, `POST /profiles/:id/members` (`user_id`), `DELETE /profiles/:id/members/:userId`, `POST /profiles/:id/units` (`unit_id`), `DELETE /profiles/:id/units/:unitId` |
| Backup | `GET /backups`, `POST /profiles/:id/backups`, `GET /backups/:id/download`, `DELETE /backups/:id`, `POST /backups/upload` (arsip mentah), `POST /backups/:id/plan`, `POST /backups/:id/restore` |

"Cakupan" adalah `{ profile_id }` atau `{ all_profiles: true }`; salah satunya wajib.

## Router enrolment {#enrol-api}

Dipanggil robot, bukan browser: `POST /enroll/claim`, `POST /enroll/status`, `POST /enroll/token`. Body
dan jawabannya ada di [Firmware & Enrolment § Enrolment](/id/development/message-contracts/firmware-and-enrolment#enrolment).

## Router sync {#sync-api}

Dipanggil `sync_agent` milik unit ke cloud, dengan token robot yang terikat ke sebuah rental:

| Endpoint | Body | Fungsi |
| --- | --- | --- |
| `POST /sync/handshake` | | Mengonfirmasi ikatan rental dan offset jam |
| `POST /sync/pull` | `{ since }` | Baris dan tombstone yang berubah di cloud sejak `since` |
| `POST /sync/push` | `{ payload, clock_offset_ms }` | Baris dan tombstone yang berubah di unit |
| `POST /sync/ack` | `{ up_to }` | Menandai perubahan hasil pull sudah diterapkan |
| `GET/PUT /sync/file/:mapId/:kind` | file mentah | File peta (`pgm`, `yaml`, gambar) |
| `GET/PUT /sync/route-file/:routeId/:kind` | file mentah | Thumbnail rute |

Semantik (urutan, aturan konflik): [Sinkronisasi Data](/id/development/data-sync).

## Dokumentasi terkait

- [Perintah MQTT](/id/development/message-contracts/mqtt-commands): apa yang dikirim tiap endpoint perintah ke robot.
- [Keamanan dan Autentikasi](/id/development/security-and-auth): umur token dan keyring.
- [Skema Database](/id/development/database-schema): tabel yang dibaca dan ditulis endpoint-endpoint ini.
