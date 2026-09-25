---
outline: deep
search: false
---

# Override Manual dan Eksplorasi Otonom

<RoleBadge role="developer" />

Dua cara menggerakkan robot selagi sebuah peta sedang dibangun, keduanya tersedia dari layar
[Pemetaan](/id/development/webui/mapping/overview) yang sama begitu sebuah sesi berstatus
`mapping_active`: membiarkan robot menjelajah sendiri, atau mengambil alih kendali secara
langsung. Untuk kontrak jalur (wire contract) di balik sesi pemetaan itu sendiri, lihat
[Integrasi ROS](/id/development/webui/mapping/ros-integration).

## Eksplorasi otonom adalah default

Menekan Play di `MappingActionBar` memulai eksplorasi frontier otonom (`explore_lite`) secara
default. Robot mengemudikan dirinya sendiri, mendorong ke luar menuju ruang yang belum dipetakan,
tanpa operator mengemudikannya. Ini adalah cara biasa sebuah peta dibangun: operator menekan Play
dan sebagian besar hanya mengawasi, memakai Pause/Stop dan emergency stop bila diperlukan.

## Manual Override

Sidebar me-render `ManualAutopilotPanel`, komponen bersama yang sama yang dipakai di layar
Navigasi. Mengaktifkan **Manual Override** di layar Pemetaan menyerahkan teleop keyboard WASD ke
operator, mengambil alih kemudi dari perilaku eksplorasi otonom yang dijelaskan di atas. Ini
adalah komponen dan toggle yang sama seperti di Navigasi; yang berbeda hanyalah apa yang
kendalinya diserahkan *dari* (eksplorasi otonom di sini, alih-alih goal yang dikirim atau sapuan
cakupan di Navigasi), sehingga mekanismenya tidak diulang di halaman ini.

## Apa arti "Autopilot" di halaman ini

Panel yang sama juga menampilkan toggle **Autopilot**. Khusus di Pemetaan, mengaktifkannya
menjaga sesi eksplorasi otonom tetap berjalan tanpa kepala (headless): eksplorasi berlanjut
bahkan jika operator menutup tab browser. Ini adalah makna praktis yang berbeda dari Autopilot di
layar Navigasi (yang di sana mengatur pengiriman waypoint/cakupan otonom); toggle dan
komponennya dibagikan, tetapi masing-masing layar mendefinisikan sendiri apa arti "tetap
berjalan tanpa browser" untuk operasinya sendiri.

::: info Pengecualian heartbeat
Jeda gerak 10 detik milik safety watchdog akibat heartbeat yang hilang ditangguhkan selama
Autopilot aktif, sehingga sesi pemetaan bisa terus berjalan melewati koneksi yang terputus atau
laptop yang ditutup. Lihat [Safety Watchdog](/id/development/ros/safety-watchdog) untuk tingkatan
waktu lengkapnya; halaman itu tidak diduplikasi di sini.
:::

## Terkait

- [Ikhtisar](/id/development/webui/mapping/overview): Play/Pause/Stop, tampilan peta live, dan
  alur simpan-saat-stop
- [Integrasi ROS](/id/development/webui/mapping/ros-integration): kontrak jalur REST/MQTT di
  balik sesi pemetaan
- [Arsitektur](/id/development/architecture)
- [State & Perilaku](/id/development/state-and-behavior): mesin state aktivitas robot dan
  pewaktuan safety watchdog
