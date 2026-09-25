---
outline: deep
search: false
---

# Sinkronisasi Data

<RoleBadge role="developer" />

Dokumen ini merinci bagaimana database MySQL lokal sebuah Unit (`ROS_DB`) dan database cloud pusat menjaga konsistensi dua arah melintasi konektivitas nirkabel yang terputus-putus.

Mencakup loop rekonsiliasi berulang (`sync_agent.js`, `sync_engine.js`, `sync_tables.js`), algoritma resolusi konflik, pelacakan watermark, dan badge status operator Local Mode.

Untuk kontrak sinkronisasi HTTP, lihat [Referensi API](/id/development/api-reference). Untuk upload penyimpanan peta real-time, lihat [State and Behavior](/id/development/state-and-behavior).

::: info Prinsip Inti: Lokal sebagai Cache
Sebuah Unit berfungsi offline tanpa batas waktu setelah terdaftar. Akun pengguna, izin, dan rental profile berasal dari cloud, sementara peta, rute, dan playlist yang direkam pada robot disinkronkan kembali ke cloud saat koneksi jaringan terbentuk.
:::

## Rezim Sinkronisasi Tabel

Tidak semua tabel database bersinkronisasi ke arah yang sama:

| Arah Sinkronisasi | Tabel yang Terpengaruh | Rasional Arsitektur |
| --- | --- | --- |
| **Hanya Downstream** (Cloud ke Unit) | `units`, `rental_profiles`, `users` (termasuk hash password bcrypt untuk login offline), `profile_members`, `profile_units`. | Batas keamanan: identitas dan tenancy rental berasal secara ketat dari server cloud. Sebuah unit lokal tidak bisa mencetak akun global baru atau menugaskan ulang tenancy fleet-nya sendiri. |
| **Dua Arah** (Last-Write-Wins per baris) | `maps_data`, `routes_data`, `areas_data`, `playlists_data`. | Data operasional dibuat di kedua sisi: peta SLAM direkam pada robot, dan rute waypoint atau playlist dibuat di dashboard web. |

Aset biner (seperti occupancy grid `.pgm`, metadata `.yaml`, dan thumbnail peta) disinkronkan lewat endpoint khusus (`/sync/file/:mapId/:kind`) dan diverifikasi lewat ukuran file yang tepat.

## Mekanika Sinkronisasi

![Mekanika Sinkronisasi](../../development/diagrams/data-sync-synchronization-mechanics.drawio)

### Komponen Kunci:
- **`sync_agent.js`**: Berjalan eksklusif pada Unit, mengelola timer polling, probe reachability, dan panggilan HTTP keluar ke endpoint cloud. (Cloud tidak menghubungi robot di belakang NAT).
- **`sync_engine.js`**: Library bersama di kedua sisi yang meng-query baris yang berubah berdasarkan watermark, menjalankan upsert, dan mengelola delete tombstone.
- **`sync_tables.js`**: Mendefinisikan arah sinkronisasi, primary key, dan aturan resolusi konflik untuk setiap tabel.

## Separuh cloud (`sync_api.js`)

Unit mengemudi; cloud menjawab. `sync_api.js` mengautentikasi token robot (`role: robot`, `typ: access`, `unit_id` dari claim, tidak pernah dari body) dan melayani `POST /handshake|/pull|/push|/ack` plus `GET|PUT /file/:mapId/:kind` dan `/route-file/:routeId/:kind`. Push di-scope (dan dipaksa) ke unit + profil pemanggil; tabel identitas ditolak.

## Aturan Resolusi Konflik

Resolusi konflik mengikuti strategi deterministik **Last-Write-Wins per baris**:

1. **Granularitas Level-Baris**: Baris yang lebih baru sepenuhnya menggantikan record yang lebih lama.
2. **Delete Tombstone**: Menghapus sebuah record menghasilkan entri di `sync_tombstones` dengan timestamp `deleted_at`. Sebuah delete yang lebih baru mengungguli edit yang lebih lama.
3. **Kompensasi Clock Skew**: Selama handshake awal, unit menghitung `clock_offset_ms` terhadap waktu server cloud. Semua timestamp lokal dinormalisasi ke frame referensi waktu cloud sebelum dibandingkan.
4. **Tie-Breaking Deterministik**: Jika timestamp persis sama, delete diutamakan di atas edit, dan versi cloud diutamakan di atas versi unit.
5. **Penanganan Tabrakan Nama**: Jika dua operator membuat rute atau peta berbeda dengan nama yang sama saat offline, sinkronisasi berikutnya secara otomatis menambahkan sufiks inkremental (misalnya `(1)`, `(2)`) alih-alih menimpa data yang ada.

## Badge Status Local Mode

Pada build dashboard lokal (`NEXT_PUBLIC_DEPLOYMENT_MODE=local`), header kanan atas menampilkan badge Local Mode:

![Badge Status Local Mode](../../development/diagrams/data-sync-the-local-mode-status-badge.drawio)

### Fase Sinkronisasi Detail:
1. `token`: Mengautentikasi dengan server cloud menggunakan kredensial robot.
2. `handshake`: Bertukar watermark dan mengkalibrasi clock offset.
3. `pull`: Mengunduh update akun dan profil downstream.
4. `apply`: Melakukan commit record yang ditarik ke MySQL lokal.
5. `push`: Mengunggah peta dan rute yang direkam secara lokal ke cloud.
6. `files`: Mentransfer gambar peta `.pgm` dan `.yaml` biner.
7. `finish`: Mengakui watermark yang di-commit.

::: warning Label Fase vs. Asal Kegagalan
Nama fase yang ditampilkan pada progress bar mencerminkan *kapan* sebuah ronde berhenti, bukan *di mana*. `readState()`, pembacaan pertama baris `sync_state` milik unit ini sendiri, berjalan segera setelah panggilan HTTP handshake tetapi sebelum `setPhase('pull')`, sehingga sebuah kegagalan di sana tetap ditampilkan sebagai `handshake`, meskipun tidak pernah menyentuh jaringan. Baca baris log itu sendiri (lihat di bawah) untuk membedakan keduanya.
:::

### Klasifikasi Kegagalan

`sync_agent.js` menandai setiap panggilan yang gagal dengan asalnya sebelum error tersebut mencapai log, karena koneksi yang ditolak ke cloud dan koneksi yang ditolak ke `ROS_DB` lokal milik unit ini sendiri keduanya muncul sebagai `ECONNREFUSED` yang identik. Tanpa tanda tersebut, database lokal yang mati dulu dilaporkan sebagai "cloud tidak dapat dijangkau."

| Tag Asal | Contoh Penyebab | Redaksi Log | Badge Status |
| --- | --- | --- | --- |
| `local_db`: kredensial ditolak | `MYSQL_USER`/`MYSQL_PASSWORD` pada `docker/.env` unit ini tidak cocok dengan password yang menjadi dasar inisialisasi volume `mysql_data_local` lokal (mysql2 `ER_ACCESS_DENIED_ERROR`). | *"this unit's own database refused the login it was given..."* | `error` |
| `local_db`: tidak terjangkau | Kontainer MySQL lokal unit tidak berjalan (`ECONNREFUSED`, `PROTOCOL_CONNECTION_LOST`). | *"cannot reach this unit's own database..."* | `error` |
| `local_db`: lainnya | Error MySQL lain apa pun (skema, lock, dll.) selama read/write lokal. | *"this unit's own database rejected the &lt;phase&gt; step..."* | `error` |
| `cloud`: error jaringan | Kegagalan DNS, timeout, atau koneksi ditolak ke endpoint cloud. Diperkirakan terjadi selama unit tidak memiliki uplink. | *"cloud not reachable, will retry..."* | `offline` |
| `cloud`: error HTTP | Cloud menjawab dengan status non-2xx di luar kasus `NOT_ENROLLED`/`NO_RENTAL`/reenroll yang sudah diketahui. | *"the cloud rejected the &lt;phase&gt; request (HTTP &lt;status&gt;)..."* | `error` |
| *(tidak ada)* | Sebuah throw di dalam `sync_agent.js` itu sendiri tanpa status HTTP dan tanpa tanda jaringan, sebuah bug di agen, bukan masalah konektivitas atau kredensial. | *"sync_agent hit an unexpected internal error during &lt;phase&gt;..."* | `error` |

Lihat `classifyFailure()` di `sync_agent.js` untuk aturan prioritas yang tepat.

## Dokumentasi Terkait

- [Referensi API](/id/development/api-reference): Endpoint dan payload sinkronisasi REST.
- [State and Behavior](/id/development/state-and-behavior): Alur penyimpanan peta dan replikasi storage.
- [Arsitektur](/id/development/architecture): Model trust domain hardware dan cloud.
- [Skema Database](/id/development/database-schema): Definisi skema untuk `sync_state` dan `sync_tombstones`.
