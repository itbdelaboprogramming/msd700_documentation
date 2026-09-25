---
search: false
---

# Akun & Akses

<RoleBadge role="user" />

## Masuk (Login)

1. Buka URL dashboard di browser Anda (tanyakan alamatnya ke administrator jika belum punya).
2. Masukkan **username** dan **password** Anda.
3. Klik **Proceed**.

Jika belum punya akun, klik **Sign Up** dan isi username, nama lengkap, email, dan password (dua kali untuk konfirmasi). Administrator harus menetapkan akun baru Anda ke suatu penyewaan sebelum robot mana pun muncul untuk Anda.

## Operator vs. Administrator

Ada dua jenis pengguna:

| Peran | Yang bisa dilakukan |
| --- | --- |
| **Operator** | Mengendalikan robot, membuat peta, menjalankan misi navigasi dan cakupan, melihat kamera langsung. |
| **Administrator** | Semua yang bisa dilakukan operator, ditambah mengelola operator lain, robot, dan profil penyewaan di [Konsol Admin](/id/user-guide/admin-console). |

Peran Anda ditetapkan oleh administrator: Anda tidak bisa mengubahnya sendiri.

## Memilih Unit (Robot)

Jika akun Anda memiliki akses ke lebih dari satu robot, Anda akan melihat daftar setelah login:

1. Setiap robot menampilkan **nama**, **status** (Ready / In Use / Pinging / Not Set), dan level baterai.
2. Klik sebuah robot untuk terhubung.
3. Jika sebuah robot menampilkan **"In Use"**, ada sesi lain yang sedang mengendalikannya: Anda tetap bisa membukanya, tetapi untuk mengendarai Anda harus mengambil alih secara eksplisit. Dialog ("This unit is already being operated from …") menawarkan **Take over control** (sesi lain diakhiri secara terlihat) atau **Leave it running**.

## Bekerja Offline (Mode Lokal)

Jika Anda berada di lokasi fasilitas tanpa akses internet, Anda tetap bisa menggunakan dashboard lengkap dengan terhubung langsung ke robot, bukan ke cloud:

1. Hubungkan laptop Anda ke hotspot Wi-Fi onboard robot (tanyakan namanya ke administrator).
2. Buka `http://<robot-ip>:3000` di Chrome atau Edge, alih-alih alamat cloud biasa. Pemetaan, navigasi, dan cakupan semuanya berfungsi persis seperti saat online.
3. Setelah robot kembali terhubung ke Wi-Fi berinternet, gunakan opsi **Sync** pada layar untuk mendorong semua yang direkam secara offline ke database cloud.

## Keluar (Logout)

Logout **tidak** menghentikan misi tanpa pengawasan (Autopilot) yang sedang berjalan: misi tetap berjalan agar tidak terganggu secara tidak sengaja.

## Pemecahan Masalah

**"The username or password you entered is incorrect"**
: Periksa kembali username dan password Anda. Jika lupa password, hubungi administrator. (Jika halaman malah menyebut server tidak terjangkau, bukan berarti ada yang salah dengan yang Anda ketik: periksa koneksi Anda.)

**Tidak ada robot yang muncul setelah login**
: Akun Anda mungkin belum ditetapkan ke penyewaan mana pun. Hubungi administrator untuk ditambahkan.

**Robot selalu menampilkan "Sedang Digunakan"**
: Operator lain mungkin meninggalkan sesi terbuka. Minta administrator untuk memeriksa, atau gunakan opsi pengambilalihan jika tersedia untuk peran Anda.
