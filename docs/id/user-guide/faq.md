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
- Jika Anda membuka tab kedua atau berpindah perangkat dengan akun Anda sendiri, dashboard menampilkan tombol **Take Over Control** yang memungkinkan Anda memindahkan lease secara eksplisit ke jendela baru Anda.
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
Batas kecepatan maksimum diterapkan pada perangkat lunak demi keselamatan tempat kerja:
- **Kecepatan Default**: `0.20 m/s` (kira-kira 0,72 km/jam).
- **Rentang yang Dapat Disesuaikan**: Anda dapat mengatur kecepatan linear antara `0.05 m/s` dan `0.40 m/s` menggunakan slider kecepatan di panel kontrol kanan bawah.
- **Kecepatan Putar Angular**: Dapat dikonfigurasi hingga `0.50 rad/s`.
:::

::: details 8. Berapa lama baterai bertahan dan bagaimana pemantauannya?
Robot ditenagai oleh paket baterai LiFePO4 24V berkapasitas tinggi yang menyediakan **4 hingga 6 jam** operasi otonom berkelanjutan:
- Tegangan dan persentase baterai langsung ditampilkan di header bar atas.
- Jika baterai turun di bawah **20%**, dashboard menampilkan peringatan kuning kecoklatan (amber).
- Jika baterai turun di bawah **15%**, misi yang sedang berjalan dijeda dan robot memprioritaskan kembali ke stasiun pengisian daya homebase-nya.
:::

::: details 9. Bisakah saya mengoperasikan robot jika tidak ada koneksi internet di gedung?
Ya. Setiap robot MSD700 menjalankan server web onboard. Sambungkan laptop atau tablet Anda langsung ke jaringan Wi-Fi robot (`MSD700_Unit_<ULID>`) dan buka `http://<jetson-ip>:3000`. Anda dapat melakukan semua rutinitas pemetaan, teleoperasi, dan cakupan sepenuhnya secara offline.
:::

::: details 10. Bagaimana cara kerja Emergency Stop?
Mengklik tombol merah **Emergency Stop** (atau menekan tombol `Escape` pada keyboard Anda) langsung mengambil alih semua rencana otonom yang aktif, menurunkan kecepatan motor ke nol dalam hitungan milidetik, dan mengunci status keselamatan. Untuk melanjutkan operasi, selesaikan kondisi keselamatan lalu klik **Release Emergency Stop**.
:::

---

## Masih ada pertanyaan?

- Konsultasikan [Panduan Pemecahan Masalah](/id/user-guide/troubleshooting).
- Untuk pemeliharaan dan instalasi perangkat keras, lihat [Instalasi Sistem](/id/setup/system-setup).
