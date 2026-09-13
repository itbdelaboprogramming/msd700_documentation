---
outline: deep
search: false
---

# Coordinate Frames, Transforms, and TF Architecture

<RoleBadge role="developer" />

This document provides a comprehensive specification of the coordinate transform tree (`tf` / `tf2`), spatial reference frames, dynamic transform broadcasters, sensor offsets, and cross-machine clock restamping implemented in the MSD700 robot system.

## Coordinate Frame Hierarchy (TF Tree)

The coordinate transform tree adheres to ROS REP-103 (Standard Units of Measure & Coordinate Conventions) and REP-105 (Coordinate Frames for Mobile Platforms):

```mermaid
flowchart TD
  MAP["map<br/>(Global Fixed World Frame, Origin at Homebase)"] -->|"AMCL / SLAM Global Correction (10 Hz)"| ODOM["odom<br/>(Smooth Continuous Local Odometry Frame)"]
  ODOM -->|"EKF Fusion: robot_localization (30 Hz)"| BASE_FP["base_footprint<br/>(Chassis 2D Projection on Floor Plane)"]

  BASE_FP -->|"Static TF: z = +0.010 m"| BASE_LINK["base_link<br/>(Chassis Center of Rotation)"]

  BASE_LINK -->|"Continuous TF: Joint State Publisher"| WHEEL_L["wheel_left_link (y = +0.144 m)"]
  BASE_LINK -->|"Continuous TF: Joint State Publisher"| WHEEL_R["wheel_right_link (y = -0.144 m)"]

  BASE_LINK -->|"Static TF: xyz = [0.00, 0.00, 0.200]"| IMU_LINK["imu_link (9-DOF IMU Sensor)"]
  BASE_LINK -->|"Static TF: xyz = [0.25, 0.00, 0.610]"| BASE_SCAN["base_scan / velodyne (3D LiDAR)"]
  BASE_LINK -->|"Static TF: xyz = [0.45, 0.00, 0.350]"| CAM_LINK["camera_link (HD Camera Optical Frame)"]
```

---

## Transform Publishers and Update Rates

| Transform Edge | Broadcaster Node | Rate | Mathematical Source | Behavior During Outages |
| --- | --- | --- | --- | --- |
| `map -> odom` | `amcl` / `slam_gmapping` | 10 Hz | Corrects odometric drift against static laser occupancy grid. | Discrete jumps when localized; preserves last transform if laser scans drop. |
| `odom -> base_footprint` | `robot_localization` (`ekf_localization_node`) | 30 Hz | Continuous fusion of wheel encoder velocities and IMU yaw/angular rates. | Continuous, smooth, drift-free short-term trajectory. |
| `base_footprint -> base_link` | `robot_state_publisher` | Static | Fixed elevation offset ($z = 0.010\text{ m}$). | Fixed transform from URDF. |
| `base_link -> base_scan` | `robot_state_publisher` | Static | Physical mast mounting coordinates ($x = 0.250\text{ m}, z = 0.610\text{ m}$). | Fixed transform from URDF. |
| `base_link -> imu_link` | `robot_state_publisher` | Static | Physical chassis mount ($z = 0.200\text{ m}$). | Fixed transform from URDF. |
| `base_link -> camera_link` | `robot_state_publisher` | Static | Front chassis mount ($x = 0.450\text{ m}, z = 0.350\text{ m}$). | Fixed transform from URDF. |

---

## Spatial Coordinate Conventions (REP-103)

MSD700 strictly enforces right-handed Cartesian coordinate systems:

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

- **$+X$**: Points directly forward along the robot's primary direction of travel.
- **$+Y$**: Points directly leftward across the robot's lateral width.
- **$+Z$**: Points vertically upward perpendicular to the floor plane.
- **Rotation Angles**: Follow right-hand rule (Counter-Clockwise rotation around $+Z$ corresponds to positive yaw rate $+\dot{\theta}$).

---

## Cross-Machine Clock Domain Restamping (`BoundaryPublisher`)

When telemetry (such as robot pose and laser scans) is bridged from the physical robot across the internet to the cloud server, **clock drift between physical machines creates `TF_OLD_DATA` extrapolation warnings** if timestamps are evaluated directly.

```mermaid
sequenceDiagram
  autonumber
  participant Robot as Robot Jetson (Clock Domain A)
  participant MQTT as Cloud HiveMQ (TLS 8883)
  participant Relay as rosweb_unit_<ULID> (Cloud Server Domain B)
  participant Canvas as Browser ROS2D Canvas

  Robot->>Robot: Stamp Pose with Jetson Time (t_robot)
  Robot->>MQTT: Publish /string/robotpose JSON payload
  MQTT->>Relay: Deliver payload over WAN
  Note over Relay: BoundaryPublisher Restamping Filter
  Relay->>Relay: Measure Delta = now(server) - t_robot<br/>Restamp message with ros::Time::now()
  Relay->>Canvas: Publish /server/robot_pose to rosbridge
  Canvas->>Canvas: Render smooth icon position without TF latency drops
```

### Why Restamping Is Load-Bearing:
1. **Jetson RTC Limitations**: Physical SBCs in field environments without NTP access can boot with clocks skewed by seconds or months.
2. **Buffer Eviction**: If incoming pose messages carry timestamps in the past relative to the server's ROS master, `tf2_ros::Buffer` immediately discards them, preventing the web canvas from rendering robot movement.
3. **`BoundaryPublisher` Solution**: `patch_time.py` strips the robot hardware timestamp and restamps geometric payloads with `ros::Time::now()` upon entry into the server ROS master.

## Related Documentation

- [Sensor Fusion and Control](/development/sensor-fusion-and-control): Kinematic state estimation and EKF.
- [Costmaps and Planners](/development/costmaps-and-planners): Navigation costmap coordinate frames.
- [rosbridge Protocol](/development/rosbridge-protocol): WebSocket topic serialization.
