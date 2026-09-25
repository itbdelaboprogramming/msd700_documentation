---
search: false
---

# Pemetaan

<RoleBadge role="user" />

Sebelum robot bisa bernavigasi di suatu ruangan, robot membutuhkan **peta** dari ruangan tersebut. Pemetaan adalah proses mengemudikan robot berkeliling agar ia dapat membangun peta tersebut secara otomatis.

## Memulai Peta Baru

1. Bawa robot ke posisi pengisian daya atau parkir yang dituju terlebih dahulu: di mana pun robot berdiri saat Anda klik Play, itu akan menjadi **home base** peta ini, dipakai nanti untuk mengirimnya kembali ke sana secara otomatis.
2. Dari menu utama, pilih **Mapping**.
3. Klik **Create a New Map** dan beri nama (contoh: "Lantai 2 Gudang").
4. Klik **Play** untuk mulai merekam.

## Membangun Peta

Anda bisa membangun peta dengan dua cara:

- **Kemudikan secara manual**: Gunakan tombol **W A S D** (tahan **Shift** untuk mode lambat `0.20 m/s`) untuk mengemudikan robot perlahan mengelilingi seluruh area, termasuk sudut dan jalan buntu, agar tidak ada yang terlewat.
- **Eksplorasi otonom**: Nyalakan toggle **Autopilot** di panel Robot Control dan robot akan menjelajahi area secara mandiri, mundur otomatis jika merasa terjebak di sudut. (Manual Override harus dalam keadaan mati: mengemudikan sendiri selalu diprioritaskan.)

Saat Anda mengemudikan, peta akan terisi secara real-time di halaman: dinding dan rintangan muncul sebagai garis gelap, lantai terbuka muncul dengan warna lebih terang.

## Menjeda dan Meninjau

- Klik **Pause** kapan saja untuk berhenti merekam dan memeriksa peta sejauh ini.
- Klik **Play** lagi untuk melanjutkan dari titik terakhir: tidak ada yang hilang.
- Kemudikan kembali ke area tertentu jika bagian itu terlihat belum lengkap atau kurang jelas.

## Menyimpan Peta

1. Setelah seluruh area tercakup, klik **Stop**.
2. Konfirmasi nama peta dan klik **Save**.
3. Peta yang selesai (grid, thumbnail, dan posisi homebase) akan muncul di [Peta & Database](/id/user-guide/database), siap digunakan untuk [Navigasi](/id/user-guide/navigation).

::: warning Jangan tutup browser saat masih merekam
Menutup tab saat Play masih aktif dapat menghilangkan progres yang belum tersimpan. Selalu klik Stop dan Simpan terlebih dahulu.
:::

## Tips untuk Peta yang Baik

- Kemudikan dengan kecepatan sedang dan stabil: terlalu cepat dapat mengaburkan pembacaan sensor.
- Cakup setiap ruangan, koridor, dan pintu yang akan Anda lalui saat navigasi nanti.
- Hindari permukaan yang sangat reflektif atau kaca jika memungkinkan; ini dapat membingungkan sensor laser.
- Jika sebuah ruangan terlihat tidak rapi atau tidak sejajar setelahnya, biasanya lebih cepat merekam ulang bagian tersebut daripada mencoba memperbaikinya secara manual.

## Pemecahan Masalah

**Peta terlihat terdistorsi atau dinding tidak sejajar**
: Robot mungkin bergerak terlalu cepat, atau roda selip di suatu permukaan. Jeda, kembali ke bagian terakhir yang baik, dan lanjutkan lebih perlahan.

**Robot berhenti bergerak saat Autopilot berjalan**
: Robot mungkin menganggap area sudah sepenuhnya dijelajahi, atau terjebak dekat rintangan. Nyalakan Manual Override untuk menyelesaikan sudut yang terlewat.

**Tombol "Save" berwarna abu-abu (tidak bisa diklik)**
: Pastikan perekaman sudah dihentikan (bukan hanya dijeda) dan peta sudah diberi nama.

**Lupa memulai dari posisi pengisian daya**
: Home base diambil dari posisi robot saat Anda klik Play. Anda tidak perlu merekam ulang: buka peta di [Navigasi](/id/user-guide/navigation), kemudikan robot ke posisi yang benar, lalu gunakan **Set Home Base** pada toolbar untuk memperbaruinya.
