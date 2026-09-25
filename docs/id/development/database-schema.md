---
outline: deep
search: false
---

# Skema Database

<RoleBadge role="developer" />

18 tabel di `ROS_DB`, dikelompokkan menurut fungsinya, beserta foreign key di antaranya. Sumber
kanonisnya adalah `ROS-dashboard-backend/sql/init.sql`, yang hanya berjalan terhadap data directory
MySQL yang kosong. Sebuah deployment yang sudah ada mengambil perubahan skema lewat script migrasi
di `ROS-dashboard-backend/scripts/` (`migrate_unit_id_refactor.js`, `migrate_enrolment.js`,
`migrate_sync.js`, `migrate_backup_scope.js`). Untuk bentuk sebuah baris sebagaimana yang
sesungguhnya dikembalikan API, lihat [Referensi API](/id/development/api-reference); halaman ini
mencakup kolom dan relasi, bukan JSON respons.

## Identitas dan akses

| Tabel | Tujuan | Kolom kunci |
| --- | --- | --- |
| `users` | Akun operator | `id` (ULID, PK), `username`, `email`, `password` (bcrypt), `status` (`active`/`suspended`) |
| `admin_accounts` | Akun back-office, sengaja dipisahkan dari `users` | `id` (ULID, PK), `role` (`superadmin`/`admin`), `must_change_password` |
| `rental_profiles` | Satu baris per rental. Menangguhkannya menyembunyikan baik unit maupun datanya dari anggota, tanpa menyentuh keduanya | `id` (ULID, PK), `profile_name` (unik), `tenant_name`, `status` |
| `units` | Satu baris per robot fisik, fleet-wide. `unit_name` adalah label tampilan yang bisa diganti nama, bukan identitas | `id` (ULID, PK): ini adalah alamat robot, `/unit_<id>/...` |
| `profile_members` | Akun mana yang termasuk dalam profil mana | `UNIQUE(profile_id, user_id)`, keduanya `ON DELETE CASCADE` |
| `profile_units` | Unit mana yang dapat diakses oleh sebuah profil | `UNIQUE(unit_id)`, **bukan** `(profile_id, unit_id)`, sehingga sebuah unit tidak pernah bisa di-assign ganda |

::: info `users.status` ditulis, belum ditegakkan
`PATCH /admin/api/users/:id/status` menulis kolom ini, tetapi `/user/login` tidak membacanya: sesi
operator yang ditangguhkan yang sudah ada tetap berfungsi dan mereka masih bisa login kembali.
Keduanya sengaja dipisahkan agar berdirinya konsol admin tidak pernah bisa mengunci sebuah
deployment live dari robot miliknya sendiri; menegakkannya di batas login adalah pekerjaan
tersendiri. Ini adalah mekanisme berbeda dari *rental profile yang ditangguhkan*, yang memang
langsung menghapus sebuah unit dan datanya dari tampilan setiap anggota (lihat
[Admin Console § Rentals](/id/development/webui/admin-console/rentals)).
:::

## Data operasional (per peta)

| Tabel | Tujuan | Kolom kunci |
| --- | --- | --- |
| `maps_data` | Sebuah peta yang direkam | `unit_id` → `units` (`ON DELETE CASCADE`, robot mana yang merekamnya), `profile_id` → `rental_profiles` (`ON DELETE RESTRICT`, rental mana yang memilikinya), `UNIQUE(map_name, unit_id, profile_id)` |
| `routes_data` | Sebuah rute multi-pinpoint tersimpan | `map_id` → `maps_data` (`ON DELETE CASCADE`), `route_points` (JSON), `UNIQUE(route_name, map_id)` |
| `areas_data` | Sebuah area coverage tersimpan | `map_id` → `maps_data` (`ON DELETE CASCADE`), `area_type` (`cover`/`no_cover`), `polygon_points` (JSON), `UNIQUE(area_name, map_id)` |
| `playlists_data` | Daftar area terurut untuk disapu secara berurutan | `map_id` → `maps_data` (`ON DELETE CASCADE`), `items` (JSON, sebuah **snapshot** dari geometri setiap area alih-alih sebuah referensi), `UNIQUE(playlist_name, map_id)` |
| `unit_operation_state` | Mode saat ini milik unit itu sendiri, untuk pemulihan setelah restart backend | PK-nya **adalah** `unit_id` itu sendiri, karena satu robot hanya bisa melakukan satu hal |

`maps_data` sengaja dikunci ke rental yang merekamnya, bukan ke unit: sebuah unit yang disewakan
ulang ke tenant berbeda tidak menyerahkan peta tenant sebelumnya, dan tenant yang masa rentalnya
berakhir tetap menyimpan peta miliknya meskipun mereka tidak lagi bisa mengemudikan unit yang
merekamnya. Lihat [Admin Console § Rentals](/id/development/webui/admin-console/rentals)
untuk bagaimana ini berlaku di lapisan akses.

Aturan itu menjawab "apakah saya boleh melihat baris ini sama sekali". Itu bukan pertanyaan yang
sama dengan "peta mana yang seharusnya tampil di halaman saat saya mengemudikan robot INI", dan
keduanya dicampuradukkan hingga 2026-09-10. Sebuah rental yang memegang beberapa robot mendaftarkan
peta semua robot bersamaan di halaman Database, tanpa apa pun di halaman yang menyatakan mana yang
mana; memilih peta milik robot sibling menyerahkan ke robot sebuah ULID peta yang file-nya tidak
pernah ia rekam, sehingga navigation init dikirim, unit tersebut tidak bisa me-resolve peta, dan
run tersebut mati di sana sementara dashboard melaporkan permulaan yang berhasil. `unit_id`
sekarang mempersempit tampilan operasi di atas lingkup rental: keduanya wajib, tidak ada yang
menggantikan yang lain.

## Pendaftaran

| Tabel | Tujuan | Kolom kunci |
| --- | --- | --- |
| `unit_devices` | Satu kredensial perangkat yang terikat pada sebuah unit | `UNIQUE(unit_id)`, `secret_hash` + `secret_prev_hash` (generasi sebelumnya tetap valid hingga pertukaran token berhasil berikutnya, sehingga merotasi secret tidak bisa mem-brick robot di tengah rotasi) |
| `pending_units` | Robot yang sudah menyapa tetapi belum diklaim | `fingerprint` (unik), `claim_code`, `nonce_hash`, `status` (`pending`/`approved`/`claimed`/`rejected`), `contact_count` (sebuah counter alih-alih log per-kontak, karena endpoint ini sengaja tanpa autentikasi) |
| `unit_enrollment_codes` | Voucher sekali pakai untuk mengklaim sebuah unit spesifik sebelum robotnya ada | `unit_id`, `code_hash`, `expires_at`, `used_at` |
| `unit_connection_log` | Riwayat koneksi append-only | Satu-satunya tabel dengan PK `AUTO_INCREMENT` biasa alih-alih ULID; dibersihkan setelah 180 hari |

Lihat [Kontrak Pesan § Handshake Pendaftaran Robot](/id/development/message-contracts#handshake-pendaftaran-robot) untuk pertukaran
lengkap yang didukung tabel-tabel ini.

## Cadangan dan sinkronisasi

| Tabel | Tujuan | Kolom kunci |
| --- | --- | --- |
| `profile_backups` | Manifest arsip | `scope` (`profile` atau `unit`: arsip berlingkup profil mencakup satu tenant di seluruh robot yang pernah digunakannya, arsip berlingkup unit mencakup satu robot di seluruh tenant yang pernah menggunakannya), `profile_id`/`unit_id` keduanya `ON DELETE SET NULL` (sebuah arsip harus bertahan lebih lama dari apa yang diarsipkannya) |
| `sync_tombstones` | Catatan hapus untuk sinkronisasi lintas perangkat | `UNIQUE(table_name, row_id)`, tanpa foreign key sama sekali, karena sebuah tombstone harus bertahan lebih lama dari baris, dan mungkin unit, yang dirujuknya |
| `sync_state` | Satu baris per peer sinkronisasi | PK `peer` (`'cloud'` pada sebuah unit; ULID unit tersebut, pada cloud), `last_pull_watermark`, `last_push_watermark`, `last_pull_profile_id`, `clock_offset_ms` |

Lihat [Sinkronisasi Data](/id/development/data-sync) untuk bagaimana kedua tabel ini sebenarnya
digunakan.

## Foreign key, secara lengkap

![Foreign key, secara lengkap](../../development/diagrams/database-schema-foreign-keys-in-full.drawio)

::: info Atribusi bukanlah otorisasi
`created_by` / `modified_by` pada `maps_data`, `routes_data`, `areas_data` dan `playlists_data`
menyimpan sebuah **ULID pengguna**, tidak pernah sebuah nama, dan hanya digunakan untuk menyatakan
siapa yang menyentuh sebuah baris, tidak pernah untuk memutuskan siapa yang boleh melihat atau
mengubahnya. Keduanya aman untuk bernilai `NULL`, dan seorang pembuat yang akunnya sudah tidak ada
lagi dirender sebagai *tidak diketahui* alih-alih merusak baris tersebut. Akses itu sendiri
sepenuhnya berjalan lewat rental profile (lihat
[Admin Console § Rentals](/id/development/webui/admin-console/rentals)).
:::

## `created_at` / `modified_at`

Konvensi timestamp yang diseragamkan di seluruh skema pada 2026-08-01
(`created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`,
`modified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`) berlaku
untuk 15 dari 18 tabel. Tiga menyimpang dari itu dengan sengaja, bukan karena kelalaian:

| Tabel | Yang dimilikinya sebagai gantinya | Alasan |
| --- | --- | --- |
| `pending_units` | `first_seen_at` / `last_seen_at` | Tabel ini melacak *kontak*, bukan sebuah catatan dengan riwayat edit |
| `unit_enrollment_codes` | `created_at` saja | Sebuah voucher bersifat immutable; siklus hidupnya adalah `used_at`, bukan timestamp update |
| `unit_connection_log` | `connected_at` saja | Log append-only, tidak pernah diperbarui setelah baris ditulis |

## Database per profil deployment

Nama database selalu `ROS_DB`; yang berbeda adalah host dan port.

| Profil | Host:port |
| --- | --- |
| Unit (`local_dev`) | `127.0.0.1:3306` (`network_mode: host`) |
| Cloud `server_prod` | port kontainer `3306`, dipublikasikan di host sebagai `3307` |
| Cloud `server_dev` | port kontainer `3306`, dipublikasikan di host sebagai `3308` |

`migrate_backup_scope.js` meng-hardcode pasangan ini dan **menolak berjalan tanpa flag `--profile`
eksplisit**, khusus agar sebuah default fallback tidak pernah bisa mengarahkan script maintenance
ke database yang salah. Lihat
[Referensi Docker § Pemetaan layanan dan port](/id/setup/docker-reference#peta-service-dan-port)
untuk bagaimana port-port ini cocok dengan sisa profil compose.

## Indeks yang perlu diketahui alasannya

| Indeks | Alasan |
| --- | --- |
| `maps_data.unique_map_unit (map_name, unit_id, profile_id)` | Dua tenant berbeda diperbolehkan menamai sebuah peta dengan nama yang sama pada robot yang sama tanpa salah satu melihat milik yang lain |
| `profile_units.unique_rented_unit (unit_id)` | Sebuah double-assignment gagal dengan keras alih-alih diam-diam menimpa yang sudah ada |
| `unit_devices.unique_device_unit (unit_id)` | Dua robot tidak akan pernah bisa berakhir menulis ke root topik yang sama |
| `unit_connection_log.idx_conn_unit_time (unit_id, connected_at)` | Mendukung baik query riwayat per-unit maupun job pembersihan 180-hari dalam satu indeks |

## Terkait

- [Referensi API](/id/development/api-reference): permukaan HTTP yang dibangun di atas skema ini
- [Sinkronisasi Data](/id/development/data-sync): bagaimana `sync_tombstones` dan `sync_state` digunakan
- [Kontrak Pesan § Handshake Pendaftaran Robot](/id/development/message-contracts#handshake-pendaftaran-robot)
- [Arsitektur](/id/development/architecture)
