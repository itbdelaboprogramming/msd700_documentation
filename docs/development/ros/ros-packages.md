---
outline: deep
search: false
---

# ROS Package Registry

<RoleBadge role="developer" />

This document provides a comprehensive registry of all ROS 1 Noetic packages within the MSD700 workspace across `msd700_robot` and `ros-web-ui/source`, detailing package roles, key launch files, active nodes, published/subscribed topics, and parameters.

## Workspace Package Layout

```mermaid
flowchart TD
  subgraph RobotCore["msd700_robot (Physical & Sim Stack)"]
    BRINGUP["msd700_bringup<br/>Hardware startup & teleop"]
    CONTROL["msd700_control<br/>EKF fusion & IMU filtering"]
    DESC["msd700_description<br/>URDF, xacro & 3D meshes"]
    FIRM["msd700_firmware<br/>MCU firmware (plain directory,<br/>not a ROS package)"]
    HW["msd700_hardware<br/>Serial motor drivers & battery"]
     NAV["msd700_navigation<br/>move_base, TEB, SLAM"]
     COV["msd700_coverage<br/>boustrophedon sweep planner"]
    SIM["msd700_simulation<br/>Gazebo warehouse & worlds"]
    TP["third_party/ira_laser_tools<br/>Dual-LiDAR pointcloud merger"]
  end

  subgraph WebUIBridge["ros-web-ui/source (Web & Fleet Bridges)"]
    W_BRINGUP["msd700_webui_bringup<br/>Top-level orchestrator launch"]
    W_CTRL["msd700_webui_control<br/>system_command & supervisor"]
    MQTT["dependencies/aws_mqtt<br/>TLS MQTT bridge (cloud & local)"]
    T2S["dependencies/topic2string<br/>JSON telemetry serializer"]
  end

  W_CTRL --> NAV
  W_CTRL --> CONTROL
  T2S --> MQTT
  NAV --> CONTROL
  CONTROL --> HW
  HW --> FIRM
```

## Package Directory: `msd700_robot`

### 0. `msd700_bringup`
The launch layer that assembles hardware, sim, and navigation into runnable stacks.

| Launch file | Purpose | Runs on |
| --- | --- | --- |
| `robot_navigation.launch` | Full stack: hardware **or** sim + control + navigation core, optional RViz/teleop | Robot vs sim (`use_sim`) |
| `robot_slam.launch` | Same layering for mapping (gmapping/hector) | Robot vs sim (`use_sim`) |
| `robot_teleop.launch` | Manual drive: hardware/sim + control + `teleop_twist_keyboard` → `mux/key_vel` | Robot vs sim + teleop/debug |
| `lidar_scanner.launch` | Real-robot lidar entry (Velodyne default, RPLIDAR/legacy); never launched in sim | Robot only |
| `serial_launch.launch` | `rosserial_python` on `/dev/stm32` @57600 | Robot |
| `map_server.launch` | `map_server` on a package-relative or absolute yaml | Both |
| `multiple_point.launch` | `nav_controller.py` + `nav_gui.py` multi-point mode | Neutral |
| `rviz_launch.launch` | Debug/viz helper (description + state publisher + rviz) | Debug |
| `teleop.launch` | `teleop_node_cmd_vel.py` | Teleop |
| `custom_model/` | Legacy single/dual RPLIDAR launches | Robot (legacy) |
| `testing/speed_test.launch` | Serial + teleop + bridger + `calculate.py` rig | Debug/test |

`bridger.launch` (drive geometry + `bridger.py`) is always on, every mode including cold idle.

### 1. `msd700_navigation`
The core autonomous movement, SLAM mapping, and area coverage package.

- **Primary Nodes**:
  - `move_base`: Standard ROS navigation action server utilizing `navfn/NavfnROS` for global path planning and `teb_local_planner/TebLocalPlannerROS` for trajectory optimization.
  - `slam_gmapping`: 2D laser-based SLAM mapping node generating occupancy grids.
  - `amcl`: Adaptive Monte Carlo Localization particle filter for static map localization.
- **Key Launch Files**:
  - `msd700_navigation.launch`: Full navigation bringup with map server, AMCL, and move_base.
  - `msd700_slam.launch`: Gmapping SLAM launch (teleop is the separate `robot_teleop.launch`).
  - `msd700_explore.launch`: Autonomous SLAM frontier exploration (`explore_lite`).
- **Coverage lives next door**: `msd700_coverage/launch/msd700_boustrophedon.launch` runs `path_coverage_node.py`, which plans serpentine paths and replans around obstacles using `src/msd700_coverage/coverage_geometry.py`.

### 2. `msd700_control`
Manages state estimation, coordinate transform hierarchies, and sensor fusion.

- **Primary Nodes**:
  - `ekf_localization_node` (`robot_localization`): Extended Kalman Filter fusing wheel encoder odometry (`/wheel/odom`) and filtered IMU data (`/imu/from_filter`) into a stable `/odometry/filtered` topic at 30 Hz.
  - `imu_filter_node` (`imu_filter_madgwick`, launched by `imu_filter.launch` with `gain 0.01`, magnetometer on, fixed frame `odom`): Madgwick AHRS filter converting raw angular rate and acceleration into orientation quaternions. Its output topic is `/imu/from_filter` (remapped from `/imu/data`), which is what the EKF actually consumes; `/imu/data` itself is published by `hardware_state.py`.
- **Key Launch Files**:
  - `robot_localization.launch`: Configures and launches EKF fusion with parameter loading from `ekf_localization_config.yaml`.
  - `imu_filter.launch`: Launches Madgwick orientation estimation.

### 3. `msd700_description`
Defines physical kinematic structures, collision geometries, and sensor placements using URDF and Xacro.

- **Primary URDF Models**:
  - `urdf/msd700_field.urdf.xacro`: True-scale production robot model (0.90 x 0.70 m body, 4 drive wheels at x = ±0.30 m / y = ±0.30 m, Velodyne mast at 0.50 m above footprint). No casters, no `camera_link`.
  - `urdf/velodyne/VLP_16.urdf.xacro`: High-fidelity 16-channel 3D LiDAR model and Gazebo sensor plugins.
  - `urdf/turtlebot3_waffle.urdf.xacro`: Legacy small-scale prototype model.

### 4. `msd700_hardware` & `msd700_firmware`
Handles low-level hardware interfaces, motor actuation, encoder pulse counting, and battery status.

- **Hardware Architecture**:
  - `serial_launch.launch` (`msd700_bringup`): Connects the host to the low-level microcontroller over `/dev/stm32` at 57600 baud (via `rosserial_python` `serial_node.py`).
  - The firmware speaks the rosserial protocol to the `msd700_hardware` interface, which publishes `/wheel/odom` and the raw IMU topics. There is no `/battery_state` topic anywhere in the stack. See [Firmware and Hardware](/development/ros/firmware-and-hardware) for what the firmware actually implements.

### 5. `msd700_simulation`
Gazebo simulation environment for testing navigation algorithms in software.

- **Key Environments**:
  - `msd700_warehouse_nav.launch`: Launches the 13.98 x 20.91 m AWS RoboMaker Small Warehouse with true-scale `msd700_field` robot model.
  - `scripts/fetch_sim_worlds.sh`: On-demand downloader for 3D simulation meshes (12 MB) from GitHub `ros1` branch.

### 6. `third_party/ira_laser_tools`
Available for merging multiple 2D LiDAR scanners, but the default stack does not use the dual merger: `pointcloud_to_laserscan` converts the Velodyne cloud into `/scan`, with the hazard pipeline adding `/scan_hazard`. See [Perception and Hazard Scan](/development/ros/perception-and-hazard-scan).

### 7. `msd700_msgs`
Robot-internal message contracts (`msd700_robot/msd700_msgs/msg/`):

- `HardwareCommand.msg`: `uint8 movement_command`, `uint8 cam_angle_command`, `float32 right_motor_speed`, `float32 left_motor_speed`.
- `HardwareState.msg`: 8× `float32 ch_ultrasonic_distance_1…_8`, `int32 right/left_motor_pulse_delta`, `float32 heading/pitch/roll`, `float32 acc/gyr/mag_x/y/z`, `float32 uwb_dist/deviation/rho/theta`.
- `WebNavCommand.msg`: `string command`, `geometry_msgs/PoseStamped pose`, `string file_path`.

## Package Directory: `ros-web-ui/source`

### 1. `msd700_webui_control`
Bridges web commands and dashboard telemetry to physical robot hardware.

- **Key Nodes**:
  - `system_command.py`: Subscribes to MQTT `/system_command`, manages the exclusive operating lease, dispatches actions, and publishes `/system_feedback`.
  - `operation_supervisor.py`: Autonomous mission sequencer managing Autopilot waypoint advancement and latching `/string/operation_snapshot`.
  - `switch_mode.py`: ROS service orchestrator dynamically switching between `navigation`, `slam`, `explore`, and `boustrophedon` mode launch stacks (idle = no stack).
  - `hardware_monitor.py`: Background watchdog verifying that critical sensor processes and USB devices remain healthy.

### 2. `dependencies/topic2string`
High-performance serialization layer converting heavy ROS message types to JSON strings.

- **Key Nodes**:
  - `robotpose_to_string.py`: pose telemetry serializer, 2 Hz by default (raised to 25 Hz by `topic2string/launch/msd.launch` so the dashboard marker stays smooth during manual drive).
  - `laserscan_to_string.py`: event-driven compressed laser scan serializer (no fixed rate).
  - `map_compression_pipeline.py` (node name `map_compression_node`): Base64 zlib compression for live SLAM occupancy grids.

### 3. `dependencies/aws_mqtt`
Encrypted transport bridge linking local ROS topics to the central HiveMQ broker.

- **Launch Files**:
  - `nakayama_msd.launch`: Robot-side bridge connecting onboard ROS topics to cloud HiveMQ on port 8883 (TLS).
  - `nakayama_cloud.launch`: Server-side bridge translating MQTT topics into per-unit cloud ROS topics.
  - `local_msd.launch`: Unit-side bridge connecting to local Mosquitto broker (`127.0.0.1:1883`).

## Related Documentation

- [Architecture](/development/architecture): High-level system structure and seams.
- [Sensor Fusion and Control](/development/ros/sensor-fusion-and-control): Detailed EKF and sensor pipeline setup.
- [State and Behavior](/development/state-and-behavior): Detailed state machines for all control nodes.
