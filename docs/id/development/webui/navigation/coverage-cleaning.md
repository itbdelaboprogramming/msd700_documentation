---
outline: deep
search: false
---

# Pembersihan Cakupan

<RoleBadge role="developer" />

Coverage Area adalah entri Mode List yang mengubah Navigasi dari "mengemudi ke satu titik" menjadi
"membersihkan satu wilayah": operator mendefinisikan satu atau beberapa polygon dan robot
menyapunya secara otonom dalam pola boustrophedon (bolak-balik, "membajak sawah"). Halaman ini
membahas fitur ini dari sisi operator: sub-menunya, apa yang dilakukan tiap entri, dan apa yang
disimpannya, bukan algoritma sapuannya sendiri. Untuk itu, lihat
[Arsitektur Cakupan Boustrophedon & Penyelarasan Zero-Spin](/id/development/ros/boustrophedon-and-alignment),
yang menjadi sumber kebenaran untuk model geometri, dekomposisi selular, dan penanganan obstacle
yang sengaja tidak dijelaskan ulang di halaman ini. Untuk kontrak jalur (wire contract) di balik
setiap aksi di halaman ini, lihat [Integrasi ROS](/id/development/webui/navigation/ros-integration).

::: info Cakupan
Halaman ini adalah "apa yang dilakukan dan dilihat operator." Jarak antar-lane, konstanta
clearance, dekomposisi selular menjadi sel-sel yang dapat disapu, dan lima lapis stack
penghindaran obstacle didokumentasikan di
[Arsitektur Cakupan Boustrophedon & Penyelarasan Zero-Spin](/id/development/ros/boustrophedon-and-alignment)
dan ditautkan dari sini alih-alih diulang.
:::

## Masuk ke mode Coverage Area

Memilih `Coverage Area` di Mode List (yang berganti label menjadi `Finish Coverage Area` saat
aktif, `NAV_MODE.COVERAGE` / `NAV_MODE.COVERAGE_ACTIVATE` di `ModeListPanel.tsx`) membuka sub-menu
kontrol khusus cakupan menggantikan entri pinpoint/rute. Coverage tidak menggunakan pin berbasis
titik, jadi marker single/multi pinpoint yang tersisa dari sesi yang belum selesai akan dihapus
saat masuk mode ini. Popup instruksi ditampilkan setiap kali operator masuk ke mode ini, berbeda
dari instruksi Map Sync yang hanya ditampilkan sekali per sesi, karena area cakupan yang salah
digambar atau salah dipahami jauh lebih berkonsekuensi untuk diulang.

## Auto Coverage

Auto Coverage menyapu seluruh peta yang dimuat tanpa batas yang digambar operator: deteksi batas
milik robot sendiri yang memutuskan lantai mana yang bisa dijangkau. Memulainya
(`src/components/navigationMap/coverageApi.ts`, `POST /api/boustrophedon/init` dengan
`use_autocover: true`) menghapus pinpoint yang tersisa, menghapus overlay
[jejak-robot](#show-hide-trace) dari run sebelumnya agar run baru menggambar garis yang bersih, dan
menghidupkan kembali subscription [overlay jalur-cakupan](#overlay-jalur-cakupan) jika sebuah
Cancel sebelumnya telah merobohkannya. Karena tidak ada polygon terbatas untuk ditandai, overlay
area yang digambar itu sendiri dihapus alih-alih diisi: batas sapuan ditemukan oleh robot, bukan
digambar oleh operator.

**Kontrak:** [`POST /api/boustrophedon/init`](/id/development/message-contracts/http-api#boustrophedon-init) `{ use_autocover: true }` →
[`boustrophedon.init`](/id/development/message-contracts/mqtt-commands#boustrophedon), dicatat dengan [`batch`](/id/development/message-contracts/operation-sync#batch) operasi `coverage`.

## Custom Range Coverage

Custom Range Coverage adalah rekan yang digambar operator: operator menggambar sendiri batas di
peta dengan tangan (`src/components/navigationMap/customAreaDraw.ts`) alih-alih mengandalkan
deteksi otomatis, lalu memulai sapuan tepat pada polygon tersebut
(`POST /api/boustrophedon/init` dengan `use_autocover: false` dan `polygon` yang digambar).

Ada dua algoritma penggambaran, dipilih saat build lewat `NEXT_PUBLIC_CUSTOM_AREA_DRAW_MODE`
(`manual` adalah default):

- **`manual`**: operator mengklik vertex batas satu per satu, secara berurutan, dan tepi
  mengikuti urutan klik secara persis. Ini satu-satunya mode yang bisa merepresentasikan garis
  luar cekung (ruangan berbentuk L, area yang melingkari pilar), karena tidak ada yang
  menyempurnakan bentuk secara otomatis. Klik yang akan memotong tepi yang sudah digambar akan
  ditolak sepenuhnya, karena batas yang berpotongan dengan dirinya sendiri tidak memiliki bagian
  dalam yang terdefinisi dengan baik dan akan ditolak atau menjadi kacau di sisi robot. Klik yang
  mendarat kembali di vertex pertama (dalam toleransi snap yang bisa dikonfigurasi) menutup loop.
- **`hull` (legacy)**: setiap klik adalah titik petunjuk yang longgar, dan polygon terus-menerus
  disempurnakan otomatis sebagai convex hull dari semua titik yang ditempatkan sejauh ini. Loop
  selalu tertutup, tetapi area cekung tidak akan pernah bisa digambar secara presisi: hull akan
  menelan setiap lekukan ke dalam.

**Kontrak:** [`POST /api/boustrophedon/init`](/id/development/message-contracts/http-api#boustrophedon-init) dengan `polygon` →
[`boustrophedon.init`](/id/development/message-contracts/mqtt-commands#boustrophedon), yang dipublish ulang robot sebagai `geometry_msgs/Polygon`
di `/msd700/coverage_polygon`; dicatat dengan [`batch`](/id/development/message-contracts/operation-sync#batch) operasi `custom_coverage`. Jeda dan
stop: [`/api/boustrophedon/pause`](/id/development/message-contracts/http-api#boustrophedon-pause),
[`/api/boustrophedon/deactivate`](/id/development/message-contracts/http-api#boustrophedon-deactivate).

### Close Loop dan Clear Area

Saat menggambar, slot tombol yang sama memiliki dua fungsi tergantung mode penggambaran dan
kemajuannya:

- **Close Loop**: di mode `manual`, kontrol eksplisit yang menyelesaikan batas lebih awal, setara
  dengan mengklik kembali ke vertex pertama. Di mode `hull` garis luar sudah disempurnakan
  otomatis seiring titik ditambahkan, jadi "menyelesaikan" hanyalah perubahan fase dari
  menggambar ke siap, dengan syarat minimal 3 titik telah ditempatkan.
- **Clear Area**: begitu sebuah batas selesai (`ready`), tombol berganti label menjadi
  `Clear Area`. Mengkliknya menghapus setiap vertex yang digambar dan overlay-nya, tetapi kembali
  ke fase menggambar alih-alih keluar dari mode Custom Range, sehingga operator bisa langsung
  menggambar ulang tanpa perlu masuk ulang ke sub-menu.

Memulai sapuan menghapus pinpoint yang tersisa, menghapus overlay jejak-robot dari run
sebelumnya, dan menukar marker polygon cyan "menggambar" dengan overlay sapuan hijau secara
langsung alih-alih menunggu pengakuan (acknowledgment) dari backend, karena pergantian mode robot
pada `/api/boustrophedon/init` memakan waktu cukup lama sehingga menunggu respons sebelum
memperbarui canvas akan membuat peta terlihat idle selama beberapa detik. Jika permulaan ditolak,
polygon dikembalikan ke drawer sehingga operator bisa mencoba lagi alih-alih harus menggambar
ulang.

## Save Area

Save Area (`src/components/save-area/SaveAreaModal.tsx`) menyimpan batas yang digambar ke dalam
pustaka yang bisa dipakai ulang alih-alih langsung mengonsumsinya: operator memberinya nama dan
menandainya sebagai area **Cover** (sesuatu untuk disapu) atau area **Not-to-Cover** (zona
keep-out), dan ditulis lewat `POST /api/areas` (`src/components/area-playlist/areaApi.ts`). Area
tersimpan didaftar, diganti nama, dan dihapus lewat modul `areaApi.ts` yang sama (`fetchAreas`,
`renameArea`, `deleteArea`) dan berlingkup pada peta tempat area itu digambar (`map_id`), sesuai
dengan lingkup per-peta, per-unit milik fitur Database yang dijelaskan di
[Database § Integrasi ROS](/id/development/webui/database/ros-integration). Area yang disimpan di
sini adalah yang menjadi sumber Operation Playlist di bawah ini.

**Kontrak:** [`/api/areas`](/id/development/message-contracts/http-api#areas) (`POST`, `GET /:map_id`, `PUT /:id`, `DELETE /:id`),
`area_type` `cover` atau `no_cover`, `polygon_points` dalam meter. Hanya backend; robot tidak terlibat.

## Operation Playlist

Operation Playlist (`src/components/area-playlist/AreaPlaylistModal.tsx`) membangun dan
menjalankan **urutan** area tersimpan dalam satu pengiriman, mencampur entri cover dan keep-out.
Setiap entri di playlist menyimpan snapshot polygon area sumbernya pada saat ditambahkan
(`PlaylistItem.polygon_points`), sehingga sebuah playlist tetap berjalan dengan benar bahkan jika
area tersimpan aslinya kemudian diganti nama atau dihapus. Playlist dipersist dengan
`POST /api/playlists` dan didaftar dengan `GET /api/playlists/:mapId` (`areaApi.ts`).

Menjalankan sebuah playlist memisahkan entrinya berdasarkan tipe sebelum pengiriman: setiap entri
`cover` polygonnya menjadi salah satu `areas` dalam panggilan coverage-init, dan setiap entri
`no_cover` menjadi salah satu `exclusions`, bentuk `areas`/`exclusions` yang sama yang
didokumentasikan di
[Integrasi ROS § Perintah MQTT: subsistem Boustrophedon](/id/development/webui/navigation/ros-integration#mqtt-commands-boustrophedon-subsystem).
Setidaknya satu area cover diperlukan; playlist yang hanya berisi zona keep-out ditolak di sisi
klien sebelum mencapai robot. Setelah dikirim, run playlist dialihkan lewat jalur
custom-coverage (`use_autocover: false`) yang sama seperti Custom Range Coverage untuk
panggilan pause/deactivate berikutnya, karena dari sudut pandang robot ini adalah satu sapuan
multi-polygon yang terbatas, bukan urutan sapuan terpisah.

**Kontrak:** penyimpanan lewat [`/api/playlists`](/id/development/message-contracts/http-api#playlists) (item menyimpan snapshot
polygon). Menjalankan adalah [`POST /api/boustrophedon/init`](/id/development/message-contracts/http-api#boustrophedon-init) dengan `areas` dan
`exclusions` → [`boustrophedon.init`](/id/development/message-contracts/mqtt-commands#boustrophedon), yang diteruskan robot ke node coverage sebagai
JSON di `/msd700/coverage_plan`; dicatat dengan [`batch`](/id/development/message-contracts/operation-sync#batch) operasi `playlist`.

## Show/Hide Trace

Show/Hide Trace mengaktifkan atau menonaktifkan overlay visual dari jalur yang telah dilalui robot
selama sebuah run cakupan: sebuah polyline merah (`src/components/navigationMap/robotTrace.ts`)
digambar di canvas dengan berlangganan ke topic pose live robot dan menambahkan setiap pose baru
ke bentuk jejak, terlepas dari [overlay jalur-cakupan](#overlay-jalur-cakupan) yang dijelaskan
di bawah. Ia menjawab pertanyaan yang berbeda dari overlay itu: jejak menunjukkan ke mana robot
sebenarnya pernah berada, bukan apa yang direncanakan planner untuk disapu. Jejak direset
(dihapus dan dimulai ulang) di awal setiap run cakupan baru (Auto, Custom Range, atau Playlist),
tetapi sengaja dipertahankan saat pause/resume, sehingga run yang dijeda-lalu-dilanjutkan tetap
menunjukkan progresnya alih-alih memulai ulang garisnya.

**Kontrak:** hanya klien; jejak digambar dari subscription
[`server/robot_pose`](/id/development/message-contracts/rosbridge#subscriptions) yang sudah dipegang canvas.

## Overlay jalur-cakupan

Terpisah dari jejak, sebuah overlay oranye me-render jalur sapuan yang dimaksudkan oleh planner
boustrophedon sendiri (`nav_msgs/Path` pada `/server/boustrophedon_path`, dijelaskan di
[Integrasi ROS § Telemetri Streaming](/id/development/webui/navigation/ros-integration#streaming-telemetry)).
Subscription overlay ini dirobohkan saat Cancel/Finish dan dihidupkan kembali di awal run
berikutnya (Auto Coverage, Custom Range Coverage, dan Playlist semuanya memanggil urutan
"inisialisasi jika perlu, lalu tampilkan" yang sama), dan sengaja disembunyikan alih-alih
dihancurkan di akhir sebuah run sehingga garis sapuan yang selesai tetap terlihat hingga run baru
dimulai.

**Kontrak:** [`server/boustrophedon_path`](/id/development/message-contracts/rosbridge#subscriptions) (`nav_msgs/Path`, dibawa sebagai
[path terkompresi](/id/development/message-contracts/bridge-topics#compressed-formats)); setiap revisi yang tergambar di-ACK di
[`string/boustrophedon_path_ack`](/id/development/message-contracts/bridge-topics#acks). Waypoint yang terlewat dan region yang belum tersapu datang di
`server/skipped_waypoints` dan `string/uncovered_regions`.

## Terkait

- [Kontrak Pesan § Pembersihan cakupan](/id/development/message-contracts/#trace-coverage): semua pesan yang dikirim run coverage.
- [Ikhtisar](/id/development/webui/navigation/overview): halaman Navigasi dan Mode List
  lengkapnya.
- [Sinkronisasi & Auto Align](/id/development/webui/navigation/map-sync-and-alignment): fitur
  lain yang dimulai dalam keadaan diam (stationary-start) dan berjalan otonom di halaman ini.
- [Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes): mengemudi
  single/multi pinpoint dan rute tersimpan.
- [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot): teleop dan
  sequencer autopilot.
- [Integrasi ROS](/id/development/webui/navigation/ros-integration): kontrak jalur Navigasi
  lengkap, termasuk envelope perintah boustrophedon yang dirujuk di atas.
- [Arsitektur Cakupan Boustrophedon & Penyelarasan Zero-Spin](/id/development/ros/boustrophedon-and-alignment):
  algoritma sapuan itu sendiri: model geometri, dekomposisi selular, manajemen obstacle.
- [Kontrak Pesan](/id/development/message-contracts/): referensi lengkap perintah/feedback MQTT.
- [HTTP API](/id/development/message-contracts/http-api): referensi lengkap REST API.
- [rosbridge (WebSocket)](/id/development/message-contracts/rosbridge): protokol jalur
  rosbridge lengkap.
