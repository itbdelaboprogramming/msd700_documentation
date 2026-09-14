---
outline: deep
search: false
---

# Pemetaan

<RoleBadge role="developer" />

Layar Pemetaan adalah tempat operator mengemudikan robot berkeliling ruang baru untuk membangun
peta SLAM, lalu menyimpannya: `unit/mapping` di dashboard (`pages/unit/mapping/index.tsx`),
dikendalikan oleh `MappingActionBar` (`src/components/mappingActionBar/mappingActionBar.tsx`).
Halaman ini mendeskripsikan bagaimana layar tersebut berperilaku. Untuk dua cara menggerakkan
robot secara aktual saat peta sedang dibangun (eksplorasi otonom dan override manual), lihat
[Override Manual dan Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous).
Untuk kontrak jalur (wire contract) REST/MQTT dan proses penyimpanan sisi robot di baliknya, lihat
[Integrasi ROS](/id/development/webui/mapping/ros-integration).

## Sebelum pemetaan dimulai: "Ready to Map"

Hingga operator menekan Play, tampilan peta live tertutup oleh `MappingOverlay`, sebuah placeholder
yang memberi tahu operator bahwa layar siap untuk memulai sesi pemetaan. Belum ada apa pun untuk
dirender karena belum ada node SLAM yang berjalan dan belum ada occupancy grid yang ada.

## Play, Pause, Stop

`MappingActionBar` menampilkan tiga kontrol yang mengendalikan sesi pemetaan:

- **Play** memulai sesi. Perilaku default begitu Play ditekan adalah eksplorasi frontier otonom
  (`explore_lite`) yang menggerakkan robot dengan sendirinya; lihat
  [Override Manual dan Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous)
  untuk bagaimana hal ini berinteraksi dengan mengemudi manual.
- **Pause** menghentikan eksplorasi sementara tanpa mengakhiri sesi.
- **Stop** mengakhiri sesi dan masuk ke alur penyimpanan yang dijelaskan di bawah.

Robot melaporkan string aktivitasnya sendiri pada setiap heartbeat (`mapping_active`,
`mapping_paused`, dan, jika penyimpanan gagal, `mapping_stop_failed`, yang menjaga sesi SLAM tetap
hidup agar operator bisa mencoba menyimpan lagi). Mesin state lengkap tempat kunci-kunci ini
berada di luar cakupan halaman ini; lihat [State & Perilaku](/id/development/state-and-behavior)
untuk diagram dan tabel transisi lengkapnya.

## Tampilan peta live

Selama sesi aktif, occupancy grid yang sedang dibangun di-render langsung di tempat, memakai
ulang mesin canvas yang sama seperti layar Navigasi: pan, zoom, rotate, dan focus-follow pada pose
live robot. Tidak ada viewer atau halaman terpisah yang terlibat.

## Notifikasi Robot Stuck

`RobotStuckNotification` menampilkan banner ketika robot tampak berhenti membuat kemajuan selama
pemetaan. Logika deteksi di balik banner tersebut dibagikan dengan Navigasi dan tidak
didokumentasikan ulang di sini.

## Menyimpan peta (alur Stop)

Menekan Stop tidak langsung menyimpan. Ia membuka `ConfirmSaving`
(`src/components/confirm-saving-mapping/confirmSaving.tsx`), sebuah dialog tempat operator
memberi nama peta sebelum dipersist. Setelah dikonfirmasi, overlay progres `MapSaving` menutupi
layar selagi robot menulis peta dan mengunggahnya (lihat
[Integrasi ROS § Memulai dan menghentikan sesi pemetaan](/id/development/webui/mapping/ros-integration#starting-and-stopping-a-mapping-session)
untuk apa yang terjadi di jalur selama jendela ini, termasuk mengapa penyimpanan tidak selesai
dalam satu request/response HTTP tunggal).

::: info Pose homebase ditangkap otomatis, bukan dimasukkan secara manual
Pose homebase milik peta ditangkap secara otomatis dari pose pertama yang dilaporkan robot
setelah pemetaan dimulai. Operator tidak diminta menetapkannya secara manual sebagai bagian dari
dialog penyimpanan; pose tersebut hanya ikut serta bersama metadata peta lainnya begitu Stop
dikonfirmasi.
:::

## Emergency stop

`EmergencyButton` tersedia di seluruh layar Pemetaan. Memicunya keluar ke `/emergency-mode`, alur
emergency bersama yang sama yang dipakai di tempat lain pada dashboard.

## Chrome bersama

Sisa layar ini adalah chrome yang dibagikan dengan halaman operasional lainnya: `Header`, sidebar
yang membawa tautan pindah-halaman, feed kamera live, dan panel Manual Override / Autopilot
(lihat [Override Manual dan Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous)),
ditambah `Footer`, `ControlInstruction`, dan `TokenExpired`.

## Terkait

- [Override Manual dan Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous):
  dua cara mengemudikan robot selama sesi pemetaan
- [Integrasi ROS](/id/development/webui/mapping/ros-integration): kontrak jalur REST/MQTT dan
  proses penyimpanan sisi robot
- [Arsitektur](/id/development/architecture)
- [State & Perilaku](/id/development/state-and-behavior): mesin state aktivitas robot dan
  perilaku rekoneksi/pemulihan sesi (tidak diduplikasi di halaman ini)
