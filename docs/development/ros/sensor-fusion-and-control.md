---
outline: deep
search: false
---

# Sensor Fusion, Kinematics, and State Estimation

<RoleBadge role="developer" />

This document provides an exhaustive mathematical and architectural specification of the state estimation pipeline, Extended Kalman Filter (EKF) configuration, IMU orientation filtering, and differential drive kinematics implemented on the MSD700 robot.

## Perception and Fusion Architecture

```mermaid
flowchart TD
  subgraph RawSensors["Physical Sensor Hardware Suite"]
    VLP16["Velodyne VLP-16 3D LiDAR<br/>(16 beams, Ethernet: 192.168.103.231)"]
    IMU_HW["9-DOF IMU (I2C / Serial)<br/>3-Axis Accel, Gyro, Magnetometer"]
    ENCODERS["Wheel Encoders<br/>2400 PPR (msd700_odom)"]
    CAM["USB Camera<br/>separate WebRTC device, not a URDF link"]
  end

  subgraph Preprocessing["ROS Preprocessing & Filtering"]
    PCL2SCAN["pointcloud_to_laserscan<br/>Projects 3D Pointcloud to 2D Planar /scan<br/>Height Window: -0.30 to +0.30 m"]
    IMU_FILT["imu_filter_madgwick<br/>Madgwick AHRS Orientation Filter<br/>gain 0.01, use_mag, fixed frame odom<br/>/imu/mag in, /imu/from_filter out"]
    WHEEL_ODOM["msd700_hardware<br/>Computes Forward Kinematics (/wheel/odom)"]
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

## Differential Drive Forward Kinematics

The field robot has four drive wheels (front/back left/right at $x = \pm 0.30\text{ m}$, $y = \pm 0.30\text{ m}$); odometry fuses them as a differential pair.

### Kinematic Parameters (`msd700_hardware/config/odometry_config.yaml`):
- Wheel Radius: $r = 0.027\text{ m}$ ($2.7\text{ cm}$).
- Track Gauge (Distance between wheel centerlines): $L = 0.23\text{ m}$ ($23\text{ cm}$).
- Encoder Resolution: $PPR = 2400\text{ pulses/revolution}$.

### Displacement Calculations per Control Period $\Delta t$:
Given left encoder delta $\Delta \text{ticks}_L$ and right encoder delta $\Delta \text{ticks}_R$:

$$\Delta s_L = \frac{2 \pi r \cdot \Delta \text{ticks}_L}{PPR}, \quad \Delta s_R = \frac{2 \pi r \cdot \Delta \text{ticks}_R}{PPR}$$

Linear displacement $\Delta s$ and heading change $\Delta \theta$:

$$\Delta s = \frac{\Delta s_R + \Delta s_L}{2}, \quad \Delta \theta = \frac{\Delta s_R - \Delta s_L}{L}$$

### Discrete Odometry Integration:
In the robot local frame with Runge-Kutta 2nd-order (midpoint) integration:

$$x_{k+1} = x_k + \Delta s \cdot \cos\left(\theta_k + \frac{\Delta \theta}{2}\right)$$

$$y_{k+1} = y_k + \Delta s \cdot \sin\left(\theta_k + \frac{\Delta \theta}{2}\right)$$

$$\theta_{k+1} = \theta_k + \Delta \theta$$

---

## Madgwick AHRS IMU Orientation Filter

Raw IMU data on `/imu/data_raw` is processed by `imu_filter_madgwick` to derive drift-free quaternion orientation $\mathbf{q} = [q_w, q_x, q_y, q_z]^T$. The filter runs with `gain 0.01`, `use_mag true`, fixed frame `odom`, reading `/imu/mag` and publishing the fused output on `/imu/from_filter` (which is what the EKF consumes as `imu0`):

### Gradient Descent Optimization:
$$\mathbf{q}_{k+1} = \mathbf{q}_k + \left( \frac{1}{2} \mathbf{q}_k \otimes \mathbf{\omega}_{gyro} - \beta \frac{\nabla \mathbf{f}}{\|\nabla \mathbf{f}\|} \right) \Delta t$$

- $\mathbf{\omega}_{gyro} = [0, \omega_x, \omega_y, \omega_z]^T$: Angular rate vector from gyroscope.
- $\nabla \mathbf{f}$: Objective function gradient aligning measured accelerometer gravity vector with reference earth-frame gravity $[0, 0, 1]^T$.
- $\beta$ (`gain`) $= 0.01$: Filter divergence rate parameter balancing gyroscope responsiveness against accelerometer vibration noise.

---

## 15-Dimensional Extended Kalman Filter (EKF)

The state estimation node (`ekf_localization_node` from `robot_localization`) maintains a 15-state Gaussian random variable vector:

$$\mathbf{x} = \begin{bmatrix} x & y & z & \phi & \theta & \psi & \dot{x} & \dot{y} & \dot{z} & \dot{\phi} & \dot{\theta} & \dot{\psi} & \ddot{x} & \ddot{y} & \ddot{z} \end{bmatrix}^T$$

Where:
- $x, y, z$: 3D position in odometry frame ($z$ clamped to $0$ in 2D mode).
- $\phi, \theta, \psi$: Roll, pitch, and yaw (Euler angles).
- $\dot{x}, \dot{y}, \dot{z}$: Body-frame linear velocities.
- $\dot{\phi}, \dot{\theta}, \dot{\psi}$: Angular velocities.
- $\ddot{x}, \ddot{y}, \ddot{z}$: Linear accelerations.

### Process Update (Prediction Step):
$$\hat{\mathbf{x}}_{k|k-1} = \mathbf{f}(\hat{\mathbf{x}}_{k-1|k-1}, \mathbf{u}_k)$$

$$\mathbf{P}_{k|k-1} = \mathbf{F}_k \mathbf{P}_{k-1|k-1} \mathbf{F}_k^T + \mathbf{Q}$$

- $\mathbf{F}_k = \left. \frac{\partial \mathbf{f}}{\partial \mathbf{x}} \right|_{\hat{\mathbf{x}}_{k-1|k-1}}$: State transition Jacobian matrix.
- $\mathbf{Q}$: Diagonal Process Noise Covariance Matrix (reflecting unmodeled dynamics and wheel slip).

### Measurement Update (Correction Step):
$$\mathbf{K}_k = \mathbf{P}_{k|k-1} \mathbf{H}_k^T \left( \mathbf{H}_k \mathbf{P}_{k|k-1} \mathbf{H}_k^T + \mathbf{R}_k \right)^{-1}$$

$$\hat{\mathbf{x}}_{k|k} = \hat{\mathbf{x}}_{k|k-1} + \mathbf{K}_k \left( \mathbf{z}_k - \mathbf{h}(\hat{\mathbf{x}}_{k|k-1}) \right)$$

$$\mathbf{P}_{k|k} = (\mathbf{I} - \mathbf{K}_k \mathbf{H}_k) \mathbf{P}_{k|k-1}$$

- $\mathbf{z}_k$: Measurement vector fusing velocity $\dot{x}$ from wheel odometry (`odom0: /wheel/odom`), and roll/pitch plus yaw rate from the filtered IMU (`imu0`, frame `odom`). Roll and pitch come from the IMU; the filter runs at $30\text{ Hz}$ in the `odom` frame.
- $\mathbf{R}_k$: Measurement Noise Covariance Matrix from `ekf_localization_config.yaml` (process and initial covariances in-file; see the yaml for the tuned values).

---

## LiDAR PointCloud Projection Pipeline

The Velodyne VLP-16 sensor produces 300,000 points/sec across 16 laser rings. To minimize CPU utilization while preserving spatial obstacle awareness, `pointcloud_to_laserscan` slices the 3D point cloud into a high-rate 2D planar scan:

```mermaid
flowchart LR
  PCL["sensor_msgs/PointCloud2<br/>(/velodyne_points)"] --> SLICE["Z-Axis Vertical Slicing Window<br/>min_height: -0.30 m<br/>max_height: +0.30 m"]
  SLICE --> PROJ["Ray Projection & Range Bounding<br/>min_range: 0.40 m, max_range: 100.0 m<br/>scan_time: 0.1 s (10 Hz)<br/>angle_increment: 0.0087 rad (0.5 deg)"]
  PROJ --> SCAN["sensor_msgs/LaserScan<br/>(/scan, 10 Hz)"]
```

This keeps the $\pm 0.30\text{ m}$ band around the sensor in the navigation costmaps while returns outside it (floor reflections, ceiling) are dropped. A second pipeline (`cloud_hazard.launch`) fits ground and watches the $0.08$–$0.65\text{ m}$ band above it for holes and drop-offs, publishing `/scan_hazard`.

## Related Documentation

- [Costmaps and Planners](/development/ros/costmaps-and-planners): Navigation layers and obstacle inflation.
- [Firmware and Hardware](/development/ros/firmware-and-hardware): Microcontroller pulse counting and PID loops.
- [Simulation](/development/ros/simulation): True-scale Gazebo sensor verification.
