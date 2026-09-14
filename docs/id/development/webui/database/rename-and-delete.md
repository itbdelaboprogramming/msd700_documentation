---
outline: deep
search: false
---

# Ganti Nama & Hapus

<RoleBadge role="developer" />

Dua aksi pengubah yang tersedia langsung dari layar Basis Data (`DatabaseComponent.tsx`): mengganti
nama sebuah peta di tempat, dan menghapusnya. Untuk cara daftar peta itu sendiri berperilaku, lihat
[Ikhtisar](/id/development/webui/database/overview); untuk skema dan endpoint yang disentuh aksi
ini, lihat [Integrasi ROS](/id/development/webui/database/ros-integration).

## Ganti nama inline

Klik dua kali pada nama peta di tabel membukanya untuk penyuntingan inline, yang memanggil
`updateMapName` (`services.ts`) saat dikonfirmasi.

Nama duplikat ditolak sepenuhnya, bukan diterima secara diam-diam. Ini berbeda dari perilaku ganti
nama yang dipakai di tempat lain pada dashboard untuk rute, area, dan playlist, yang malah
auto-suffix nama duplikat alih-alih menolaknya. Peta dicakup ke `(unit_id, profile_id)` dalam
skema (lihat [Integrasi ROS § Tabel](/id/development/webui/database/ros-integration#tables)),
sehingga duplikat yang ditolak di sini lebih mungkin merupakan kesalahan penamaan sungguhan
ketimbang tabrakan alami.

::: info Belum terdokumentasi di Referensi API
[Referensi API § Manajemen Data Peta dan Rute](/id/development/api-reference#map-and-route-data-management)
saat ini mencakup pendaftaran peta tetapi bukan endpoint ganti nama itu sendiri. Perilaku di atas
dikonfirmasi terhadap komponen frontend (`updateMapName` di `services.ts`); metode HTTP dan path
yang persis tidak tercakup dalam Referensi API saat ini dan tidak ditebak-tebak di sini.
:::

## Cascade delete

Menghapus sebuah peta melewati dialog konfirmasi `ConfirmDelete` sebelum apa pun dikirim.
Mengonfirmasi akan menghapus baris peta dan, sesuai foreign key pada `maps_data`, mem-cascade ke
setiap rute, area, dan playlist yang menyertainya, ditambah berkas tersimpan milik peta tersebut.
Lihat [Integrasi ROS § Foreign key](/id/development/webui/database/ros-integration#foreign-keys)
untuk tabel mana yang cascade dan mana yang hanya dinolkan.

Tidak ada undo. Karena rute, area, dan playlist tidak didaftar secara terpisah di layar ini (lihat
[Ikhtisar § Cakupan](/id/development/webui/database/overview#scope)), operator yang menghapus
sebuah peta tidak diperlihatkan daftar terperinci hal-hal yang akan ikut terbawa selain prompt
konfirmasi itu sendiri.

## Pengaman konflik sesi

Membuka sebuah peta (lihat
[Ikhtisar § Membuka peta ke Navigasi](/id/development/webui/database/overview#opening-a-map-into-navigation))
sementara sesi pemetaan sedang berjalan atau dijeda pada unit ditangani berbeda tergantung peta
mana yang dibuka:

- Membuka peta yang sedang direkam saat ini berjalan seperti biasa.
- Membuka peta yang *berbeda* memunculkan `ConfirmSaving` dan `MapSaving`, memberi operator
  pilihan alih-alih diam-diam membuang peta yang sedang berjalan itu:
  - **Simpan**: peta yang sedang berjalan disimpan sebelum peta baru dimuat. Ini mengikuti jalur
    stop-and-save yang sama seperti yang terdokumentasi di
    [Referensi API § Hentikan Pemetaan dan Simpan Peta](/id/development/api-reference#_2-stop-mapping-and-save-map)
    (`POST /api/mapping/stop`).
  - **Buang**: peta yang sedang berjalan dibuang tanpa disimpan.
  - **Batal**: operator tetap berada di peta saat ini dan sesi pemetaan berlanjut tanpa perubahan.

Referensi API saat ini mendokumentasikan jalur simpan (`POST /api/mapping/stop`) tetapi bukan
endpoint terpisah untuk buang; detail itu tidak tercakup dalam materi sumber dan tidak ditebak-tebak
di sini.

## Terkait

- [Ikhtisar](/id/development/webui/database/overview): daftar peta, pencarian/urutan/paginasi, dan keadaan yang menjadi dasar fitur ini
- [Integrasi ROS](/id/development/webui/database/ros-integration): skema dan endpoint REST di balik aksi-aksi ini
- [Arsitektur](/id/development/architecture)
- [Skema Basis Data](/id/development/database-schema): referensi skema lengkap untuk `ROS_DB`
