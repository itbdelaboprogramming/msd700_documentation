---
outline: deep
search: false
---

# Sensor Fusion, Kinematics, and State Estimation

<RoleBadge role="developer" />

This document provides an exhaustive mathematical and architectural specification of the state estimation pipeline, Extended Kalman Filter (EKF) configuration, IMU orientation filtering, and differential drive kinematics implemented on the MSD700 robot.

## Perception and Fusion Architecture

![Perception and Fusion Architecture](./diagrams/sensor-fusion-and-control-perception-and-fusion-architecture.drawio)

---

## Differential Drive Forward Kinematics

Two machines share this stack. The simulation runs the **field** robot (0.90 x 0.70 m, tracked, `msd700_field` model, skid-steer plugin with Gazebo ground-truth odometry). Physical testing uses the smaller **prototype** (`irbot` model, about 0.30 x 0.30 m, two rear drive wheels plus casters, a true differential drive). Do not carry tuning from one to the other. The numbers below are the prototype's.

On the real unit (`hardware_mode 1`, the default) `raw_sensor_node` (`msd700_control/src/hardware_state.py`) turns the STM32's encoder pulse deltas into `/wheel/odom`. (`msd700_hardware/config/odometry_config.yaml` belongs to the separate C++ hardware interface used only in `hardware_mode 2`.)

### Kinematic Parameters (`msd700_control/config/pose_config.yaml`, namespace `/raw_sensor`):
- Wheel radius: $r = 0.0275\text{ m}$ (`wheel_radius: 2.75` cm).
- Track (wheel separation): $L = 0.26\text{ m}$ (`wheel_distance: 26.0` cm, measured on the real robot; it was `78.0` until September 2026, which made every pivot overshoot 3×).
- Encoder resolution: `ppr: 50000`, multiplied by an empirical `pulse_scale: 24.0`.
- Heading source: `use_imu: 1`, so heading comes from the filtered IMU, not from the wheel difference.

The same file feeds `bridger.py`, so the command side (twist → wheel speeds) and the odometry side agree on one geometry.

### Per-cycle computation ($\Delta t$, `compute_period` 10 ms):

$$d = \frac{2 \pi r}{PPR} \cdot s_{\text{pulse}}, \quad \Delta s_L = d \cdot \Delta \text{ticks}_L, \quad \Delta s_R = d \cdot \Delta \text{ticks}_R$$

$$v = \frac{\Delta s_R + \Delta s_L}{2 \Delta t}, \quad \omega = \frac{\Delta s_R - \Delta s_L}{L \, \Delta t}$$

$$x_{k+1} = x_k + \frac{\Delta s_R + \Delta s_L}{2} \cos \theta_k, \quad y_{k+1} = y_k + \frac{\Delta s_R + \Delta s_L}{2} \sin \theta_k, \quad \theta_k = \psi_{\text{IMU}}$$

`/wheel/odom` carries $v$ and $\omega$ in its twist; the EKF uses only the twist. `raw_sensor_node` does **not** broadcast `odom -> base_footprint` (`publish_tf` defaults to false); the EKF owns that transform.

---

## Madgwick AHRS IMU Orientation Filter

Raw IMU data on `/imu/data_raw` is processed by `imu_filter_madgwick` to derive drift-free quaternion orientation $\mathbf{q} = [q_w, q_x, q_y, q_z]^T$. The filter runs with `gain 0.01`, `use_mag true`, fixed frame `odom`, reading `/imu/mag` and publishing the fused output on `/imu/from_filter`. `raw_sensor_node` subscribes to that, combines the filter's roll/pitch with the accumulated yaw and republishes it as `/imu/data` (frame `imu`), which is what the EKF consumes as `imu0`:

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

- $\mathbf{z}_k$: Measurement vector fusing body velocities $\dot{x}, \dot{y}$ from wheel odometry (`odom0: /wheel/odom`) and roll, pitch, yaw plus all three angular rates from `/imu/data` (`imu0`). Linear acceleration is not fused. `two_d_mode` is **false** (since August 2026) so the robot may tilt on uneven ground; $z$ is dead-reckoned and not a real height. The filter runs at $30\text{ Hz}$ with `world_frame: odom`.
- $\mathbf{R}_k$: Measurement Noise Covariance Matrix from `ekf_localization_config.yaml` (process and initial covariances in-file; see the yaml for the tuned values).

---

## LiDAR PointCloud Projection Pipeline

The Velodyne VLP-16 sensor produces 300,000 points/sec across 16 laser rings. To minimize CPU utilization while preserving spatial obstacle awareness, `pointcloud_to_laserscan` slices the 3D point cloud into a high-rate 2D planar scan:

![LiDAR PointCloud Projection Pipeline](./diagrams/sensor-fusion-and-control-lidar-pointcloud-projection-pipeline.drawio)

This keeps the $\pm 0.30\text{ m}$ band around the sensor in the navigation costmaps while returns outside it (floor reflections, ceiling) are dropped. A second pipeline (`cloud_hazard.launch`) fits ground and watches the $0.08$–$0.65\text{ m}$ band above it for holes and drop-offs, publishing `/scan_hazard`.

## Related Documentation

- [Costmaps and Planners](/development/ros/costmaps-and-planners): Navigation layers and obstacle inflation.
- [Firmware and Hardware](/development/ros/firmware-and-hardware): Microcontroller pulse counting and PID loops.
- [Simulation](/development/ros/simulation): True-scale Gazebo sensor verification.
