---
search: false
---

# Konsol Admin

<RoleBadge role="admin" />

Konsol Admin hanya terlihat untuk akun dengan akses **Administrator**. Digunakan untuk mengelola operator, robot, dan profil penyewaan di semua unit Anda.

## Operator

1. Buka **Admin Console → Operators**.
2. Di sini Anda bisa melihat semua akun operator, mengundang yang baru, dan menyesuaikan peran atau penyewaan mana yang bisa mereka akses.
3. Untuk mencabut akses, klik **Remove** di samping nama operator.

## Unit

Tab **Units** memiliki dua tampilan: **Unit Terdaftar** (semua robot yang sudah terdaftar) dan **Pending** (robot baru yang menunggu persetujuan).

- Robot yang benar-benar baru muncul dulu di **Pending**. Administrator meninjaunya di sana dan klik **Register** (atau **Adopt**) untuk mendaftarkannya sebagai unit. Registrasi saja tidak memberi akses ke siapa pun: siapa yang boleh mengendarainya ditentukan oleh penetapan penyewaannya.
- Tampilan **Unit Terdaftar** mendaftar semua robot terdaftar: penyewaan mana yang menyewanya, jumlah operator dan peta, kapan didaftarkan, dan aksi per-unit (Rename, Move data, Backup, Swap, Clear data, Unbind, Delete).
- **Unit Status** diperiksa langsung setiap beberapa detik, dengan cara yang sama seperti tabel unit milik operator. **On** menunjukkan apa yang sedang dilakukan robot (**Ready**, **In use by** seorang operator, atau **Starting up**) dan waktu ping-nya dalam milidetik. **Off** berarti robot tidak menjawab: mati atau tidak punya koneksi internet. Arahkan kursor ke status untuk melihat baterai dan berapa lama robot sudah menyala.
- Operator melihat robot yang sama di tabel unit tepat setelah login: pilih baris berstatus **Ready** dan klik **Start** untuk terhubung.

## Penyewaan (Rental)

**Penyewaan** mengelompokkan peta, rute, dan operator yang terkait dengan lokasi atau kontrak tertentu.

1. Buka **Rentals** untuk melihat semua profil penyewaan aktif.
2. Buat profil penyewaan baru untuk mendirikan lokasi baru, lalu tetapkan robot dan operator ke dalamnya.
3. Gunakan **Backup** pada suatu penyewaan untuk mengarsipkan semua peta dan rutenya: berguna sebelum melakukan perubahan besar atau mengakhiri kontrak.

## Backup

1. Buka **Admin Console → Backups**.
2. Pilih untuk mencadangkan seluruh **penyewaan** atau data dari satu **unit** saja.
3. Klik **Create Backup**: ini akan mengunduh atau menyimpan arsip yang bisa dipulihkan nanti jika diperlukan.
4. Untuk memulihkan, pilih file backup dan klik **Restore**. Pemulihan menambahkan data kembali; tidak akan menimpa peta yang sudah ada dengan nama berbeda.

## Kesehatan Sistem

**System Health** menunjukkan apakah sisi server berfungsi. Semua admin bisa membukanya; tab ini tidak mengubah apa pun.

- **Services**: database, backend, MQTT broker yang membawa pesan robot, live link (peta live dan posisi robot), dashboard web, media server (file peta) dan camera signalling. Masing-masing menyebut fungsinya dan apakah berfungsi.
- **SSL certificates**: sertifikat website (HTTPS) dan sertifikat MQTT broker, dengan sisa hari, kapan terakhir diperbarui dan kapan certbot memperbaruinya lagi. Robot menolak broker begitu sertifikatnya kedaluwarsa, meskipun website masih berfungsi.
- **Connections and ports**: setiap port yang dipakai server, apakah menjawab, dan seberapa cepat.

Status bisa **Working**, **Needs attention** (segera tangani), **Not working** (operator kemungkinan terdampak) atau **Not used**. Bila perlu tindakan, catatan singkat di bawahnya menyebut apa yang harus dilakukan. **Details** berisi fakta teknis untuk diteruskan ke pengelola server. Halaman memeriksa ulang setiap 30 detik; **Check now** memeriksa saat itu juga.

## Admin (Khusus Superadmin)

Jika akun Anda memiliki hak superadmin, tab **Admins** memungkinkan Anda mempromosikan operator lain menjadi administrator, atau mencabut akses tersebut.

## Pemecahan Masalah

**Saya tidak melihat Konsol Admin**
: Akun Anda ditetapkan sebagai Operator, bukan Administrator. Minta administrator yang ada untuk menaikkan peran Anda.

**Robot terlihat Off padahal menyala**
: Off berarti robot tidak menjawab server sekitar 12 detik. Periksa koneksi internetnya. Bila semua robot terlihat Off, buka **System Health**: penyebab umumnya MQTT broker atau sertifikatnya.

**System Health menyebut sertifikat MQTT broker perlu perhatian**
: Sertifikat website sudah diperbarui tetapi broker masih memakai yang lama. Minta pengelola server membangun ulang sertifikat broker (lihat [Pemeliharaan § Sertifikat](/id/setup/maintenance#sertifikat)) sebelum tanggal yang tertera, atau robot tidak bisa terhubung lagi.

**Sebuah robot menghilang dari daftar Unit**
: Mungkin telah dipindahkan ke penyewaan lain, atau sedang offline sementara. Periksa status terakhir terlihatnya.

**Memulihkan backup tidak mengembalikan data robot yang sudah dihapus**
: Jika robot asli sudah tidak ada, proses pemulihan akan meminta Anda memetakan ulang data ke unit yang berbeda: ikuti petunjuk di console untuk menyelesaikan proses pemindahan.
