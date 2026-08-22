---
search: false
---
# Dokumentasi Pengembang

<RoleBadge role="developer" />

Dokumentasi teknis yang komprehensif untuk insinyur perangkat lunak, pengembang robotika, dan arsitek sistem yang bekerja pada platform MSD700.

## Arsitektur dan Sistem Inti

<LinkCards>
  <LinkCard icon="🏗️" title="Arsitektur" details="Model rekan dua mesin, topologi sistem, domain kepercayaan, dan jahitan." link="/id/development/architecture" />
  <LinkCard icon="🛡️" title="Keamanan & Otentikasi" details="Gantungan kunci JWT, nonce pendaftaran kriptografi 3 tahap, dan isolasi kepercayaan." link="/id/development/security-and-auth" />
  <LinkCard icon="🔁" title="Keadaan dan Perilaku" details="Aktivitas robot, tingkat pengawas keselamatan, mode Autopilot, dan pemulihan sesi." link="/id/development/state-and-behavior" />
  <LinkCard icon="🗂️" title="Struktur Repositori" details="Tata letak basis kode di msd700_robot, ros-web-ui, dan msd700_noetic." link="/id/development/repository-structure" />
</LinkCards>

## Subsistem ROS & Robot

<LinkCards>
  <LinkCard icon="📦" title="Registri Paket ROS" details="Direktori lengkap node ROS 1 Noetic, file peluncuran, dan topik." link="/id/development/ros-packages" />
  <LinkCard icon="📐" title="Transformasi Koordinat (TF)" details="Pohon transformasi REP-103/105, offset sensor, dan stempel ulang BoundaryPublisher." link="/id/development/tf-transforms" />
  <LinkCard icon="📡" title="Penggabungan & Kontrol Sensor" details="Velodyne VLP-16 LiDAR, pemfilteran IMU, dan estimasi status EKF." link="/id/development/sensor-fusion-and-control" />
  <LinkCard icon="⚡" title="Firmware & Perangkat Keras" details="Protokol UART serial mikrokontroler, loop kecepatan PID, dan telemetri baterai." link="/id/development/firmware-and-hardware" />
  <LinkCard icon="🗺️" title="Peta Biaya & Perencana" details="Pindahkan basis, navfn perencana global, dan optimalisasi lintasan lokal TEB." link="/id/development/costmaps-and-planners" />
  <LinkCard icon="🔄" title="Peralihan Mode Dinamis" details="switch_mode.py, pemijahan proses API Python roslaunch, dan sequencer Autopilot." link="/id/development/mode-switching" />
</LinkCards>

## Navigasi, Cakupan & Simulasi

<LinkCards>
  <LinkCard icon="📐" title="Cakupan Boustrophedon" details="Model geometri ganda, dekomposisi seluler, dan penyelarasan putaran nol." link="/id/development/boustrophedon-and-alignment" />
  <LinkCard icon="🏭" title="Simulasi" details="Simulasi Gazebo skala nyata, dunia AWS Small Warehouse, dan pengujian izin." link="/id/development/simulation" />
</LinkCards>

## Komunikasi & Antarmuka

<LinkCards>
  <LinkCard icon="📨" title="Kontrak Pesan" details="Amplop perintah MQTT, skema umpan balik, dan protokol ARQ ACK." link="/id/development/message-contracts" />
  <LinkCard icon="🔌" title="Referensi API" details="Titik akhir REST API, parameter permintaan, dan badan respons yang lengkap." link="/id/development/api-reference" />
  <LinkCard icon="🌐" title="Protokol Rosbridge" details="Protokol streaming WebSocket JSON, langganan topik, dan rendering kanvas." link="/id/development/rosbridge-protocol" />
  <LinkCard icon="🎨" title="Kanvas Frontend & UI Web" details="Rendering tahap EaselJS, matematika metrik-ke-piksel, dan patch prototipe pembuatan." link="/id/development/frontend-canvas" />
  <LinkCard icon="📷" title="Streaming Kamera" details="Pipeline video WebRTC, relai STUN/TURN, dan pemfilteran kandidat mDNS." link="/id/development/camera-streaming" />
</LinkCards>

## Data, Penyimpanan & Sinkronisasi Cloud

<LinkCards>
  <LinkCard icon="🗄️" title="Skema Basis Data" details="Tabel MySQL 8.0, stempel waktu seragam, dan kunci asing profil sewa." link="/id/development/database-schema" />
  <LinkCard icon="🔄" title="Sinkronisasi Data" details="Rekonsiliasi basis data yang mengutamakan offline, resolusi konflik, dan lencana Lokal." link="/id/development/data-sync" />
  <LinkCard icon="💾" title="Pencadangan & Migrasi" details="Pencadangan cakupan profil dan unit, manifes tar.gz, dan migrasi skema." link="/id/development/backup-and-restore" />
</LinkCards>

## Operasi & Diagnostik

<LinkCards>
  <LinkCard icon="🐳" title="Siklus Hidup Kontainer Unit" details="unit_manager.js, proksi soket Docker, dan sapuan reaper yang menganggur." link="/id/development/unit-container-lifecycle" />
  <LinkCard icon="🔧" title="Diagnostik & Pemecahan Masalah" details="Pohon keputusan kegagalan pengembang, pemetaan akar permasalahan, dan pemulihan." link="/id/development/troubleshooting-guide" />
  <LinkCard icon="🤝" title="Panduan Berkontribusi" details="Alur kerja pengembangan, penerapan konvensi, dan prosedur permintaan tarik." link="/id/development/contributing" />
  <LinkCard icon="📝" title="log perubahan" details="Log perubahan platform historis dan catatan rilis." link="/id/development/changelog" />
</LinkCards>

## Urutan Bacaan yang Direkomendasikan

Untuk teknisi yang baru bergabung dengan MSD700, perkembangan dasar yang disarankan adalah:

1. [Arsitektur](/id/development/architecture): Memahami model dua mesin dan pemisahan antara MQTT dan rosbridge.
2. [Keamanan & Otentikasi](/id/development/security-and-auth): Pelajari tiga domain kepercayaan dan pendaftaran perangkat kriptografi.
3. [ROS Package Registry](/id/development/ros-packages): Jelajahi node ROS dan pengikatan paket.
4. [Coordinate Transforms (TF)](/id/development/tf-transforms): Memahami pohon referensi spasial dan penataan ulang domain jam.
5. [Kontrak Pesan](/id/development/message-contracts): Kuasai format kabel yang tepat melintasi batas mesin.
6. [Status dan Perilaku](/id/development/state-and-behavior): Melacak transisi mesin negara yang terbatas dan pengawas keselamatan.
7. [Referensi API](/id/development/api-reference): Integrasikan pengontrol klien eksternal dan web.