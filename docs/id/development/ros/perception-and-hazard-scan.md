---
outline: deep
search: false
---

# Persepsi dan Hazard Scan

<RoleBadge role="developer" />

Bagaimana awan Velodyne menjadi dua scan 2D yang dikonsumsi sisa stack: `/scan` untuk SLAM dan lokalisasi, `/scan_hazard` untuk costmap. Satu awan 3D masuk, dua scan 2D keluar: simulasi dan robot nyata berbagi pipeline yang persis sama.

## Kedua scan

| Topic | Isi | Dikonsumsi oleh |
| --- | --- | --- |
| `/scan` | Hanya obstacle positif. Tanda lubang tidak boleh sampai ke sini | `slam_gmapping`, AMCL |
| `/scan_hazard` | Awan yang sama **plus lubang** (diinjeksikan sebagai dinding di bibir dekatnya) | costmap `move_base` |
| `/scan_holes` | Hanya lubang | Overlay dashboard |
| `/msd700/hazard_cells` | Jejak kumulatif sel hazard (`nav_msgs/Path`) | Debugging |

Memanggang tepi lubang ke peta statis akan menghantui lokalisasi selamanya, sehingga pemisahannya struktural: SLAM mendapat scan bersih, costmap mendapat yang berbahaya. Height gating dimatikan di costmap (`min/max_obstacle_height ∓100.0`) karena sudah terjadi di hulu, di sini.

## Pipeline (`msd700_perception/launch/cloud_hazard.launch`)

![Pipeline (msd700perception/launch/cloudhazard.launch)](../../../development/ros/diagrams/perception-and-hazard-scan-pipeline-msd700perception-launch-cloudha.drawio)

Pita-pita itu adalah meter **di atas permukaan tanah hasil fit**, bukan sensor: `ground_tolerance 0.06`, `min_obstacle_height 0.08` (di atas pita lantai berarti obstacle nyata), `max_obstacle_height 0.65` (di atas ini robot melintas di bawahnya), `hole_depth_threshold 0.12` (`config/hazard_scan.yaml`). Fit-nya kuadratik (orde 2, perlu untuk melintasi tanah bergelombang) atas return lantai dalam 3.0 m, dibobot ulang 3 kali, dengan diskriminator lantai-vs-dinding (`steepest_ring_deg 15.0`) agar dinding tidak memiringkan tanah.

`hazard_scan.launch` membungkus node-nya (`hazard_scan_node.py`, respawn on): `scan_topic /scan_hazard`, `obstacles_topic /scan_obstacles`, `holes_topic /scan_holes`, `cells_topic /msd700/hazard_cells`, base frame `base_footprint`. Tinggi mount lidar berasal dari TF, bukan config ini.

### Jalur cepat C (`fastops`)

Reduksi min/max per grup di dalam pipeline (verticality, slope dan descent run, range per bin, tanda lubang) dijalankan oleh library C kecil, `src_cpp/fastops.cpp`, yang di-build catkin sebagai `libmsd700_perception_fastops.so` dan dipanggil lewat `ctypes` dari `src/msd700_perception/fastops.py`. Pada frame 29 ribu titik, waktu pipeline turun dari sekitar 52-63 ms menjadi 36-39 ms, dengan output yang identik bit per bit.

Setiap entry point tetap punya implementasi numpy. Workspace yang di-build tanpa target C, atau library yang gagal dimuat, kembali ke numpy dengan kecepatan lama, bukan kehilangan deteksi hazard. Set `MSD700_FASTOPS_DISABLE=1` untuk memaksa jalur numpy tanpa rebuild, misalnya untuk A/B test perbedaan yang dicurigai di unit sungguhan; `test/hazard_harness.py --selftest` menjalankan kedua jalur.

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
