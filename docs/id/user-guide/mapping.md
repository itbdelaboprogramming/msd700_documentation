---
search: false
---

# Pemetaan

<RoleBadge role="user" />

Sebelum robot bisa bernavigasi di suatu ruangan, robot membutuhkan **peta** dari ruangan tersebut. Pemetaan adalah proses mengendarai robot berkeliling agar ia dapat membangun peta tersebut secara otomatis.

## Memulai Peta Baru

1. Dari menu utama, pilih **Pemetaan**.
2. Klik **Peta Baru** dan beri nama (contoh: "Lantai 2 Gudang").
3. Klik **Play** untuk mulai merekam.

## Membangun Peta

Anda bisa membangun peta dengan dua cara:

- **Kendarai secara manual**: Gunakan joystick atau tombol **W A S D** untuk mengendarai robot perlahan mengelilingi seluruh area, termasuk sudut dan jalan buntu, agar tidak ada yang terlewat.
- **Eksplorasi otonom**: Klik **Auto Explore** dan robot akan menjelajahi area secara mandiri, mundur otomatis jika merasa terjebak di sudut.

Saat Anda mengendarai, peta akan terisi di layar secara real-time: dinding dan rintangan muncul sebagai garis gelap, lantai terbuka muncul dengan warna lebih terang.

## Menjeda dan Meninjau

- Klik **Pause** kapan saja untuk berhenti merekam dan memeriksa peta sejauh ini.
- Klik **Play** lagi untuk melanjutkan dari titik terakhir: tidak ada yang hilang.
- Kendarai kembali ke area tertentu jika bagian itu terlihat belum lengkap atau kurang jelas.

## Menyimpan Peta

1. Setelah seluruh area tercakup, klik **Stop**.
2. Konfirmasi nama peta dan klik **Simpan**.
3. Peta yang selesai akan muncul di [Peta & Database](/id/user-guide/database), siap digunakan untuk [Navigasi](/id/user-guide/navigation).

::: warning Jangan tutup browser saat masih merekam
Menutup tab saat Play masih aktif dapat menghilangkan progres yang belum tersimpan. Selalu klik Stop dan Simpan terlebih dahulu.
:::

## Tips untuk Peta yang Baik

- Kendarai dengan kecepatan sedang dan stabil: terlalu cepat dapat mengaburkan pembacaan sensor.
- Cakup setiap ruangan, koridor, dan pintu yang akan Anda lalui saat navigasi nanti.
- Hindari permukaan yang sangat reflektif atau kaca jika memungkinkan; ini dapat membingungkan sensor LiDAR.
- Jika sebuah ruangan terlihat tidak rapi atau tidak sejajar setelahnya, biasanya lebih cepat merekam ulang bagian tersebut daripada mencoba memperbaikinya secara manual.

## Pemecahan Masalah

**Peta terlihat terdistorsi atau dinding tidak sejajar**
: Robot mungkin bergerak terlalu cepat, atau roda selip di suatu permukaan. Jeda, kembali ke bagian terakhir yang baik, dan lanjutkan lebih perlahan.

**Robot berhenti bergerak saat Auto Explore**
: Robot mungkin menganggap area sudah sepenuhnya dijelajahi, atau terjebak dekat rintangan. Beralih ke kendali manual untuk menyelesaikan sudut yang terlewat.

**Tombol "Simpan" berwarna abu-abu (tidak bisa diklik)**
: Pastikan perekaman sudah dihentikan (bukan hanya dijeda) dan peta sudah diberi nama.
