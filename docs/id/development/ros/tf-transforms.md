---
outline: deep
search: false
---

# Frame Koordinat, Transformasi, dan Arsitektur TF

<RoleBadge role="developer" />

Dokumen ini menyediakan spesifikasi komprehensif untuk pohon transformasi koordinat (`tf` / `tf2`), frame referensi spasial, broadcaster transformasi dinamis, offset sensor, dan restamping clock lintas-mesin yang diimplementasikan dalam sistem robot MSD700.

## Hierarki Frame Koordinat (Pohon TF)

Pohon transformasi koordinat mematuhi ROS REP-103 (Standard Units of Measure & Coordinate Conventions) dan REP-105 (Coordinate Frames for Mobile Platforms):

Pohon di bawah adalah yang dipublikasikan **unit sungguhan**: `irbot.urdf.xacro` lewat `msd700_description/launch/robot_description.launch.xml`, dijalankan oleh `bringup_msd.launch` di setiap mode (termasuk idle) sehingga `/scan` dan EKF selalu punya transform statisnya. Tinggi lidar diambil dari `config/msd700_xacro_irbot.yaml` (`offset_z_lidar: 0.427`, `wheel_radius: 0.10`) dan menjadi acuan `msd700_perception` untuk mengukur semua ketinggian.

![Hierarki Frame Koordinat (Pohon TF)](../../../development/ros/diagrams/tf-transforms-coordinate-frame-hierarchy-tf-tree.drawio)

Tidak ada `camera_link` pada robot: kamera adalah perangkat USB/WebRTC terpisah, bukan link URDF.

Di simulasi yang dipakai adalah model Gazebo `msd700_field.urdf.xacro`: frame `base_scan` (0,40 m di atas `base_link`, 0,50 m di atas footprint, dengan alias `laser` untuk replay bag), `imu_link` (z ≈ 0,085 m), dan empat link roda yang digerakkan `joint_state_publisher`.

---

## Publisher Transformasi dan Laju Update

| Edge Transformasi | Node Broadcaster | Laju | Sumber Matematis | Perilaku Saat Terputus |
| --- | --- | --- | --- | --- |
| `map -> odom` | `amcl` / `slam_gmapping` | 10 Hz | Mengoreksi drift odometrik terhadap occupancy grid laser statis. | Lompatan diskret saat terlokalisasi; mempertahankan transformasi terakhir jika laser scan terputus. |
| `odom -> base_footprint` | `robot_localization` (`ekf_localization_node`) | 30 Hz | Fusion kontinu kecepatan odometri roda serta attitude dan angular rate IMU. | Trajektori jangka pendek yang kontinu, halus, dan bebas-drift. |
| `base_footprint -> base_link` | `robot_state_publisher` | Statis | Offset elevasi tetap ($z = 0.10\text{ m}$ = `wheel_radius`). | Transformasi tetap dari URDF. |
| `base_link -> laser` | `robot_state_publisher` | Statis | Dudukan LiDAR ($x = 0$, $z = 0.427\text{ m}$ dari `base_link`, `msd700_xacro_irbot.yaml`). | Transformasi tetap dari URDF. |
| `base_link -> imu` | `robot_state_publisher` | Statis | Identitas; `/imu/data` dicap dengan frame `imu`, jadi tanpa edge ini EKF membuang setiap sampel IMU. | Transformasi tetap dari URDF. |

---

## Konvensi Koordinat Spasial (REP-103)

MSD700 secara ketat menerapkan sistem koordinat Cartesian tangan-kanan:

```
        +X (Forward / Roll Axis)
           ▲
           │
           │
           │
 ◄─────────┼─────────► +Y (Left / Pitch Axis)
           │
           ▼
        +Z (Upward / Yaw Axis)
```

- **$+X$**: Mengarah lurus ke depan sepanjang arah utama pergerakan robot.
- **$+Y$**: Mengarah lurus ke kiri melintasi lebar lateral robot.
- **$+Z$**: Mengarah vertikal ke atas tegak lurus terhadap bidang lantai.
- **Sudut Rotasi**: Mengikuti aturan tangan-kanan (rotasi Counter-Clockwise di sekitar $+Z$ berkorespondensi dengan yaw rate positif $+\dot{\theta}$).

---

## Restamping Domain Clock Lintas-Mesin (`BoundaryPublisher`)

Ketika telemetri (seperti pose robot dan laser scan) dijembatani dari robot fisik melalui internet ke server cloud, **drift clock antar mesin fisik menghasilkan peringatan ekstrapolasi `TF_OLD_DATA`** jika timestamp dievaluasi secara langsung.

![Restamping Domain Clock Lintas-Mesin (BoundaryPublisher)](../../../development/ros/diagrams/tf-transforms-cross-machine-clock-domain-restamping-bo.drawio)

### Mengapa Restamping Bersifat Krusial:
1. **Keterbatasan RTC Jetson**: SBC fisik di lingkungan lapangan tanpa akses NTP dapat boot dengan clock yang menyimpang hingga hitungan detik atau bahkan bulan.
2. **Buffer Eviction**: Jika pesan pose yang masuk membawa timestamp di masa lalu relatif terhadap ROS master server, `tf2_ros::Buffer` langsung membuangnya, mencegah kanvas web merender pergerakan robot.
3. **Solusi `BoundaryPublisher`**: `BoundaryPublisher` (`topic2string/scripts/clock_boundary.py`, versi C++ `include/topic2string/clock_boundary.h`) membungkus setiap publisher di sisi masuk bridge dan menulis ulang setiap timestamp absolut di message ke clock ROS lokal, sehingga stamp dari robot atau simulator lain tidak pernah sampai ke konsumen di master server.

## Dokumentasi Terkait

- [Sensor Fusion & Kontrol](/id/development/ros/sensor-fusion-and-control): Estimasi state kinematik dan EKF.
- [Costmap & Planner](/id/development/ros/costmaps-and-planners): Frame koordinat costmap navigasi.
- [Protokol rosbridge](/id/development/rosbridge-protocol): Serialisasi topic WebSocket.
