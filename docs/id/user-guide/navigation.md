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

1. Nyalakan toggle **Manual Override** di panel Robot Control.
2. Gunakan tombol **W A S D** pada keyboard untuk mengendarai:
   - **W**: maju (`0.40 m/s`)
   - **S**: mundur
   - **A / D**: belok kiri / kanan
   - Tahan **Shift** untuk mode lambat (`0.20 m/s`) saat butuh presisi
3. Lepaskan semua tombol (atau klik **Stop**) untuk menghentikan robot seketika.

::: info Catatan
Manual Override selalu memiliki prioritas lebih tinggi dari misi otomatis apa pun: kedua toggle saling eksklusif, jadi menyalakannya akan menjeda pergerakan otonom.
:::

## Mengirim Robot ke Suatu Titik (Pinpoint)

1. Pastikan Manual Override dalam keadaan **OFF**.
2. Klik di mana saja pada peta ke tempat Anda ingin robot pergi.
3. Sebuah pin akan muncul di lokasi tersebut. Konfirmasi untuk mengirim robot.
4. Robot secara otomatis merencanakan jalur dan menghindari rintangan sepanjang perjalanan.
5. Perhatikan **tampilan status** untuk progres: "On Progress", "Arrived", atau "Robot Stuck" jika ada sesuatu yang menghalangi jalan.

Anda juga bisa mengantrekan beberapa titik henti secara berurutan dan menyimpannya sebagai rute yang bisa dipakai ulang (lihat [Rute & Cakupan](/id/user-guide/routes-coverage)).

### Membaca Kanvas Peta

Saat robot bergerak, kanvas menampilkan beberapa indikator yang perlu diketahui:

- **Garis biru**: jalur yang direncanakan pada peta.
- **Jalur pendek hijau/merah**: beberapa meter yang sedang aktif diikuti robot saat ini.
- **Titik merah**: apa yang sedang dilihat sensor robot di sekelilingnya.
- **Garis tembus pandang di sekeliling robot**: zona keselamatannya; robot menjaga area ini tetap bebas dari rintangan.

## Auto Align

Jika posisi robot pada peta terlihat sedikit meleset (misalnya setelah dipindahkan secara manual), gunakan **Auto Align** untuk mengoreksinya tanpa berputar di tempat:

1. Klik **Auto Align** pada toolbar.
2. Robot membandingkan apa yang dilihat sensornya dengan peta tersimpan untuk memperbaiki posisinya, biasanya dalam waktu kurang dari satu detik dan tanpa bergerak.
3. Tunggu pesan konfirmasi sebelum mengirim tujuan baru.

## Autopilot (Misi Tanpa Pengawasan)

Autopilot menjaga operasi tanpa pengawasan yang sedang berjalan tetap hidup di robot bahkan setelah Anda menutup tab browser — baik itu rute yang sedang Anda jalankan maupun sapuan [Operation Playlist](/id/user-guide/routes-coverage).

1. Mulai operasinya: muat rute tersimpan lalu klik **Play**, atau buka **Operation Playlist** dan klik **Run Playlist**.
2. Nyalakan toggle **Autopilot** di panel Robot Control.
3. Robot akan terus menjalankannya secara otomatis. Anda bisa menutup dashboard: misi tetap berjalan di robot itu sendiri.
4. Untuk menghentikan lebih awal, buka kembali dashboard dan matikan toggle **Autopilot** (Anda akan diminta konfirmasi).

## Jeda dan Lanjutkan

- Klik **Jeda (Pause)** untuk menghentikan robot sementara di posisinya saat ini.
- Klik **Lanjutkan (Resume)** untuk melanjutkan tepat dari titik terakhir.
- Jika Anda me-refresh browser saat misi sedang berjalan, dashboard akan otomatis tersambung kembali dan menampilkan kondisi terkini: Anda tidak akan kehilangan progres.

## Pemecahan Masalah

**Robot menampilkan "Terjebak"**
: Ada sesuatu yang menghalangi jalur yang direncanakan. Periksa kamera langsung, singkirkan rintangan jika memungkinkan, lalu klik Lanjutkan.

**Klik pada peta tidak berpengaruh apa-apa**
: Manual Override mungkin masih ON: matikan dulu, atau pastikan Anda terhubung ke robot yang benar (lihat indikator koneksi).

**Robot berhenti sejenak sebelum berbelok, bukan berputar di tempat**
: Ini wajar: perencana lebih memilih jalur yang aman daripada berputar di tempat. Beri waktu sesaat agar robot menemukan jalannya.

**Misi Autopilot berhenti setelah saya menutup tab**
: Ini seharusnya tidak terjadi: Autopilot berjalan di robot, bukan di browser. Jika terjadi, periksa dengan administrator; mungkin ada masalah konektivitas.
