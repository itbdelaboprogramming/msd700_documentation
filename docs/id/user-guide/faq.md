---
outline: deep
search: false
---

# Tanya Jawab (FAQ)

<RoleBadge role="user" />

Jawaban untuk pertanyaan operasional umum mengenai platform robotik MSD700.

---

::: details 1. Apa yang dirancang untuk dilakukan robot MSD700?
MSD700 adalah robot self-driving untuk ruang indoor seperti gudang, koridor kantor, dan pabrik. Robot ini membangun denah peta sambil berjalan, menjalankan perjalanan titik-ke-titik secara mandiri, dan mencakup area secara sistematis (misalnya untuk pembersihan atau inspeksi).
:::

::: details 2. Saya sudah masuk ke dashboard, tetapi daftar unit kosong. Mengapa?
Akun pengguna Anda ada, tetapi administrator belum menetapkannya ke **Profil Penyewaan (Rental Profile)** yang berisi robot aktif. Hubungi administrator fasilitas atau supervisor lab Anda untuk memberikan akses akun Anda ke profil penyewaan organisasi Anda.
:::

::: details 3. Bisakah dua operator mengendalikan robot yang sama secara bersamaan?
Tidak. Untuk menjamin keselamatan, setiap robot diatur oleh **lease operasi eksklusif** yang dipegang oleh satu sesi aktif:
- Jika seorang rekan sedang mengoperasikan robot, unit tersebut menampilkan lencana **In Use** dan perintah diblokir.
- Jika sesi lain sedang mengemudikan (tab kedua, operator lain, atau dashboard lokal unit itu sendiri), dashboard menampilkan dialog berisi **Take over control** yang memungkinkan Anda memindahkan kendali secara eksplisit ke jendela Anda. Sesi lainnya diakhiri secara terlihat.
:::

::: details 4. Apa yang terjadi jika laptop saya kehilangan Wi-Fi atau tertutup saat robot sedang bergerak?
Sistem merespons berdasarkan mode operasi yang aktif:
- **Mode Manual Standar / Navigasi**: Jika robot kehilangan kontak dengan browser Anda selama **2 detik**, ia secara otomatis menjalankan **Safety Motion Pause** dan berhenti sambil tetap menyimpan misi di memori. Menyambungkan kembali browser Anda secara otomatis melanjutkan misi.
- **Mode Autopilot ON**: Jika Autopilot diaktifkan, robot mengabaikan terputusnya browser dan menyelesaikan seluruh rute atau playlist-nya secara mandiri sebelum kembali ke homebase-nya.
:::

::: details 5. Apa itu titik Homebase dan mengapa penting?
Di mana pun robot berdiri saat Anda klik Play untuk memulai peta baru, itu menjadi home base peta tersebut (posisi nol). Jadi parkirkan dulu di titik pengisian daya atau docking-nya. Playlist di masa mendatang menggunakan titik ini untuk secara otomatis mengirim robot kembali ke stasiun pengisian dayanya saat sebuah misi selesai. Jika lupa, Anda bisa memperbaikinya nanti dari [Navigasi](/id/user-guide/navigation) dengan **Set Home Base**.
:::

::: details 6. Bagaimana robot menangani dinding kaca, cermin, atau area terjun (drop-off)?
Sensor robot dapat menembus kaca bening atau menjadi bingung karena cermin, sehingga dinding kaca bisa hilang dari peta. Untuk melindungi robot, gambar **Avoided Area** di atas semua partisi kaca dan area terjun (lihat [Rute & Coverage](/id/user-guide/routes-coverage)): robot akan memperlakukan zona itu sebagai area terlarang.
:::

::: details 7. Seberapa cepat robot berjalan?
Anda mengemudikan dengan tombol **W A S D**; ada dua kecepatan tetap:
- **Normal**: `0.40 m/s` maju.
- **Mode lambat**: tahan **Shift** untuk gerakan presisi `0.20 m/s`, misalnya di ruang sempit atau saat pemetaan.
:::

::: details 8. Berapa lama baterai bertahan dan bagaimana pemantauannya?
Robot ditenagai oleh paket baterai LiFePO4 24V berkapasitas tinggi yang menyediakan **4 hingga 6 jam** operasi otonom berkelanjutan:
- Status baterai langsung ditampilkan di header dashboard saat Anda mengoperasikan unit.
- Dashboard menampilkan peringatan saat baterai hampir habis. Jika melihat peringatan tersebut, selesaikan misi dan kirim robot kembali ke stasiun pengisian daya homebase-nya.
:::

::: details 9. Bisakah saya mengoperasikan robot jika tidak ada koneksi internet di gedung?
Ya. Setiap robot MSD700 menjalankan server web onboard. Sambungkan laptop Anda langsung ke hotspot Wi-Fi robot (tanyakan namanya ke administrator) dan buka `http://mymsd.jp` di Chrome atau Edge (jika lewat jaringan lokal lain, `http://<robot-ip>:3000`). Anda dapat melakukan semua rutinitas pemetaan, teleoperasi, dan coverage sepenuhnya secara offline. Perhatikan bahwa dashboard membutuhkan jendela browser berukuran desktop bahkan saat offline: ponsel dan tablet tidak didukung.
:::

::: details 10. Bagaimana cara kerja Emergency Stop?
Mengklik tombol merah **Emergency Stop** langsung mengambil alih semua rencana otonom yang aktif, menghentikan robot, dan mengunci status keselamatan. Dashboard kemudian menampilkan halaman **Emergency Stop Activated**: periksa situasi di lapangan, dan jika semuanya aman, restart robot lalu masuk kembali melalui tombol **Go to LOGIN page**.
:::

---

## Masih ada pertanyaan?

- Konsultasikan [Panduan Pemecahan Masalah](/id/user-guide/troubleshooting).
- Untuk pemeliharaan dan instalasi perangkat keras, lihat [Instalasi Sistem](/id/setup/system-setup).
