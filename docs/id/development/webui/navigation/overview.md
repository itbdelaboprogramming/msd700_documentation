---
outline: deep
search: false
---

# Navigasi

<RoleBadge role="developer" />

Fitur Navigasi adalah halaman `unit/navigation`. `pages/unit/navigation/index.tsx` hanyalah lapisan
layout tipis; hampir seluruh fungsionalitas sesungguhnya berada di
`src/components/navigationMap/mapComponent.tsx` (`MapComponent`) dan sub-komponen yang direndernya,
yang dijangkau lewat dropdown "Mode List" (`ModeListPanel.tsx`) dan action bar persisten
(`actionBar.tsx`). Dokumen ini membahas mekanisme yang dibagikan di seluruh mode pada halaman ini:
pola pergantian mode itu sendiri, pipeline rendering canvas dan matematika koordinat yang menjadi
dasar tiap mode, serta bagian-bagian UI pendukung kecil yang muncul terlepas dari mode mana yang
sedang aktif.

Setiap mode memiliki halamannya masing-masing:

| Mode / fitur | Dibahas di |
| --- | --- |
| Single Pinpoint, Multiple Pinpoint, Save/Load Route, Round Trip/Loop Route, Set Home Base, Delete All Pinpoints | [Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes) |
| Teleop manual (WASD), toggle Autopilot, perutean tab dashboard berdasarkan aktivitas robot, rekoneksi/pemulihan sesi | [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot) |
| Map Sync / Auto Align | [Sinkronisasi & Penyelarasan Peta](/id/development/webui/navigation/map-sync-and-alignment) |
| Coverage Area (pembersihan boustrophedon) | [Pembersihan Cakupan](/id/development/webui/navigation/coverage-cleaning) |
| Kontrak jalur (wire contract) sisi ROS di balik semua hal di atas | [Integrasi ROS](/id/development/webui/navigation/ros-integration) |

## Satu halaman, banyak mode

Ini layak dinyatakan secara eksplisit karena mudah diasumsikan sebaliknya: Navigasi adalah **satu
rute** yang me-render **satu pohon komponen berumur panjang**, bukan sekumpulan halaman terpisah.
Memilih Single Pinpoint, Multiple Pinpoint, Set Home Base, Delete All Pinpoints, Map Sync/Auto
Align, atau Coverage Area di `ModeListPanel.tsx` adalah pemilihan mode di dalam state milik
`MapComponent` sendiri, bukan perubahan rute Next.js atau mount ulang canvas peta. Action bar
(`actionBar.tsx`) berada berdampingan dengan mode list dan menampilkan aksi yang tersedia lintas
mode, bukan per mode: Play/Pause navigasi, Stop, Return to Home Base, dan Focus View (kamera
mengikuti robot di canvas).

Karena canvas itu sendiri tidak pernah di-remount saat operator berpindah mode, pipeline rendering,
helper konversi koordinat, dan UI pendukung yang dijelaskan di bawah ini adalah infrastruktur
bersama di bawah setiap mode, bukan sesuatu yang diimplementasikan ulang oleh masing-masing mode.

**Kontrak:** Play, Pause, dan Stop bekerja pada goal `move_base` lewat
[rosbridge](/id/development/message-contracts/rosbridge#move-base-action) dan mencerminkan run dengan [operation sync](/id/development/message-contracts/operation-sync);
Return to Home Base adalah goal `move_base` ke home base tersimpan; Focus View hanya klien. Daftar per tombol:
[Kontrak Pesan § Halaman Navigasi](/id/development/message-contracts/#trace-navigation).

## Pipeline rendering canvas

`MapComponent` menyusun tampilannya sebagai tumpukan layer EaselJS di atas satu stage HTML5
Canvas, yang dipasok oleh topic WebSocket rosbridge:

![Map Canvas Pipeline](../../../../development/webui/navigation/diagrams/msd700-draw-map-pipeline.drawio)

Layer 6, overlay vertex interaktif, adalah tempat Single Pinpoint, Multiple Pinpoint, dan Set Home
Base menggambar saat operator mengklik canvas; lihat
[Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes) untuk cara overlay itu
dikendalikan. Layer 2 dan 4 (polygon keep-out dan jalur sapu boustrophedon) adalah milik mode yang
dibahas di halaman-halaman sejenis lainnya.

**Kontrak:** setiap layer adalah satu subscription rosbridge, didaftar beserta tipe pesannya di
[rosbridge § Subscription](/id/development/message-contracts/rosbridge#subscriptions); peta sendiri diminta saat mount lewat
[`string/map_request`](/id/development/message-contracts/bridge-topics#map-delivery).

## Transformasi koordinat: ruang metrik ke piksel layar

Frame koordinat ROS bersifat metrik (meter, dengan $(0, 0)$ di titik asal peta), sementara HTML5
Canvas menggunakan koordinat piksel dengan titik asal di kiri-atas $(p_x, p_y)$. Setiap klik pada
canvas dan setiap pose robot yang digambar ke atasnya melintasi batas ini.

Dengan resolusi peta $r$ (meter per piksel), tinggi citra $H$ (piksel), dan titik asal peta
$\mathbf{o} = [x_0, y_0]^T$:

**Definisi variabel:**

| Variabel | Keterangan |
| --- | --- |
| $(x, y)$ | Posisi dalam frame koordinat metrik ROS (meter) |
| $(p_x, p_y)$ | Posisi dalam frame koordinat piksel canvas |
| $r$ | Resolusi peta (meter per piksel) |
| $H$ | Tinggi citra canvas dalam piksel |
| $(x_0, y_0)$ | Titik asal peta dalam koordinat ROS (meter) |

**Metrik ke piksel canvas** (dipakai untuk menggambar robot, jalur, dan state ter-latch apa pun ke
peta):

$$p_x = \frac{x - x_0}{r}$$

$$p_y = H - \frac{y - y_0}{r}$$

*(Sumbu $y$ dibalik karena $Y$ ROS bertambah ke atas sementara $Y$ Canvas bertambah ke bawah.)*

**Piksel canvas ke metrik** (dipakai untuk mengonversi klik operator menjadi goal yang dikirim):

$$x = x_0 + (p_x \cdot r)$$

$$y = y_0 + ((H - p_y) \cdot r)$$

## Patch `createjs.Stage.prototype`

Kode di `mapComponent.tsx` yang mem-patch `createjs.Stage.prototype` sebelum canvas apa pun
dibuat terlihat janggal jika dilihat tanpa konteks, jadi ada baiknya dijelaskan alasannya. EaselJS
dapat mengevaluasi ulang `createjs.Stage` menjadi konstruktor yang benar-benar baru yang
prototypenya tidak lagi memiliki helper koordinat `ROS2D` (`globalToRos`, `rosToGlobal`,
`rosQuaternionToGlobalTheta`). Viewer yang dibangun sesudahnya kemudian melempar `TypeError`
fatal `this.stage.globalToRos is not a function` begitu operator mencoba mengklik canvas.

Untuk menjamin canvas tidak pernah crash dengan cara ini, `ensureStagePrototype()` di
`mapComponent.tsx` menerapkan ulang helper tersebut secara idempoten pada prototype saat ini tepat
sebelum setiap pembuatan viewer. Matematikanya mencerminkan `public/script/ros2d.js` secara persis,
sehingga perilaku tidak berubah pada jalur normal (`rosScriptLoader.ts` hanyalah sequential script
loader: patch tidak berada di sana).
Lihat [Frontend Canvas](/id/development/frontend-canvas) untuk snippet lengkap.

Penanganan klik setiap mode di halaman ini (penempatan pinpoint, penempatan home base, penggambaran
polygon) pada akhirnya memanggil `stage.globalToRos`, sehingga patch ini menjadi prasyarat untuk
semuanya, bukan detail khusus milik satu mode saja.

## UI pendukung

Ada beberapa komponen yang muncul lintas mode alih-alih menjadi milik satu mode saja:

- **`RobotStuckNotification`**: peringatan di halaman yang muncul ketika robot tampak tidak mampu
  membuat kemajuan menuju goal-nya saat ini.
- **`HoverTooltip`**: tooltip kontekstual yang ditampilkan saat operator mengarahkan kursor ke
  elemen di canvas.
- **`TopToast`**: menampilkan error dari operasi save/load (misalnya save atau load rute yang
  gagal) sebagai toast sementara alih-alih dialog yang memblokir.
- **`PreviewMap`**: rendering thumbnail dari peta, berbeda dari canvas interaktif penuh.

## Terkait

- [Kontrak Pesan § Halaman Navigasi](/id/development/message-contracts/#trace-navigation): semua pesan yang dikirim dan diterima halaman ini.
- [Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes): Single/Multiple
  Pinpoint, Save/Load Route, Round Trip/Loop Route, Set Home Base, Delete All Pinpoints.
- [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot): `ManualAutopilotPanel`
  yang dibagikan, perutean aktivitas-ke-tab, dan rekoneksi/pemulihan sesi.
- [Sinkronisasi & Penyelarasan Peta](/id/development/webui/navigation/map-sync-and-alignment)
- [Pembersihan Cakupan](/id/development/webui/navigation/coverage-cleaning)
- [Integrasi ROS](/id/development/webui/navigation/ros-integration)
- [Arsitektur](/id/development/architecture)
- [State & Perilaku](/id/development/state-and-behavior)
