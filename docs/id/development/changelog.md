---
search: false
---
# Catatan Perubahan Platform & Tonggak Rilis

<RoleBadge role="developer" />

Catatan perubahan ini merangkum pencapaian arsitektur utama, perombakan platform, dan kemajuan protokol di seluruh ekosistem robotika MSD700.

## Tonggak Sejarah Arsitektur

### Agustus 2026: Perombakan Dokumentasi & Kinematika Presisi
- **Arsitektur Dokumentasi Modular**: Penulisan ulang menyeluruh semua halaman dokumentasi dengan diagram Mermaid SVG yang responsif, formulasi matematika, dan operasi tanpa waktu henti.
- **Simulasi Gazebo Skala Sejati**: Model simulator ditingkatkan menjadi `msd700_field` ($0,90 \kali 0,70\text{ m}$ tapak badan dengan 4 kastor) yang beroperasi di Gudang Kecil AWS RoboMaker.
- **Pencocokan Pemindaian Korelatif (Penyelarasan Otomatis)**: Menerapkan penyelarasan pose awal tanpa putaran (<50 ms) untuk menghilangkan rotasi 360 derajat di koridor sempit.
- **Pendaftaran Kriptografi Nonce 32-Byte**: Protokol hashing nonce CSPRNG yang diterapkan untuk autentikasi perangkat robot.

### Juli 2026: Keamanan Sewa Multi-Penyewa & Migrasi ULID
- **Otorisasi Profil Sewa**: Menambahkan middleware `attachUnit` Express untuk menerapkan isolasi penyewa yang ketat di seluruh peta dan unit.
- **Arsitektur ULID**: Pengalamatan sistem yang dimigrasikan dari string perangkat keras mentah ke Pengidentifikasi yang Dapat Diurutkan Secara Leksikografis Unik Secara Universal (`/unit_<ULID>/...`).
- **Cap Waktu Basis Data Seragam**: Kolom `created_at` dan `modified_at` terstandarisasi dengan pemicu `ON UPDATE CURRENT_TIMESTAMP` otomatis di 15 tabel basis data.

### Juni 2026: Replikasi Offline-Pertama & Tumpukan Mode Lokal
- **Agen Sinkronisasi Data Dua Arah**: Dikerahkan `sync_agent.js` dan `sync_engine.js` dengan penyelesaian konflik penulisan terakhir per baris dan penghapusan batu nisan.
- **Penyimpanan Peta Dua Tingkat**: Mengimplementasikan unggahan lokal wajib (`media_local :3003`) dengan sinkronisasi cloud upaya terbaik (`media-server :3003`).
- **Dasbor Lokal Jetson**: Paket onboard `frontend_local` dan `backend_local` untuk operasi lapangan offline yang otonom.

### Mei 2026: Pipeline Video WebRTC Latensi Sangat Rendah
- **Filter Kandidat mDNS**: Diperkenalkan `_strip_mdns_candidates()` di `camera_client.py` untuk mencegah kesalahan resolusi jaringan RFC 8445 pada LAN offline.
- **coturn TURN Relay**: Media WebRTC produksi terintegrasi yang menyampaikan melalui NAT simetris.

---

## Riwayat Komit Repositori

Untuk log penerapan baris demi baris, lihat repositori GitHub masing-masing:

- [msd700_documentation Komit](https://github.com/itbdelaboprogramming/msd700_documentation/commits/main)
- [Komitmen ros-web-ui](https://github.com/itbdelaboprogramming/ros-web-ui/commits/v2)
- [msd700_robot Berkomitmen](https://github.com/itbdelaboprogramming/msd700_robot/commits/v2)
- [Komitmen ROS-dashboard-next-ts](https://github.com/itbdelaboprogramming/ROS-dashboard-next-ts/commits/v2)
- [msd700_noetic Komit](https://github.com/itbdelaboprogramming/msd700_noetic/commits/master)