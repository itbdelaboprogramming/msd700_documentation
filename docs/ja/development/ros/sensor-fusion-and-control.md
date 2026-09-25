---
outline: deep
search: false
---

# センサーフュージョン、キネマティクス、状態推定

<RoleBadge role="developer" />

本ドキュメントは、MSD700ロボットに実装されている状態推定パイプライン、拡張カルマンフィルタ(EKF)構成、IMUオリエンテーションフィルタリング、差動二輪駆動キネマティクスについての網羅的な数学的・アーキテクチャ的仕様を提供する。

## 知覚とフュージョンのアーキテクチャ

![知覚とフュージョンのアーキテクチャ](../../../development/ros/diagrams/sensor-fusion-and-control-perception-and-fusion-architecture.drawio)

---

## 差動二輪駆動の順運動学

このスタックは2台の機体で共有される。シミュレーションは**field**ロボット(0.90 x 0.70 m、クローラー式、`msd700_field`モデル、スキッドステアプラグインとGazeboの真値オドメトリ)を動かす。実機試験には小型の**prototype**(`irbot`モデル、約0.30 x 0.30 m、後輪2輪駆動+キャスター、純粋な差動駆動)を使う。一方のチューニングをもう一方に持ち込まないこと。以下の数値はprototypeのものである。

実機(既定の`hardware_mode 1`)では、`raw_sensor_node`(`msd700_control/src/hardware_state.py`)がSTM32のエンコーダーパルス差分を`/wheel/odom`に変換する。(`msd700_hardware/config/odometry_config.yaml`は`hardware_mode 2`でのみ使われる別のC++ハードウェアインターフェース用である。)

### キネマティクスパラメータ(`msd700_control/config/pose_config.yaml`、名前空間`/raw_sensor`):
- ホイール半径: $r = 0.0275\text{ m}$(`wheel_radius: 2.75` cm)。
- トラック(車輪間距離): $L = 0.26\text{ m}$(`wheel_distance: 26.0` cm、実機で計測。2026年9月までは`78.0`で、旋回が毎回3倍行き過ぎていた)。
- エンコーダー分解能: `ppr: 50000`、経験的係数`pulse_scale: 24.0`を掛ける。
- 方位の入力源: `use_imu: 1`。方位は車輪差ではなくフィルタ済みIMUから得る。

同じファイルを`bridger.py`も読むため、指令側(twist → 車輪速度)とオドメトリ側は同一の形状を使う。

### 周期ごとの計算($\Delta t$、`compute_period` 10 ms):

$$d = \frac{2 \pi r}{PPR} \cdot s_{\text{pulse}}, \quad \Delta s_L = d \cdot \Delta \text{ticks}_L, \quad \Delta s_R = d \cdot \Delta \text{ticks}_R$$

$$v = \frac{\Delta s_R + \Delta s_L}{2 \Delta t}, \quad \omega = \frac{\Delta s_R - \Delta s_L}{L \, \Delta t}$$

$$x_{k+1} = x_k + \frac{\Delta s_R + \Delta s_L}{2} \cos \theta_k, \quad y_{k+1} = y_k + \frac{\Delta s_R + \Delta s_L}{2} \sin \theta_k, \quad \theta_k = \psi_{\text{IMU}}$$

`/wheel/odom`のtwistには$v$と$\omega$が入り、EKFはtwistのみを使う。`raw_sensor_node`は`odom -> base_footprint`をブロードキャスト**しない**(`publish_tf`の既定値はfalse)。このTFはEKFが担う。

---

## Madgwick AHRS IMUオリエンテーションフィルタ

`/imu/data_raw`上の生IMUデータは、`imu_filter_madgwick`によって処理され、ドリフトフリーなクォータニオンオリエンテーション$\mathbf{q} = [q_w, q_x, q_y, q_z]^T$が導出される。フィルタは`gain 0.01`、`use_mag true`、固定フレーム`odom`で動作し、`/imu/mag`を読み取り、融合結果を`/imu/from_filter`にパブリッシュする。`raw_sensor_node`がこれを購読し、フィルタのロール/ピッチと積算ヨーを組み合わせて`/imu/data`(フレーム`imu`)として再パブリッシュし、これがEKFの`imu0`として消費される:

### 勾配降下法による最適化:
$$\mathbf{q}_{k+1} = \mathbf{q}_k + \left( \frac{1}{2} \mathbf{q}_k \otimes \mathbf{\omega}_{gyro} - \beta \frac{\nabla \mathbf{f}}{\|\nabla \mathbf{f}\|} \right) \Delta t$$

- $\mathbf{\omega}_{gyro} = [0, \omega_x, \omega_y, \omega_z]^T$: ジャイロスコープからの角速度ベクトル。
- $\nabla \mathbf{f}$: 実測された加速度計の重力ベクトルを、基準地球座標系の重力$[0, 0, 1]^T$に整合させる目的関数の勾配。
- $\beta$(`gain`)$= 0.01$: ジャイロスコープの応答性と加速度計の振動ノイズのバランスを取るフィルタ発散率パラメータ。

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

- $\mathbf{z}_k$: ホイールオドメトリ(`odom0: /wheel/odom`)からの機体速度$\dot{x}, \dot{y}$と、`/imu/data`(`imu0`)からのロール・ピッチ・ヨーおよび3軸すべての角速度を融合した観測ベクトル。直線加速度は融合しない。`two_d_mode`は(2026年8月以降)**false**で、不整地ではロボットの傾きを許容する。$z$は推測航法による値であり実際の高さではない。フィルタは`world_frame: odom`で$30\text{ Hz}$動作する。
- $\mathbf{R}_k$: `ekf_localization_config.yaml`由来の観測ノイズ共分散行列(プロセス共分散と初期共分散はファイル内。チューニング値はyamlを参照)。

---

## LiDARポイントクラウド投影パイプライン

Velodyne VLP-16センサーは16本のレーザーリングにわたって毎秒30万点を生成する。空間的な障害物認識を維持しつつCPU使用率を最小化するため、`pointcloud_to_laserscan`は3Dポイントクラウドを高頻度の2D平面スキャンにスライスする:

![LiDARポイントクラウド投影パイプライン](../../../development/ros/diagrams/sensor-fusion-and-control-lidar-pointcloud-projection-pipeline.drawio)

センサー周辺の$\pm 0.30\text{ m}$バンドはナビゲーションコストマップに残し、それ以外(床面反射、天井)は落とす。第2のパイプライン(`cloud_hazard.launch`)は地面をフィットさせ、その上$0.08$–$0.65\text{ m}$バンドで穴や段差を監視し、`/scan_hazard`をパブリッシュする。

## 関連ドキュメント

- [コストマップ & プランナー](/ja/development/ros/costmaps-and-planners): ナビゲーションレイヤーと障害物インフレーション。
- [ファームウェア & ハードウェア](/ja/development/ros/firmware-and-hardware): マイコンのパルスカウントとPIDループ。
- [シミュレーション (Gazebo)](/ja/development/ros/simulation): 実寸スケールのGazeboセンサー検証。
