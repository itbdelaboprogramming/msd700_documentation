---
outline: deep
search: false
---

# Tanya Jawab (FAQ)

<RoleBadge role="user" />

Jawaban untuk pertanyaan operasional umum mengenai platform robotik MSD700.

---

::: details 1. Apa yang dirancang untuk dilakukan robot MSD700?
MSD700 adalah platform robot mobile otonom yang dirancang untuk pemetaan lingkungan (SLAM), transportasi titik-ke-titik otonom, dan cakupan area sistematis (misalnya pembersihan lantai, disinfeksi, atau pemindaian permukaan) di fasilitas indoor seperti gudang, koridor kantor, dan pabrik industri.
:::

::: details 2. Saya sudah masuk ke dashboard, tetapi daftar armada kosong. Mengapa?
Akun pengguna Anda ada, tetapi administrator belum menetapkannya ke **Profil Penyewaan (Rental Profile)** yang berisi robot aktif. Hubungi administrator fasilitas atau supervisor lab Anda untuk memberikan akses akun Anda ke profil penyewaan organisasi Anda.
:::

::: details 3. Bisakah dua operator mengendalikan robot yang sama secara bersamaan?
Tidak. Untuk menjamin keselamatan, setiap robot diatur oleh **lease operasi eksklusif** yang dipegang oleh satu sesi aktif:
- Jika seorang rekan sedang mengoperasikan robot, unit tersebut menampilkan lencana **In Use** dan perintah diblokir.
- Jika sesi lain sedang mengendarai (tab kedua, operator lain, atau dashboard lokal unit itu sendiri), dashboard menampilkan dialog berisi **Take over control** yang memungkinkan Anda memindahkan kendali secara eksplisit ke jendela Anda. Sesi lainnya diakhiri secara terlihat.
:::

::: details 4. Apa yang terjadi jika laptop saya kehilangan Wi-Fi atau tertutup saat robot sedang bergerak?
Sistem merespons berdasarkan mode operasi yang aktif:
- **Mode Manual Standar / Navigasi**: Jika robot kehilangan kontak dengan peramban Anda selama **10 detik**, ia secara otomatis menjalankan **Safety Motion Pause** dan berhenti sambil tetap menyimpan misi di memori. Menyambungkan kembali peramban Anda secara otomatis melanjutkan misi.
- **Mode Autopilot ON**: Jika Autopilot diaktifkan, robot mengabaikan terputusnya peramban dan secara otonom menyelesaikan seluruh urutan waypoint atau playlist cakupan area sebelum kembali ke homebase-nya.
:::

::: details 5. Apa itu titik Homebase dan mengapa penting?
Saat membuat peta selama sesi SLAM, mengklik **Set Homebase Here** merekam koordinat stasiun docking fisik robot $(x=0, y=0, \theta=0)$. Playlist otomatis di masa mendatang menggunakan koordinat ini untuk secara otomatis menavigasikan robot kembali ke stasiun pengisian dayanya setelah menyelesaikan misi.
:::

::: details 6. Bagaimana robot menangani dinding kaca, cermin, atau area terjun (drop-off)?
Sinar LiDAR 2D/3D optik dapat menembus kaca bening atau memantul dari cermin reflektif, yang dapat menyebabkan batas tak terlihat pada peta SLAM mentah. Untuk melindungi robot:
1. Buka peta di dashboard.
2. Gunakan alat **Keep-Out Zone** untuk menggambar batas eksklusi virtual berwarna merah di sepanjang semua partisi kaca dan area terjun.
3. Perencana gerak memperlakukan garis virtual ini sebagai dinding padat yang tidak dapat ditembus.
:::

::: details 7. Seberapa cepat robot berjalan?
Anda mengendarai dengan tombol **W A S D**; ada dua kecepatan tetap:
- **Normal**: `0.40 m/s` maju.
- **Mode lambat**: tahan **Shift** untuk gerakan presisi `0.20 m/s`, misalnya di ruang sempit atau saat pemetaan.
:::

::: details 8. Berapa lama baterai bertahan dan bagaimana pemantauannya?
Robot ditenagai oleh paket baterai LiFePO4 24V berkapasitas tinggi yang menyediakan **4 hingga 6 jam** operasi otonom berkelanjutan:
- Status baterai langsung ditampilkan di header dashboard saat Anda mengoperasikan unit.
- Dashboard menampilkan peringatan saat baterai hampir habis. Jika melihat peringatan tersebut, selesaikan misi dan kirim robot kembali ke stasiun pengisian daya homebase-nya.
:::

::: details 9. Bisakah saya mengoperasikan robot jika tidak ada koneksi internet di gedung?
Ya. Setiap robot MSD700 menjalankan server web onboard. Sambungkan laptop Anda langsung ke hotspot Wi-Fi robot (tanyakan namanya ke administrator) dan buka `http://<robot-ip>:3000` di Chrome atau Edge. Anda dapat melakukan semua rutinitas pemetaan, teleoperasi, dan cakupan sepenuhnya secara offline. Perhatikan bahwa dashboard membutuhkan jendela browser berukuran desktop bahkan saat offline: ponsel dan tablet tidak didukung.
:::

::: details 10. Bagaimana cara kerja Emergency Stop?
Mengklik tombol merah **Emergency Stop** langsung mengambil alih semua rencana otonom yang aktif, menghentikan robot, dan mengunci status keselamatan. Dashboard kemudian menampilkan halaman **Emergency Stop Activated**: periksa situasi di lapangan, dan jika semuanya aman, restart robot lalu masuk kembali melalui tombol **Go to LOGIN page**.
:::

---

## Masih ada pertanyaan?

- Konsultasikan [Panduan Pemecahan Masalah](/id/user-guide/troubleshooting).
- Untuk pemeliharaan dan instalasi perangkat keras, lihat [Instalasi Sistem](/id/setup/system-setup).
