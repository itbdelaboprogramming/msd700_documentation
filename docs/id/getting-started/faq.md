---
outline: deep
search: false
---
# Pertanyaan yang Sering Diajukan (FAQ)

<RoleBadge role="user" />

Jawaban atas pertanyaan operasional umum mengenai platform robot MSD700.

---

::: details 1. What is the MSD700 robot designed to do?
MSD700 adalah platform robot bergerak otonom yang dirancang untuk pemetaan lingkungan (SLAM), transportasi titik-ke-titik otonom, dan cakupan area sistematis (misalnya pembersihan lantai, desinfeksi, atau pemindaian permukaan) di fasilitas dalam ruangan seperti gudang, koridor kantor, dan pabrik industri.
:::

::: details 2. I logged into the dashboard, but the fleet list is empty. Why?
Akun pengguna Anda ada, namun administrator belum menugaskannya ke **Profil Penyewaan** yang berisi robot aktif. Hubungi administrator fasilitas atau penyelia lab Anda untuk memberikan akses akun Anda ke profil persewaan organisasi Anda.
:::

::: details 3. Can two operators control the same robot simultaneously?
Tidak. Untuk memastikan keselamatan, setiap robot diatur oleh **sewa operasi eksklusif** yang diadakan dalam satu sesi aktif:
- Jika ada rekan yang mengoperasikan robot, unit akan menampilkan lencana **Sedang Digunakan** dan perintah diblokir.
- Jika Anda membuka tab kedua atau berpindah perangkat dengan akun Anda sendiri, dasbor akan menampilkan tombol **Ambil Alih Kontrol**, sehingga Anda dapat secara eksplisit mentransfer sewa ke jendela baru.
:::

::: details 4. What happens if my laptop loses Wi-Fi or closes while the robot is moving?
Sistem merespons berdasarkan mode operasi aktif:
- **Manual Standar / Mode Navigasi**: Jika robot kehilangan kontak dengan browser Anda selama **10 detik**, robot secara otomatis menjalankan **Jeda Gerakan Aman** dan berhenti sambil menyimpan misi di memori. Menghubungkan kembali browser Anda secara otomatis melanjutkan misi.
- **Mode Autopilot AKTIF**: Jika Autopilot diaktifkan, robot mengabaikan pemutusan koneksi browser dan secara mandiri menyelesaikan seluruh urutan titik jalan atau daftar putar cakupan area sebelum kembali ke basisnya.
:::

::: details 5. What is the Homebase point and why is it important?
Saat membuat peta selama sesi SLAM, mengklik **Set Homebase Here** mencatat koordinat stasiun dok fisik robot $(x=0, y=0, \theta=0)$. Daftar putar otomatis di masa depan menggunakan koordinat ini untuk secara otomatis menavigasi robot kembali ke stasiun pengisian dayanya setelah menyelesaikan misi.
:::

::: details 6. How does the robot handle glass walls, mirrors, or drop-offs?
Sinar optik LiDAR 2D/3D dapat menembus kaca bening atau menyebarkan cermin reflektif, yang dapat menyebabkan batas tidak terlihat pada peta SLAM mentah. Untuk melindungi robot:
1. Buka peta di dashboard.
2. Gunakan alat **Zona Jauhkan** untuk menggambar batas pengecualian berwarna merah virtual di sepanjang partisi kaca dan titik drop-off.
3. Perencana gerak memperlakukan garis maya ini sebagai dinding kokoh yang tidak dapat ditembus.
:::

::: details 7. How fast does the robot drive?
Batas kecepatan maksimum diberlakukan dalam perangkat lunak untuk keselamatan tempat kerja:
- **Kecepatan Default**: `0.20 m/s` (kira-kira 0,72 km/jam).
- **Rentang yang Dapat Disesuaikan**: Anda dapat menyesuaikan kecepatan linier antara `0.05 m/s` dan `0.40 m/s` menggunakan penggeser kecepatan di panel kontrol kanan bawah.
- **Kecepatan Putar Sudut**: Dapat dikonfigurasi hingga `0.50 rad/s`.
:::

::: details 8. How long does the battery last and how is it monitored?
Robot ini ditenagai oleh baterai berkapasitas tinggi LiFePO4 24V yang menyediakan **4 hingga 6 jam** pengoperasian otonom terus menerus:
- Tegangan dan persentase baterai langsung ditampilkan di bilah header atas.
- Jika baterai turun di bawah **20%**, dasbor akan menampilkan peringatan kuning.
- Jika baterai turun di bawah **15%**, misi yang sedang berjalan akan dijeda dan robot memprioritaskan untuk kembali ke stasiun pengisian daya di pangkalannya.
:::

::: details 9. Can I operate the robot if there is no internet connection in the building?
Ya. Setiap robot MSD700 menjalankan server web onboard. Hubungkan laptop atau tablet Anda langsung ke jaringan Wi-Fi robot (`MSD700_Unit_<ULID>`) dan buka `http://<jetson-ip>:3000`. Anda dapat melakukan semua pemetaan, teleoperasi, dan rutinitas cakupan sepenuhnya secara offline.
:::

::: details 10. How does the Emergency Stop work?
Mengklik tombol merah **Berhenti Darurat** (atau menekan tombol `Escape` pada keyboard Anda) akan langsung mengesampingkan semua rencana otonom yang aktif, menjadikan kecepatan motor ke nol dalam hitungan milidetik, dan mengunci status keselamatan. Untuk melanjutkan pengoperasian, selesaikan kondisi keselamatan dan klik **Lepaskan Berhenti Darurat**.
:::

---

## Masih ada pertanyaan?

- Lihat [Panduan Mengatasi Masalah Operator](/id/getting-started/troubleshooting).
- Untuk pemeliharaan dan pemasangan perangkat keras, lihat [Pengaturan Sistem](/id/setup/system-setup).