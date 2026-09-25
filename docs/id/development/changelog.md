---
search: false
---

# Changelog & Tonggak Rilis Platform

<RoleBadge role="developer" />

Changelog ini merangkum tonggak arsitektur utama, overhaul platform, dan kemajuan protokol di seluruh ekosistem robotika MSD700.

## Tonggak Arsitektur

### September 2026: Optimisasi Bandwidth & Lingkup Data Per-Unit
- **Egress yang Digerbangi Kehadiran**: Telemetri robot-ke-cloud kini membaca `/msd700/viewers` dan mengirim dengan laju yang disesuaikan dengan ada tidaknya yang menonton. Overlay dan occupancy grid dikirim saat berubah alih-alih berdasarkan timer, dan keempat topik overlay di-latch pada bridge cloud sehingga tab yang menyambung ulang tetap mendapatkan gambarnya.
- **Jaminan Pengiriman Map**: Change-gating menyisakan map sebagai satu pesan sekali-kirim-lalu-lupa per heartbeat, yang merupakan jaminan yang salah untuk satu-satunya payload yang membuat operator tidak bisa bekerja kalau tidak ada. Topik map kini di-latch pada relay cloud, map setelah reset diulang sebagai burst pendek, dan dashboard bisa menariknya sesuai kebutuhan lewat `/string/map_request` alih-alih menunggu heartbeat yang terukur ~52 detik. Membuka peta dari Database juga tidak lagi duduk di belakang tunggu 5 detik tetap yang salah dilabeli sebagai polling kesiapan. Lihat [Kontrak Pesan § Pengiriman map](/id/development/message-contracts#map-delivery).
- **Coverage Bertahan Melewati Operator**: Manual Override kini memarkir run boustrophedon lewat service pause milik node coverage sendiri, bukan `/move_base/cancel` telanjang yang dibaca node itu sebagai cancel misi sehingga membunuh sapuan seketika tanpa menerbitkan status terminal apa pun. Cancel yang datang saat run sedang paused tidak lagi mengakhirinya, pause hanya dikembalikan kepada yang mengambilnya, dan run yang benar-benar mati kini mengatakannya di `/msd700/coverage_status` alih-alih membiarkan dashboard melaporkan run hidup di atas robot yang diam. Lihat [Manual & Autopilot § Menyerahkan sapuan coverage ke operator dan mengambilnya kembali](/id/development/webui/navigation/manual-and-autopilot#menyerahkan-sapuan-coverage-ke-operator-dan-mengambilnya-kembali).
- **Lingkup Peta Per-Unit**: Daftar peta, pembacaan peta tunggal, dan `POST /api/navigation/init` kini dibatasi pada unit yang sedang dikendalikan sekaligus rental-nya. Sebuah rental yang memegang beberapa robot tidak lagi mendaftarkan peta semua robot bersamaan, dan peta milik robot sibling ditolak di API alih-alih gagal di robot.
- **Jangkauan Pemulihan di Atas Jumlah Pesan**: Rebuild snapshot kini juga dipicu pada tab `Idle` tanpa mode terpilih (state yang ditinggalkan oleh membuka ulang peta dari halaman Database), dan prompt resync kini mencapai 9,4 detik alih-alih 3,4 detik. Baik halaman Navigation maupun komponen peta tidak lagi menimpa status atau mode yang tersimpan saat mount.
- **Pencegahan Self-Join**: Hotspot milik unit sendiri kini dikecualikan dari pemindaian WiFi-nya dan ditolak oleh `connect()`, sehingga operator yang membaca daftar lewat hotspot tersebut tidak dapat menyuruh unit bergabung dengan dirinya sendiri.
- **Autostart Boot yang Mempertahankan Mode**: `msd700.service` kini membawa flag `--dev` dan `--simulator` dari `up` yang mempersenjatainya. Unit boot sebelumnya menjalankan ulang `up` polos, sehingga robot yang dimulai melawan cloud dev, atau sebagai simulator, secara diam-diam kembali setelah reboot sebagai hardware melawan produksi.

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
- [Commit ros-web-ui](https://github.com/itbdelaboprogramming/ros-web-ui/commits/v2-optimization)
- [Commit msd700_robot](https://github.com/itbdelaboprogramming/msd700_robot/commits/v2-optimization)
- [Commit ROS-dashboard-next-ts](https://github.com/itbdelaboprogramming/ROS-dashboard-next-ts/commits/v2-optimization)
- [Commit msd700_noetic](https://github.com/itbdelaboprogramming/msd700_noetic/commits/v2-optimization)
