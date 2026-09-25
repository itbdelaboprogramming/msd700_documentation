---
outline: deep
search: false
---

# Konsol Admin: Operator

<RoleBadge role="developer" />

Tab Operator (`UsersPanel.tsx`) adalah tempat admin mengelola `users`: akun yang login di
[login operator](/id/development/webui/accounts/overview#login-operator) dan mengemudikan robot.
Untuk shell tab dan peran yang dapat mengaksesnya, lihat
[Ikhtisar](/id/development/webui/admin-console/overview); untuk cara operator mendapatkan akses
ke robot sungguhan setelah akun ada, lihat [Penyewaan](/id/development/webui/admin-console/rentals).

## Apa yang dilakukan tab ini

- **Mendaftarkan** akun operator baru.
- **Mencari / mendaftar** akun operator.
- **Menangguhkan / mengaktifkan kembali** akun operator.
- **Mereset** kata sandi operator.

Tidak ada hapus. Menghapus akun operator sepenuhnya sengaja tidak ditawarkan di mana pun pada tab
ini: peta, rute, area, dan playlist milik seorang operator sering dibagikan dengan operator lain
pada profil penyewaan dan unit yang sama, dan menghapus akun tersebut akan mem-cascade-hancurkan
data itu dari bawah orang-orang yang masih mengandalkannya. Menangguhkan akun, bukan
menghapusnya, adalah satu-satunya cara untuk mematikan operator yang seharusnya tidak lagi
menggunakan sistem.

## Tangguhkan / aktifkan kembali

`PATCH /admin/api/users/:id/status` menulis `users.status` (`active` atau `suspended`), sesuai
[Skema Basis Data § Identitas dan akses](/id/development/database-schema#identitas-dan-akses).

::: warning Penangguhan tertulis, tapi belum ditegakkan saat login
`/user/login` tidak membaca `users.status`. Sesi yang ada milik operator yang ditangguhkan tetap
berfungsi, dan mereka masih bisa login kembali. Ini adalah celah yang diketahui dan masih ada saat
ini, bukan kehalusan UI: konsol itu sendiri menampilkannya secara langsung lewat `NotYetWiredNote`
di sebelah kontrolnya, alih-alih menyiratkan bahwa tombol tangguhkan sudah mengunci akun. Keduanya
dijaga tetap terpisah dengan sengaja agar penerapan konsol admin tidak akan pernah, dengan
sendirinya, mengunci sebuah deployment yang hidup dari robot-robotnya sendiri; menegakkan
penangguhan pada batas login adalah pekerjaan lain yang belum selesai.
:::

Ini adalah mekanisme yang berbeda dari menangguhkan sebuah *profil penyewaan*, yang segera
menghilangkan sebuah unit dan datanya dari tampilan setiap anggota meskipun akun anggota itu
sendiri tetap aktif dan dapat login: lihat [Penyewaan](/id/development/webui/admin-console/rentals)
dan [Skema Basis Data § Identitas dan akses](/id/development/database-schema#identitas-dan-akses)
untuk perbedaan itu. Jika tujuannya adalah benar-benar memutus seorang operator dari sebuah robot
hari ini, menangguhkan keanggotaan profil atau penugasan unit adalah tuas yang bekerja;
menangguhkan akun operator itu sendiri untuk saat ini adalah aksi pencatatan saja.

## Reset kata sandi

Mereset kata sandi seorang operator ke nilai baru yang ditetapkan oleh admin. Ini terpisah dari
alur ganti-kata-sandi-sendiri yang dapat dipicu oleh operator atau admin untuk akun mereka sendiri
(lihat [Ikhtisar § Menu akun](/id/development/webui/admin-console/overview#menu-akun)); di sini,
seorang admin menetapkan kata sandi pada akun orang lain, bukan akunnya sendiri.

## Terkait

- [Ikhtisar](/id/development/webui/admin-console/overview): shell lima-tab, peran admin vs superadmin, dan menu akun.
- [Unit & Armada](/id/development/webui/admin-console/units-and-fleet): sub-tampilan Armada dan Tertunda di atas daftar robot.
- [Penyewaan](/id/development/webui/admin-console/rentals): tempat sebuah akun operator sungguhan mendapatkan akses ke robot.
- [Cadangan](/id/development/webui/admin-console/backups): mengarsipkan dan memulihkan profil penyewaan secara utuh.
- [Integrasi ROS](/id/development/webui/admin-console/ros-integration): cara aksi admin menjangkau robot dan armada kontainer.
- [Arsitektur](/id/development/architecture): struktur sistem tingkat tinggi dan model dua-mesin.
- [Skema Basis Data](/id/development/database-schema): referensi skema lengkap, termasuk catatan `users.status`.
- [Siklus Hidup Kontainer Unit](/id/development/unit-container-lifecycle): referensi mandiri untuk `unit_manager.js` dan relay armada.
- [Cadangan, Pemulihan, dan Migrasi Data](/id/development/backup-and-restore): referensi mandiri untuk format arsip dan operasi REST.
