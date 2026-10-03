---
outline: deep
search: false
---

# Persepsi dan Hazard Scan

<RoleBadge role="developer" />

Bagaimana awan Velodyne menjadi dua scan 2D yang dikonsumsi sisa stack: `/scan` untuk SLAM dan lokalisasi, `/scan_hazard` untuk costmap. Satu awan 3D masuk, dua scan 2D keluar: simulasi dan robot nyata berbagi pipeline yang persis sama.

## Kedua scan {#the-two-scans}

| Topic | Isi | Dikonsumsi oleh |
| --- | --- | --- |
| `/scan` | Hanya obstacle positif. Tanda lubang tidak boleh sampai ke sini | `slam_gmapping`, AMCL |
| `/scan_hazard` | Awan yang sama **plus lubang** (diinjeksikan sebagai dinding di bibir dekatnya) | costmap `move_base` |
| `/scan_holes` | Hanya lubang | Overlay dashboard |
| `/msd700/hazard_cells` | Jejak kumulatif sel hazard (`nav_msgs/Path`) | Jejak lubang di dashboard, di-relay sebagai `<root>/server/hazard_cells` |

Memanggang tepi lubang ke peta statis akan menghantui lokalisasi selamanya, sehingga pemisahannya struktural: SLAM mendapat scan bersih, costmap mendapat yang berbahaya. Height gating dimatikan di costmap (`min/max_obstacle_height ∓100.0`) karena sudah terjadi di hulu, di sini.

Jejak lubang bukan latch milik costmap. Jejak mempertahankan sel setelah robot menjauh dan selama sel itu berada di blind zone, lalu membuangnya begitu detektor melihatnya lagi dan mendapati lantai: `memory.clear_hits` (3) frame ketika return lantai pada bearing sel itu menjangkau melewatinya, tidak ada apa pun di depannya, dan jaraknya dalam `expected_max_range` (3.5 m), tanpa deteksi baru sel itu di antaranya. Jadi salah deteksi hilang dari dashboard seperti hilang dari costmap di RViz. Sel yang sudah dibantah baru kembali setelah `confirm_frames` (3) deteksi baru.

## Pipeline (`msd700_perception/launch/cloud_hazard.launch`)

![Pipeline (msd700perception/launch/cloudhazard.launch)](../../../development/ros/diagrams/perception-and-hazard-scan-pipeline-msd700perception-launch-cloudha.drawio)

Pita-pita itu adalah meter **di atas permukaan tanah hasil fit**, bukan sensor: `ground_tolerance 0.06`, `min_obstacle_height 0.08` (di atas pita lantai berarti obstacle nyata), `max_obstacle_height 0.65` (di atas ini robot melintas di bawahnya), `hole_depth_threshold 0.12` (`config/hazard_scan.yaml`). Fit-nya kuadratik (orde 2, perlu untuk melintasi tanah bergelombang) atas return lantai dalam 3.0 m, dibobot ulang 3 kali, dengan diskriminator lantai-vs-dinding (`steepest_ring_deg 15.0`) agar dinding tidak memiringkan tanah.

`hazard_scan.launch` membungkus node-nya (`hazard_scan_node.py`, respawn on): `scan_topic /scan_hazard`, `obstacles_topic /scan_obstacles`, `holes_topic /scan_holes`, `cells_topic /msd700/hazard_cells`, base frame `base_footprint`. Tinggi mount lidar berasal dari TF, bukan config ini.

### Jalur cepat C (`fastops`)

Reduksi min/max per grup di dalam pipeline (verticality, slope dan descent run, range per bin, tanda lubang) dijalankan oleh library C kecil, `src_cpp/fastops.cpp`, yang di-build catkin sebagai `libmsd700_perception_fastops.so` dan dipanggil lewat `ctypes` dari `src/msd700_perception/fastops.py`. Pada frame 29 ribu titik, waktu pipeline turun dari sekitar 52-63 ms menjadi 36-39 ms, dengan output yang identik bit per bit.

Setiap entry point tetap punya implementasi numpy. Workspace yang di-build tanpa target C, atau library yang gagal dimuat, kembali ke numpy dengan kecepatan lama, bukan kehilangan deteksi hazard. Set `MSD700_FASTOPS_DISABLE=1` untuk memaksa jalur numpy tanpa rebuild, misalnya untuk A/B test perbedaan yang dicurigai di unit sungguhan; `test/hazard_harness.py --selftest` menjalankan kedua jalur.

## Gerbang crest: puncak tanjakan

Di tanjakan, `base_footprint` ikut miring bersama badan robot. Akibatnya tanjakan terbaca datar, dan tanah datar di balik puncaknya terbaca sebagai turunan sebesar kemiringan tanjakan itu sendiri. Ground fit hanya melihat tanjakan: puncak adalah sudut, bukan lengkungan, dan permukaan datar di atasnya keluar dari band fit dalam satu meter. Setiap sinar yang diarahkan melewati puncak terbang melampaui titik yang diprediksi bidang tanjakan yang diperpanjang, tanjakan tepat sebelum puncak terlihat persis seperti bibir dekat sebuah lubang, dan detektor lubang menandai puncak bukit sebagai drop-off. Robot berhenti sebelum setiap puncak.

![Mengapa puncak tanjakan terbaca sebagai lubang](../../../development/ros/diagrams/perception-and-hazard-scan-crest-side-view.drawio)

Di frame robot sendiri, ini adalah pengukuran yang sama dengan turunan sungguhan di depan robot yang datar, sehingga tidak ada gerbang yang bekerja di frame itu yang bisa membedakan keduanya. `descent_run` juga tidak membantu: ia mundur di atas sekitar 8 derajat, dan puncak tanjakan secara konstruksi berada di atas itu. IMU adalah satu-satunya sensor yang tahu arah gravitasi. Setelah diputar ke frame gravitasi, sisi jauh sebuah puncak terbaca datar.

Gerbang crest (`src/msd700_perception/crest.py`) berjalan di dalam `negative.detect`, setelah continuity gate dan `descent_run` serta sebelum dilasi, dan hanya pernah menghapus mark.

![Mark lubang melewati gerbang-gerbang](../../../development/ros/diagrams/perception-and-hazard-scan-crest-gate.drawio)

Untuk setiap sektor 2 derajat yang memuat mark, keenam pemeriksaan berikut harus lolos sebelum mark di sektor itu dihapus:

| # | Pemeriksaan | Yang disingkirkan |
| --- | --- | --- |
| 1 | Ada sinar yang **mendarat** di tempat yang diprediksi ground fit, dalam `lip_window` dari mark pertama | Mark tanpa tanah terkonfirmasi di depannya |
| 2 | Tidak ada sinar yang mendarat lagi di ground fit **melewati** overshoot pertama | Lubang di tanjakan yang terus berlanjut: bibir seberangnya mendarat |
| 3 | Satu bidang cocok dengan sinar yang overshoot dalam `far_half_width` dari bearing, tanpa sel di bawahnya lebih dari `max_residual` | Dinding parit atau dasar lubang di sisi jauh |
| 4 | Bidang itu, ditarik kembali ke bibir, bertemu ground fit di sana: tidak ada step turun lebih dari `step_tolerance` | Drop-off di balik puncak, sedatar apa pun tanah di bawahnya. Tidak butuh IMU |
| 5 | Kemiringan terbesar bidang itu di **frame gravitasi** paling besar `max_world_grade` | Sisi jauh yang terlalu curam untuk dilalui |
| 6 | Turunan relatif dikurangi turunan dunia sepanjang bearing paling kecil `min_bend_explained` | Robot datar yang menghadap turunan sungguhan: turunan itu bukan akibat kemiringan badan |

Sisi jauh dimodelkan sebagai **bidang di atas jendela bearing**, bukan garis sepanjang satu bearing. Dari tanjakan sedang sering hanya satu ring yang mencapai permukaan atas, dan garis melalui satu ring adalah sinar ring itu sendiri: garis itu kembali ke sensor dan "bertemu tanah di bibir" di atas drop apa pun. Satu ring yang menyapu beberapa bearing membentuk busur melengkung, dan bentuk busur itulah yang memastikan kemiringan permukaan jauh.

### Attitude IMU

Node menyimpan buffer pendek sampel `/imu/data` dan menilai setiap cloud terhadap sampel **yang paling dekat dengan stamp-nya sendiri**, bukan sampel terakhir yang datang. Sampel itu diputar melalui mounting `base_footprint` ke IMU dari TF, sehingga IMU yang tidak sejajar badan tetap tertangani. Gerbang ini dan slope guard 30 derajat sama-sama mundur, dan semua mark dipertahankan, ketika:

- IMU tidak membawa orientation (`orientation_covariance[0] = -1`, atau quaternion bernilai nol semua); node memberi peringatan sekali;
- tidak ada sampel dalam `imu.stale_after` (0.5 s) dari stamp cloud;
- TF tidak punya transform dari `base_footprint` ke frame IMU.

### Konfigurasi (`config/hazard_scan.yaml`, blok `crest`)

| Kunci | Default | Arti |
| --- | --- | --- |
| `enabled` | `true` | Mematikan gerbang tanpa rebuild (`~reload_params`) |
| `sector` | `2.0` deg | Azimut yang dinilai bersama |
| `lip_window` | `1.2` m | Seberapa dekat di dalam mark pertama sinar terakhir yang mendarat harus berada |
| `far_window` | `16.0` m | Seberapa jauh melewati mark return jauh dikumpulkan. Dari tanjakan 10 derajat, ring pertama mencapai permukaan atas sekitar 8 m |
| `far_half_width` | `15.0` deg | Bearing di kiri dan kanan yang dipakai untuk bidang jauh |
| `radial_cell` | `0.15` m | Return jauh dirata-rata per bin dan sel radial sebelum fit |
| `min_cells`, `min_spread` | `8`, `0.10` m | Di bawah ini bidang tidak terkunci sepanjang bearing, dan mark tetap ada |
| `max_residual` | `0.08` m | Sel sejauh ini di bawah bidang memveto sektor |
| `step_tolerance` | `0.10` m | Step turun terbesar yang diizinkan di bibir. Di bawah `hole_depth_threshold` (0.12 m) |
| `max_world_grade` | `8.0` deg | Sisi jauh tercuram, di frame gravitasi, yang akan dihapus gerbang |
| `min_bend_explained` | `3.0` deg | Seberapa besar turunan yang harus dijelaskan oleh kemiringan badan |

### Hasil pengukuran (`test/hazard_harness.py --selftest`)

| Kasus | Sebelum | Sesudah |
| --- | --- | --- |
| Puncak tanjakan 6 sampai 14 derajat, 1.5 sampai 3.0 m di depan (10 kasus) | 38 sampai 142 bin lubang | **0** di setiap kasus |
| 10 kasus yang sama dengan noise range 0.03 m (VLP-16 asli) | 35 sampai 142 | **0** |
| Sama, IMU meleset 3 derajat ke arah mana pun | 83 | **0** |
| Puncak didekati 20 sampai 35 derajat miring (pitch dan roll sekaligus) | 20 sampai 167 | **0** |
| Bukit: naik 10 derajat, turun 5 derajat di sisi seberang | 81 | **0** |
| Bukit: naik 4 derajat, turun 10 derajat (melewati `max_world_grade`) | 102 | 102, tidak berubah |
| Drop-off 0.3, 0.5, atau 1.0 m tepat di balik puncak (12 kasus; juga dengan noise 0.03 m, dan dengan IMU meleset 2 sampai 4 derajat) | semua | **semua tidak berubah** |
| Parit, selokan, dan jurang 3 m di tanjakan yang terus berlanjut | masing-masing 245 | **245, tidak berubah** |
| Robot datar menghadap turunan sungguhan 10 atau 14 derajat | 83, 102 | tidak berubah |

Gerbang ini memakan sekitar 11 ms pada frame sintetis terburuk, masih di dalam periode scan 100 ms.

::: warning Bayangan puncak
Dari tanjakan, beberapa meter pertama di balik puncak tersembunyi: sinar melintas di atasnya pada 1 sampai 5 derajat dan mendarat beberapa meter lebih jauh. Lubang di pita itu tidak meninggalkan return di bawah bidang jauh dan tidak ada tanah yang mendarat lagi, sehingga ikut terhapus bersama puncaknya (harness menyimpannya sebagai test, `test_what_the_crest_gate_cannot_see`). Begitu badan robot rebah datar di atas puncak, meter-meter itu berada di dalam zona buta 1.87 m, sehingga tidak ada bagian package ini yang melihatnya dari sisi mana pun. Ini batas geometri sensor, bukan batas tuning. Lewati puncak dengan pelan.
:::

## Sakelar `MSD700_HAZARD_SCAN`

Satu environment variable, dua belahan yang harus sepakat:

- **Belahan lidar** (`lidar_scanner.launch`): `true` menukar perata `pointcloud_to_laserscan` polos dengan `velodyne_hazard.launch` (driver dan `/scan` yang sama untuk SLAM/AMCL, plus `/scan_hazard`). Prasyarat: Velodyne terpasang di `192.168.103.231` dan paket `ros-noetic-velodyne` + `ros-noetic-pointcloud-to-laserscan` (terpanggang di image).
- **Belahan costmap** (`navigation_core.launch`, `msd700_navigation.launch`): keempat topik observasi costmap mengikuti satu arg `obstacle_scan`: `scan` secara default, `scan_hazard` saat persepsi jalan. Sengaja se-unit, tidak pernah per-mode (`switch_mode.yaml` menyatakannya begitu): override per-mode akan membiarkan costmap meminta topik yang tak dipublikasikan siapa pun.

::: warning Jangan pernah tambahkan `scan_hazard` sebagai sumber kedua
Arahkan `obstacle_scan` ke satu scan atau yang lain, bukan keduanya. Raytrace scan polos akan menghapus tanda lubang yang baru saja dicat `scan_hazard` (`move_base.launch` membawa warning ini). Override manual tanpa env var: `obstacle_scan:=scan_hazard` pada navigation launch.
:::

Default live adalah `MSD700_HAZARD_SCAN=true` di `docker/.env` unit (template membawa `false`). Jaga `.env` tetap sinkron dengan `velodyne_scanner.launch device_ip`.

## Mengujinya

`msd700_hazard_test.launch`: robot lapangan dengan VLP-16 asli di world berlubang: parit, kerb 0.15 m, bangku drive-under, balok must-block. `msd700_mine.launch`: rig open-pit/bawah-tanah 44 m dengan chasm 3.0 m. `msd700_world.launch` mendispatch menurut `MSD700_SIM_WORLD`: `warehouse` (AWS datar, `/scan_hazard` = `/scan`), `hazard`, `mine`.

Aturan uji latch, dari header launch: kemudikan **dalam 1.87 m** dari lubang. Demo diam di 3 m tidak membuktikan apa-apa.

## Dokumentasi Terkait

- [Costmaps and Planners](/id/development/ros/costmaps-and-planners): Scan mana yang dikonsumsi tiap layer costmap.
- [Sensor Fusion and Control](/id/development/ros/sensor-fusion-and-control): Pipeline `/scan` polos.
- [Simulation](/id/development/ros/simulation): World uji warehouse dan hazard.
- [ROS Package Registry](/id/development/ros/ros-packages): Peta paket dan launch file.
