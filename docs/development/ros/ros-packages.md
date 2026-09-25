---
outline: deep
search: false
---

# ROS Package Registry

<RoleBadge role="developer" />

This document provides a comprehensive registry of all ROS 1 Noetic packages within the MSD700 workspace across `msd700_robot` and `ros-web-ui/source`, detailing package roles, key launch files, active nodes, published/subscribed topics, and parameters.

## Workspace Package Layout

![Workspace Package Layout](./diagrams/ros-packages-workspace-package-layout.drawio)

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
  - `ekf_localization_node` (`robot_localization`): Extended Kalman Filter fusing wheel odometry (`/wheel/odom`) and the IMU (`/imu/data`) into `/odometry/filtered` at 30 Hz, and broadcasting `odom -> base_footprint`.
  - `imu_filter_node` (`imu_filter_madgwick`, launched by `imu_filter.launch` with `gain 0.01`, magnetometer on, fixed frame `odom`): Madgwick AHRS filter over `/imu/data_raw` + `/imu/mag`. Its output is remapped to `/imu/from_filter`; `hardware_state.py` (`raw_sensor_node`) reads that and republishes the attitude as `/imu/data`, which is what the EKF consumes.
  - `raw_sensor_node` (`hardware_state.py`, launched by `hardware_state_sub.launch` in `hardware_mode 1`): turns the STM32's `hardware_state` into `/wheel/odom`, `/imu/data_raw`, `/imu/mag` and `/imu/data`, using the geometry in `config/pose_config.yaml`.
- **Key Launch Files**:
  - `robot_localization.launch`: Configures and launches EKF fusion with parameter loading from `ekf_localization_config.yaml`.
  - `imu_filter.launch`: Launches Madgwick orientation estimation.

### 3. `msd700_description`
Defines physical kinematic structures, collision geometries, and sensor placements using URDF and Xacro.

- **Primary URDF Models**:
  - `urdf/irbot.urdf.xacro`: The model the **real unit** publishes (via `launch/robot_description.launch.xml`, always on in `bringup_msd.launch`). Fixed chain `base_footprint -> base_link -> laser` and `base_link -> imu`; lidar height from `config/msd700_xacro_irbot.yaml`.
  - `urdf/msd700_field.urdf.xacro`: True-scale **simulation** model (0.90 x 0.70 m body, 4 drive wheels at x = ±0.30 m / y = ±0.30 m, Velodyne mast at 0.50 m above footprint). No casters, no `camera_link`.
  - `urdf/velodyne/VLP_16.urdf.xacro`: High-fidelity 16-channel 3D LiDAR model and Gazebo sensor plugins.
  - `urdf/turtlebot3_waffle.urdf.xacro`: Legacy small-scale prototype model.

### 4. `msd700_hardware` & `msd700_firmware`
Handles low-level hardware interfaces, motor actuation and encoder pulse counting.

- **Hardware Architecture**:
  - `serial_launch.launch` (`msd700_bringup`): Connects the host to the low-level microcontroller over `/dev/stm32` at 57600 baud (via `rosserial_python` `serial_node.py`).
  - The STM32 firmware speaks rosserial (`hardware_state` / `hardware_command`). In the default `hardware_mode 1`, `raw_sensor_node` and `bridger.py` handle both directions; the C++ `msd700_hardware` interface (`msd700_hardware.launch`, `config/odometry_config.yaml`) is only used in `hardware_mode 2`. There is no `/battery_state` topic anywhere in the stack. See [Firmware and Hardware](/development/ros/firmware-and-hardware) for what the firmware actually implements.

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

### 8. `msd700_perception`
Turns the Velodyne point cloud into the 2D scans the rest of the stack uses: `/scan` for SLAM/AMCL, `/scan_hazard` (obstacles plus holes) for the costmaps, `/scan_holes` for the dashboard overlay. See [Perception and Hazard Scan](/development/ros/perception-and-hazard-scan).

- **Nodes**: `hazard_scan_node.py` (the pipeline, library code in `src/msd700_perception/`, C fast path in `src_cpp/fastops.cpp`); `hazard_inspector.py` for stage-by-stage debugging.
- **Launch files**: `velodyne_hazard.launch` (drop-in replacement for `msd700_hardware/velodyne_scanner.launch`, chosen by `MSD700_HAZARD_SCAN=true`), `cloud_hazard.launch`, `hazard_scan.launch`.
- **Config**: `config/hazard_scan.yaml`.

### 9. `msd700_coverage`
The boustrophedon coverage planner behind area sweeps and operation playlists. See [Boustrophedon Coverage](/development/ros/boustrophedon-and-alignment).

- **Nodes**: `path_coverage_node.py` (decomposition, lane planning, goal dispatch, pause/resume ownership), `autocover_node.py` (optional automatic start, off by default).
- **Launch files**: `msd700_boustrophedon.launch` (the `boustrophedon` mode in `switch_mode.yaml`), `coverage.launch`.
- **Config**: `config/boustrophedon_params.yaml`, `config/robot/field.yaml` / `prototype.yaml`.

### 10. `third_party/sensor_pointcloud`
Aggregates range messages into a `PointCloud2`. Vendored but not launched by the current stack.

`msd700_movement/` is a leftover directory with no `package.xml` (old navigation scripts, `rplidar_ros`, a second `robot_pose_publisher` copy); catkin does not build it.

## Package Directory: `ros-web-ui/source`

### 1. `msd700_webui_control`
Bridges web commands and dashboard telemetry to physical robot hardware.

- **Key Nodes**:
  - `system_command.py`: Subscribes to MQTT `/system_command`, manages the exclusive operating lease, dispatches actions, and publishes `/system_feedback`.
  - `operation_supervisor.py`: Autonomous mission sequencer managing Autopilot waypoint advancement and latching `/string/operation_snapshot`.
  - `switch_mode.py`: ROS service orchestrator dynamically switching between `navigation`, `slam`, `explore`, and `boustrophedon` mode launch stacks (idle = no stack).
  - `hardware_monitor.py`: Background watchdog verifying that critical sensor processes and USB devices remain healthy.

### 2. `dependencies/topic2string`
Serialization layer converting heavy ROS message types to compact strings for MQTT. Since 2026-09-18 the unit runs the **C++ nodes** (`bringup_msd.launch` → `topic2string_impl:=cpp_nodes` → `launch/msd_cpp_nodes.launch`, sources in `src/nodelets/`). The Python scripts in `scripts/` and `launch/msd.launch` stay as a rollback (`topic2string_impl:=python`); node names and topics are identical in both.

- **Key Nodes**:
  - `robotpose_msd` (`robotpose_to_string_node`): pose telemetry serializer at 25 Hz, skipped when the robot has not moved.
  - `laserscan_to_string` (`laserscan_to_string_node`): compressed laser scan serializer at 2 Hz (`publish_frequency 2.0`), quantised to centimetres.
  - `map_compression_node` (`map_compression_node`, `src/nodelets/map_compression.cpp`): compresses the live occupancy grid (`base64(zlib(...))`, cells packed as int8), sends on change plus a heartbeat and bursts after a map reset.

### 3. `dependencies/aws_mqtt`
Encrypted transport bridge linking local ROS topics to the central HiveMQ broker.

- **Launch Files**:
  - `nakayama_msd.launch`: Robot-side bridge connecting onboard ROS topics to cloud HiveMQ on port 8883 (TLS).
  - `nakayama_cloud.launch`: Server-side bridge translating MQTT topics into per-unit cloud ROS topics.
  - `local_msd.launch`: Unit-side bridge connecting to local Mosquitto broker (`127.0.0.1:1883`).

### 4. `msd700_webui_bringup`
Top-level launch files that start a whole side of the system.

- `bringup_msd.launch`: the unit. Always-on base (`twist_mux`, `bridger`, robot description, hardware monitor), `topic2string` (C++ by default), MQTT bridge, `system_command`, `switch_mode`, idle detector.
- `bringup_cloud.launch`: the cloud server. Per-unit or fleet relays (`use_unit_relays`, `use_multi_unit_bridge`), backend, rosbridge.
- `bringup_local_server.launch`: the unit's local server half (backend, rosbridge, `topic2string/local.launch`) in a separate container sharing the roscore.
- `debug_local.launch`: cloud + unit on one machine for debugging.

### 5. `msd700_webui_msg`
Message and service types for mode switching: `SwitchModeMsg.msg`, `SwitchMode.srv`, `SetMapPath.srv`.

### 6. `msd700_webui_utils`
- `idle_detector.py` (`idle_detector.launch`, started by `bringup_msd.launch`): watches the robot pose on TF and reports whether the robot is actually moving; `system_command.py` uses it for the stuck/idle checks.
- `string_monitor.py`: debug tool that reports `std_msgs/String` payload sizes on a topic.

### 7. `dependencies/robot_pose_publisher`
C++ node publishing the robot pose in `map` from TF as `/robot_pose`, which `topic2string` serializes for the dashboard.

### 8. `dependencies/ROS-dashboard-backend` (package `ros_dashboard_backend`)
The Node.js REST API (`scripts/backend_node`, `admin_api.js`, `enroll_api.js`, `sync_*.js`), launched by `launch/ros_dashboard_backend.launch`. See [API Reference](/development/api-reference).

## Related Documentation

- [Architecture](/development/architecture): High-level system structure and seams.
- [Sensor Fusion and Control](/development/ros/sensor-fusion-and-control): Detailed EKF and sensor pipeline setup.
- [State and Behavior](/development/state-and-behavior): Detailed state machines for all control nodes.
