---
outline: deep
search: false
---

# Konsol Admin

<RoleBadge role="developer" />

Sisi back-office dari MSD700, dicapai lewat [login admin](/id/development/webui/accounts/overview#admin-login-admin)
terpisah yang dijelaskan di Akun & Akses: sebuah shell lima-tab (`admin/dashboard.tsx`, satu
komponen `*Panel.tsx` per tab di bawah `src/components/admin/`) untuk staf yang menjalankan seluruh
armada alih-alih mengemudikan satu robot. Halaman ini memperkenalkan shell itu sendiri, dua peran
admin yang dilayaninya, dan menu akun yang dipakai bersama di setiap tab. Setiap tab punya
halamannya sendiri: [Operator](/id/development/webui/admin-console/operators),
[Unit & Armada](/id/development/webui/admin-console/units-and-fleet),
[Penyewaan](/id/development/webui/admin-console/rentals), dan
[Cadangan](/id/development/webui/admin-console/backups). Yang menghubungkan aksi konsol kembali
ke robot dan armada kontainer di bawahnya adalah
[Integrasi ROS](/id/development/webui/admin-console/ros-integration).

## Lima tab

| Tab | Komponen | Terlihat oleh | Mengelola |
| --- | --- | --- | --- |
| Operator | `UsersPanel.tsx` | admin, superadmin | `users`: akun yang login dan mengemudikan robot |
| Unit | `UnitsPanel.tsx` | admin, superadmin | `units`: robot fisik mana saja yang ada, armada dan tertunda |
| Penyewaan | `ProfilesPanel.tsx` | admin, superadmin | `rental_profiles`: sebuah unit disewakan kepada siapa |
| Cadangan | `BackupsPanel.tsx` | admin, superadmin | Arsip profil penyewaan secara utuh |
| Admin | `AdminsPanel.tsx` | superadmin saja | `admin_accounts`: staf back-office itu sendiri |

Empat tab pertama mengelola armada yang *menghadap-operator*: orang yang mengemudi, robot yang
mereka kemudikan, dan hubungan penyewaan yang menghubungkan keduanya. Tab kelima mengelola operator
konsol itu sendiri. Ketidaksimetrisan itu disengaja, bukan kelalaian: seorang admin dapat melakukan
semua yang dibutuhkan untuk menjalankan penyewa dan robot sehari-hari tanpa pernah bisa membuat
atau menghapus akun back-office lain.

## Dua peran admin, ditegakkan di kedua sisi

`admin_accounts.role` adalah salah satu dari `admin` atau `superadmin` (lihat
[Skema Basis Data § Identitas dan akses](/id/development/database-schema#identity-and-access)). Tab
Admin tidak sekadar disembunyikan secara visual untuk `admin` biasa; ia dihilangkan sepenuhnya dari
daftar tab, dan aksi yang diekspos juga dijaga di sisi server.

::: warning Tab Admin adalah kemudahan UI, bukan batas keamanan
Menyembunyikan tab untuk `admin` biasa mencegah tab itu diklik; itu bukan yang sebenarnya
menghentikan aksinya. Pemeriksaan sisi-server yang sesuailah yang menegakkan aturan
khusus-superadmin, sama seperti `admin_accounts` yang dijaga sebagai tabel yang sepenuhnya
terpisah dari `users` alih-alih flag peran pada satu tabel bersama (lihat
[Akun & Akses § Akun operator dan akun admin adalah sistem
terpisah](/id/development/webui/accounts/overview#operator-accounts-and-admin-accounts-are-separate-systems)).
Seorang admin biasa yang mengetuk aksi tab Admin secara langsung, melewati UI, diharapkan ditolak
oleh backend, bukan hanya dicegah melihat tombolnya.
:::

## Tiga ruang identitas, tiga tab

Konsol ini menjaga tiga pertanyaan agar sengaja terpisah, masing-masing dengan tab dan tabelnya
sendiri:

- **Siapa yang bisa mengemudi sama sekali** — akun operator, dikelola di
  [Operator](/id/development/webui/admin-console/operators).
- **Robot apa saja yang ada** — baris unit, dikelola di
  [Unit & Armada](/id/development/webui/admin-console/units-and-fleet).
- **Siapa menyewa robot mana** — profil penyewaan dan penugasannya, dikelola di
  [Penyewaan](/id/development/webui/admin-console/rentals).

Membuat akun operator tidak memberikan akses apa pun dengan sendirinya, dan mendaftarkan sebuah
unit juga tidak memberi siapa pun kemampuan untuk mengemudikannya: keduanya baru bermakna begitu
profil penyewaan menghubungkan mereka, dengan menjadikan operator sebagai anggota dan unit sebagai
penugasan. Lihat [Unit & Armada](/id/development/webui/admin-console/units-and-fleet) dan
[Penyewaan](/id/development/webui/admin-console/rentals) untuk cara kerja setiap sisi hubungan itu.

## Tab Admin (superadmin saja)

`AdminsPanel.tsx` mengelola tabel `admin_accounts` secara langsung, dan merupakan satu-satunya tab
yang tidak pernah dilihat oleh `admin` biasa:

- **Buat** akun admin back-office, memilih perannya (`admin` atau `superadmin`).
- **Tangguhkan / aktifkan kembali** akun admin.
- **Reset** kata sandi seorang admin.
- **Hapus** akun admin.

Berbeda dari akun operator (lihat [Operator](/id/development/webui/admin-console/operators)), akun
admin dapat dihapus sepenuhnya. Tidak ada apa pun dalam skema yang bergantung pada
`admin_accounts` sebagaimana peta, rute, area, dan playlist milik operator bergantung pada `users`:
stempel `created_by` / `modified_by` milik seorang admin pada `rental_profiles`, `units`,
`profile_backups`, `pending_units`, dan `unit_enrollment_codes` hanya untuk atribusi, sehingga
menghapus akun tidak membuat yatim atau menghancurkan apa pun yang disentuhnya (lihat
[Skema Basis Data § Foreign key, lengkap](/id/development/database-schema#foreign-keys-in-full)).

## Menu akun

`AccountMenu.tsx` berada di header dan tersedia bagi setiap admin yang sudah masuk, biasa maupun
superadmin. Ia dicakup hanya untuk identitas admin yang sedang masuk itu sendiri, tidak pernah
akun lain, dan mencakup tiga hal:

- Melihat identitas admin yang sedang masuk itu sendiri (nama pengguna, peran).
- Menyunting profil admin itu sendiri (nama pengguna, nama lengkap).
- Berpindah ke layar ganti-kata-sandi-sendiri, mode sukarela yang sama seperti yang dijelaskan di
  [Akun & Akses § Ganti kata sandi admin](/id/development/webui/accounts/overview#admin-change-password-admin-change-password).

Mereset kata sandi akun *lain* adalah aksi terpisah, khusus per tab — tab Admin di atas untuk
sesama akun back-office, [Operator](/id/development/webui/admin-console/operators) untuk akun
operator — bukan sesuatu yang dapat dicapai dari menu ini.

## Terkait

- [Operator](/id/development/webui/admin-console/operators): mendaftarkan, mencari, menangguhkan/mengaktifkan kembali, dan mereset kata sandi akun operator.
- [Unit & Armada](/id/development/webui/admin-console/units-and-fleet): sub-tampilan Armada dan Tertunda di atas daftar robot.
- [Penyewaan](/id/development/webui/admin-console/rentals): CRUD profil penyewaan, keanggotaan, dan penugasan unit.
- [Cadangan](/id/development/webui/admin-console/backups): mengarsipkan dan memulihkan profil penyewaan secara utuh.
- [Integrasi ROS](/id/development/webui/admin-console/ros-integration): cara aksi-aksi ini menjangkau robot dan armada kontainer.
- [Arsitektur](/id/development/architecture): struktur sistem tingkat tinggi dan model dua-mesin.
- [Skema Basis Data](/id/development/database-schema): referensi skema lengkap di balik setiap tab.
- [Siklus Hidup Kontainer Unit](/id/development/unit-container-lifecycle): referensi mandiri untuk `unit_manager.js` dan relay armada.
- [Cadangan, Pemulihan, dan Migrasi Data](/id/development/backup-and-restore): referensi mandiri untuk format arsip dan operasi REST.
