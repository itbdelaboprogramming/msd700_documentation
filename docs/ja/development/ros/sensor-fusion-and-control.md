---
outline: deep
search: false
---

# センサーフュージョン、キネマティクス、状態推定

<RoleBadge role="developer" />

本ドキュメントは、MSD700ロボットに実装されている状態推定パイプライン、拡張カルマンフィルタ(EKF)構成、IMUオリエンテーションフィルタリング、差動二輪駆動キネマティクスについての網羅的な数学的・アーキテクチャ的仕様を提供する。

## 知覚とフュージョンのアーキテクチャ

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

## 差動二輪駆動の順運動学

実機ロボットは、4つの受動キャスターホイールに支持された2輪差動駆動プラットフォームとして動作する。

### キネマティクスパラメータ:
- ホイール半径: $r = 0.075\text{ m}$(ホイール直径: $0.150\text{ m}$)。
- トラックゲージ(駆動輪センターライン間の距離): $L = 0.580\text{ m}$。
- エンコーダー分解能: $CPR = 4000\text{ counts/revolution}$($4\times$クアドラチャデコード後)。
- ギアボックス減速比: $N = 30:1$。

### 制御周期$\Delta t$ごとの変位計算:
左エンコーダー差分$\Delta \text{ticks}_L$と右エンコーダー差分$\Delta \text{ticks}_R$が与えられたとき:

$$\Delta s_L = \frac{2 \pi r \cdot \Delta \text{ticks}_L}{CPR \cdot N}, \quad \Delta s_R = \frac{2 \pi r \cdot \Delta \text{ticks}_R}{CPR \cdot N}$$

並進変位$\Delta s$と方位変化$\Delta \theta$:

$$\Delta s = \frac{\Delta s_R + \Delta s_L}{2}, \quad \Delta \theta = \frac{\Delta s_R - \Delta s_L}{L}$$

### 離散オドメトリ積分:
ロボットローカルフレームにおいて、ルンゲ・クッタ2次(中点法)積分を用いる:

$$x_{k+1} = x_k + \Delta s \cdot \cos\left(\theta_k + \frac{\Delta \theta}{2}\right)$$

$$y_{k+1} = y_k + \Delta s \cdot \sin\left(\theta_k + \frac{\Delta \theta}{2}\right)$$

$$\theta_{k+1} = \theta_k + \Delta \theta$$

---

## Madgwick AHRS IMUオリエンテーションフィルタ

`/imu/data_raw`($50\text{ Hz}$)上の生IMUデータは、`imu_filter_madgwick`によって処理され、ドリフトフリーなクォータニオンオリエンテーション$\mathbf{q} = [q_w, q_x, q_y, q_z]^T$が導出される:

### 勾配降下法による最適化:
$$\mathbf{q}_{k+1} = \mathbf{q}_k + \left( \frac{1}{2} \mathbf{q}_k \otimes \mathbf{\omega}_{gyro} - \beta \frac{\nabla \mathbf{f}}{\|\nabla \mathbf{f}\|} \right) \Delta t$$

- $\mathbf{\omega}_{gyro} = [0, \omega_x, \omega_y, \omega_z]^T$: ジャイロスコープからの角速度ベクトル。
- $\nabla \mathbf{f}$: 実測された加速度計の重力ベクトルを、基準地球座標系の重力$[0, 0, 1]^T$に整合させる目的関数の勾配。
- $\beta = 0.05$: ジャイロスコープの応答性と加速度計の振動ノイズのバランスを取るフィルタ発散率パラメータ。

---

## 15次元拡張カルマンフィルタ(EKF)

状態推定ノード(`robot_localization`の`ekf_localization_node`)は、15状態のガウス確率変数ベクトルを保持する:

$$\mathbf{x} = \begin{bmatrix} x & y & z & \phi & \theta & \psi & \dot{x} & \dot{y} & \dot{z} & \dot{\phi} & \dot{\theta} & \dot{\psi} & \ddot{x} & \ddot{y} & \ddot{z} \end{bmatrix}^T$$

ここで:
- $x, y, z$: オドメトリフレームにおける3D位置($2$Dモードでは$z$は$0$に固定)。
- $\phi, \theta, \psi$: ロール、ピッチ、ヨー(オイラー角)。
- $\dot{x}, \dot{y}, \dot{z}$: 機体座標系の並進速度。
- $\dot{\phi}, \dot{\theta}, \dot{\psi}$: 角速度。
- $\ddot{x}, \ddot{y}, \ddot{z}$: 並進加速度。

### プロセス更新(予測ステップ):
$$\hat{\mathbf{x}}_{k|k-1} = \mathbf{f}(\hat{\mathbf{x}}_{k-1|k-1}, \mathbf{u}_k)$$

$$\mathbf{P}_{k|k-1} = \mathbf{F}_k \mathbf{P}_{k-1|k-1} \mathbf{F}_k^T + \mathbf{Q}$$

- $\mathbf{F}_k = \left. \frac{\partial \mathbf{f}}{\partial \mathbf{x}} \right|_{\hat{\mathbf{x}}_{k-1|k-1}}$: 状態遷移ヤコビ行列。
- $\mathbf{Q}$: プロセスノイズ共分散対角行列(未モデル化のダイナミクスとホイールスリップを反映)。

### 観測更新(修正ステップ):
$$\mathbf{K}_k = \mathbf{P}_{k|k-1} \mathbf{H}_k^T \left( \mathbf{H}_k \mathbf{P}_{k|k-1} \mathbf{H}_k^T + \mathbf{R}_k \right)^{-1}$$

$$\hat{\mathbf{x}}_{k|k} = \hat{\mathbf{x}}_{k|k-1} + \mathbf{K}_k \left( \mathbf{z}_k - \mathbf{h}(\hat{\mathbf{x}}_{k|k-1}) \right)$$

$$\mathbf{P}_{k|k} = (\mathbf{I} - \mathbf{K}_k \mathbf{H}_k) \mathbf{P}_{k|k-1}$$

- $\mathbf{z}_k$: ホイールオドメトリからの速度$\dot{x}$と、IMUからの絶対ヨー$\psi$および角速度$\dot{\psi}$を融合した観測ベクトル。
- $\mathbf{R}_k$: センサー分散に合わせてチューニングされた観測ノイズ共分散行列($R_{\dot{x}, \text{wheel}} = 10^{-3}$、$R_{\psi, \text{imu}} = 10^{-4}$)。

---

## LiDARポイントクラウド投影パイプライン

Velodyne VLP-16センサーは16本のレーザーリングにわたって毎秒30万点を生成する。空間的な障害物認識を維持しつつCPU使用率を最小化するため、`pointcloud_to_laserscan`は3Dポイントクラウドを高頻度の2D平面スキャンにスライスする:

```mermaid
flowchart LR
  PCL["sensor_msgs/PointCloud2<br/>(/velodyne_points)"] --> SLICE["Z-Axis Vertical Slicing Window<br/>min_height: -0.15 m (0.46 m above floor)<br/>max_height: +0.35 m (0.96 m above floor)"]
  SLICE --> PROJ["Ray Projection & Range Bounding<br/>min_range: 0.20 m, max_range: 100.0 m<br/>angle_increment: 0.0087 rad (0.5 deg)"]
  PROJ --> SCAN["sensor_msgs/LaserScan<br/>(/scan, 20 Hz, 720 points/rev)"]
```

これにより、$0.46\text{ m}$から$0.96\text{ m}$の高さゾーン内にある障害物(テーブルの脚、低いパレット、立っている作業員など)が、床面反射のノイズを伴わずにナビゲーションコストマップへ確実に取り込まれる。

## 関連ドキュメント

- [コストマップ & プランナー](/ja/development/ros/costmaps-and-planners): ナビゲーションレイヤーと障害物インフレーション。
- [ファームウェア & ハードウェア](/ja/development/ros/firmware-and-hardware): マイコンのパルスカウントとPIDループ。
- [シミュレーション (Gazebo)](/ja/development/ros/simulation): 実寸スケールのGazeboセンサー検証。
