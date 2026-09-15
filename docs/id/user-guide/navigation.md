---
search: false
---

# Navigasi

<RoleBadge role="user" />

Layar Navigasi adalah tempat Anda mengendarai dan mengirim robot pada peta yang sudah Anda buat sebelumnya. Jika belum punya peta, mulai dulu dari [Pemetaan](/id/user-guide/mapping).

## Membuka Peta

1. Dari menu utama, pilih **Navigasi**.
2. Pilih peta tersimpan dari daftar, atau peta yang terakhir digunakan akan otomatis terbuka.
3. Peta akan tampil di layar dengan posisi robot saat ini ditandai sebagai panah berwarna.

## Kendali Manual (Joystick / WASD)

Gunakan kendali manual saat Anda ingin mengendarai robot sendiri, langkah demi langkah.

1. Klik tombol **Kendali Manual** untuk mengaktifkannya.
2. Gunakan joystick di layar (atau tombol **W A S D** di keyboard) untuk mengendarai:
   - **W**: maju
   - **S**: mundur
   - **A / D**: belok kiri / kanan
3. Lepaskan kendali (atau klik **Stop**) untuk menghentikan robot seketika.

::: info Catatan
Kendali manual selalu memiliki prioritas lebih tinggi dari misi otomatis apa pun. Jika Autopilot sedang berjalan, mengambil kendali manual akan menjeda Autopilot.
:::

## Mengirim Robot ke Suatu Titik (Pinpoint)

1. Pastikan Kendali Manual dalam keadaan **mati**.
2. Klik di mana saja pada peta ke tempat Anda ingin robot pergi.
3. Sebuah pin akan muncul di lokasi tersebut. Klik **Go** (atau konfirmasi) untuk mengirim robot.
4. Robot secara otomatis merencanakan jalur dan menghindari rintangan sepanjang perjalanan.
5. Perhatikan **status bar** untuk progres: "Bergerak", "Sampai", atau "Terjebak" jika ada sesuatu yang menghalangi jalan.

Anda juga bisa menaruh beberapa pin secara berurutan: robot akan mengunjunginya sesuai urutan.

## Auto Align

Jika posisi robot pada peta terlihat sedikit meleset (misalnya setelah dipindahkan secara manual), gunakan **Auto Align** untuk mengoreksinya tanpa berputar di tempat:

1. Klik **Auto Align** pada toolbar.
2. Robot menyesuaikan perkiraan posisinya menggunakan penanda di sekitarnya.
3. Tunggu pesan konfirmasi sebelum mengirim tujuan baru.

## Autopilot (Misi Tanpa Pengawasan)

Autopilot memungkinkan robot menjalankan rute atau playlist yang telah direncanakan secara mandiri, bahkan jika Anda menutup tab browser.

1. Pilih [rute atau playlist](/id/user-guide/routes-coverage) yang tersimpan.
2. Klik **Mulai Autopilot**.
3. Robot akan menjalankan setiap titik secara otomatis. Anda bisa menutup dashboard: misi tetap berjalan di robot itu sendiri.
4. Untuk menghentikan lebih awal, buka kembali dashboard dan klik **Hentikan Autopilot**.

## Jeda dan Lanjutkan

- Klik **Jeda (Pause)** untuk menghentikan robot sementara di posisinya saat ini.
- Klik **Lanjutkan (Resume)** untuk melanjutkan tepat dari titik terakhir.
- Jika Anda me-refresh browser saat misi sedang berjalan, dashboard akan otomatis tersambung kembali dan menampilkan kondisi terkini: Anda tidak akan kehilangan progres.

## Pemecahan Masalah

**Robot menampilkan "Terjebak"**
: Ada sesuatu yang menghalangi jalur yang direncanakan. Periksa kamera langsung, singkirkan rintangan jika memungkinkan, lalu klik Lanjutkan.

**Klik pada peta tidak berpengaruh apa-apa**
: Kendali Manual mungkin masih aktif: matikan dulu, atau pastikan Anda terhubung ke robot yang benar (lihat indikator koneksi).

**Robot berputar di tempat secara tak terduga**
: Rotasi di tempat dinonaktifkan secara default demi keamanan. Jika Anda melihat robot menolak berputar di tempat, ini memang sesuai desain: robot akan mencari jalur yang tidak membutuhkan putaran di tempat.

**Misi Autopilot berhenti setelah saya menutup tab**
: Ini seharusnya tidak terjadi: Autopilot berjalan di robot, bukan di browser. Jika terjadi, periksa dengan administrator; mungkin ada masalah konektivitas.
