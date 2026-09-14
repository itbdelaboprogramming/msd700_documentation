---
outline: deep
search: false
---

# Konsol Admin: Cadangan

<RoleBadge role="developer" />

Tab Cadangan (`BackupsPanel.tsx`) adalah front end konsol admin ke mesin arsip yang
didokumentasikan lengkap di [Cadangan, Pemulihan, dan Migrasi
Data](/id/development/backup-and-restore): arsip **seluruh profil penyewaan**. Tab Unit punya
titik masuknya sendiri yang lebih sempit ke separuh bercakupan-unit dari arsitektur yang sama —
lihat [Unit & Armada § Cadangkan data bercakupan-penyewaan unit
ini](/id/development/webui/admin-console/units-and-fleet#backup-this-units-rental-scoped-data) —
tetapi tab ini adalah tempat admin mengelola arsip sebagai objek kelas satu: buat, hapus, unduh,
unggah, dan pulihkan.

## Dua cakupan, satu tab untuk separuh profil

[Cadangan dan Pemulihan § Arsitektur Backup
Dua-Cakupan](/id/development/backup-and-restore#arsitektur-backup-dua-lingkup) mendefinisikan dua
cakupan backup independen, dikunci dengan `scope: 'profile'` atau `scope: 'unit'`. Tab ini
mengerjakan sisi bercakupan-profil: arsip berpusat-penyewa yang menangkap "semua peta, rute, area,
dan playlist yang dimiliki sebuah profil penyewaan di seluruh robot" yang pernah dipakainya,
dipulihkan secara aditif ke sebuah profil target dengan robot yang hilang dapat dipetakan ulang.
Sisi bercakupan-unit — arsip berpusat-robot dari semua yang pernah direkam satu unit fisik —
dicapai dari tab Unit sebagai gantinya (lihat di atas).

## Buat arsip sebuah profil

Menghasilkan arsip `.tar.gz` dengan struktur yang didokumentasikan di
[Cadangan dan Pemulihan § Struktur Arsip](/id/development/backup-and-restore#struktur-arsip-tar-gz):
sebuah `manifest.json`, sebuah `database_dump.sql` berisi pernyataan SQL insert bercakupan, dan
sebuah direktori `maps/` berisi berkas peta biner (`.pgm`, `.yaml`, `.png`) yang menyertainya.

::: info Apa yang ada, dan tidak ada, dalam arsip
Dibawa: profil itu sendiri, penugasan unitnya, dan setiap peta, rute, area, dan playlist yang
dimilikinya, ditambah berkas gambar peta yang ditunjuk baris-baris itu. **Tidak pernah dibawa: akun
operator.** Manifest dan `database_dump.sql` memang menstempel baris individual dengan ULID
pengguna `created_by` untuk atribusi — contoh `manifest.json` yang sama di Cadangan dan Pemulihan
menampilkan field `created_by` tingkat-atas — tetapi itu hanya atribusi, aturan "Atribusi bukanlah
otorisasi" yang sama seperti disebutkan di
[Skema Basis Data § Foreign key, lengkap](/id/development/database-schema#foreign-key-secara-lengkap).
Memulihkan sebuah arsip tidak pernah membuat, mengubah, atau menghapus apa pun di tabel `users`.
:::

## Hapus sebuah arsip

Menghapus arsip tersebut. Sesuai
[Skema Basis Data § Backup dan sinkronisasi](/id/development/database-schema#cadangan-dan-sinkronisasi),
baris `profile_backups` independen dari profil asalnya (`profile_id` adalah `ON DELETE SET NULL`,
"sebuah arsip harus bertahan lebih lama dari yang diarsipkannya"), tetapi sebaliknya tidak benar:
menghapus arsip itu sendiri hanyalah menghapus arsip, tanpa efek pada profil hidup asalnya.

## Unduh / unggah

- **Unduh** sesuai dengan
  [Cadangan dan Pemulihan § Ekspor Arsip](/id/development/backup-and-restore#_1-ekspor-arsip),
  `POST /api/backup/export`, yang menghasilkan dan mengunduh `.tar.gz` untuk sebuah
  `{ scope, profile_id }` tertentu.
- **Unggah** sesuai dengan
  [Cadangan dan Pemulihan § Impor dan Pulihkan Arsip](/id/development/backup-and-restore#_2-impor-dan-restore-arsip),
  `POST /api/backup/import`, sebuah permintaan multipart yang membawa berkas arsip dan
  `profile_id` target.

## Rencanakan sebuah restore

Langkah pratinjau di depan panggilan impor di atas: ia menunjukkan apa yang akan digabung ke
profil target versus apa yang harus dibuat baru, dan memungkinkan admin memetakan ulang penyewa
atau robot milik arsip ke yang berbeda dalam sistem hidup sebelum apa pun ditulis. Ini penting
karena sebuah arsip dirancang untuk bertahan lebih lama dari yang diarsipkannya — sebuah `unit_id`
yang dirujuk di dalam dump mungkin tidak lagi berkaitan dengan unit terdaftar pada saat arsip
dipulihkan (unitnya telah dihapus, atau arsip sedang dipulihkan ke armada yang sepenuhnya berbeda)
— dan "robot yang hilang dapat dipetakan ulang" persis perilaku restore yang dijanjikan baris
bercakupan-profil pada tabel dua-cakupan. REST API yang didokumentasikan di Cadangan dan Pemulihan
mencakup langkah commit (`POST /api/backup/import`) sebagai satu panggilan tunggal; langkah
rencana/pratinjau adalah UX konsol admin yang dilapiskan di depan commit itu, bukan endpoint yang
didokumentasikan secara terpisah.

## Jalankan restore

::: warning Restore selalu aditif
Sesuai [Cadangan dan Pemulihan § Arsitektur Backup
Dua-Cakupan](/id/development/backup-and-restore#arsitektur-backup-dua-lingkup), restore
bercakupan-profil adalah "restore aditif ke profil target," dan endpoint impor itu sendiri
"menerapkannya secara aditif." Menjalankan sebuah restore tidak pernah menimpa data profil yang
sudah ada; paling buruk ia menambahkan baris di samping apa yang sudah ada. Tidak ada mode
"ganti" yang destruktif.
:::

Evolusi skema untuk tabel yang disentuh backup (`profile_backups.scope`, tabel sinkronisasi, dan
sejenisnya) ditangani oleh skrip migrasi di
[Cadangan dan Pemulihan § Skrip Migrasi
Skema](/id/development/backup-and-restore#script-migrasi-skema), bukan oleh apa pun pada tab
ini — skrip itu berjalan langsung terhadap basis data dan di luar cakupan untuk `BackupsPanel.tsx`.

## Terkait

- [Ikhtisar](/id/development/webui/admin-console/overview): shell lima-tab, peran admin vs superadmin, dan menu akun.
- [Operator](/id/development/webui/admin-console/operators): mendaftarkan, mencari, menangguhkan/mengaktifkan kembali, dan mereset kata sandi akun operator.
- [Unit & Armada](/id/development/webui/admin-console/units-and-fleet): titik masuk backup bercakupan-unit yang dicapai dari tampilan Armada.
- [Penyewaan](/id/development/webui/admin-console/rentals): pintasan backup satu-klik ke tab ini, dan profil yang dimiliki arsip ini.
- [Integrasi ROS](/id/development/webui/admin-console/ros-integration): cara aksi admin menjangkau robot dan armada kontainer.
- [Arsitektur](/id/development/architecture): struktur sistem tingkat tinggi dan model dua-mesin.
- [Skema Basis Data](/id/development/database-schema): referensi skema lengkap, termasuk `profile_backups`.
- [Siklus Hidup Kontainer Unit](/id/development/unit-container-lifecycle): referensi mandiri untuk `unit_manager.js` dan relay armada.
- [Cadangan, Pemulihan, dan Migrasi Data](/id/development/backup-and-restore): referensi lengkap yang menjadi dasar tab ini.
