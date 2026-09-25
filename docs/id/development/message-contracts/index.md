---
outline: deep
search: false
---

# Kontrak Pesan

<RoleBadge role="developer" />

Setiap payload yang melintasi batas proses di MSD700 dispesifikasikan di bagian ini: HTTP API yang
dipanggil dashboard web, kanal perintah MQTT antara cloud dan unit, topik ROS yang dibawa bridge,
WebSocket rosbridge yang dipakai browser untuk menggambar, protokol operation supervisor, signalling
WebRTC, link firmware, dan handshake enrolment.

Istilah yang dipakai di seluruh bagian ini: **unit** adalah satu robot terdaftar sebagaimana dilihat
perangkat lunak (satu baris di `units`, dialamatkan sebagai `/unit_<ULID>`); **robot** adalah mesin
fisiknya. Tidak ada objek kelompok terpisah di atas unit.

::: info Verifikasi kontrak
Bentuk payload diambil dari source yang berjalan (`backend_node`, `system_command.py`,
`operation_supervisor.py`, `topic2string`, `aws_mqtt`, `media-server`, `src/` milik dashboard).
Perubahan field apa pun di kode harus diperbarui di sini dalam commit yang sama.
:::

## Halaman di bagian ini {#pages}

| Halaman | Transport | Isi spesifikasi |
| --- | --- | --- |
| [HTTP API (Web)](/id/development/message-contracts/http-api) | HTTPS REST, SSE | Semua endpoint yang dipanggil dashboard, Konsol Admin, dan robot di `backend_node` dan `media-server` |
| [Perintah MQTT](/id/development/message-contracts/mqtt-commands) | MQTT 3.1.1 over TLS 8883 | Amplop `system_command` / `system_feedback`, retry, dan setiap pasangan `header`/`command` |
| [Heartbeat & Lease](/id/development/message-contracts/heartbeat-and-lease) | HTTP → MQTT, MQTT over WebSocket | Field lease `hardware.ping`, frame `hardware.heartbeat` 5 Hz |
| [Topik Bridge (MQTT ↔ ROS)](/id/development/message-contracts/bridge-topics) | MQTT, ROS | Peta topik robot ↔ cloud lengkap, format string JSON, pengiriman peta, profil egress |
| [rosbridge (WebSocket)](/id/development/message-contracts/rosbridge) | WSS | Apa yang di-subscribe, dipublish, dan dikirim browser lewat action client `move_base` |
| [Operation Sync](/id/development/message-contracts/operation-sync) | ROS over MQTT | `operation_sync`, `operation_progress`, `operation_snapshot` |
| [Signalling WebRTC](/id/development/message-contracts/webrtc-signalling) | WSS, SRTP | Pesan negosiasi kamera |
| [Firmware & Enrolment](/id/development/message-contracts/firmware-and-enrolment) | rosserial, HTTPS | Topik STM32 ↔ Jetson, handshake `/enroll` |

## Dua jalur kontrol {#two-control-paths}

Aksi operator sampai ke robot lewat salah satu dari dua jalur, dan mengetahui jalur mana yang dipakai
sebuah aksi adalah sebagian besar pekerjaan untuk menelusurinya.

![Dua Jalur Kontrol](../../../development/message-contracts/diagrams/message-contracts-two-control-paths.drawio)

- **Jalur A, kanal perintah.** Browser memanggil endpoint HTTP; `backend_node` membungkusnya dalam
  amplop `system_command`, mempublishnya lewat MQTT, dan menahan request HTTP sampai `system_feedback`
  yang cocok datang (atau 30 detik lewat). Dipakai untuk semua yang mengubah mode atau butuh jawaban
  ya/tidak: navigation init, mulai/simpan mapping, mulai/jeda/berhenti coverage, manual override,
  autopilot, emergency stop, auto align. Lihat [Perintah MQTT](/id/development/message-contracts/mqtt-commands).
- **Jalur B, kanal streaming.** Browser publish dan subscribe lewat rosbridge ke ROS master di cloud.
  Relay `topic2string` mengubah pesan bertipe menjadi string JSON, bridge MQTT membawanya, dan
  `topic2string` di robot mengubahnya kembali menjadi pesan bertipe. Dipakai untuk goal navigasi,
  teleop, ACK, operation sync, dan semua overlay yang digambar di peta. Lihat
  [rosbridge](/id/development/message-contracts/rosbridge) dan
  [Topik Bridge](/id/development/message-contracts/bridge-topics).

Data yang tidak pernah menyentuh robot (daftar peta, rute, area, playlist, akun) adalah HTTP biasa ke
`backend_node` atau `media-server` dan berakhir di MySQL atau di disk.

## Pengalamatan unit {#unit-addressing}

Setiap unit dialamatkan dengan prefix `/unit_<ULID>`, dengan ULID berupa primary key barisnya di
`units`. `GET /unit/all` memberikan `topic_root` yang sudah jadi ke browser, sehingga dashboard tidak
pernah harus menyusun prefix itu sendiri.

![Skema Pengalamatan Unit](../../../development/message-contracts/diagrams/message-contracts-unit-addressing-scheme.drawio)

| Hop | Bentuk topik | Catatan |
| --- | --- | --- |
| ROS master robot | `/string/robotpose` | Tanpa prefix: satu robot per `roscore` onboard. |
| Broker MQTT | `/unit_<ULID>/string/robotpose` | Bridge `aws_mqtt` di robot menambahkan prefix. |
| ROS master cloud | `/unit_<ULID>/string/robotpose`, lalu `/unit_<ULID>/server/robot_pose` | Unit relay mempertahankan prefix dan mempublish ulang topik bertipe di bawah `server/`. |

::: warning Kenapa prefix `unit_` wajib
Nama graph ROS harus diawali huruf, `~`, atau `/`. ULID diawali angka (`01JZ...`), sehingga
`/01JZ.../string/map` ditolak ROS. Prefix ini menjaga pemetaan 1:1 antara nama MQTT dan ROS.
:::

## Jejak aksi {#action-trace}

Setiap baris adalah satu hal yang dilakukan operator di dashboard, beserta semua pesan yang
ditimbulkannya. Ikuti tautan untuk kontrak persisnya. Aksi bertanda *hanya klien* tidak mengirim apa
pun sampai aksi berikutnya (biasanya Play) memakai apa yang sudah disiapkan.

### Sesi dan daftar unit {#trace-session}

| Aksi | Browser mengirim | Sisi robot | Jawaban kembali sebagai |
| --- | --- | --- | --- |
| Login | [`POST /user/login`](/id/development/message-contracts/http-api#user-login) | tidak ada | token di body HTTP |
| Refresh token | [`POST /user/refresh`](/id/development/message-contracts/http-api#user-refresh) | tidak ada | pasangan token baru |
| Membuka daftar unit | [`GET /unit/all`](/id/development/message-contracts/http-api#unit-list), lalu [`POST /api/hardware/ping`](/id/development/message-contracts/http-api#hardware-ping) per unit dengan `claim: false` | [`hardware.ping`](/id/development/message-contracts/heartbeat-and-lease#ping-request) | [respons ping](/id/development/message-contracts/heartbeat-and-lease#ping-response) di dalam `details.data` |
| Tetap di halaman operasional | [`hardware.ping`](/id/development/message-contracts/heartbeat-and-lease#ping-request) dengan `claim: true` tiap detik, [`POST /api/unit/heartbeat`](/id/development/message-contracts/http-api#unit-heartbeat) tiap 15 detik; di dashboard lokal unit juga [`hardware.heartbeat` 5 Hz](/id/development/message-contracts/heartbeat-and-lease#heartbeat-frame) | refresh lease, tier watchdog | status lease di respons ping |
| Meninggalkan halaman operasional | ping dengan `release: true`, `page: "other"` | lease dilepas | tidak ada (fire and forget) |
| Mengambil alih dari sesi lain | ping dengan `force_takeover: true` | lease berpindah | `in_use`, `origin_conflict` bersih |
| Logout | [`POST /api/hardware/idle`](/id/development/message-contracts/http-api#hardware-commands) (bukan saat autopilot), [`POST /user/logout`](/id/development/message-contracts/http-api#user-logout) | [`hardware.idle`](/id/development/message-contracts/mqtt-commands#hardware) | `{ success, remaining, retained }` |

### Halaman Navigasi {#trace-navigation}

| Aksi | Browser mengirim | Sisi robot | Jawaban kembali sebagai |
| --- | --- | --- | --- |
| Membuka peta untuk navigasi | [`POST /api/navigation/init`](/id/development/message-contracts/http-api#navigation-init) | [`navigation.init`](/id/development/message-contracts/mqtt-commands#navigation): `/switch_mode(navigation)`, `/map/retire`, home base ke `/initialpose` | HTTP 200; peta lalu datang di [`server/slam/map`](/id/development/message-contracts/rosbridge#subscriptions) setelah [`map_request`](/id/development/message-contracts/bridge-topics#map-delivery) |
| Menaruh pinpoint, menambah waypoint, Delete All Pinpoints | *hanya klien* | tidak ada | tidak ada |
| Play, single pinpoint | [goal `move_base`](/id/development/message-contracts/rosbridge#move-base-action) di `server/move_base/goal`, [`operation_sync` `batch`](/id/development/message-contracts/operation-sync#batch) dengan `single_pinpoint` | [`string/move_base/goal`](/id/development/message-contracts/bridge-topics#json-goal) → `/move_base/goal` | [`server/move_base/status` dan `/result`](/id/development/message-contracts/rosbridge#move-base-action), tiap result di-ACK di [`result_ack`](/id/development/message-contracts/bridge-topics#acks) |
| Play, multiple pinpoint (Basic, Round Trip, Loop) | satu goal per waypoint, [`batch`](/id/development/message-contracts/operation-sync#batch) dengan `multi_pinpoint` dan `route_mode`, [`progress`](/id/development/message-contracts/operation-sync#progress) per waypoint, [`complete`](/id/development/message-contracts/operation-sync#stop-complete) di akhir | sama seperti di atas, per waypoint | sama seperti di atas |
| Pause | cancel goal di [`server/move_base/cancel`](/id/development/message-contracts/rosbridge#move-base-action), [`operation_sync` `pause`](/id/development/message-contracts/operation-sync#pause) | [`string/move_base/cancel`](/id/development/message-contracts/bridge-topics#json-cancel) → `/move_base/cancel` | status goal `PREEMPTED` |
| Stop | cancel goal, [`operation_sync` `stop`](/id/development/message-contracts/operation-sync#stop-complete) | sama seperti Pause, batch dihapus | status goal, [snapshot](/id/development/message-contracts/operation-sync#snapshot) dengan `active: false` |
| Save Route | [`POST /api/routes`](/id/development/message-contracts/http-api#routes), lalu [`POST /api/media/uploadRouteImage`](/id/development/message-contracts/http-api#media-server) | tidak ada | `201 { data: { route_id } }` |
| Load / rename / hapus rute | [`GET`, `PUT`, `DELETE /api/routes`](/id/development/message-contracts/http-api#routes) | tidak ada | daftar rute / `{ success }` |
| Set Home Base | [`PUT /api/maps_data/homebase/:mapId`](/id/development/message-contracts/http-api#map-homebase), lalu goal `move_base` ke sana dengan [`batch` `homebase`](/id/development/message-contracts/operation-sync#batch) | goal seperti di atas | status goal |
| Return to Home Base | [goal `move_base`](/id/development/message-contracts/rosbridge#move-base-action) ke home base tersimpan | goal seperti di atas | status goal |
| Estimasi pose / seed pose home base | publish di [`/unit_<ULID>/initialpose`](/id/development/message-contracts/rosbridge#publications) | [`string/initialpose`](/id/development/message-contracts/bridge-topics#json-initialpose) → `/initialpose` | pose robot bergeser di `server/robot_pose` |
| Manual Override on / off | [`POST /api/manual`](/id/development/message-contracts/http-api#manual) | [`manual.enable` / `disable`](/id/development/message-contracts/mqtt-commands#manual) | HTTP 200; `manual_override` di respons ping |
| Mengemudi dengan WASD | [`geometry_msgs/Twist` di `server/key_vel`](/id/development/message-contracts/rosbridge#publications) 10 Hz | [`string/key_vel`](/id/development/message-contracts/bridge-topics#json-twist) → `/mux/key_vel` | pose robot |
| Autopilot on / off | [`POST /api/autopilot`](/id/development/message-contracts/http-api#autopilot), [`batch` + `takeover`](/id/development/message-contracts/operation-sync#takeover) atau [`release`](/id/development/message-contracts/operation-sync#release) | [`autopilot.enable` / `disable`](/id/development/message-contracts/mqtt-commands#autopilot) | [`operation_progress`](/id/development/message-contracts/operation-sync#progress-out), [snapshot](/id/development/message-contracts/operation-sync#snapshot) |
| Emergency stop / lepas | [`POST /api/emergency_stop`](/id/development/message-contracts/http-api#emergency-stop) | [`emergency_stop.activate` / `deactivate`](/id/development/message-contracts/mqtt-commands#emergency-stop) | HTTP 200 |
| Auto Align | [`POST /api/autoalign/start`, `/status`, `/reset`](/id/development/message-contracts/http-api#autoalign) | [`autoalign.*`](/id/development/message-contracts/mqtt-commands#autoalign) | HTTP 200 per panggilan |

### Pembersihan cakupan {#trace-coverage}

| Aksi | Browser mengirim | Sisi robot | Jawaban kembali sebagai |
| --- | --- | --- | --- |
| Mulai auto coverage | [`POST /api/boustrophedon/init`](/id/development/message-contracts/http-api#boustrophedon-init) dengan `use_autocover: true`, [`batch` `coverage`](/id/development/message-contracts/operation-sync#batch) | [`boustrophedon.init`](/id/development/message-contracts/mqtt-commands#boustrophedon): `/switch_mode(boustrophedon)` | HTTP 200, lalu path di [`server/boustrophedon_path`](/id/development/message-contracts/rosbridge#subscriptions) |
| Mulai custom area | endpoint yang sama dengan `polygon`, [`batch` `custom_coverage`](/id/development/message-contracts/operation-sync#batch) | polygon di `/msd700/coverage_polygon` | sama |
| Mulai playlist (area + keep-out) | endpoint yang sama dengan `areas` dan `exclusions`, [`batch` `playlist`](/id/development/message-contracts/operation-sync#batch) | JSON rencana di `/msd700/coverage_plan` | sama |
| Path coverage diterima | [`boustrophedon_path_ack`](/id/development/message-contracts/bridge-topics#acks) dengan revisi path | robot berhenti mengirim ulang | tidak ada |
| Jeda / lanjut | [`POST /api/boustrophedon/pause`](/id/development/message-contracts/http-api#boustrophedon-pause) | [`boustrophedon.pause`](/id/development/message-contracts/mqtt-commands#boustrophedon): `/path_coverage/pause` atau `/resume` | HTTP 200 |
| Stop | [`POST /api/boustrophedon/deactivate`](/id/development/message-contracts/http-api#boustrophedon-deactivate), [`operation_sync` `stop`](/id/development/message-contracts/operation-sync#stop-complete) | [`boustrophedon.deactivate`](/id/development/message-contracts/mqtt-commands#boustrophedon) | HTTP 200 |
| Simpan / rename / hapus area | [`/api/areas`](/id/development/message-contracts/http-api#areas) | tidak ada | `{ success, data }` |
| Simpan / edit / hapus playlist | [`/api/playlists`](/id/development/message-contracts/http-api#playlists) | tidak ada | `{ success, data }` |

### Halaman Pemetaan {#trace-mapping}

| Aksi | Browser mengirim | Sisi robot | Jawaban kembali sebagai |
| --- | --- | --- | --- |
| Mulai mapping | [`POST /api/mapping`](/id/development/message-contracts/http-api#mapping-control) `{ start: true }` | [`mapping.start`](/id/development/message-contracts/mqtt-commands#mapping): `/switch_mode(explore)` | HTTP 200; peta yang tumbuh di [`server/slam/map`](/id/development/message-contracts/rosbridge#subscriptions) |
| Pause | `POST /api/mapping` `{ pause: true }` | [`mapping.pause`](/id/development/message-contracts/mqtt-commands#mapping) | HTTP 200 |
| Cek nama peta | [`GET /api/media/checkMapName`](/id/development/message-contracts/http-api#media-server) | tidak ada | `data.available` |
| Simpan (stop) | `POST /api/mapping` `{ stop: true, map_name, homebase_* }`, lalu [`GET /api/mapping/progress/:request_id`](/id/development/message-contracts/http-api#mapping-progress) | [`mapping.stop`](/id/development/message-contracts/mqtt-commands#mapping): `/mapsaver/full_path`, upload ke [`/api/media/uploadMap`](/id/development/message-contracts/http-api#media-server) | langsung `{ request_id, map_ulid }`, lalu event [`mapping_progress`](/id/development/message-contracts/mqtt-commands#mapping-progress) lewat SSE |
| Buang (discard) | [`POST /api/mapping/discard`](/id/development/message-contracts/http-api#mapping-discard) | [`mapping.discard`](/id/development/message-contracts/mqtt-commands#mapping) | HTTP 200 |

### Halaman Database {#trace-database}

| Aksi | Browser mengirim | Sisi robot | Jawaban kembali sebagai |
| --- | --- | --- | --- |
| Daftar peta | [`GET /api/maps_data?unit_id=`](/id/development/message-contracts/http-api#maps-list) | tidak ada | `{ data: [map] }` |
| Thumbnail | [`GET /api/media/images/<ULID peta>.png`](/id/development/message-contracts/http-api#media-server) | tidak ada | PNG |
| Rename peta | [`PUT /api/maps_data/rename/:mapId`](/id/development/message-contracts/http-api#map-rename) | tidak ada (unit menerima perubahan lewat [sinkronisasi data](/id/development/data-sync)) | `{ data: { old_map_name, new_map_name } }` |
| Hapus peta | [`DELETE /api/maps_data`](/id/development/message-contracts/http-api#map-delete) dengan `map_id` | tidak ada | `{ data: { mapId, files } }` |
| Navigasi di sebuah peta | [`POST /api/navigation/init`](/id/development/message-contracts/http-api#navigation-init) | lihat tabel Navigasi | lihat tabel Navigasi |

### Konsol admin, enrolment, kamera {#trace-other}

| Aksi | Kontrak |
| --- | --- |
| Tab mana pun di Konsol Admin | [`/admin/api/*`](/id/development/message-contracts/http-api#admin-api) dengan token `admin` |
| Enrolment robot, refresh token saat boot | [`/enroll/claim`, `/status`, `/token`](/id/development/message-contracts/firmware-and-enrolment#enrolment) |
| Sinkronisasi data unit ↔ cloud | [`/sync/*`](/id/development/message-contracts/http-api#sync-api) |
| Kamera langsung | [Signalling WebRTC](/id/development/message-contracts/webrtc-signalling) |

## Dokumentasi terkait

- [Arsitektur](/id/development/architecture): topologi sistem dan batas kepercayaan.
- [State dan Perilaku](/id/development/state-and-behavior): state machine yang digerakkan pesan-pesan ini.
- [ROS Web UI](/id/development/webui/): deskripsi fungsional setiap halaman yang ditelusuri di atas.
