---
search: false
---

# Ponsel & Tablet

<RoleBadge role="user" />

Dashboard operator juga berjalan di ponsel dan tablet, dengan tata letak sentuh tersendiri. Halamannya sama (Navigasi, Pemetaan, Database) dan cara berkomunikasi dengan robot persis sama seperti di desktop; yang berbeda hanya susunan di halaman. Pengecualiannya adalah [Konsol Admin](/id/user-guide/admin-console): konsol ini tetap membutuhkan desktop atau laptop.

## Tata Letak yang Anda Dapatkan {#layouts}

Dashboard memilih tata letak berdasarkan perangkat, bukan ukuran jendela:

| Perangkat | Tata letak | Orientasi |
| --- | --- | --- |
| Desktop atau laptop, termasuk laptop layar sentuh | Tata letak desktop | Jendela minimal 1400 x 720 |
| Ponsel (sisi pendek layar kurang dari 600 px) | Tata letak ponsel | Hanya portrait (tegak) |
| Tablet | Tata letak tablet | Portrait atau landscape |

Jika ponsel dipegang menyamping, pemberitahuan **Turn your phone upright** menutupi halaman. Halaman tetap termuat di bawahnya: apa pun yang sedang dikerjakan robot tetap berjalan, dan pemberitahuan hilang begitu ponsel ditegakkan kembali. Memutar tablet menyusun ulang halaman tanpa memuat ulang peta atau kamera.

## Login {#logging-in}

Di ponsel, halaman login menampilkan satu kartu dalam satu waktu: pertama formulir login, lalu daftar unit. **Change account** di daftar unit menampilkan kembali formulir login. Tombol bulat **Documents** di kiri bawah membuka dokumen operator yang sama dengan tautan di footer desktop.

## Tata Letak Ponsel {#phone-layout}

Dari atas ke bawah:

1. **Header**: nama Anda dan unit, serta tombol tutup.
2. **Baris halaman**: halaman saat ini (ketuk untuk membuka menu) serta indikator LiDAR dan koneksi.
3. **Peta**, atau daftar peta di halaman Database.
4. **Panel kamera** (Navigasi dan Pemetaan).
5. **Bilah bawah**: **Menu**, **Camera** (tampilkan atau sembunyikan panel kamera), **Instructions**, dan di Database **Sort maps**.

Tombol **Menu** membuka sheet berisi tiga halaman dan, di Navigasi dan Pemetaan, panel **Robot Control** (Manual Override dan Autopilot). Pada kunjungan pertama, sebuah petunjuk menunjuk ke tombol Menu, karena hanya lewat tombol itu Anda bisa berpindah halaman di ponsel.

## Tata Letak Tablet {#tablet-layout}

Tablet punya ruang lebih, jadi tidak ada yang disembunyikan di menu:

- Tiga halaman menjadi tab di bawah header, dan status robot ada di header.
- Kamera dan **Robot Control** berada di samping peta: dalam kolom di kiri saat landscape, dalam baris di bawah peta saat portrait.

## Kontrol di Peta {#controls-on-the-map}

Peta menerima gestur yang sama seperti di laptop layar sentuh (cubit untuk zoom, dua jari untuk menggeser, sentuh dan drag untuk menaruh pin, ketuk dua kali untuk menghapusnya; lihat [Menggeser dan Memperbesar Peta](/id/user-guide/navigation#moving-around-the-map)). Tombol di atasnya lebih kecil daripada di desktop:

- **Minus / Plus** (kiri atas) menyembunyikan semua tombol peta agar seluruh peta terlihat, lalu menampilkannya lagi.
- **Dots** di bawahnya membuka **Zoom in**, **Zoom out**, **Fit the map**, dan **Rotate the map**.
- **Play**, **Pause**, dan **Return Home** (Navigasi), atau **Play**, **Pause**, dan **Stop** (Pemetaan), berupa tombol bulat di sepanjang bagian atas. **Focus View** ada di kanan atas.
- **Mode List** awalnya terlipat; ketuk untuk membukanya. Tombol yang ditambahkan suatu mode (Save Route, Load Route, Round Trip, Auto Align, opsi coverage, dan sebagainya) muncul sebagai tombol bulat dengan keterangan singkat di samping Mode List.
- **Tombol berhenti darurat** ada di sudut kiri bawah peta dan selalu terlihat. Di ponsel, status robot ada tepat di bawahnya; di tablet status ada di header.
- Petunjuk seperti "place a pinpoint" muncul sebagai strip di atas footer peta. Ketuk **x** untuk menutupnya.

Layar sentuh tidak punya tooltip hover, jadi penjelasan muncul sebagai kartu. Saat pertama kali memilih **Multiple Pinpoints** dalam satu sesi, sebuah kartu menjelaskan Save Route, Load Route, Round Trip, dan Loop Route. Coverage, Map Sync, dan hasil Auto Align juga memakai kartu. Ketuk di luar kartu untuk menutupnya.

## Kamera dan Ikhtisar Peta {#camera-panel}

Di Navigasi, sakelar kecil di kiri bawah panel kamera berpindah antara **Camera** dan ikhtisar peta (**Preview**), yang di desktop tampil di sudut peta. Keduanya tetap berjalan saat tersembunyi, jadi beralih kembali terjadi seketika. Tombol **Camera** di bilah bawah menyembunyikan seluruh panel agar peta mendapat ruang lebih.

## Mengemudi dengan Joystick {#driving-with-the-joystick}

Perangkat sentuh tidak punya keyboard, jadi **Manual Override** dikemudikan dengan joystick di layar, bukan tombol W A S D:

1. Buka **Robot Control** (lewat Menu di ponsel; di samping peta di tablet) dan nyalakan **Manual Override**.
2. Di ponsel, tutup menu. Joystick ada di samping kamera, dengan sakelar kecil **Manual** dan **Autopilot** di atasnya, sehingga Anda bisa berhenti mengemudi tanpa membuka menu lagi.
   Di tablet, joystick mengambang di tepi kanan. Pegangannya menggeser joystick keluar dari tampilan dan kembali.
3. Drag kenopnya. Makin jauh didorong, makin cepat robot berjalan, hingga kecepatan normal (`0.40 m/s` maju, sama dengan tombol W). Kiri dan kanan memutar robot.
4. Angkat jari Anda dan robot langsung berhenti.

Robot juga berhenti saat Anda mematikan Manual Override, meninggalkan halaman, menyembunyikan joystick saat sedang mengemudi, atau berpindah ke aplikasi lain. Tidak ada tombol mode lambat: dorong kenop hanya sebagian untuk gerakan pelan dan presisi.

## Peta di Halaman Database {#database}

Daftar di ponsel hanya menampilkan nomor, nama peta, dan tanggal diubah. Ketuk sebuah baris untuk membuka sheet berisi pratinjau peta, siapa yang terakhir mengubahnya, dan ukurannya, serta **Rename**, **Delete**, dan **Go to the Map**. **Sort maps** di bilah bawah mengurutkan berdasarkan nama (A ke Z, Z ke A) atau tanggal (terbaru atau terlama dulu).

## Pemecahan Masalah {#troubleshooting}

- **"Turn your phone upright"**: pegang ponsel dalam posisi tegak. Tidak ada yang hilang selama pemberitahuan tampil.
- **"Desktop only" di ponsel atau tablet**: Anda membuka Konsol Admin. Gunakan desktop atau laptop untuk konsol itu; halaman operator berfungsi di perangkat ini.
- Untuk masalah lain, lihat [Pemecahan Masalah](/id/user-guide/troubleshooting).
