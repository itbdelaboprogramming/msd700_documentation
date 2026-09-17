---
search: false
---

# Akun & Akses

<RoleBadge role="user" />

## Masuk (Login)

1. Buka URL dashboard di browser Anda (tanyakan alamatnya ke administrator jika belum punya).
2. Masukkan **email/username** dan **password** Anda.
3. Klik **Masuk**.

Jika belum punya akun, klik **Daftar** dan isi data Anda. Administrator armada mungkin perlu menyetujui akun Anda atau menetapkan Anda ke suatu penyewaan sebelum Anda bisa melihat robot mana pun.

## Operator vs. Administrator

Ada dua jenis pengguna:

| Peran | Yang bisa dilakukan |
| --- | --- |
| **Operator** | Mengendalikan robot, membuat peta, menjalankan misi navigasi dan cakupan, melihat kamera langsung. |
| **Administrator** | Semua yang bisa dilakukan operator, ditambah mengelola operator lain, robot, dan profil penyewaan di [Konsol Admin](/id/user-guide/admin-console). |

Peran Anda ditetapkan oleh administrator: Anda tidak bisa mengubahnya sendiri.

## Memilih Unit (Robot)

Jika akun Anda memiliki akses ke lebih dari satu robot, Anda akan melihat daftar setelah login:

1. Setiap robot menampilkan **nama**, **status** (Online / Offline / Sedang Digunakan), dan level baterai.
2. Klik sebuah robot untuk terhubung.
3. Jika sebuah robot menampilkan **"In Use"**, ada sesi lain yang sedang mengendalikannya: Anda tetap bisa membukanya, tetapi untuk mengendarai Anda harus mengambil alih secara eksplisit. Dialog ("This unit is already being operated from …") menawarkan **Take over control** (sesi lain diakhiri secara terlihat) atau **Leave it running**.

## Bekerja Offline (Mode Lokal)

Jika Anda berada di lokasi fasilitas tanpa akses internet, Anda tetap bisa menggunakan dashboard lengkap dengan terhubung langsung ke robot, bukan ke cloud:

1. Hubungkan laptop Anda ke hotspot Wi-Fi onboard robot (tanyakan namanya ke administrator).
2. Buka `http://<robot-ip>:3000` di Chrome atau Edge, alih-alih alamat cloud biasa. Pemetaan, navigasi, dan cakupan semuanya berfungsi persis seperti saat online.
3. Setelah robot kembali terhubung ke Wi-Fi berinternet, gunakan opsi **Sync** pada layar untuk mendorong semua yang direkam secara offline ke database cloud.

## Keluar (Logout)

Klik nama akun Anda di pojok atas, lalu **Keluar**. Jika robot sedang menjalankan misi tanpa pengawasan (Autopilot), logout **tidak** menghentikannya: misi tetap berjalan agar tidak terganggu secara tidak sengaja.

## Pemecahan Masalah

**"Kredensial tidak valid" saat login**
: Periksa kembali email dan password Anda. Jika lupa password, hubungi administrator.

**Tidak ada robot yang muncul setelah login**
: Akun Anda mungkin belum ditetapkan ke penyewaan mana pun. Hubungi administrator untuk ditambahkan.

**Robot selalu menampilkan "Sedang Digunakan"**
: Operator lain mungkin meninggalkan sesi terbuka. Minta administrator untuk memeriksa, atau gunakan opsi pengambilalihan jika tersedia untuk peran Anda.
