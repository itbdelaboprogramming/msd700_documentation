---
outline: deep
search: false
---

# Sensor Fusion, Kinematika, dan Estimasi State

<RoleBadge role="developer" />

Dokumen ini menyediakan spesifikasi matematis dan arsitektural yang menyeluruh untuk pipeline estimasi state, konfigurasi Extended Kalman Filter (EKF), filtering orientasi IMU, dan kinematika differential drive yang diimplementasikan pada robot MSD700.

## Arsitektur Persepsi dan Fusion

![Arsitektur Persepsi dan Fusion](../../../development/ros/diagrams/sensor-fusion-and-control-perception-and-fusion-architecture.drawio)

---

## Kinematika Maju Differential Drive

Dua mesin memakai stack ini. Simulasi menjalankan robot **field** (0,90 x 0,70 m, tracked, model `msd700_field`, plugin skid-steer dengan odometri ground truth Gazebo). Uji fisik memakai **prototype** yang lebih kecil (model `irbot`, sekitar 0,30 x 0,30 m, dua roda penggerak belakang plus caster, differential drive sungguhan). Jangan membawa tuning dari satu ke yang lain. Angka di bawah milik prototype.

Di unit sungguhan (`hardware_mode 1`, default), `raw_sensor_node` (`msd700_control/src/hardware_state.py`) mengubah delta pulse encoder dari STM32 menjadi `/wheel/odom`. (`msd700_hardware/config/odometry_config.yaml` milik interface hardware C++ terpisah yang hanya dipakai di `hardware_mode 2`.)

### Parameter Kinematik (`msd700_control/config/pose_config.yaml`, namespace `/raw_sensor`):
- Radius roda: $r = 0.0275\text{ m}$ (`wheel_radius: 2.75` cm).
- Track (jarak antar roda): $L = 0.26\text{ m}$ (`wheel_distance: 26.0` cm, hasil ukur di robot sungguhan; sampai September 2026 nilainya `78.0`, yang membuat setiap pivot berlebih 3×).
- Resolusi encoder: `ppr: 50000`, dikalikan faktor empiris `pulse_scale: 24.0`.
- Sumber heading: `use_imu: 1`, jadi heading berasal dari IMU terfilter, bukan dari selisih roda.

File yang sama dipakai `bridger.py`, sehingga sisi perintah (twist → kecepatan roda) dan sisi odometri memakai geometri yang sama.

### Perhitungan per siklus ($\Delta t$, `compute_period` 10 ms):

$$d = \frac{2 \pi r}{PPR} \cdot s_{\text{pulse}}, \quad \Delta s_L = d \cdot \Delta \text{ticks}_L, \quad \Delta s_R = d \cdot \Delta \text{ticks}_R$$

$$v = \frac{\Delta s_R + \Delta s_L}{2 \Delta t}, \quad \omega = \frac{\Delta s_R - \Delta s_L}{L \, \Delta t}$$

$$x_{k+1} = x_k + \frac{\Delta s_R + \Delta s_L}{2} \cos \theta_k, \quad y_{k+1} = y_k + \frac{\Delta s_R + \Delta s_L}{2} \sin \theta_k, \quad \theta_k = \psi_{\text{IMU}}$$

`/wheel/odom` membawa $v$ dan $\omega$ di bagian twist; EKF hanya memakai twist. `raw_sensor_node` **tidak** mem-broadcast `odom -> base_footprint` (`publish_tf` default false); transform itu milik EKF.

---

## Filter Orientasi Madgwick AHRS IMU

Data IMU mentah pada `/imu/data_raw` diproses oleh `imu_filter_madgwick` untuk menurunkan orientasi quaternion bebas-drift $\mathbf{q} = [q_w, q_x, q_y, q_z]^T$. Filter berjalan dengan `gain 0.01`, `use_mag true`, fixed frame `odom`, membaca `/imu/mag` dan mempublikasikan output terfusi pada `/imu/from_filter`. `raw_sensor_node` men-subscribe topic itu, menggabungkan roll/pitch filter dengan yaw terakumulasi, lalu menerbitkannya ulang sebagai `/imu/data` (frame `imu`), yang dikonsumsi EKF sebagai `imu0`:

### Optimisasi Gradient Descent:
$$\mathbf{q}_{k+1} = \mathbf{q}_k + \left( \frac{1}{2} \mathbf{q}_k \otimes \mathbf{\omega}_{gyro} - \beta \frac{\nabla \mathbf{f}}{\|\nabla \mathbf{f}\|} \right) \Delta t$$

- $\mathbf{\omega}_{gyro} = [0, \omega_x, \omega_y, \omega_z]^T$: Vektor angular rate dari gyroscope.
- $\nabla \mathbf{f}$: Gradient fungsi objektif yang menyelaraskan vektor gravitasi accelerometer terukur dengan gravitasi earth-frame referensi $[0, 0, 1]^T$.
- $\beta$ (`gain`) $= 0.01$: Parameter laju divergensi filter yang menyeimbangkan responsivitas gyroscope terhadap noise getaran accelerometer.

---

## Extended Kalman Filter (EKF) 15-Dimensi

Node estimasi state (`ekf_localization_node` dari `robot_localization`) mempertahankan vektor variabel acak Gaussian 15-state:

$$\mathbf{x} = \begin{bmatrix} x & y & z & \phi & \theta & \psi & \dot{x} & \dot{y} & \dot{z} & \dot{\phi} & \dot{\theta} & \dot{\psi} & \ddot{x} & \ddot{y} & \ddot{z} \end{bmatrix}^T$$

Dimana:
- $x, y, z$: Posisi 3D dalam frame odometri ($z$ di-clamp ke $0$ dalam mode 2D).
- $\phi, \theta, \psi$: Roll, pitch, dan yaw (sudut Euler).
- $\dot{x}, \dot{y}, \dot{z}$: Kecepatan linear body-frame.
- $\dot{\phi}, \dot{\theta}, \dot{\psi}$: Kecepatan sudut.
- $\ddot{x}, \ddot{y}, \ddot{z}$: Akselerasi linear.

### Process Update (Langkah Prediksi):
$$\hat{\mathbf{x}}_{k|k-1} = \mathbf{f}(\hat{\mathbf{x}}_{k-1|k-1}, \mathbf{u}_k)$$

$$\mathbf{P}_{k|k-1} = \mathbf{F}_k \mathbf{P}_{k-1|k-1} \mathbf{F}_k^T + \mathbf{Q}$$

- $\mathbf{F}_k = \left. \frac{\partial \mathbf{f}}{\partial \mathbf{x}} \right|_{\hat{\mathbf{x}}_{k-1|k-1}}$: Matriks Jacobian state transition.
- $\mathbf{Q}$: Matriks Kovarians Process Noise diagonal (merefleksikan dinamika yang tak termodelkan dan wheel slip).

### Measurement Update (Langkah Koreksi):
$$\mathbf{K}_k = \mathbf{P}_{k|k-1} \mathbf{H}_k^T \left( \mathbf{H}_k \mathbf{P}_{k|k-1} \mathbf{H}_k^T + \mathbf{R}_k \right)^{-1}$$

$$\hat{\mathbf{x}}_{k|k} = \hat{\mathbf{x}}_{k|k-1} + \mathbf{K}_k \left( \mathbf{z}_k - \mathbf{h}(\hat{\mathbf{x}}_{k|k-1}) \right)$$

$$\mathbf{P}_{k|k} = (\mathbf{I} - \mathbf{K}_k \mathbf{H}_k) \mathbf{P}_{k|k-1}$$

- $\mathbf{z}_k$: Vektor pengukuran yang mem-fusi kecepatan badan $\dot{x}, \dot{y}$ dari odometri roda (`odom0: /wheel/odom`) serta roll, pitch, yaw dan ketiga kecepatan sudut dari `/imu/data` (`imu0`). Akselerasi linear tidak di-fusi. `two_d_mode` bernilai **false** (sejak Agustus 2026) sehingga robot boleh miring di permukaan tidak rata; $z$ hasil dead-reckoning dan bukan ketinggian sebenarnya. Filter berjalan pada $30\text{ Hz}$ dengan `world_frame: odom`.
- $\mathbf{R}_k$: Matriks Kovarians Measurement Noise dari `ekf_localization_config.yaml` (process dan initial covariance dalam file; lihat yaml untuk nilai yang disetel).

---

## Pipeline Proyeksi PointCloud LiDAR

Sensor Velodyne VLP-16 menghasilkan 300.000 titik/detik melintasi 16 laser ring. Untuk meminimalkan utilisasi CPU sambil mempertahankan kesadaran obstacle spasial, `pointcloud_to_laserscan` mengiris point cloud 3D menjadi scan planar 2D laju tinggi:

![Pipeline Proyeksi PointCloud LiDAR](../../../development/ros/diagrams/sensor-fusion-and-control-lidar-pointcloud-projection-pipeline.drawio)

Ini menjaga pita $\pm 0.30\text{ m}$ di sekitar sensor di dalam costmap navigasi sementara return di luarnya (pantulan lantai, langit-langit) dibuang. Pipeline kedua (`cloud_hazard.launch`) mem-fitting ground dan mengawasi pita $0.08$–$0.65\text{ m}$ di atasnya untuk lubang dan drop-off, mempublikasikan `/scan_hazard`.

## Dokumentasi Terkait

- [Costmap & Planner](/id/development/ros/costmaps-and-planners): Layer navigasi dan inflation obstacle.
- [Firmware & Perangkat Keras](/id/development/ros/firmware-and-hardware): Penghitungan pulsa mikrokontroler dan loop PID.
- [Simulasi](/id/development/ros/simulation): Verifikasi sensor Gazebo berskala nyata.
