---
outline: deep
search: false
---

# Konsol Admin: Cadangan

<RoleBadge role="developer" />

Tab Cadangan (`BackupsPanel.tsx`) adalah front end konsol admin ke mesin arsip yang
didokumentasikan lengkap di [Cadangan, Pemulihan, dan Migrasi
Data](/id/development/backup-and-restore): arsip **seluruh profil penyewaan**. Tab Unit punya
titik masuknya sendiri yang lebih sempit ke separuh bercakupan-unit dari arsitektur yang sama:
lihat [Unit § Cadangkan data bercakupan-penyewaan unit
ini](/id/development/webui/admin-console/units#cadangkan-data-bercakupan-penyewaan-unit-ini):
tetapi tab ini adalah tempat admin mengelola arsip sebagai objek kelas satu: buat, hapus, unduh,
unggah, dan pulihkan.

## Dua cakupan, satu tab untuk separuh profil

[Cadangan dan Pemulihan § Arsitektur Backup
Dua-Cakupan](/id/development/backup-and-restore#arsitektur-backup-dua-lingkup) mendefinisikan dua
cakupan backup independen, dikunci dengan `scope: 'profile'` atau `scope: 'unit'`. Tab ini
mengerjakan sisi bercakupan-profil: arsip berpusat-penyewa yang menangkap "semua peta, rute, area,
dan playlist yang dimiliki sebuah profil penyewaan di seluruh robot" yang pernah dipakainya,
dipulihkan secara aditif ke profil baru (atau profil yang sudah ada, jika admin memilihnya) dengan robot yang hilang dapat dipetakan ulang.
Sisi bercakupan-unit: arsip berpusat-robot dari semua yang pernah direkam satu unit fisik:
dicapai dari tab Unit sebagai gantinya (lihat di atas).

## Buat arsip sebuah profil

`POST /admin/api/profiles/:id/backups` menghasilkan arsip `.tar.gz` dengan struktur yang
didokumentasikan di [Cadangan dan Pemulihan § Struktur Arsip](/id/development/backup-and-restore#struktur-arsip-tar-gz):
sebuah `manifest.json` (baris profil, anggotanya, penugasan unitnya, dan setiap map beserta rute,
area, dan playlist di bawahnya) ditambah direktori `files/` berisi `<mapId>.pgm`, `.yaml`, dan
`.png` untuk tiap map. Tidak ada dump SQL di dalam arsip. Map yang file-nya sudah hilang tetap
membawa rute dan areanya, dan response mencantumkannya.

::: info Apa yang ada, dan tidak ada, dalam arsip
Dibawa: profil itu sendiri, penugasan unitnya, serta setiap map, rute, area, dan playlist yang
dimilikinya, ditambah file gambar map yang dirujuk baris-baris tersebut. **Tidak pernah dibawa: akun
operator.** Keanggotaan dicatat dengan id dan username agar bisa dihubungkan kembali saat restore,
tetapi hanya ke akun yang sudah ada. `created_by` / `modified_by` dibawa untuk atribusi; yang
menunjuk ke akun yang sudah tidak ada menjadi `NULL` dan tampil sebagai "unknown". Restore arsip
tidak pernah membuat, mengubah, atau menghapus apa pun di tabel `users`.
:::

## Hapus sebuah arsip

`DELETE /admin/api/backups/:id` menghapus baris arsip beserta file-nya. Menurut
[Skema Database § Cadangan dan sinkronisasi](/id/development/database-schema#cadangan-dan-sinkronisasi), baris
`profile_backups` tidak bergantung pada profil asalnya (`profile_id` bernilai `ON DELETE SET NULL`,
"arsip harus bertahan lebih lama dari yang diarsipkannya"), tetapi tidak sebaliknya: menghapus arsip
hanya menghapus arsip, tanpa efek pada profil live asalnya.

## Unduh / unggah

- **Unduh**: `GET /admin/api/backups/:id/download` mengalirkan `.tar.gz` yang tersimpan. Nama file
  unduhan dibentuk dari nama profil; file di disk dinamai dengan ULID backup.
- **Unggah**: `POST /admin/api/backups/upload` menerima arsip sebagai **raw request body** (bukan
  multipart). Server memvalidasinya (tipe file salah, gzip rusak, dan versi format yang lebih baru
  ditolak), menyimpannya sebagai baris backup baru dengan `profile_id` `NULL`, dan langsung
  mengembalikan rencana restore.

## Rencanakan sebuah restore

`POST /admin/api/backups/:id/plan` adalah endpoint sungguhan dan tidak menulis apa pun. Endpoint ini
melaporkan apa yang akan dibuat restore, robot mana di arsip yang sudah tidak terdaftar, dan ke profil
mana data akan masuk. Console mengirim balik pilihan admin sebagai `unit_remap` (unit di arsip → unit
terdaftar) dan `profile_remap` (profil di arsip → rental yang sudah ada) sampai rencana tidak punya
unit yang belum terselesaikan. Ini penting karena arsip dirancang untuk bertahan lebih lama dari yang
diarsipkannya: `unit_id` di dalamnya bisa milik robot yang sudah dihapus, diganti, atau tidak pernah
ada di server ini.

## Jalankan restore

`POST /admin/api/backups/:id/restore` menerapkan arsip dengan `unit_remap` / `profile_remap` yang
sama. Endpoint ini menjawab `409` beserta rencananya jika masih ada unit yang belum terselesaikan atau
profil tujuan yang dipilih sudah tidak ada.

::: warning Restore selalu aditif
Tidak ada yang diubah atau ditimpa; restore hanya menambah baris dan file. ULID asli dipakai ulang
jika masih bebas, jika tidak dibuat ULID baru dan setiap referensi dipetakan ulang. Tanpa
`profile_remap`, arsip profil selalu masuk ke profil **baru** (memakai ULID dan nama asli bila
keduanya masih bebas), sehingga me-restore arsip yang sama dua kali menghasilkan dua profil: berisik,
tetapi tidak pernah merusak. Tidak ada mode "replace".
:::


Evolusi skema untuk tabel yang disentuh backup (`profile_backups.scope`, tabel sinkronisasi, dan
sejenisnya) ditangani oleh skrip migrasi di
[Cadangan dan Pemulihan § Skrip Migrasi
Skema](/id/development/backup-and-restore#script-migrasi-skema), bukan oleh apa pun pada tab
ini: skrip itu berjalan langsung terhadap basis data dan di luar cakupan untuk `BackupsPanel.tsx`.

## Terkait

- [Kontrak Pesan: HTTP API § Admin API](/id/development/message-contracts/http-api#admin-api): `GET /admin/api/backups`, `POST /admin/api/profiles/:id/backups`, `GET /admin/api/backups/:id/download`, `POST /admin/api/backups/upload`, `POST /admin/api/backups/:id/plan`, `POST /admin/api/backups/:id/restore`, `DELETE /admin/api/backups/:id`.
- [Ikhtisar](/id/development/webui/admin-console/overview): shell lima-tab, peran admin vs superadmin, dan menu akun.
- [Operator](/id/development/webui/admin-console/operators): mendaftarkan, mencari, menangguhkan/mengaktifkan kembali, dan mereset kata sandi akun operator.
- [Unit](/id/development/webui/admin-console/units): titik masuk backup bercakupan-unit yang dicapai dari tampilan Unit Terdaftar.
- [Penyewaan](/id/development/webui/admin-console/rentals): pintasan backup satu-klik ke tab ini, dan profil yang dimiliki arsip ini.
- [Integrasi ROS](/id/development/webui/admin-console/ros-integration): cara aksi admin menjangkau robot dan kontainer unit.
- [Arsitektur](/id/development/architecture): struktur sistem tingkat tinggi dan model dua-mesin.
- [Skema Basis Data](/id/development/database-schema): referensi skema lengkap, termasuk `profile_backups`.
- [Siklus Hidup Kontainer Unit](/id/development/unit-container-lifecycle): referensi mandiri untuk `unit_manager.js` dan unit relay.
- [Cadangan, Pemulihan, dan Migrasi Data](/id/development/backup-and-restore): referensi lengkap yang menjadi dasar tab ini.
