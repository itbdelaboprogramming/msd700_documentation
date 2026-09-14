---
search: false
---

# Changelog & Tonggak Rilis Platform

<RoleBadge role="developer" />

Changelog ini merangkum tonggak arsitektur utama, overhaul platform, dan kemajuan protokol di seluruh ekosistem robotika MSD700.

## Tonggak Arsitektur

### September 2026: Optimisasi Bandwidth & Lingkup Data Per-Unit
- **Egress yang Digerbangi Kehadiran**: Telemetri robot-ke-cloud kini membaca `/msd700/viewers` dan mengirim dengan laju yang disesuaikan dengan ada tidaknya yang menonton. Overlay dan occupancy grid dikirim saat berubah alih-alih berdasarkan timer, dan keempat topik overlay di-latch pada bridge cloud sehingga tab yang menyambung ulang tetap mendapatkan gambarnya.
- **Lingkup Peta Per-Unit**: Daftar peta, pembacaan peta tunggal, dan `POST /api/navigation/init` kini dibatasi pada unit yang sedang dikendalikan sekaligus rental-nya. Sebuah rental yang memegang beberapa robot tidak lagi mendaftarkan peta semua robot bersamaan, dan peta milik robot sibling ditolak di API alih-alih gagal di robot.
- **Jangkauan Pemulihan di Atas Jumlah Pesan**: Rebuild snapshot kini juga dipicu pada tab `Idle` tanpa mode terpilih (state yang ditinggalkan oleh membuka ulang peta dari halaman Database), dan prompt resync kini mencapai 9,4 detik alih-alih 3,4 detik. Baik halaman Navigation maupun komponen peta tidak lagi menimpa status atau mode yang tersimpan saat mount.
- **Pencegahan Self-Join**: Hotspot milik unit sendiri kini dikecualikan dari pemindaian WiFi-nya dan ditolak oleh `connect()`, sehingga operator yang membaca daftar lewat hotspot tersebut tidak dapat menyuruh unit bergabung dengan dirinya sendiri.
- **Autostart Boot yang Mempertahankan Mode**: `msd700.service` kini membawa flag `--dev` dan `--simulator` dari `up` yang mempersenjatainya. Unit boot sebelumnya menjalankan ulang `up` polos, sehingga robot yang dimulai melawan cloud dev, atau sebagai simulator, secara diam-diam kembali setelah reboot sebagai hardware melawan produksi.

### Agustus 2026: Overhaul Dokumentasi & Kinematika Presisi
- **Arsitektur Dokumentasi Modular**: Penulisan ulang menyeluruh semua halaman dokumentasi dengan diagram SVG Mermaid responsif, formulasi matematis, dan operasi zero-downtime.
- **Simulasi Gazebo Skala Nyata**: Meningkatkan model simulator ke `msd700_field` (jejak badan $0,90 \times 0,70\text{ m}$ dengan 4 caster) beroperasi di AWS RoboMaker Small Warehouse.
- **Correlative Scan Matching (Auto-Align)**: Mengimplementasikan penyelarasan pose awal tanpa putaran (< 50 ms) untuk menghilangkan rotasi 360 derajat di koridor sempit.
- **Pendaftaran Kriptografis Nonce 32-Byte**: Menegakkan protokol hashing nonce CSPRNG untuk autentikasi perangkat robot.

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
- [Commit ros-web-ui](https://github.com/itbdelaboprogramming/ros-web-ui/commits/v2)
- [Commit msd700_robot](https://github.com/itbdelaboprogramming/msd700_robot/commits/v2)
- [Commit ROS-dashboard-next-ts](https://github.com/itbdelaboprogramming/ROS-dashboard-next-ts/commits/v2)
- [Commit msd700_noetic](https://github.com/itbdelaboprogramming/msd700_noetic/commits/master)
