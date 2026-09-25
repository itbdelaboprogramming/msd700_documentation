---
outline: deep
search: false
---

# Navigasi: Pinpoint & Rute

<RoleBadge role="developer" />

Mode point-and-go di halaman Navigasi: Single Pinpoint, Multiple Pinpoint beserta kontrol Save/Load
Route dan Round Trip/Loop Route-nya, Set Home Base, dan Delete All Pinpoints. Untuk pipeline
rendering canvas dan matematika koordinat yang menjadi dasar mode-mode ini, serta pola Mode
List/Action Bar tempat mode-mode ini dipilih, lihat
[Ikhtisar](/id/development/webui/navigation/overview). Untuk mengemudi manual dan alih kendali ke
Autopilot, lihat [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot).

## Menempatkan titik pada canvas

Setiap mode di halaman ini yang menjatuhkan marker (satu pinpoint tunggal, satu waypoint dalam
rute multi-titik, atau posisi home base baru) melewati konversi klik-ke-metrik yang sama seperti
yang dijelaskan di
[Ikhtisar § Transformasi koordinat](/id/development/webui/navigation/overview#transformasi-koordinat-ruang-metrik-ke-piksel-layar):
sebuah klik pada canvas dikonversi dari koordinat piksel ke koordinat metrik ROS lewat
`stage.globalToRos`, yang di-patch ke `createjs.Stage.prototype` seperti dijelaskan di
[Ikhtisar § Patch `createjs.Stage.prototype`](/id/development/webui/navigation/overview#patch-createjs-stage-prototype).

Ini adalah penggunaan mesin penggambaran interaktif canvas yang lebih ringan dibandingkan
penggambaran polygon loop-tertutup yang dipakai untuk zona keep-out dan area cakupan (menarik
karet tepi sementara mengikuti kursor, lalu menutup otomatis dalam jarak 15 piksel dari vertex
awal). Penempatan pinpoint adalah operasi satu-vertex: setiap klik mencatat satu koordinat metrik
dan menjatuhkan satu marker, tanpa langkah penutupan yang diperlukan, karena pinpoint adalah
tujuan, bukan batas.

## Single Pinpoint

Mode point-and-go sekali pakai: operator mengklik tujuan di canvas, klik tersebut dikonversi
menjadi goal metrik, dan robot dikirim ke titik tunggal tersebut.

**Kontrak:** menaruh pin tidak mengirim apa pun. Play mengirim
[goal `move_base` lewat rosbridge](/id/development/message-contracts/rosbridge#move-base-action) (dibawa ke robot sebagai
[`string/move_base/goal`](/id/development/message-contracts/bridge-topics#json-goal)) dan mencatat run dengan
[`operation_sync` `batch`](/id/development/message-contracts/operation-sync#batch) (`single_pinpoint`). Penyelesaian kembali di
`server/move_base/status` dan `/result`, tiap result di-ACK di [`result_ack`](/id/development/message-contracts/bridge-topics#acks).
Pause dan Stop membatalkan goal ([`cancel`](/id/development/message-contracts/bridge-topics#json-cancel)) dan mengirim
[`pause`](/id/development/message-contracts/operation-sync#pause) atau [`stop`](/id/development/message-contracts/operation-sync#stop-complete).

## Multiple Pinpoint

Mekanisme klik-untuk-menempatkan yang sama diulang untuk membangun urutan waypoint yang berurutan,
yang kemudian dilintasi robot secara berurutan.

**Kontrak:** browser mengirim satu [goal `move_base`](/id/development/message-contracts/rosbridge#move-base-action) per
waypoint dan maju saat selesai. Run dicatat dengan [`batch`](/id/development/message-contracts/operation-sync#batch) (`multi_pinpoint`,
dengan `route_mode` dan semua `waypoints`), setiap waypoint yang di-dispatch dicerminkan dengan
[`progress`](/id/development/message-contracts/operation-sync#progress), dan akhir rute dengan [`complete`](/id/development/message-contracts/operation-sync#stop-complete).
Saat Autopilot aktif, supervisor robot yang men-dispatch ([`takeover`](/id/development/message-contracts/operation-sync#takeover)).

### Save Route / Load Route

Urutan Multiple Pinpoint dapat diberi nama dan disimpan lewat `SaveRouteModal.tsx`, lalu dipanggil
kembali kemudian lewat `LoadRouteModal.tsx`, yang mengisi ulang canvas dengan urutan waypoint yang
tersimpan. Kegagalan pada salah satu jalur ini ditampilkan lewat komponen `TopToast` yang
dijelaskan di [Ikhtisar § UI pendukung](/id/development/webui/navigation/overview#ui-pendukung).

**Kontrak:** Save Route adalah [`POST /api/routes`](/id/development/message-contracts/http-api#routes) dengan pinpoint
sebagai `route_points` (satu pose ROS per titik), lalu thumbnail canvas ke
[`POST /api/media/uploadRouteImage`](/id/development/message-contracts/http-api#media-server). Load Route adalah
[`GET /api/routes/:map_id`](/id/development/message-contracts/http-api#routes) plus `GET /api/media/images/<id rute>.jpg` untuk thumbnail;
rename dan hapus adalah `PUT` dan `DELETE /api/routes/:id`. Tidak ada yang sampai ke robot.

### Round Trip / Loop Route

`RouteControls.tsx` menampilkan dua toggle independen, Round Trip dan Loop Route, yang mengubah
apa yang terjadi begitu rute Multiple Pinpoint mencapai waypoint terakhirnya, berdampingan dengan
kontrol Save/Load Route di atas.

**Kontrak:** mode ini tidak dikirim ke robot secara tersendiri dan tidak disimpan bersama
rute. Ia ikut sebagai `route_mode` (`basic`, `round-trip`, `loop`) plus `direction` di
[`operation_sync` `batch`](/id/development/message-contracts/operation-sync#batch), agar supervisor bisa melanjutkan polanya bila mengambil alih.

## Set Home Base

Menempatkan atau memperbarui posisi home robot dengan mengklik canvas, memanggil `updateHomebase`
di lapisan layanan database. Ini adalah posisi home base yang sama yang ditampilkan di halaman
Database (kolom `homebase_x`/`homebase_y`; lihat
[Ikhtisar Database § Daftar peta](/id/development/webui/database/overview#daftar-peta)), dan tujuan
yang dipakai oleh aksi Return to Home Base pada Action Bar
(lihat [Ikhtisar § Satu halaman, banyak mode](/id/development/webui/navigation/overview#satu-halaman-banyak-mode)).

**Kontrak:** [`PUT /api/maps_data/homebase/:mapId`](/id/development/message-contracts/http-api#map-homebase) dengan
`{ x, y, z, ox, oy, oz, ow }`, lalu perjalanan ke sana sebagai [goal `move_base`](/id/development/message-contracts/rosbridge#move-base-action)
yang dicatat dengan [`batch`](/id/development/message-contracts/operation-sync#batch) operasi `homebase`. Pada peta yang baru disimpan,
home base ikut di dalam [`mapping.stop`](/id/development/message-contracts/mqtt-commands#mapping), dan `navigation.init` memberikannya ke
`/initialpose` robot ([MQTT `navigation`](/id/development/message-contracts/mqtt-commands#navigation)).

## Delete All Pinpoints

Entri permanen di Mode List, bukan sesuatu yang terikat pada mode tertentu: menghapus seluruh
pinpoint yang sudah ditempatkan sekaligus. Entri ini di-nonaktifkan (greyed out) ketika tidak ada
apa pun untuk dihapus.

**Kontrak:** hanya klien; tidak ada yang dikirim ke robot maupun backend.

## Terkait

- [Kontrak Pesan § Halaman Navigasi](/id/development/message-contracts/#trace-navigation): semua pesan yang dikirim mode-mode ini, dalam satu tabel.
- [Ikhtisar](/id/development/webui/navigation/overview): pola Mode List/Action Bar, pipeline
  canvas, dan transformasi koordinat yang menjadi dasar mode-mode ini.
- [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot): mengemudi manual,
  alih kendali ke Autopilot, dan perutean aktivitas-ke-tab.
- [Sinkronisasi & Penyelarasan Peta](/id/development/webui/navigation/map-sync-and-alignment)
- [Pembersihan Cakupan](/id/development/webui/navigation/coverage-cleaning)
- [Integrasi ROS](/id/development/webui/navigation/ros-integration)
- [Arsitektur](/id/development/architecture)
- [State & Perilaku](/id/development/state-and-behavior)
