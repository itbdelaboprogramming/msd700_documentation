---
outline: deep
search: false
---

# Sensor Fusion, Kinematika, dan Estimasi State

<RoleBadge role="developer" />

Dokumen ini menyediakan spesifikasi matematis dan arsitektural yang menyeluruh untuk pipeline estimasi state, konfigurasi Extended Kalman Filter (EKF), filtering orientasi IMU, dan kinematika differential drive yang diimplementasikan pada robot MSD700.

## Arsitektur Persepsi dan Fusion

```mermaid
flowchart TD
  subgraph RawSensors["Physical Sensor Hardware Suite"]
    VLP16["Velodyne VLP-16 3D LiDAR<br/>(16 beams, Ethernet: 192.168.103.201)"]
    IMU_HW["9-DOF IMU (I2C / Serial)<br/>3-Axis Accel, Gyro, Magnetometer"]
    ENCODERS["Optical Quadrature Encoders<br/>Dual Channel (A/B) 4000 CPR"]
    CAM["HD Optical Camera<br/>(/dev/video0, 1080p WebRTC)"]
  end

  subgraph Preprocessing["ROS Preprocessing & Filtering"]
    PCL2SCAN["pointcloud_to_laserscan<br/>Projects 3D Pointcloud to 2D Planar /scan<br/>Height Window: 0.46 to 0.96 m"]
    IMU_FILT["imu_filter_madgwick<br/>Madgwick AHRS Orientation Filter<br/>Fuses Accel, Gyro & Gravity Vector"]
    WHEEL_ODOM["msd700_hardware / serial_node<br/>Computes Forward Kinematics (/wheel/odom)"]
  end

  subgraph StateEstimation["Continuous State Estimation (EKF)"]
    EKF["robot_localization (ekf_localization_node)<br/>15-Dimensional Extended Kalman Filter<br/>Fuses /wheel/odom and /imu/data"]
    ODOM_FILT["/odometry/filtered<br/>Publishes TF: odom -> base_footprint (30 Hz)"]
  end

  VLP16 --> PCL2SCAN
  IMU_HW --> IMU_FILT
  ENCODERS --> WHEEL_ODOM

  WHEEL_ODOM --> EKF
  IMU_FILT --> EKF
  EKF --> ODOM_FILT
```

---

## Kinematika Maju Differential Drive

Robot fisik beroperasi sebagai platform differential drive dua roda yang ditopang oleh empat roda caster pasif.

### Parameter Kinematik:
- Radius Roda: $r = 0.075\text{ m}$ (Diameter Roda: $0.150\text{ m}$).
- Track Gauge (jarak antara centerline roda penggerak): $L = 0.580\text{ m}$.
- Resolusi Encoder: $CPR = 4000\text{ counts/revolution}$ (setelah decoding quadrature $4\times$).
- Rasio Reduksi Gearbox: $N = 30:1$.

### Perhitungan Displacement per Periode Kontrol $\Delta t$:
Dengan delta encoder kiri $\Delta \text{ticks}_L$ dan delta encoder kanan $\Delta \text{ticks}_R$:

$$\Delta s_L = \frac{2 \pi r \cdot \Delta \text{ticks}_L}{CPR \cdot N}, \quad \Delta s_R = \frac{2 \pi r \cdot \Delta \text{ticks}_R}{CPR \cdot N}$$

Displacement linear $\Delta s$ dan perubahan heading $\Delta \theta$:

$$\Delta s = \frac{\Delta s_R + \Delta s_L}{2}, \quad \Delta \theta = \frac{\Delta s_R - \Delta s_L}{L}$$

### Integrasi Odometri Diskret:
Dalam frame lokal robot dengan integrasi Runge-Kutta orde-2 (midpoint):

$$x_{k+1} = x_k + \Delta s \cdot \cos\left(\theta_k + \frac{\Delta \theta}{2}\right)$$

$$y_{k+1} = y_k + \Delta s \cdot \sin\left(\theta_k + \frac{\Delta \theta}{2}\right)$$

$$\theta_{k+1} = \theta_k + \Delta \theta$$

---

## Filter Orientasi Madgwick AHRS IMU

Data IMU mentah pada `/imu/data_raw` ($50\text{ Hz}$) diproses oleh `imu_filter_madgwick` untuk menurunkan orientasi quaternion bebas-drift $\mathbf{q} = [q_w, q_x, q_y, q_z]^T$:

### Optimisasi Gradient Descent:
$$\mathbf{q}_{k+1} = \mathbf{q}_k + \left( \frac{1}{2} \mathbf{q}_k \otimes \mathbf{\omega}_{gyro} - \beta \frac{\nabla \mathbf{f}}{\|\nabla \mathbf{f}\|} \right) \Delta t$$

- $\mathbf{\omega}_{gyro} = [0, \omega_x, \omega_y, \omega_z]^T$: Vektor angular rate dari gyroscope.
- $\nabla \mathbf{f}$: Gradient fungsi objektif yang menyelaraskan vektor gravitasi accelerometer terukur dengan gravitasi earth-frame referensi $[0, 0, 1]^T$.
- $\beta = 0.05$: Parameter laju divergensi filter yang menyeimbangkan responsivitas gyroscope terhadap noise getaran accelerometer.

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

- $\mathbf{z}_k$: Vektor pengukuran yang mem-fusi kecepatan $\dot{x}$ dari odometri roda, serta yaw absolut $\psi$ dan kecepatan sudut $\dot{\psi}$ dari IMU.
- $\mathbf{R}_k$: Matriks Kovarians Measurement Noise yang disetel untuk varians sensor ($R_{\dot{x}, \text{wheel}} = 10^{-3}$, $R_{\psi, \text{imu}} = 10^{-4}$).

---

## Pipeline Proyeksi PointCloud LiDAR

Sensor Velodyne VLP-16 menghasilkan 300.000 titik/detik melintasi 16 laser ring. Untuk meminimalkan utilisasi CPU sambil mempertahankan kesadaran obstacle spasial, `pointcloud_to_laserscan` mengiris point cloud 3D menjadi scan planar 2D laju tinggi:

```mermaid
flowchart LR
  PCL["sensor_msgs/PointCloud2<br/>(/velodyne_points)"] --> SLICE["Z-Axis Vertical Slicing Window<br/>min_height: -0.15 m (0.46 m above floor)<br/>max_height: +0.35 m (0.96 m above floor)"]
  SLICE --> PROJ["Ray Projection & Range Bounding<br/>min_range: 0.20 m, max_range: 100.0 m<br/>angle_increment: 0.0087 rad (0.5 deg)"]
  PROJ --> SCAN["sensor_msgs/LaserScan<br/>(/scan, 20 Hz, 720 points/rev)"]
```

Ini memastikan bahwa obstacle (seperti kaki meja, pallet rendah, dan personel yang berdiri) dalam zona elevasi $0.46\text{ m}$ hingga $0.96\text{ m}$ tertangkap ke dalam costmap navigasi tanpa clutter dari pantulan lantai.

## Dokumentasi Terkait

- [Costmap & Planner](/id/development/ros/costmaps-and-planners): Layer navigasi dan inflation obstacle.
- [Firmware & Perangkat Keras](/id/development/ros/firmware-and-hardware): Penghitungan pulsa mikrokontroler dan loop PID.
- [Simulasi](/id/development/ros/simulation): Verifikasi sensor Gazebo berskala nyata.
