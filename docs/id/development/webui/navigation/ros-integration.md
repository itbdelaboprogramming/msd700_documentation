---
outline: deep
search: false
---

# Navigasi: Integrasi ROS

<RoleBadge role="developer" />

Kontrak jalur (wire contract) di balik seluruh halaman Navigasi: setiap envelope perintah MQTT,
endpoint REST, dan subscription rosbridge yang benar-benar dipakai oleh fitur-fitur Mode List (Map
Sync, Coverage Area, mengemudi pinpoint, manual/autopilot). Halaman ini hanya menarik subset yang
relevan dengan Navigasi dari tiga dokumen referensi bersama yang lebih besar:
[Kontrak Pesan](/id/development/message-contracts), [Referensi API](/id/development/api-reference),
dan [Protokol WebSocket dan rosbridge](/id/development/rosbridge-protocol), dan mengorganisasinya
berdasarkan topik. Ketiga dokumen tersebut tetap menjadi referensi otoritatif dan lengkap untuk
apa pun yang tidak spesifik ke Navigasi; halaman ini menautkan kembali ke sana alih-alih
menduplikasi seluruh isinya.

Untuk perilaku tingkat fitur yang diimplementasikan oleh panggilan-panggilan jalur ini, lihat
[Ikhtisar](/id/development/webui/navigation/overview),
[Sinkronisasi & Auto Align](/id/development/webui/navigation/map-sync-and-alignment),
[Pembersihan Cakupan](/id/development/webui/navigation/coverage-cleaning),
[Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes), dan
[Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot).

::: info Cakupan
Halaman ini membahas subsistem MQTT Navigasi dan Boustrophedon, kontrak heartbeat/lease,
sinkronisasi operation supervisor, topic telemetri yang di-render canvas Navigasi, endpoint REST
Navigasi dan Auto Align, serta subscription rosbridge yang memasok canvas live. Halaman ini tidak
membahas Mapping (SLAM), hardware/enrolment, atau signalling WebRTC: itu semua adalah milik area
fitur lain dan dibahas lengkap di dokumen referensi bersama yang ditautkan di atas.
:::

## Perintah MQTT: subsistem Navigasi

Bentuk envelope lengkap, parameter retry/timeout, dan subsistem `hardware`/`mapping` ada di
[Kontrak Pesan § Katalog Referensi Perintah](/id/development/message-contracts#command-reference-catalogue).
Perintah yang relevan dengan Navigasi (`header: "navigation"`) adalah:

| Perintah | Payload | Tujuan |
| --- | --- | --- |
| `init` | `config.resource`: `map_name` (ULID peta), `default_save_path`, `homebase_x/y/z`, `homebase_ox/oy/oz/ow`. Top-level `ensure_unpaused: true`. | Menjalankan stack navigasi dengan peta tertentu. `ensure_unpaused` menghapus kunci `/emergency_pause` yang tersisa agar navigasi tidak menyala dalam keadaan pause. |
| `pointstamped` | `config.resource`: `X`, `Y`, `Z`. | Mengirim satu goal waypoint ke `move_base`. |
| `deactivate` | tidak ada | Menghentikan stack navigasi yang aktif. |

`map_name` di payload perintah dan `map_id` di body REST di bawah merujuk pada ULID peta yang
sama: field ini diganti namanya di batas HTTP tetapi tidak di jalur menuju robot.

## Perintah MQTT: subsistem Boustrophedon

Perintah `header: "boustrophedon"` menggerakkan
[Pembersihan Cakupan](/id/development/webui/navigation/coverage-cleaning):

| Perintah | Payload | Tujuan |
| --- | --- | --- |
| `init` | `config`: `use_autocover` (bool), `polygon` (satu batas custom-range tunggal), `areas` (array polygon berurutan: kasus seluruh-peta milik Auto Coverage, satu polygon milik Custom Range, atau entri cover milik sebuah Playlist), `exclusions` (polygon keep-out, entri `no_cover` milik sebuah Playlist), `ensure_unpaused: true`. | Memulai sapuan. Field mana dari `polygon`/`areas`/`exclusions` yang terisi bergantung pada titik masuk Pembersihan Cakupan mana yang mengirimkannya (Auto Coverage tidak mengirim apa pun, Custom Range mengirim `polygon`, Playlist mengirim `areas` dan `exclusions` sekaligus). |
| `pause` | `{ "pause": true }` atau `{ "pause": false }` | Menjeda atau melanjutkan sapuan yang sedang berjalan tanpa membuang rencananya. |
| `deactivate` | tidak ada | Menghentikan perencanaan cakupan sepenuhnya. |

Algoritma yang mengubah polygon-polygon ini menjadi jalur sapuan aktual (dekomposisi selular,
jarak antar-lane, penanganan obstacle) didokumentasikan di
[Arsitektur Cakupan Boustrophedon & Penyelarasan Zero-Spin](/id/development/ros/boustrophedon-and-alignment)
dan di luar cakupan di sini.

## Heartbeat/lease

Setiap load halaman Navigasi dan pergantian mode menumpang kontrak heartbeat yang sama yang
didokumentasikan lengkap di
[Kontrak Pesan § Kontrak Ping Heartbeat dan Lease](/id/development/message-contracts#heartbeat-ping-and-lease-contract).
Field yang paling relevan dengan halaman ini:

- **Request**: `page: "navigation"` dan `claim: true` adalah yang dikirim sesi Navigasi
  operasional pada setiap ping, berbeda dari daftar fleet read-only (`claim: false`).
- **Response**: `robot_activity` (misalnya `navigating`, `stuck`) dan `active_page` mengarahkan
  routing dan stuck-detector; `manual_override` dan `autopilot` mencerminkan dua mode yang
  dibahas di [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot); `in_use`
  dan `origin_conflict` mengatur apakah tab ini bahkan diizinkan mengeluarkan perintah-perintah di
  atas.

Bentuk sisi-REST dari ping yang sama adalah `POST /api/units/ping`, didokumentasikan di
[Referensi API § Robot Heartbeat Ping](/id/development/api-reference#_2-robot-heartbeat-ping);
blok `data`-nya cocok dengan kontrak MQTT field demi field.

## Sinkronisasi Operation Supervisor

`operation_supervisor.py` mencerminkan apa pun yang dikirim browser di `/string/operation_sync`
sehingga sebuah misi Navigasi, baik multi-pinpoint maupun cakupan, tetap berjalan meski tab
browser ditutup; protokol lengkap dan diagram urutannya ada di
[Kontrak Pesan § Sinkronisasi Operation Supervisor](/id/development/message-contracts#operation-supervisor-synchronization).
Khusus untuk Navigasi:

- Memulai Auto Coverage, Custom Range Coverage, atau run Playlist masing-masing mengirim sinkron
  `batch` yang mencatat operasi tersebut (`operation: "coverage" | "custom_coverage" |
  "playlist"` dan payload `coverage` yang relevan). Ini adalah cermin yang hanya bersifat
  pencatatan, karena eksekusi cakupan sudah berjalan di sisi robot begitu dikirim; supervisor
  tidak turut mengendalikannya lagi.
- `takeover` dan `release` adalah yang dikirim toggle Autopilot milik
  [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot) untuk menyerahkan
  penyusunan waypoint ke supervisor dan mengambilnya kembali.
- `progress` dikirim saat browser melaju melalui rute multi-pinpoint di bawah kendalinya sendiri
  (lihat [Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes)).

## Telemetri Streaming

Canvas Navigasi dibangun sepenuhnya dari topic yang diserialisasi di unit lewat `topic2string`,
dibawa lewat MQTT, dan dihidrasi ulang menjadi pesan ROS bertipe di server cloud untuk
`rosbridge`. Detail lengkap hop-demi-hop ada di
[Kontrak Pesan § Topic Telemetri Streaming](/id/development/message-contracts#streaming-telemetry-topics);
topic yang memasok canvas Navigasi secara spesifik:

| Topic Robot | Topic Server Cloud | Rate | Peran di canvas |
| --- | --- | --- | --- |
| `/string/robotpose` | `/unit_<ULID>/server/robot_pose` | 25 Hz | Posisi/arah hadap ikon robot, dan sumber stream pose untuk [Show/Hide Trace](/id/development/webui/navigation/coverage-cleaning#show-hide-trace). |
| `/string/map` | `/unit_<ULID>/server/slam/map` | Saat update | Bitmap denah peta yang di-render. |
| `/string/laserscan` | `/unit_<ULID>/server/scan` | 2 Hz | Titik-titik laser scan merah di sekitar robot. |
| `/string/move_base/NavfnROS/plan` | `/unit_<ULID>/server/move_base/NavfnROS/plan` | Saat ada plan | Garis biru global-plan untuk navigasi pinpoint/rute. |
| `/string/move_base/TebLocalPlannerROS/local_plan` | `/unit_<ULID>/server/move_base/TebLocalPlannerROS/local_plan` | Kontinu | Garis lintasan lokal. |
| `/string/boustrophedon_path` | `/unit_<ULID>/server/boustrophedon_path` | Saat ada plan | [Overlay jalur-cakupan](/id/development/webui/navigation/coverage-cleaning#the-coverage-path-overlay) berwarna oranye. |
| `/string/operation_snapshot` | `/unit_<ULID>/string/operation_snapshot` | Latched | Snapshot misi lengkap yang dipakai untuk memulihkan state Navigasi saat rekoneksi/reload. |

## Endpoint REST

Dari
[Referensi API § Navigasi dan Pengiriman Misi](/id/development/api-reference#navigation-and-mission-dispatch):

### Inisialisasi Mode Navigasi: `POST /api/navigation/init`

Menjalankan stack navigasi dengan `map_id`. Peta harus milik unit yang meminta di dalam rental
tempat pemanggil berada; peta yang terlihat oleh pemanggil tetapi direkam oleh robot **lain** pada
rental yang sama akan ditolak dengan `404` alih-alih diteruskan. Meneruskannya dulu membiarkan
request lolos sementara robot diam-diam gagal menemukan file peta yang tidak pernah direkamnya
(lihat
[Referensi API § Inisialisasi Mode Navigasi](/id/development/api-reference#_1-initialize-navigation-mode)
untuk insiden yang diperbaiki oleh perubahan ini).

### Kirim Goal Waypoint: `POST /api/navigation/pointstamped`

Mengirim satu tujuan `{ unit_id, X, Y, Z }`. Ini adalah wrapper REST di sekitar perintah MQTT
`navigation`/`pointstamped` di atas; lihat
[Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes) untuk cara mengemudi
single vs multi pinpoint memakainya.

### Mulai Cakupan Area Boustrophedon: `POST /api/boustrophedon/init`

Wrapper REST di sekitar perintah MQTT `boustrophedon`/`init` di atas (`unit_id`, `areas`,
`exclusions`). Transport frontend untuk ini dan panggilan `deactivate`/`pause` yang sejenis
berada di `src/components/navigationMap/coverageApi.ts`; lihat
[Pembersihan Cakupan](/id/development/webui/navigation/coverage-cleaning) untuk aksi UI mana yang
mengisi field mana.

### Simpan Rute Waypoint Custom: `POST /api/routes`

Menyimpan urutan waypoint bernama (`profile_id`, `map_id`, `route_name`, `route_type`,
`waypoints`). Dibahas secara mendalam di
[Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes); dicantumkan di sini hanya
karena berada di bagian Referensi API yang sama.

### Sistem Auto Align: `POST /api/autoalign/start`

Dari
[Referensi API § Sistem Auto Align](/id/development/api-reference#auto-align-system): memulai
pemeriksaan konvergensi particle-filter/scan-match. `api-reference.md` hanya mendokumentasikan
`start`; rekan-rekannya `status` dan `reset` yang juga dipanggil frontend
(`src/components/navigationMap/autoAlignApi.ts`) didokumentasikan dari sumber di
[Sinkronisasi & Auto Align](/id/development/webui/navigation/map-sync-and-alignment#api-autoalign-status),
karena keduanya belum ditulis di referensi REST itu sendiri.

## Subscription rosbridge

Canvas Navigasi berbicara dengan `rosbridge_suite` lewat protokol WebSocket yang didokumentasikan
lengkap di [Protokol WebSocket dan rosbridge](/id/development/rosbridge-protocol): endpoint
koneksi per lingkungan, bentuk operasi `subscribe`/`publish`/`call_service`, dan resiliensi/self-
healing frontend (patch prototype `createjs.Stage` milik EaselJS dan debounce reconnect
tiga-kali-percobaan) semuanya berlaku sama untuk Navigasi dan tidak diulang di sini.

Subset dari
[Subscription Canvas Web Utama](/id/development/rosbridge-protocol#primary-web-canvas-subscriptions)
yang benar-benar di-render Navigasi adalah kumpulan topic yang sama yang terdaftar di
[Telemetri Streaming](#streaming-telemetry) di atas, dialamatkan dengan nama sisi-rosbridge-nya
(misalnya `/server/robot_pose`, `/server/boustrophedon_path`) alih-alih bentuk sisi-MQTT
`/unit_<ULID>/server/...`: rosbridge berlangganan per-relay-unit, sehingga segmen ULID tersirat
dari relay mana browser terhubung alih-alih diulang di setiap nama topic pada lapisan itu.

## Terkait

- [Ikhtisar](/id/development/webui/navigation/overview): halaman Navigasi dan Mode List
  lengkapnya.
- [Sinkronisasi & Auto Align](/id/development/webui/navigation/map-sync-and-alignment): koreksi
  pose dan panggilan REST Auto Align dalam konteks fiturnya.
- [Pembersihan Cakupan](/id/development/webui/navigation/coverage-cleaning): fitur boustrophedon
  dalam konteks fiturnya.
- [Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes): mengemudi
  single/multi pinpoint dan rute tersimpan.
- [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot): teleop dan
  sequencer autopilot, serta panggilan takeover/release Operation Supervisor.
- [Arsitektur Cakupan Boustrophedon & Penyelarasan Zero-Spin](/id/development/ros/boustrophedon-and-alignment):
  algoritma sapuan dan guard rotasi di tempat.
- [Kontrak Pesan](/id/development/message-contracts): referensi lengkap perintah/feedback MQTT.
- [Referensi API](/id/development/api-reference): referensi lengkap REST API.
- [Protokol WebSocket dan rosbridge](/id/development/rosbridge-protocol): protokol jalur
  rosbridge lengkap.
