---
search: false
---

# Dokumentasi Pengembang

<RoleBadge role="developer" />

Dokumentasi teknis lengkap untuk software engineer, pengembang robotika, dan arsitek sistem yang mengerjakan platform MSD700, dibagi menjadi dua domain: perangkat lunak robot itu sendiri, dan platform yang mengoperasikannya.

## ROS: Perangkat Lunak Robot

Stack ROS 1 Noetic yang berjalan di unit fisik: paket, algoritma, sensor, dan control loop. Diatur per subsistem, karena sisi ini tidak punya UI operator sendiri.

<LinkCards>
  <LinkCard icon="🤖" title="Bagian ROS" details="Registri paket, persepsi & lokalisasi, navigasi & perencanaan, algoritma coverage boustrophedon, firmware & hardware, safety watchdog, dan simulasi." link="/id/development/ros/" />
</LinkCards>

## ROS Web UI: Platform

Dashboard operator, konsol admin, dan layanan backend/bridge yang menghubungkannya ke robot. Diatur per layar fitur aktual, bukan per lapisan protokol.

<LinkCards>
  <LinkCard icon="🧭" title="Navigasi" details="Kendali manual, Autopilot, pinpoint/rute, sinkronisasi & penyelarasan peta, dan coverage cleaning." link="/id/development/webui/navigation/overview" />
  <LinkCard icon="🗺️" title="Mapping" details="Membangun peta baru: Play/Pause/Stop, eksplorasi manual vs. otonom, dan save-on-stop." link="/id/development/webui/mapping/overview" />
  <LinkCard icon="🗄️" title="Database" details="Layar Map DB: mendaftar, mencari, mengganti nama, dan menghapus peta yang direkam." link="/id/development/webui/database/overview" />
  <LinkCard icon="🛠️" title="Konsol Admin" details="Tab Operators, Units & Fleet, Rentals, Backups, dan Admins khusus superadmin." link="/id/development/webui/admin-console/overview" />
  <LinkCard icon="🔑" title="Akun & Akses" details="Login/pendaftaran operator, login admin, keyring JWT, dan pendaftaran perangkat keras." link="/id/development/webui/accounts/overview" />
  <LinkCard icon="📷" title="Kamera & Live View" details="Pipeline video WebRTC di balik live feed dashboard." link="/id/development/webui/camera/overview" />
</LinkCards>

## Mulai di Sini & Referensi

Materi lintas domain yang berlaku untuk kedua domain, sehingga tidak diduplikasi ke masing-masing bagian.

<LinkCards>
  <LinkCard icon="🏗️" title="Arsitektur" details="Model dua mesin sebagai peer, topologi sistem, trust domain, dan kepemilikan state." link="/id/development/architecture" />
  <LinkCard icon="🗂️" title="Struktur Repositori" details="Tata letak basis kode di msd700_robot, ros-web-ui, dan msd700_noetic." link="/id/development/repository-structure" />
  <LinkCard icon="📨" title="Kontrak Pesan" details="Format wire MQTT lengkap: amplop perintah, skema feedback, dan protokol ACK ARQ." link="/id/development/message-contracts" />
  <LinkCard icon="🔧" title="Diagnostik & Troubleshooting" details="Pohon keputusan kegagalan seluruh stack dan pemetaan akar penyebab." link="/id/development/troubleshooting-guide" />
  <LinkCard icon="🤝" title="Panduan Kontribusi" details="Alur kerja pengembangan, konvensi commit, dan prosedur pull request." link="/id/development/contributing" />
  <LinkCard icon="📝" title="Changelog" details="Riwayat perubahan platform dan catatan rilis." link="/id/development/changelog" />
</LinkCards>

::: info Masih dalam migrasi
`Referensi REST API`, `Protokol rosbridge`, `Frontend Canvas`, `Skema Database`, `Sinkronisasi Data`, `Cadangan & Pemulihan`, dan `Siklus Hidup Kontainer Unit` untuk saat ini tetap menjadi referensi mandiri yang lengkap; setiap halaman fitur ROS Web UI di atas menautkan ke bagian spesifik yang dibutuhkannya, bukan menduplikasinya.
:::

## Urutan Bacaan yang Disarankan

Untuk engineer yang baru bergabung dengan MSD700, urutan progresi fondasi yang disarankan adalah:

1. [Arsitektur](/id/development/architecture): Pahami model dua mesin dan pemisahan antara MQTT dan rosbridge.
2. [Akun & Akses: Keamanan & Token](/id/development/webui/accounts/security-and-tokens): Pelajari tiga trust domain dan pendaftaran perangkat kriptografis.
3. [Registri Paket ROS](/id/development/ros/ros-packages): Jelajahi node ROS dan binding paket.
4. [Transformasi Koordinat (TF)](/id/development/ros/tf-transforms): Pahami pohon referensi spasial dan restamping domain jam.
5. [Kontrak Pesan](/id/development/message-contracts): Kuasai format wire persis yang melintasi batas mesin.
6. [Navigasi: Manual Override & Autopilot](/id/development/webui/navigation/manual-and-autopilot): Telusuri state machine aktivitas robot dan pemulihan sesi.
7. [Referensi REST API](/id/development/api-reference): Integrasikan pengendali klien web dan eksternal.
