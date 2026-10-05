---
search: false
---

# Changelog & Tonggak Rilis Platform

<RoleBadge role="developer" />

Changelog ini merangkum tonggak arsitektur utama, overhaul platform, dan kemajuan protokol di seluruh ekosistem robotika MSD700.

## Tonggak Arsitektur

### Oktober 2026: Server Tanpa ROS (sedang berjalan)
- **Server Tanpa ROS**: sejak maintenance 2026-10-03 cloud production dan development sama sekali tidak menjalankan ROS: tanpa roscore, rosbridge, `catkin_make`, maupun container relay. `backend_node`, media, dan signalling berjalan sebagai Node biasa dari image 269 MB (`Docker/Dockerfile` target `server`), dan kedua dashboard cloud di-build dengan `NEXT_PUBLIC_UNIT_LINK=string`. Gateway live link mengambil port milik rosbridge (9090 di belakang Apache, 9091 di dev), sehingga tidak ada URL dashboard yang berubah. Unit dan dashboard lokalnya tidak berubah. Lihat [Referensi Docker](/id/setup/docker-reference#service-and-port-map).
- **`backend_node` Bukan Lagi Node ROS**: log lewat logger console biasa, priming `DUMMY_INIT_DATA_` dikirim langsung ke MQTT di semua server, dan `rosnodejs` serta `ps-tree` dilepas. Di tempat yang masih memakai ROS, `roslaunch` tetap menjalankannya sebagai proses biasa. `UNIT_MANAGER_DOCKER=false` mempertahankan pencatatan lease dan retensi autopilot tanpa akses Docker.
- **Satu Identitas per Cloud**: unit yang dipakai di production dan di stack dev menyimpan satu identitas untuk masing-masing (`Certificates/robot/identities/`). `up --dev` pertama pada unit yang terdaftar di production sekarang menunggu persetujuan admin dev lalu berjalan dengan id dev, sehingga unit langsung online di dashboard dev; kembali ke production menukar identitasnya kembali tanpa persetujuan baru. Sebelumnya unit boot dengan id production di dev, persetujuan dev baru berlaku setelah restart dan menimpa identitas production. Pengecekan identitas saat boot kini juga melakukan claim dengan fingerprint host, bukan milik container. Lihat [Pendaftaran Perangkat Keras § Satu robot, dua cloud](/id/development/webui/accounts/enrolment#one-robot-two-clouds).
- **Banner Robot Restart**: saat robot restart sementara halaman Navigation tetap terbuka, map digelapkan di belakang banner "Robot restarted", dan **Reinit Navigation** memulai lagi run yang terputus (coverage di balik overlay inisialisasinya). Dulu tidak pernah: status run sudah di-reset sebelum Reinit membacanya. Pengecekan restart kini membaca `uptime` robot dalam menit, sesuai yang dilaporkan. Lihat [Manual & Autopilot § Saat robot sendiri restart](/id/development/webui/navigation/manual-and-autopilot#robot-restarted).
- **Build Image Unit Lebih Cepat**: Dockerfile robot dan web lokal meng-install dependency hanya dari manifest paket dan meng-copy source paling akhir, dengan cache apt, pip, npm, ccache dan Next.js disimpan di cache mount BuildKit. Edit source tidak lagi mengunduh ulang Gazebo atau meng-install ulang semua paket npm, dan build context turun dari sekitar 1 GB ke sekitar 220 MB. Service web lokal me-bind-mount `ros-web-ui/source`, jadi edit backend cukup `up`, bukan rebuild, dan `build` membangun ketiga image secara paralel. Lihat [Referensi Docker](/id/setup/docker-reference).
- **Home Base Adalah Titik Awal Peta**: home base sebuah run pemetaan tidak lagi pindah ke posisi robot saat Play ditekan lagi setelah pause, atau setelah login kembali. Dashboard hanya menangkapnya untuk run baru, dan robot mencatat pose awal sendiri lalu menyimpan salinan itu saat Save, sehingga sign out tidak lagi menghilangkannya. Ditemukan sekaligus: setelah E-Stop, switch idle, atau init navigasi mengakhiri run mapping, Play berikutnya menjawab "Already in mapping mode" tanpa SLAM yang berjalan; kini setiap panggilan `/switch_mode` memperbarui satu catatan bersama tentang launch yang sedang berjalan. Lihat [Mapping § Menyimpan peta](/id/development/webui/mapping/overview).
- **Recovery Autopilot Setelah Coverage Dihentikan**: menghentikan coverage, atau run supervisor yang berhenti, tidak lagi melaporkan `idle` selama stack navigasi masih hidup. Itu menghapus `active_map_id` dan map intended di backend, sehingga login lagi ke run autopilot berikutnya di map yang sama mendarat di halaman Navigasi kosong. Lihat [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot).
- **Gateway Live Link**: `backend_node` bisa melayani live link dashboard sendiri (`unit_gateway.js`). Gateway meneruskan topik stream MQTT tiap unit ke browser apa adanya lewat protokol rosbridge, di balik tiket sekali pakai per akun dan unit ([`POST /api/link/ticket`](/id/development/message-contracts/http-api#link-ticket)). Berbeda dengan rosbridge, satu koneksi hanya menjangkau topik unitnya sendiri, masing-masing ke arahnya sendiri. Lihat [rosbridge § Gateway live link](/id/development/message-contracts/rosbridge#gateway).
- **Satu Tabel Topik**: topik stream antara unit dan dashboard didaftar sekali di `shared/unit_topics.json`, dan sebuah uji gagal bila bridge cloud, bridge robot, dan tabel itu tidak sama. Entri bridge `server/ping` dan `server/pong` ternyata tidak membawa apa pun. Lihat [Topik Bridge](/id/development/message-contracts/bridge-topics).
- **Adapter Link di Dashboard**: semua topik ROS di dashboard kini dibuka lewat `src/services/unitLink`. Build default berperilaku persis seperti sebelumnya; build dengan `NEXT_PUBLIC_UNIT_LINK=string` berbicara ke gateway dan men-decode format wire robot di browser, diuji terhadap payload yang dibuat codec robot sendiri. Lihat [rosbridge § Di dashboard](/id/development/message-contracts/rosbridge#gateway-dashboard).

### September 2026: Optimisasi Bandwidth & Lingkup Data Per-Unit
- **Egress yang Digerbangi Kehadiran**: Telemetri robot-ke-cloud kini membaca `/msd700/viewers` dan mengirim dengan laju yang disesuaikan dengan ada tidaknya yang menonton. Overlay dan occupancy grid dikirim saat berubah alih-alih berdasarkan timer, dan keempat topik overlay di-latch pada bridge cloud sehingga tab yang menyambung ulang tetap mendapatkan gambarnya.
- **Jaminan Pengiriman Map**: Change-gating menyisakan map sebagai satu pesan sekali-kirim-lalu-lupa per heartbeat, yang merupakan jaminan yang salah untuk satu-satunya payload yang membuat operator tidak bisa bekerja kalau tidak ada. Topik map kini di-latch pada relay cloud, map setelah reset diulang sebagai burst pendek, dan dashboard bisa menariknya sesuai kebutuhan lewat `/string/map_request` alih-alih menunggu heartbeat yang terukur ~52 detik. Membuka peta dari Database juga tidak lagi duduk di belakang tunggu 5 detik tetap yang salah dilabeli sebagai polling kesiapan. Lihat [Topik Bridge § Pengiriman peta](/id/development/message-contracts/bridge-topics#map-delivery).
- **Coverage Bertahan Melewati Operator**: Manual Override kini memarkir run boustrophedon lewat service pause milik node coverage sendiri, bukan `/move_base/cancel` telanjang yang dibaca node itu sebagai cancel misi sehingga membunuh sapuan seketika tanpa menerbitkan status terminal apa pun. Cancel yang datang saat run sedang paused tidak lagi mengakhirinya, pause hanya dikembalikan kepada yang mengambilnya, dan run yang benar-benar mati kini mengatakannya di `/msd700/coverage_status` alih-alih membiarkan dashboard melaporkan run hidup di atas robot yang diam. Lihat [Manual & Autopilot § Menyerahkan sapuan coverage ke operator dan mengambilnya kembali](/id/development/webui/navigation/manual-and-autopilot#menyerahkan-sapuan-coverage-ke-operator-dan-mengambilnya-kembali).
- **Lingkup Peta Per-Unit**: Daftar peta, pembacaan peta tunggal, dan `POST /api/navigation/init` kini dibatasi pada unit yang sedang dikendalikan sekaligus rental-nya. Sebuah rental yang memegang beberapa robot tidak lagi mendaftarkan peta semua robot bersamaan, dan peta milik robot sibling ditolak di API alih-alih gagal di robot.
- **Jangkauan Pemulihan di Atas Jumlah Pesan**: Rebuild snapshot kini juga dipicu pada tab `Idle` tanpa mode terpilih (state yang ditinggalkan oleh membuka ulang peta dari halaman Database), dan prompt resync kini mencapai 9,4 detik alih-alih 3,4 detik. Baik halaman Navigation maupun komponen peta tidak lagi menimpa status atau mode yang tersimpan saat mount.
- **Pencegahan Self-Join**: Hotspot milik unit sendiri kini dikecualikan dari pemindaian WiFi-nya dan ditolak oleh `connect()`, sehingga operator yang membaca daftar lewat hotspot tersebut tidak dapat menyuruh unit bergabung dengan dirinya sendiri.
- **Autostart Boot yang Mempertahankan Mode**: `msd700.service` kini membawa flag `--dev` dan `--simulator` dari `up` yang mempersenjatainya. Unit boot sebelumnya menjalankan ulang `up` polos, sehingga robot yang dimulai melawan cloud dev, atau sebagai simulator, secara diam-diam kembali setelah reboot sebagai hardware melawan produksi.
- **Jeda Keselamatan 2 Detik dan Heartbeat MQTT**: Jeda gerak watchdog kini aktif setelah 2 detik tanpa operator (sebelumnya 10 detik). Dashboard lokal unit membuktikan kehadiran dengan `heartbeat` 5 Hz lewat MQTT-over-WebSocket langsung ke broker unit, jadi link yang lossy tidak lagi menghentikan robot; ping HTTP tetap memegang lease dan otoritas. Autopilot menangguhkan ketiga tingkatan watchdog.
- **Geometri Roda Hasil Ukur**: `pose_config.yaml` kini memakai track 26 cm hasil ukur (sebelumnya 78 cm, membuat setiap pivot berlebih 3×), dan node `rotation_guard` dihapus.
- **Tuning TEB untuk Celah Sempit**: `min_obstacle_dist` 0,10 → 0,05 m dan `inflation_dist` 0,75 → 0,35 m, agar TEB tidak macet di celah yang sudah bisa direncanakan `navfn`. Clearance coverage yang diturunkan darinya ikut mengecil.
- **topic2string C++ di Unit**: Konverter telemetri unit berjalan sebagai node C++ terpisah (`topic2string_impl:=cpp_nodes`); node Python disimpan untuk rollback.
- **Hazard Scan Lebih Cepat**: Reduksi per grup di pipeline perception dipindah ke library C (`fastops`), memangkas satu frame dari sekitar 55 ms menjadi sekitar 37 ms, dengan fallback numpy.
- **Restart Hotspot dari Dashboard**: `network_local` me-restart hotspot lewat unit sempit `msd700-hotspot-restart.path`, bukan lewat NetworkManager.
- **Webhook Auto-Deploy**: Push ke branch deploy otomatis me-rebuild `server_prod` / `server_dev`.
- **Diagram di draw.io**: Semua diagram dokumentasi kini berupa file `.drawio` yang bisa diedit, disimpan di samping halamannya, dan dirender menjadi PNG statis dengan viewer draw.io. Mermaid tidak dipakai lagi. Lihat [Struktur Repositori § Diagram](/id/development/repository-structure#diagram).

### Agustus 2026: Overhaul Dokumentasi & Kinematika Presisi
- **Arsitektur Dokumentasi Modular**: Penulisan ulang menyeluruh semua halaman dokumentasi dengan diagram SVG Mermaid responsif, formulasi matematis, dan operasi zero-downtime.
- **Simulasi Gazebo Skala Nyata**: Meningkatkan model simulator ke `msd700_field` (badan $0,90 \times 0,70\text{ m}$, 4 roda penggerak, 150 kg) beroperasi di AWS RoboMaker Small Warehouse.
- **Auto-Align Zero-Spin**: Mengimplementasikan penyelarasan pose awal coarse-to-fine `particle_align_validator.py` (< 50 ms) untuk menghilangkan rotasi 360 derajat di koridor sempit.
- **Pendaftaran Kriptografis Nonce**: Menegakkan protokol hashing nonce CSPRNG untuk autentikasi perangkat robot. Tiga secret berbeda, jangan dicampuradukkan: nonce klaim 32-byte milik robot, kode klaim admin 8-karakter (`K7M2QP4R`), dan device secret 32-byte yang dicetak saat handover.

### Juli 2026: Keamanan Rental Multi-Tenant & Migrasi ULID
- **Otorisasi Profil Rental**: Menambahkan middleware Express `attachUnit` untuk menegakkan isolasi tenant yang ketat di seluruh peta dan unit.
- **Arsitektur ULID**: Memigrasikan pengalamatan sistem dari string hardware mentah ke Universally Unique Lexicographically Sortable Identifier (`/unit_<ULID>/...`).
- **Timestamp Database Seragam**: Menstandardisasi kolom `created_at` dan `modified_at` dengan trigger `ON UPDATE CURRENT_TIMESTAMP` otomatis di 15 tabel database.

### Juni 2026: Replikasi Offline-First & Local Mode Stack
- **Agen Sinkronisasi Data Dua Arah**: Men-deploy `sync_agent.js` dan `sync_engine.js` dengan resolusi konflik per-baris last-write-wins dan delete tombstone.
- **Penyimpanan Peta Dua Tingkat**: Mengimplementasikan upload lokal wajib (`media_local :3003`) dengan sinkronisasi cloud best-effort (`media-server :3003`).
- **Dashboard Lokal Jetson**: Membundel stack `frontend_local` dan `backend_local` onboard untuk operasi lapangan offline yang otonom.

### Mei 2026: Pipeline Video WebRTC Latensi Ultra-Rendah
- **Filter Kandidat mDNS**: Memperkenalkan `_strip_mdns_candidates()` di `camera_client.py` untuk mencegah error resolusi jaringan RFC 8445 pada LAN offline.
- **coturn TURN Relay**: Mengintegrasikan relay media WebRTC produksi lintas symmetric NAT.

---

## Riwayat Commit Repositori

Untuk log commit baris demi baris, lihat repositori GitHub masing-masing:

- [Commit msd700_documentation](https://github.com/itbdelaboprogramming/msd700_documentation/commits/main)
- [Commit ros-web-ui](https://github.com/itbdelaboprogramming/ros-web-ui/commits/main)
- [Commit msd700_robot](https://github.com/itbdelaboprogramming/msd700_robot/commits/master)
- [Commit ROS-dashboard-next-ts](https://github.com/itbdelaboprogramming/ROS-dashboard-next-ts/commits/main)
- [Commit msd700_noetic](https://github.com/itbdelaboprogramming/msd700_noetic/commits/master)
