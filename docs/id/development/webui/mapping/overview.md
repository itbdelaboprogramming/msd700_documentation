---
outline: deep
search: false
---

# Pemetaan

<RoleBadge role="developer" />

Halaman Pemetaan adalah tempat operator mengemudikan robot berkeliling ruang baru untuk membangun
peta SLAM, lalu menyimpannya: `unit/mapping` di dashboard (`pages/unit/mapping/index.tsx`),
dikendalikan oleh `MappingActionBar` (`src/components/mappingActionBar/mappingActionBar.tsx`).
Dokumen ini mendeskripsikan bagaimana halaman tersebut berperilaku. Untuk dua cara menggerakkan
robot secara aktual saat peta sedang dibangun (eksplorasi otonom dan override manual), lihat
[Override Manual dan Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous).
Untuk kontrak jalur (wire contract) REST/MQTT dan proses penyimpanan sisi robot di baliknya, lihat
[Integrasi ROS](/id/development/webui/mapping/ros-integration).

## Sebelum pemetaan dimulai: "Ready to Map"

Hingga operator menekan Play, tampilan peta live tertutup oleh `MappingOverlay`, sebuah placeholder
yang memberi tahu operator bahwa halaman siap untuk memulai sesi pemetaan. Belum ada apa pun untuk
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

**Kontrak:** Play dan Pause adalah [`POST /api/mapping`](/id/development/message-contracts/http-api#mapping-control) dengan
`{ start: true }` atau `{ pause: true }` → [`mapping.start` / `mapping.pause`](/id/development/message-contracts/mqtt-commands#mapping)
(`/switch_mode(explore)`, lalu motion lock `operator_pause`). Stop menuju alur simpan di bawah.

## Tampilan peta live

Selama sesi aktif, occupancy grid yang sedang dibangun di-render langsung di tempat, memakai
ulang mesin canvas yang sama seperti halaman Navigasi: pan, zoom, rotate, dan focus-follow pada pose
live robot. Tidak ada viewer atau halaman terpisah yang terlibat.

**Kontrak:** grid yang tumbuh di [`<root>/server/slam/map`](/id/development/message-contracts/rosbridge#subscriptions) dan pose di
`<root>/server/robot_pose`, keduanya lewat rosbridge; lihat [Topik Bridge](/id/development/message-contracts/bridge-topics#topic-map) untuk cara
keduanya meninggalkan robot.

## Notifikasi Robot Stuck

`RobotStuckNotification` menampilkan banner ketika robot tampak berhenti membuat kemajuan selama
pemetaan. Logika deteksi di balik banner tersebut dibagikan dengan Navigasi dan tidak
didokumentasikan ulang di sini.

## Menyimpan peta (alur Stop)

Menekan Stop tidak langsung menyimpan. Ia membuka `ConfirmSaving`
(`src/components/confirm-saving-mapping/confirmSaving.tsx`), sebuah dialog tempat operator
memberi nama peta sebelum dipersist. Setelah dikonfirmasi, overlay progres `MapSaving` menutupi
halaman selagi robot menulis peta dan mengunggahnya (lihat
[Integrasi ROS § Memulai dan menghentikan sesi pemetaan](/id/development/webui/mapping/ros-integration#starting-and-stopping-a-mapping-session)
untuk apa yang terjadi di jalur selama jendela ini, termasuk mengapa penyimpanan tidak selesai
dalam satu request/response HTTP tunggal).

::: info Pose homebase ditangkap otomatis, bukan dimasukkan secara manual
Pose homebase milik peta ditangkap secara otomatis dari pose pertama yang dilaporkan robot
setelah pemetaan dimulai. Operator tidak diminta menetapkannya secara manual sebagai bagian dari
dialog penyimpanan; pose tersebut hanya ikut serta bersama metadata peta lainnya begitu Stop
dikonfirmasi.
:::

**Kontrak:** cek nama adalah [`GET /api/media/checkMapName`](/id/development/message-contracts/http-api#media-server). Menyimpan
adalah [`POST /api/mapping`](/id/development/message-contracts/http-api#mapping-control) dengan `{ stop: true, map_name, homebase_* }`, yang langsung
menjawab `{ request_id, map_ulid }`; overlay lalu mengikuti
[`GET /api/mapping/progress/:request_id`](/id/development/message-contracts/http-api#mapping-progress), yang event-nya adalah pesan
[`mapping_progress`](/id/development/message-contracts/mqtt-commands#mapping-progress) robot. Membuang adalah
[`POST /api/mapping/discard`](/id/development/message-contracts/http-api#mapping-discard).

## Emergency stop

`EmergencyButton` tersedia di seluruh halaman Pemetaan. Memicunya keluar ke `/emergency-mode`, alur
emergency bersama yang sama yang dipakai di tempat lain pada dashboard.

**Kontrak:** [`POST /api/emergency_stop`](/id/development/message-contracts/http-api#emergency-stop) `{ enable: true }` →
[`emergency_stop.activate`](/id/development/message-contracts/mqtt-commands#emergency-stop).

## Chrome bersama

Sisa halaman ini adalah chrome yang dibagikan dengan halaman operasional lainnya: `Header`, sidebar
yang membawa tautan pindah-halaman, feed kamera live, dan panel Manual Override / Autopilot
(lihat [Override Manual dan Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous)),
ditambah `Footer`, `ControlInstruction`, dan `TokenExpired`.

## Terkait

- [Kontrak Pesan § Halaman Pemetaan](/id/development/message-contracts/#trace-mapping): semua pesan yang dikirim sesi mapping.
- [Override Manual dan Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous):
  dua cara mengemudikan robot selama sesi pemetaan
- [Integrasi ROS](/id/development/webui/mapping/ros-integration): kontrak jalur REST/MQTT dan
  proses penyimpanan sisi robot
- [Arsitektur](/id/development/architecture)
- [State & Perilaku](/id/development/state-and-behavior): mesin state aktivitas robot dan
  perilaku rekoneksi/pemulihan sesi (tidak diduplikasi di halaman ini)
