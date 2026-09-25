---
outline: deep
search: false
---

# Navigasi: Integrasi ROS

<RoleBadge role="developer" />

Apa yang dikirim dan diterima halaman Navigasi, dikelompokkan per transport. Setiap payload
dispesifikasikan satu kali, di [Kontrak Pesan](/id/development/message-contracts/); halaman ini
menyebutkan kontrak mana yang dipakai halaman Navigasi dan mengapa, lalu menautkan ke bagian persisnya.
Untuk satu baris per tombol, lihat
[Kontrak Pesan § Halaman Navigasi](/id/development/message-contracts/#trace-navigation).

Untuk perilaku tingkat fitur yang diimplementasikan panggilan-panggilan ini, lihat
[Ikhtisar](/id/development/webui/navigation/overview),
[Sinkronisasi & Penyelarasan Peta](/id/development/webui/navigation/map-sync-and-alignment),
[Pembersihan Cakupan](/id/development/webui/navigation/coverage-cleaning),
[Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes), dan
[Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot).

## Dua jalur ke robot {#two-paths}

Halaman ini memakai kedua jalur kontrol yang dijelaskan di
[Kontrak Pesan § Dua jalur kontrol](/id/development/message-contracts/#two-control-paths):

- **Kanal perintah (HTTP → MQTT `system_command`)** untuk semua yang mengubah mode atau butuh jawaban
  ya/tidak: membuka peta, memulai, menjeda, dan menghentikan coverage, Auto Align, Manual Override,
  Autopilot, emergency stop.
- **Kanal streaming (rosbridge → MQTT `string/*`)** untuk goal pinpoint dan rute, teleop WASD, cermin
  operation supervisor, ACK, dan semua overlay yang digambar di canvas.

## Perintah MQTT: subsistem Navigation {#mqtt-commands-navigation-subsystem}

| Perintah | Dikirim oleh | Yang dilakukan di robot | Kontrak |
| --- | --- | --- | --- |
| `navigation.init` | Membuka peta dari halaman Database, atau auto-resume halaman ini | `/map/retire`, `/switch_mode(navigation)`, lalu home base tersimpan di `/initialpose` | [`navigation`](/id/development/message-contracts/mqtt-commands#navigation) |
| `navigation.deactivate` | Keluar dari navigasi (idle, ganti peta) | `/switch_mode(idle)`, `/map/reset` | sama |
| `navigation.pointstamped` | tidak ada di dashboard saat ini | mempublish `/clicked_point` | sama |

`map_id` di body HTTP dan `map_name` di payload MQTT adalah ULID peta yang sama; field-nya hanya
berganti nama di batas HTTP.

::: warning Pinpoint bukan `pointstamped`
Single dan multiple pinpoint, rute, dan perjalanan ke home base adalah goal `move_base` lewat rosbridge
(lihat [di bawah](#move-base-goals)). `POST /api/navigation/pointstamped` masih ada tetapi tidak dipanggil
dashboard.
:::

## Perintah MQTT: subsistem Boustrophedon {#mqtt-commands-boustrophedon-subsystem}

| Perintah | Dikirim oleh | Payload | Kontrak |
| --- | --- | --- | --- |
| `boustrophedon.init` | Auto Coverage | `use_autocover: true` | [`boustrophedon`](/id/development/message-contracts/mqtt-commands#boustrophedon) |
| `boustrophedon.init` | Custom Range Coverage | `use_autocover: false`, `polygon` | sama |
| `boustrophedon.init` | Operation Playlist | `use_autocover: false`, `areas` (entri cover, berurutan), `exclusions` (entri keep-out) | sama |
| `boustrophedon.pause` | Jeda / lanjut | `pause: true` atau `false` | sama |
| `boustrophedon.deactivate` | Cancel / Finish | `use_autocover` sesuai run | sama |

Algoritma yang mengubah polygon-polygon ini menjadi path sapuan ada di
[Arsitektur Cakupan Boustrophedon & Penyelarasan Zero-Spin](/id/development/ros/boustrophedon-and-alignment).

## Endpoint REST {#rest-endpoints}

| Endpoint | Dipakai untuk | Kontrak |
| --- | --- | --- |
| `POST /api/navigation/init` | Membuka peta; ditolak `404` bila peta direkam unit lain | [HTTP API](/id/development/message-contracts/http-api#navigation-init) |
| `POST /api/navigation/deactivate` | Keluar dari navigasi | [HTTP API](/id/development/message-contracts/http-api#navigation-deactivate) |
| `POST /api/boustrophedon/init`, `/pause`, `/deactivate` | Coverage (`coverageApi.ts`) | [HTTP API](/id/development/message-contracts/http-api#coverage) |
| `POST /api/autoalign/start`, `/status`, `/reset` | Auto Align di Map Sync (`autoAlignApi.ts`) | [HTTP API](/id/development/message-contracts/http-api#autoalign) |
| `POST /api/manual`, `POST /api/autopilot` | Dua toggle di `ManualAutopilotPanel` | [HTTP API](/id/development/message-contracts/http-api#manual) |
| `POST /api/emergency_stop` | Tombol darurat | [HTTP API](/id/development/message-contracts/http-api#emergency-stop) |
| `POST /api/routes`, `GET /api/routes/:map_id`, `PUT`/`DELETE /api/routes/:id` | Save, Load, rename, hapus rute (`route_name`, `map_id`, `route_points`) | [HTTP API](/id/development/message-contracts/http-api#routes) |
| `/api/areas`, `/api/playlists` | Area coverage dan playlist | [HTTP API](/id/development/message-contracts/http-api#areas) |
| `PUT /api/maps_data/homebase/:mapId` | Set Home Base | [HTTP API](/id/development/message-contracts/http-api#map-homebase) |

## Goal `move_base` {#move-base-goals}

Pinpoint, rute, Return to Home Base, dan perjalanan ke home base baru semuanya lewat `ActionClient`
roslibjs di `<root>/server/move_base`, dibangun di `public/script/Nav2D.js`. Relay cloud mengubah setiap
goal dan cancel menjadi JSON di `string/move_base/goal` dan `/cancel`, dan `action_client.py` di robot
mengubahnya kembali menjadi `/move_base/goal` dan `/move_base/cancel`.

- Pengiriman: goal yang sama dikirim ulang tiap detik sampai status atau result apa pun untuknya datang.
- Penyelesaian: kode terminal pertama dari `/status` atau `/result` menentukan Arrived, Failed, atau Cancelled.
- Setiap result di-ACK di `string/move_base/result_ack`; robot mengirim ulang result sampai saat itu.

Kontrak lengkap: [rosbridge § Action client move_base](/id/development/message-contracts/rosbridge#move-base-action),
[Topik Bridge § Goal](/id/development/message-contracts/bridge-topics#json-goal).

## Heartbeat dan lease {#heartbeat-lease}

Halaman ini mem-ping `POST /api/hardware/ping` tiap detik dengan `page: "navigation"` dan `claim: true`,
berbeda dengan `claim: false` read-only milik daftar unit, dan mengirim `release: true` saat keluar.
Jawabannya menggerakkan halaman:

- `robot_activity` dan `active_page` mengarahkan operator dan memberi makan detektor stuck;
- `manual_override` dan `autopilot` mengatur dua toggle di
  [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot);
- `in_use` dan `origin_conflict` menentukan apakah tab ini boleh mengirim perintah sama sekali;
- `motion_locked` menunjukkan bahwa `/emergency_pause` sedang menahan robot;
- `intended_mode` dan `needs_recovery` (ditambahkan backend) memicu auto-resume.

Kontrak lengkap: [Heartbeat & Lease](/id/development/message-contracts/heartbeat-and-lease).

## Operation supervisor sync {#operation-sync}

Setiap run yang dimulai halaman ini dicerminkan ke `operation_supervisor.py` di `string/operation_sync`:

| Aksi halaman | Pesan sync |
| --- | --- |
| Play, single atau multiple pinpoint | `batch` (`single_pinpoint` / `multi_pinpoint`, `route_mode`, `waypoints`), `progress` per waypoint, `complete` di akhir |
| Pause, Stop | `pause`, `stop` |
| Autopilot on / off | `batch` + `takeover`, dikonfirmasi snapshot; `release` |
| Perjalanan Set Home Base | `batch` dengan `homebase` (hanya dicatat) |
| Auto Coverage, Custom Range, Playlist | `batch` dengan `coverage`, `custom_coverage`, `playlist` (hanya dicatat: coverage sudah berjalan di robot) |
| Load halaman, reconnect | `resync`, dijawab `operation_snapshot` |

Kontrak lengkap: [Operation Sync](/id/development/message-contracts/operation-sync).

## Telemetri streaming {#streaming-telemetry}

Semua yang digambar canvas datang lewat rosbridge. Nama topik menyertakan prefix unit
(`<root>` = `/unit_<ULID>`); satu koneksi rosbridge melayani semua unit, jadi prefix itulah yang
memilih robot.

| Topik rosbridge | Tipe | Peran di canvas |
| --- | --- | --- |
| `<root>/server/robot_pose` | `geometry_msgs/Pose` | Ikon robot, dan stream pose di balik [Show/Hide Trace](/id/development/webui/navigation/coverage-cleaning) |
| `<root>/server/slam/map` | `nav_msgs/OccupancyGrid` | Peta. Diminta saat mount lewat `string/map_request` alih-alih menunggu pengiriman berikutnya; "Loading map from robot..." sampai tergambar. Lihat [Topik Bridge § Pengiriman peta](/id/development/message-contracts/bridge-topics#map-delivery). |
| `<root>/server/scan`, `<root>/server/scan_holes` | `sensor_msgs/LaserScan` | Titik lidar, lubang live |
| `<root>/server/hazard_cells` | `nav_msgs/Path` | Jejak lubang dalam run |
| `<root>/server/move_base/NavfnROS/plan`, `.../TebLocalPlannerROS/local_plan` | `nav_msgs/Path` | Garis plan global dan lokal |
| `<root>/server/boustrophedon_path` | `nav_msgs/Path` | Overlay path coverage, di-ACK per revisi |
| `<root>/server/skipped_waypoints`, `<root>/string/uncovered_regions` | `nav_msgs/Path`, `std_msgs/String` | Sisa coverage |
| `<root>/string/operation_snapshot`, `<root>/string/operation_progress` | `std_msgs/String` | Pemulihan run dan progres supervisor |

Laju bergantung pada profil egress unit (idle, watching, driving); lihat
[Topik Bridge § Presence dan profil egress](/id/development/message-contracts/bridge-topics#egress-profiles).
Detail subscription: [rosbridge § Subscription](/id/development/message-contracts/rosbridge#subscriptions).

## Terkait

- [Kontrak Pesan § Halaman Navigasi](/id/development/message-contracts/#trace-navigation): semua pesan, satu baris per tombol.
- [Ikhtisar](/id/development/webui/navigation/overview): halaman Navigasi dan Mode List lengkapnya.
- [Sinkronisasi & Penyelarasan Peta](/id/development/webui/navigation/map-sync-and-alignment): koreksi pose dan Auto Align.
- [Pembersihan Cakupan](/id/development/webui/navigation/coverage-cleaning): fitur boustrophedon.
- [Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes): mengemudi dengan pinpoint dan rute tersimpan.
- [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot): teleop, autopilot, pemulihan.
- [Arsitektur Cakupan Boustrophedon & Penyelarasan Zero-Spin](/id/development/ros/boustrophedon-and-alignment):
  algoritma sapuan dan rotation guard in-place.
