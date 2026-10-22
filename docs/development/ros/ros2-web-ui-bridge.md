---
outline: deep
search: false
---

# ROS 2 Web UI Bridge (msd_system)

<RoleBadge role="developer" />

How a ROS 2 Jazzy robot from `msd_system` appears in the dashboard as a **unit** and is driven from it. Everything lives in `src/msd_webui/` of that workspace (branch `web-ui-bridge`) and speaks the same MQTT contract as a ROS 1 unit, so the dashboard, backend and cloud relay need no change. This page is the robot side; the shared payloads are in [Message Contracts](/development/message-contracts/), and how the dashboard uses them is in [ROS Web UI](/development/webui/). How to run it on a unit: [Unit Setup § Switching to the ROS 2 stack](/setup/unit-setup#ros2-stack).

The robot's bringup owns the robot, and `webui.launch.py` runs next to it. The bridge starts and stops two parts of it on the dashboard's commands: the hardware on **Initialize** and **Stop** (`hardware_prototype.launch.py`), and the navigation stack for each mode (free driving, navigation on a saved map, mapping) through the bringup's own `msd_bringup.launch.xml`. Two feature packages of the web UI, `msd_map_manager` and `msd_coverage` in `src/msd_feature/`, are routed into that bringup with arguments that are off by default. Nothing else outside `src/msd_webui/` is edited, and the bringup only gains lines (`tools/check_additive.sh` fails otherwise).

## Packages

| Package | Nodes and launch files | Role |
| --- | --- | --- |
| `msd_webui_bridge` | `webui_bridge` | The unit agent: MQTT to the local and cloud brokers, command handling, operating lease, presence watchdog, emergency stop, manual drive, robot pose, the encoders for the map, scan and hole streams, and the GPS, follower and return to home bridging |
| | `motion_guard` | The last hop before the base: the only node that writes `cmd_vel` |
| | `webui.launch.py` | Starts `webui_bridge`, `motion_guard` and the views |
| | `hardware_prototype.launch.py`, `follower.launch.py`, `rth.launch.py` | Launch layers the bridge starts and stops: the robot hardware, the follower, return to home (msd_rth) |
| `msd_webui_views` | `scan_flattener`, `hole_trail`, `grid_mapper` | What the dashboard draws, built from the CMU terrain map |
| | `livox_to_cloud` | A Livox Mid-360's `CustomMsg` as a Velodyne-shaped `PointCloud2` (Livox units only, started by `hardware_prototype.launch.py`) |
| | `image_to_v4l2` | The RealSense image written to a v4l2loopback camera for `camera_client`, so the dashboard camera and the follower's vision share the RealSense (only with `camera_device` set) |
| `msd_map_manager` | `map_server` | A saved pgm/yaml map as `/map` (latched) |
| | `map_recorder` | Keeps a mapping run's 2D map and registered 3D scans; `~/save` writes `<name>.pgm/.yaml/.pcd` |
| | `scan_aligner` | Auto Align: matches the lidar against the saved map and sends the result as `/initialpose` |
| | `grid_to_pcd`, `explore.launch.py` | A 3D map from a 2D one (walls extruded); TARE exploration with its goal topic as an argument |
| `msd_coverage` | `coverage_node` | Boustrophedon coverage on the saved map: plans the lanes and drives them one goal at a time |

`webui.launch.py` arguments: `profile` (`sim` or `prototype`), `use_sim_time`, `unit_id` or `cred_dir`, `dev` (dev cloud broker), `enable_cloud`, `enable_local`, `guard_input`, `guard_output`, `enable_views`, `terrain_topic` (default `/terrain_map_ext`) and `camera_device` (default empty).

### Navigation stack modes {#stack-modes}

The bridge runs one `ros2 launch msd_bringup msd_bringup.launch.xml run_robot:=none ...` at a time:

| Mode | Started by | Bringup arguments |
| --- | --- | --- |
| `free` | `follower.start`, `rth.go_home` when no navigation runs | `navigation_mode:=kiss_icp` |
| `navigation` | `navigation.init` | `navigation_mode:=lidar_map_localization map_path:=<map>.pcd`, `run_map_manager:=true map_yaml:=<map>.yaml run_aligner:=true`, `run_coverage:=true coverage_goal_topic:=webui/coverage/way_point` |
| `mapping` | `mapping.start` | `navigation_mode:=kiss_icp`, `run_map_manager:=true record_map:=true`; with `mapping_explore` also `run_exploration:=true exploration_goal_topic:=webui/explore/way_point` |

A saved map is a pair from one mapping run, in one `map` frame: `<map>.pgm/.yaml` for the dashboard and the media server, and `<map>.pcd`, which `lidar_map_localization` localizes against and which stays on the robot (`$MAPS_FOLDER`). A map that exists only as pgm/yaml (made on a ROS 1 unit) gets a pcd made from its walls. A navigation stack the bridge did not start is left alone; the bridge then starts the map tools and coverage only. The unit is enrolled once with ros-web-ui's `scripts/enroll.py`; see [Firmware & Enrolment](/development/message-contracts/firmware-and-enrolment).

## Topic flow {#topic-flow}

From the robot to the dashboard: the CMU navigation stack and the hardware publish; `msd_webui_views` turns the 3D terrain map into flat drawings; `webui_bridge` encodes, gates and relays everything to MQTT.

![Topic flow from robot to dashboard](./diagrams/ros2-web-ui-bridge-topic-flow-robot-to-dashboard.drawio)

From the dashboard to the robot: every command arrives on `system_command`, and the bridge turns it into ROS topics (manual drive, motion lock, goals, msd_rth commands) or into starting and stopping a launch layer. `motion_guard` stays between `twist_mux` and the base whatever happens.

![Topic flow from dashboard to robot](./diagrams/ros2-web-ui-bridge-topic-flow-dashboard-to-robot.drawio)

## Topic list {#topic-list}

The **Minimum** column refers to the levels in [Minimum operation](#minimum): **Core** (the unit is online), **Drive** (Initialize and manual drive), **Map page** (pose, scan and map on the dashboard), a feature name (needed only for that feature), or **Optional** (safe to leave out).

### Read from the robot {#ros-inputs}

Topics the bringup provides and the web UI nodes read.

| Topic | Type | Publisher | Read by | Used for | Minimum |
| --- | --- | --- | --- | --- | --- |
| `/msd_hardware/imu/data` | `sensor_msgs/Imu` | msd_hardware (Xsens) | `webui_bridge` | Hardware liveness; compass heading in `string/gps` | Drive |
| `/msd_hardware/wheel/left_vel`, `right_vel` | `std_msgs/Float64` | `hardware_interface_node` | `webui_bridge` | Hardware liveness (prototype profile) | Drive |
| `/msd_hardware/scan_3d/points` | `PointCloud2`, or `livox_ros_driver2/CustomMsg` (type taken from the graph) | lidar driver, or `livox_to_cloud` | `webui_bridge` | Hardware liveness | Drive |
| `mux/cmd_vel` | `geometry_msgs/TwistStamped` | `twist_mux` | `motion_guard` | The command `motion_guard` passes or zeroes | Drive |
| TF `map` → `base_link`, `base_footprint` | tf2 | navigation stack (state estimation; `map` → `odom` is static) | `webui_bridge`, views | `string/robotpose`; scan frame and local ground height | Map page |
| `/terrain_map_ext` | `PointCloud2` in `map`, `intensity` = height above local ground | CMU `terrain_analysis_ext` | `scan_flattener`, `hole_trail`, `grid_mapper` | Scan, hole marks, hole trail, 2D map | Map page |
| `/state_estimation` | `nav_msgs/Odometry` | navigation stack | `webui_bridge` | "Navigation is running", the frame of follower goals, the pose to park at | Follower, RTH |
| `/msd_hardware/gps/fix` | `sensor_msgs/NavSatFix` | msd_hardware | `webui_bridge` | `string/gps`; RTH `go_home` needs a fix | GPS, RTH |
| `/gps/hdop` | `std_msgs/Float32` | GPS driver | `webui_bridge` | `hdop` in `string/gps` | Optional |
| `/gps/satcount` | `std_msgs/Int32` | GPS driver | `webui_bridge` | `sats` in `string/gps` | Optional |
| `/vision/target_point`, `/uwb/target_point` | `geometry_msgs/PointStamped` | follower target sources | `webui_bridge` | `source` in `string/follower_status` | Optional |
| `/msd_hardware/uwb` | `msd_interfaces/UWBStamped` | `hardware_interface_node` | `webui_bridge` | `uwb_range_m` (skipped when `msd_interfaces` is not installed) | Optional |
| `/path` | `nav_msgs/Path` in `vehicle` | CMU `localPlanner` | `webui_bridge` | Local plan overlay, moved into `map` | Optional |
| `/map` | `nav_msgs/OccupancyGrid`, latched | `msd_map_manager` `map_server` | `webui_bridge`, `scan_aligner`, `coverage_node` | The saved map: `string/map` while it is open, Auto Align, coverage | Navigation |
| `/registered_scan` | `PointCloud2` | navigation stack | `map_recorder` | The 3D map of a mapping run | Mapping |
| `/exploration_finish` | `std_msgs/Bool` | TARE | `webui_bridge` | `mapping_completed` | Optional |

Every name is a `webui_bridge` parameter (`config/bridge.yaml`, `config/profile_<profile>.yaml`). The liveness list is `liveness_topics`; a topic counts as alive when a message arrived within 2 s (`liveness_max_age`).

### Between the web UI nodes {#ros-internal}

| Topic | Type and QoS | Publisher | Read by | Content | Minimum |
| --- | --- | --- | --- | --- | --- |
| `webui/motion_lock` | `std_msgs/Bool`, reliable, transient local, repeated every 1 s | `webui_bridge` | `motion_guard`, `twist_mux` (lock 255) | `true` = hold the robot (presence pause, emergency stop, hardware shutdown) | Drive |
| `webui/guard_heartbeat` | `std_msgs/Empty`, every 0.2 s | `webui_bridge` | `motion_guard` | Proof the bridge's watchdog runs | Drive |
| `webui/scan` | `sensor_msgs/LaserScan`, best effort, 720 beams in `base_link` | `scan_flattener` | `webui_bridge` | Obstacles above `obstacle_height`, nearest per bearing | Map page |
| `webui/scan_holes` | `sensor_msgs/LaserScan`, best effort | `scan_flattener` | `webui_bridge` | Hole marks | Optional |
| `webui/hazard_cells` | `nav_msgs/Path` in `map`, reliable, transient local | `hole_trail` | `webui_bridge` | Every hole cell of this run, 0.10 m | Optional |
| `webui/map` | `nav_msgs/OccupancyGrid` in `map`, reliable, transient local | `grid_mapper` | `webui_bridge` | 2D log-odds grid, 0.1 m | Map page |
| `webui/follower/way_point` | `geometry_msgs/PointStamped` | follower (`follower.launch.py`) | `webui_bridge` | Follower goals, relayed to `/way_point` while the follower holds the goal gate | Follower |
| `webui/rth/command` | `std_msgs/String` (JSON) | `webui_bridge` | msd_rth | `start_session`, `go_home`, `cancel` | RTH |
| `webui/rth/status` | `std_msgs/String` (JSON), 5 Hz | msd_rth | `webui_bridge` | RTH state; its arrival proves msd_rth is up | RTH |
| `webui/rth/way_point` | `geometry_msgs/PointStamped` | msd_rth | `webui_bridge` | Return route goals, relayed to `/way_point` while RTH holds the goal gate | RTH |
| `webui/coverage/way_point`, `webui/explore/way_point` | `geometry_msgs/PointStamped` | `coverage_node`, TARE | `webui_bridge` | Coverage and exploration goals, relayed to `/way_point` while that source holds the goal gate | Coverage, Mapping |
| `coverage/plan` | `std_msgs/String` (JSON), latched | `webui_bridge` | `coverage_node` | `{"plan_id", "areas", "exclusions"}`; empty to clear | Coverage |
| `coverage/status`, `coverage/path`, `coverage/skipped`, `coverage/uncovered`, `coverage/debug` | String / `nav_msgs/Path`, latched | `coverage_node` | `webui_bridge` | The run's state and overlays, relayed to the `string/` streams | Coverage |
| `webui/system_command` | `std_msgs/String` | a bench tool | `webui_bridge` | The same envelopes as MQTT, for tests without a broker | Optional |

### Written to the robot {#ros-outputs}

| Topic | Type and QoS | Publisher | Read by | Content | Minimum |
| --- | --- | --- | --- | --- | --- |
| `webui/manual_vel` | `geometry_msgs/TwistStamped` in `base_link` | `webui_bridge` | `twist_mux` (priority 90, timeout 0.5 s) | `string/key_vel`, only while `manual.enable` is in force | Drive |
| `cmd_vel` | `geometry_msgs/TwistStamped`, 20 Hz, always | `motion_guard` | `hardware_interface_node` | `mux/cmd_vel`, or zero | Drive |
| `/way_point` | `geometry_msgs/PointStamped` | `webui_bridge` | `cmu_nav_executor` | Goals of one source at a time: the dashboard and the autopilot supervisor, coverage, exploration, the follower, RTH; a goal at the robot's own pose to park it | Navigation |
| `/initialpose` | `geometry_msgs/PoseWithCovarianceStamped` in `map` | `webui_bridge`, `scan_aligner` | `lidar_map_localization` | The home base on `navigation.init`, the dashboard's pose estimate, an Auto Align result | Navigation |
| `/clicked_point` | `geometry_msgs/PointStamped` | `webui_bridge` | nothing on msd_system | `navigation.pointstamped`, as on ROS 1 | Optional |
| `webui/guard_state` | `std_msgs/String` (JSON), latched, on change | `motion_guard` | people debugging | Why `cmd_vel` is zero | Optional |
| `webui/watchdog_status` | `std_msgs/String` (JSON), latched, 5 Hz | `webui_bridge` | people debugging | Watchdog tiers, lock holders, viewer profile | Optional |
| `webui/system_feedback` | `std_msgs/String` | `webui_bridge` | people debugging | A ROS copy of every feedback sent to MQTT | Optional |
| `msd_hardware/cmd_arm` | `std_msgs/Bool` | `motion_guard` | MCU | Only with `use_cmd_arm: true` (off: the ros2/dev firmware's ARM behaviour is unchecked) | Optional |

### Services {#ros-services}

| Service | Type | Effect |
| --- | --- | --- |
| `grid_mapper/reset` | `std_srvs/Trigger` | Empties the 2D map |
| `hole_trail/clear` | `std_srvs/Trigger` | Empties the hole trail |
| `map_recorder/save`, `map_recorder/reset` | `std_srvs/Trigger` | Writes the run's map pair (the reply names the files); forgets the 3D map |
| `alignment/start`, `alignment/reset`, `check_alignment` | `std_srvs/Trigger` | Auto Align, as on ROS 1 |
| `coverage/pause`, `coverage/resume`, `coverage/cancel` | `std_srvs/Trigger` | The coverage run |

### MQTT {#mqtt-topics}

Every topic is under `/unit_<ULID>/`. The bridge connects to the cloud broker (`msd.nglobal.jp:8883`, or `8884` with `dev:=true`) and the unit's local Mosquitto (`localhost:1883`) at the same time and serves both alike, except the three feature streams, which stay on the local broker until the cloud relay carries them (`feature_streams_cloud: false`).

Robot to dashboard:

| MQTT | From | Format | Rate | Brokers | Minimum |
| --- | --- | --- | --- | --- | --- |
| `system_feedback` | every command | [feedback JSON](#payload-system-feedback) | per command; one answer per ping | both | Core |
| `string/robotpose` | TF `map` → `base_link` | [pose JSON](#payload-robotpose) | up to 25 Hz past a 5 mm / 0.5° deadband; repeated at least every 5 s (25 s while nobody watches) | both | Map page |
| `string/laserscan` | `webui/scan` | [base64(zlib(Q1))](#payload-laserscan) | 2 Hz; 1 Hz watching; off while idle | both | Map page |
| `string/laserscan_holes` | `webui/scan_holes` | base64(zlib(Q1)) | as `string/laserscan` | both | Optional |
| `string/hazard_cells` | `webui/hazard_cells` | [base64(zlib(Path JSON))](#payload-hazard-cells) | checked at 0.5 Hz, sent on change and every 15 s; off while idle | both | Optional |
| `string/map` | `webui/map` | [base64(zlib(M1))](#payload-map) | at most every 5 s when changed; heartbeat 60 s (300 s idle); 3 sends after a reset | both | Map page |
| `string/gps` | GPS fix, HDOP, satellites, IMU yaw | [JSON](#payload-gps) | 1 Hz; off while idle | local | GPS |
| `string/follower_status` | follower goals and sources | [JSON](#payload-follower-status) | 2 Hz while following, and on every change | local | Follower |
| `string/rth_status` | `webui/rth/status` | [JSON](#payload-rth-status) | on every state change, 1 Hz while returning | local | RTH |
| `string/rth_path` | msd_rth's trajectory file, moved into `map` | [base64(zlib(Path JSON))](#payload-rth-path) | when the recording grows (checked every 2 s) | local | RTH |
| `string/move_base/status`, `string/move_base/result` | the bridge's goal tracker | [status](/development/message-contracts/bridge-topics#json-status), [result](/development/message-contracts/bridge-topics#json-result) JSON | status on change and every 2 s; a result every 1 s until ACKed (not while nobody watches) | both | Navigation |
| `string/move_base/NavfnROS/plan`, `string/move_base/TebLocalPlannerROS/local_plan` | straight line robot to goal; `/path` | base64(zlib(Path JSON)) | as `string/hazard_cells` | both | Optional |
| `string/boustrophedon_path`, `string/skipped_waypoints` | `coverage/path`, `coverage/skipped` | base64(zlib(Path JSON)); the route carries its revision in `header.seq` | the route on every change and every 2 s until ACKed | both | Coverage |
| `string/coverage_status`, `string/uncovered_regions`, `string/coverage_debug` | `coverage_node` | text / JSON | on change | both | Coverage |
| `string/operation_progress`, `string/operation_snapshot` | the operation supervisor | [JSON](/development/message-contracts/operation-sync#supervisor-to-browser) | on every step; the snapshot on every change | both | Autopilot |

Dashboard to robot:

| MQTT | From | Format | Read as | Minimum |
| --- | --- | --- | --- | --- |
| `system_command` | `backend_node` (commands, pings), the browser (heartbeat frames every 0.2 s) | [command envelope](#payload-system-command) | routed by `header` | Core |
| `string/key_vel` | the browser, 10 Hz while Manual Override is on | [twist JSON](#payload-key-vel) | `webui/manual_vel` | Drive |
| `string/map_request` | the browser, while its map canvas has no map | [JSON](#payload-map-request) | the next `string/map` goes out at once | Map page |
| `string/move_base/goal`, `string/move_base/cancel`, `string/move_base/result_ack` | the browser | [goal](/development/message-contracts/bridge-topics#json-goal), [cancel](/development/message-contracts/bridge-topics#json-cancel), [ACK](/development/message-contracts/bridge-topics#acks) | a `/way_point` goal; preempt; stop resending a result | Navigation |
| `string/initialpose` | the browser (pose estimate) | [initial pose JSON](/development/message-contracts/bridge-topics#json-initialpose) | `/initialpose` | Navigation |
| `string/boustrophedon_path_ack` | the browser | the route revision | stop resending the coverage route | Coverage |
| `string/operation_sync` | the browser | [operation sync JSON](/development/message-contracts/operation-sync#sync-messages) | the operation supervisor | Autopilot |

## Minimum operation {#minimum}

Each level needs everything of the levels above it.

| Level | What works | ROS side needs | MQTT needs |
| --- | --- | --- | --- |
| **Core** | The unit is listed online, pings and leases are answered, unsupported commands answer at once | `webui_bridge` running with a unit identity (`unit_id`, `$UNIT_ID` or `device.json`) and a reachable broker. No other topic | `system_command`, `system_feedback` |
| **Drive** | Initialize and Stop, manual drive, emergency stop, the 2 s presence pause | `motion_guard` between `twist_mux` and the base; `twist_mux` writing `mux/cmd_vel` with the `webui/manual_vel` input and `webui/motion_lock` lock; nothing else on `cmd_vel`; the liveness topics within 20 s of Initialize | + `string/key_vel` and the heartbeat frames |
| **Map page** | Robot position, scan, 2D map | The navigation stack: TF `map` → `base_link` and `base_footprint`, `/terrain_map_ext`; `msd_webui_views` (`enable_views`) | + `string/robotpose`, `string/laserscan`, `string/map`, `string/map_request` |
| **GPS** | Fix badge and position | `/msd_hardware/gps/fix` | + `string/gps` (local broker) |
| **Follower** | Follow a person or tag | `/state_estimation`, `cmu_nav_executor` reading `/way_point`, the follower packages | + `follower` commands, `string/follower_status` |
| **RTH** | Mark home, return along the recorded path | `/state_estimation`, a GPS fix, msd_rth, `cmu_nav_executor` | + `rth` commands, `string/rth_status`, `string/rth_path` |
| **Navigation** | Open a saved map, pinpoints, pose estimate, Auto Align | the CMU stack and `lidar_map_localization` through `msd_bringup.launch.xml`, `msd_map_manager`; the map's `.pcd` (or one made from its walls) | + `navigation`, `autoalign` commands, `string/move_base/*`, `string/initialpose` |
| **Mapping** | Make and save a map | the CMU stack with KISS-ICP, `msd_map_manager`, a media server and a credential; TARE for automatic exploration | + `mapping` commands and their progress events |
| **Coverage** | Auto coverage, custom area, playlist with keep-out | a map open for navigation, `msd_coverage` | + `boustrophedon` commands, the coverage streams |
| **Autopilot** | A multi-pinpoint run goes on with the dashboard closed | a map open for navigation | + `autopilot` commands, `string/operation_*` |

Leaving out a level is safe: what it would draw stays empty and its commands answer `status: false` with a reason. Without the **Map page** level the pose stream is silent, and the dashboard's operating pages reconnect after about 30 s without a pose. Optional extras that cost nothing when absent: `string/laserscan_holes`, `string/hazard_cells`, `/gps/hdop`, `/gps/satcount`, UWB range, vision targets, and the debugging topics.

`hw_status` in the ping answer is `true` only while every liveness topic is fresh, so it reads `false` before Initialize.

## Payload examples {#payloads}

Payloads shared with ROS 1 units are defined in [Message Contracts](/development/message-contracts/); each example below links to its definition. GPS, follower and return to home exist only on msd_system units: their payloads are drafts here until the backend, relay and dashboard use them, and then move to Message Contracts.

### MQTT, dashboard to robot

#### `system_command` {#payload-system-command}

The [command envelope](/development/message-contracts/mqtt-commands#command-envelope). A ping, as `backend_node` sends it ([ping request](/development/message-contracts/heartbeat-and-lease#ping-request)):

```json
{
  "header": "hardware",
  "command": "ping",
  "data": {
    "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
    "user_id": "01JZ7YV5CQUSER00000000000",
    "claim": true, "release": false, "page": "navigation",
    "origin": "cloud", "force_takeover": false
  },
  "metadata": { "timestamp": "2026-10-21T04:11:52.913Z", "request_id": "6f0c2d7e-1b44-4c55-9f0e-5d2b1a9e8c31" }
}
```

The browser's [heartbeat frame](/development/message-contracts/heartbeat-and-lease#heartbeat-frame), every 0.2 s:

```json
{ "header": "hardware", "command": "heartbeat", "metadata": { "request_id": "heartbeat" }, "data": { "page": "navigation" } }
```

Commands the bridge serves, all in the same envelope:

| `header` | `command` | `config` or `data` |
| --- | --- | --- |
| `hardware` | `ping`, `heartbeat`, `check`, `init`, `stop`, `idle` | none, except `ping` and `heartbeat` above |
| `hardware` | `battery_update` | `"config": { "resource": { "value": 87 } }` |
| `emergency_stop` | `activate`, `deactivate` | none |
| `manual` | `enable`, `disable` | none |
| `follower` | `start` | optional `"data": { "sources": ["uwb"] }`, any of `vision`, `uwb` in priority order |
| `follower` | `stop` | none |
| `rth` | `mark_home`, `go_home`, `cancel` | none |
| `navigation` | `init`, `deactivate`, `pointstamped` | as on ROS 1 ([MQTT Commands](/development/message-contracts/mqtt-commands)) |
| `mapping` | `start`, `pause`, `stop`, `discard` | as on ROS 1, with the same `mapping_progress` events |
| `boustrophedon` | `init`, `pause`, `deactivate` | as on ROS 1: `use_autocover`, `polygon`, `areas`, `exclusions`, `pause` |
| `autoalign` | `start`, `reset`, `status` | none |
| `autopilot` | `enable`, `disable` | none |

```json
{ "header": "follower", "command": "start", "data": { "sources": ["uwb"] },
  "metadata": { "timestamp": "2026-10-21T04:12:03.120Z", "request_id": "c3a1e0b2-7d9f-4e1a-8b6c-2f4d5e6a7b8c" } }
```

#### `string/key_vel` {#payload-key-vel}

[Twist JSON](/development/message-contracts/bridge-topics#json-twist). The bridge reads only `linear.x` and `angular.z`:

```json
{ "linear": { "x": 0.4, "y": 0.0, "z": 0.0 }, "angular": { "x": 0.0, "y": 0.0, "z": 1.0 } }
```

#### `string/map_request` {#payload-map-request}

Any payload counts; the dashboard sends ([map delivery](/development/message-contracts/bridge-topics#map-delivery)):

```json
{ "reason": "map-init", "at": 1792555923120 }
```

### MQTT, robot to dashboard

#### `system_feedback` {#payload-system-feedback}

The [feedback envelope](/development/message-contracts/mqtt-commands#feedback-envelope). A plain answer:

```json
{ "header": "follower", "command": "start",
  "data": { "status": true, "message": "Following (sources: uwb, goals in odom)" },
  "metadata": { "timestamp": 1792555923.42, "request_id": "c3a1e0b2-7d9f-4e1a-8b6c-2f4d5e6a7b8c" } }
```

The ping answer ([ping response](/development/message-contracts/heartbeat-and-lease#ping-response)) carries one field ROS 1 units do not send, `capabilities`:

```json
{
  "header": "hardware", "command": "ping",
  "data": {
    "status": true, "robot_activity": "hardware_ready", "active_page": "navigation",
    "battery": 0.0, "uptime": 42, "hw_status": true,
    "manual_override": false, "autopilot": false, "active_map_id": null,
    "in_use": false, "in_use_by": null, "origin_conflict": false, "origin_conflict_side": null,
    "motion_locked": false,
    "capabilities": ["autopilot", "coverage", "autoalign", "gps", "follower", "rth"]
  },
  "metadata": { "timestamp": 1792555912.95, "request_id": "6f0c2d7e-1b44-4c55-9f0e-5d2b1a9e8c31" }
}
```

`capabilities` lists the optional features this unit serves; a ROS 1 unit sends none, which reads as `["autopilot", "coverage", "autoalign"]`. `battery` stays `0.0` until something sends `battery_update`. New `robot_activity` values: `following`, `follower_target_lost`, `returning_home`, `returned_home`. `stuck` is reported as on ROS 1: in a motion-expected activity, a robot that has not moved 0.15 m in 20 s (60 s before its first motion) reads as `stuck`, while `active_page` follows the real activity.

#### `string/robotpose` {#payload-robotpose}

[Pose JSON](/development/message-contracts/bridge-topics#json-pose), from TF `map` → `base_link`:

```json
{"position":{"x":1.234,"y":-0.5,"z":0.0},"orientation":{"x":0.0,"y":0.0,"z":0.382683,"w":0.92388}}
```

#### `string/laserscan` and `string/laserscan_holes` {#payload-laserscan}

`base64(zlib(Q1))` ([compressed formats](/development/message-contracts/bridge-topics#compressed-formats)). An 8-beam scan, made with the bridge's own encoder:

```text
eJwLNLzN73ngyWkxByBtzwAB9mfPnLFlYFjgyAHkcDIkJRanxudk5mXXMvz/H8JoByQPMp0AkgBgUhX9
```

Decoded: magic `Q1`, `angle_min` -3.1416, `angle_max` 2.3562, `angle_increment` 0.7854, `time_increment` 0, `scan_time` 0.5, `range_min` 0.1, `range_max` 20.0, 8 beams, frame `base_link`, then one little-endian uint16 per beam in centimetres: `125, 65535, 340, 62, 65535, 705, 200, 65535` (65535 = no return). A real scan has 720 beams.

#### `string/hazard_cells` {#payload-hazard-cells}

`base64(zlib(JSON))` of a `nav_msgs/Path` in `map`, one pose per hole cell:

```text
eJy9TssOAiEQ+5XNnJUMu64af8UYQ9wxcuAhbOKD8O8OBA/e1QvTlrZpggupiQLsugSRrnxx0UGclfFNO0UGcrNdjzhI2fOvbSJmJuegDB31xByM8lA07yIVwz79rL6mGehZO1vJnd9eDCMbHgyXUmDBz9IkapcLmuysPhLY7Pi28r2VRTlz5P/7V1/cf8gvYOmDeA==
```

Decoded:

```json
{"header": {"seq": 0, "stamp": {"secs": 1786503112, "nsecs": 0}, "frame_id": "map"},
 "poses": [
  {"header": {"seq": 0, "stamp": {"secs": 1786503112, "nsecs": 0}, "frame_id": "map"},
   "pose": {"position": {"x": 2.35, "y": -1.05, "z": 0.0}, "orientation": {"x": 0, "y": 0, "z": 0, "w": 1}}},
  {"header": {"seq": 0, "stamp": {"secs": 1786503112, "nsecs": 0}, "frame_id": "map"},
   "pose": {"position": {"x": 2.45, "y": -1.05, "z": 0.0}, "orientation": {"x": 0, "y": 0, "z": 0, "w": 1}}}]}
```

#### `string/map` {#payload-map}

`base64(zlib(M1))`. A 4 by 3 grid:

```text
eJzzNTx75owtCwMDAzMQnz3js2/WTMl9DBigwR6Zd+J+dRYDWE9uYsF/BoYUIDvlP5ABAJU+ECY=
```

Decoded: magic `M1`, resolution 0.1, width 4, height 3, origin (-0.2, -0.15, 0.0) with identity orientation, frame `map`, then 12 int8 cells row by row from the origin: `-1 0 0 100 / 0 0 0 100 / -1 -1 0 0` (-1 unknown, 0 free, 100 occupied). The 0x0 grid `eJzzNWSgADAz5CYWAAAjlAHA` is the retire signal, not a corrupt map ([map delivery](/development/message-contracts/bridge-topics#map-delivery)).

#### `string/gps` {#payload-gps}

Draft, msd_system only.

```json
{"status":0,"lat":-6.89123,"lon":107.61045,"alt":760.12,"hdop":0.84,"sats":14,"heading_deg":12.5,"age_s":0.3}
```

| Field | Meaning |
| --- | --- |
| `status` | `sensor_msgs/NavSatStatus`: -1 no fix, 0 fix, 1 SBAS, 2 GBAS. A fix older than 3 s reads as -1 |
| `lat`, `lon`, `alt` | degrees, degrees, metres; `null` when `status` is -1 |
| `hdop`, `sats` | `null` without `/gps/hdop` or `/gps/satcount` (the simulator) |
| `heading_deg` | compass heading from `/msd_hardware/imu/data`, 0 = north, clockwise; `null` without it |
| `age_s` | seconds since the last fix message |

Nothing is sent before the first fix message.

#### `string/follower_status` {#payload-follower-status}

Draft, msd_system only.

```json
{"state":"following","source":"uwb","target":{"x":3.2,"y":-0.4,"frame":"odom"},"uwb_range_m":2.85}
```

| Field | Meaning |
| --- | --- |
| `state` | `following`, `target_lost`, `stopped` |
| `source` | the source that is fresh now: `vision`, `uwb`, or empty |
| `target` | the goal the robot drives to, in the frame of `/state_estimation`; `null` unless following |
| `uwb_range_m` | distance to the UWB tag; `null` without a reading in the last 2 s |

#### `string/rth_status` {#payload-rth-status}

Draft, msd_system only. msd_rth's status with the bridge's session id:

```json
{"state":"RETURNING_HOME","session_id":"01M5C39HBDDTJ45SHG79AGX383","waypoint_index":3,"total_waypoints":12,"distance_to_next_m":1.7}
```

`state` is `IDLE`, `RETURNING_HOME` or `HOME`. The three route fields are present only while returning.

#### `string/rth_path` {#payload-rth-path}

Draft, msd_system only. The recorded session, the route a return drives back along: `base64(zlib(JSON))` of a `nav_msgs/Path` in `map`, the same format as [`string/hazard_cells`](#payload-hazard-cells). The bridge reads msd_rth's trajectory file (GNSS frame `gps_map`), keeps points at least 0.25 m apart (at most 1000) and moves them into `map` with TF; an empty path when the session ends.

### ROS 2 topics

Shown as `ros2 topic echo` prints them, abridged.

#### `webui/motion_lock` and `webui/guard_heartbeat` {#payload-motion-lock}

```yaml
# webui/motion_lock (std_msgs/Bool): true holds the robot
data: true
---
# webui/guard_heartbeat (std_msgs/Empty): the message itself is the signal
{}
```

#### `webui/manual_vel`, `mux/cmd_vel` and `cmd_vel` {#payload-cmd-vel}

All three are `geometry_msgs/TwistStamped`; only `linear.x` and `angular.z` are used.

```yaml
header:
  stamp: {sec: 1792555923, nanosec: 120000000}
  frame_id: base_link
twist:
  linear: {x: 0.4, y: 0.0, z: 0.0}
  angular: {x: 0.0, y: 0.0, z: 1.0}
```

#### `webui/guard_state` {#payload-guard-state}

```json
{"state": "bridge_heartbeat_lost"}
```

`state` is `pass`, or why `cmd_vel` is zero: `motion_lock`, `another_cmd_vel_publisher`, `bridge_heartbeat_lost`, `no_fresh_command`.

#### `webui/watchdog_status` {#payload-watchdog-status}

```json
{"alive": 5120, "interval": 0.2, "presence_age": 0.18, "operation_age": 0.18,
 "operation_page": "navigation", "activity": "manual", "autopilot": false, "manual_override": true,
 "state": "manual_override", "lock_holders": [],
 "tiers": {"pause": {"threshold": 2.0, "fired": false},
           "idle": {"threshold": 600.0, "fired": false},
           "shutdown": {"threshold": 1800.0, "fired": false}},
 "errors": 0, "last_error": null, "viewers": "driving"}
```

`state` is one of `starting`, `disabled`, `autopilot_suspended`, `operator_paused`, `no_operation`, `manual_override`, `paused_ping_loss`, `supervised`. `lock_holders` names who holds the motion lock (`emergency_stop`, `ping_watchdog`, `hardware_shutdown`). `viewers` is the egress profile: `idle`, `watching` or `driving`.

#### `webui/scan`, `webui/map` and `webui/hazard_cells` {#payload-view-topics}

```yaml
# webui/scan (sensor_msgs/LaserScan); webui/scan_holes has the same shape
header: {frame_id: base_link}
angle_min: -3.14159
angle_max: 3.13286
angle_increment: 0.00873   # 720 beams
range_min: 0.1
range_max: 20.0
ranges: [.inf, .inf, 3.42, 3.40, ...]
---
# webui/map (nav_msgs/OccupancyGrid), latched
header: {frame_id: map}
info:
  resolution: 0.1
  width: 812
  height: 640
  origin: {position: {x: -40.6, y: -32.0, z: 0.0}, orientation: {w: 1.0}}
data: [-1, -1, 0, 0, 100, ...]
---
# webui/hazard_cells (nav_msgs/Path), latched: one pose per hole cell, centre of a 0.10 m cell
header: {frame_id: map}
poses:
- pose: {position: {x: 2.35, y: -1.05, z: 0.0}, orientation: {w: 1.0}}
```

#### `/way_point`, `webui/follower/way_point` and `webui/rth/way_point` {#payload-way-point}

`geometry_msgs/PointStamped`, in the frame of `/state_estimation`:

```yaml
header:
  stamp: {sec: 1792555930, nanosec: 0}
  frame_id: odom
point: {x: 3.2, y: -0.4, z: 0.0}
```

A park goal is the same message at the robot's latest `/state_estimation` position.

#### `webui/rth/command` and `webui/rth/status` {#payload-rth-topics}

`std_msgs/String` with JSON in `data`:

```json
{"command": "start_session", "session_id": "01M5C39HBDDTJ45SHG79AGX383"}
{"command": "go_home", "session_id": "01M5C39HBDDTJ45SHG79AGX383"}
{"command": "cancel"}
```

`webui/rth/status` is msd_rth's own status at 5 Hz, the source of [`string/rth_status`](#payload-rth-status).

## Commands

`webui_bridge` subscribes to `/unit_<ULID>/system_command` on both brokers and answers on `system_feedback`, with the same envelope, request-id dedupe and lease rules as `system_command.py` (see [MQTT Commands](/development/message-contracts/mqtt-commands) and [Heartbeat & Lease](/development/message-contracts/heartbeat-and-lease)).

| Header | State | Notes |
| --- | --- | --- |
| `hardware` (`ping`, `heartbeat`, `check`, `init`, `stop`, `idle`, `battery_update`) | done | `init` and `stop` start and stop `hardware_prototype.launch.py` when `hardware_managed` is set (prototype profile); hardware someone started by hand is left alone. The sim profile only reports liveness |
| `emergency_stop`, `manual` | done | See [Safety chain](#safety-chain) |
| `follower` (`start`, `stop`), `rth` (`mark_home`, `go_home`, `cancel`) | done | Only when listed in `capabilities`. One goal source at a time; `follower.start` also starts RTH recording when no session exists |
| `navigation` (`init`, `deactivate`, `pointstamped`) | done | `init` downloads the map when missing, starts the `navigation` mode and sends the home base as `/initialpose`. Goals come over `string/move_base/goal`: ACTIVE, SUCCEEDED within 0.6 m, ABORTED after 20 s without 0.2 m progress, PREEMPTED, REJECTED without navigation, under the emergency stop or while coverage drives |
| `mapping` (`start`, `pause`, `stop`, `discard`) | done | `start` is refused when the map could not be stored. `stop` writes `<map>.pgm/.yaml` (uploaded) and `<map>.pcd` (kept on the robot); a failed save keeps the run open |
| `boustrophedon` (`init`, `pause`, `deactivate`) | done | Needs a map open on the Navigation page. Manual override pauses the run and resumes it when released |
| `autoalign` (`start`, `reset`, `status`) | done | `scan_aligner`; commands no wheel motion |
| `autopilot` (`enable`, `disable`) | done | Suspends the presence tiers; the operation supervisor drives a multi-pinpoint run with the dashboard closed |

`boustrophedon`, `autoalign` and `autopilot` are served only when listed in `capabilities` (both profiles list them); otherwise the unit answers them at once with a reason instead of leaving the dashboard to wait 30 s for a 504. Commands that only tear something down (`deactivate`, `discard`, `reset`) succeed as no-ops, so a logout flow shows no error. Follower and RTH refuse while the emergency stop or Manual Override is on, and without `/state_estimation`; `go_home` also needs a GPS fix and a recorded session.

## Safety chain {#safety-chain}

![Drive chain and motion guard](./diagrams/ros2-web-ui-bridge-drive-chain-and-motion-guard.drawio)

`hardware_interface_node` forwards every `cmd_vel` to the MCU with no timeout, and the firmware keeps the last wheel speed forever, so a stalled node would leave the robot driving. `motion_guard` prevents that. It publishes at 20 Hz, always, and sends zero unless all four hold:

- the motion lock (`webui/motion_lock`) is released;
- the bridge heartbeat (`webui/guard_heartbeat`, 5 Hz) is less than 0.6 s old;
- `mux/cmd_vel` is less than 0.3 s old;
- it is the only publisher of `cmd_vel`.

`twist_mux` therefore publishes to `mux/cmd_vel`, not `cmd_vel`, and carries two web UI entries next to the navigation and teleop ones: input `webui/manual_vel` (priority 90, timeout 0.5) and lock `webui/motion_lock` (priority 255). `msd_webui_bridge/config/twist_mux_webui.yaml` is a reference file; on the robot, `hardware_prototype.launch.py` sets both without editing the bringup.

| Tier | Trigger | Effect |
| --- | --- | --- |
| Pause | No presence for 2 s (`ping_pause_timeout`, sampled every 0.2 s) | Holds the motion lock. The next ping or heartbeat lifts it |
| Idle | No presence for 10 min (`ping_timeout`) | The lease is dropped; the mode, the follower and a return home are stopped |
| Shutdown | No presence for 30 min (`ping_shutdown_timeout`) | Lease dropped, hardware stopped with the lock held. Does not recover on reconnect |

The values equal the ROS 1 watchdog in [Safety Watchdog](/development/ros/safety-watchdog). The emergency stop is a key on the same motion lock, saved in `~/.msd_webui/estop.json`, so a restart of the bridge cannot lift it and manual override cannot drive out of it. `manual.enable` opens `webui/manual_vel`; the dashboard's `string/key_vel` arrives at 10 Hz and a 0.5 s gap stops the robot.

## Map, scan and hole streams {#streams}

![Map, scan and hole streams](./diagrams/ros2-web-ui-bridge-map-scan-and-hole-streams.drawio)

The 3D work is not done by the bridge. The CMU stack already reduces the lidar to `/terrain_map_ext`, a `PointCloud2` in `map` whose `intensity` is the height above the local ground. The view nodes flatten that into what the dashboard draws, and the bridge only encodes and relays it.

| Node | Output | What it draws |
| --- | --- | --- |
| `scan_flattener` | `webui/scan`, `webui/scan_holes` (`LaserScan`, 720 beams, `base_link`) | Terrain points higher than `obstacle_height` above the local ground, nearest per bearing. A ramp stays floor. Hole marks go to the second scan |
| `hole_trail` | `webui/hazard_cells` (`nav_msgs/Path`, `map`, latched) | Every cell marked as a hole this run, 0.10 m cells, at most 1000 like ROS 1. A cell is kept once it is marked in `min_hits` (2) updates |
| `grid_mapper` | `webui/map` (`OccupancyGrid`, `map`, latched) | Log-odds grid at 0.1 m, grown in chunks up to 400 m a side. Walls harden after one look, a person who walked through fades back to floor, holes are left out |

The encoders are byte-identical to `topic2string` on ROS 1, pinned against golden output from the ROS 1 code in `test/test_codec.py`. The egress gate, change heartbeat, map request and the burst of three repeats after a reset behave as described in [Bridge Topics](/development/message-contracts/bridge-topics#map-delivery) and [egress profiles](/development/message-contracts/bridge-topics#egress-profiles): the scan stops while nobody watches (`idle`), and a fresh bridge counts as watching for 15 s (`viewer_idle_after`). The streams run in their own callback groups of a `MultiThreadedExecutor`, so compressing a large map never delays the guard heartbeat.

### Difference from ROS 1

Holes and obstacles of several heights are detected by the CMU `terrain_analysis`, not by a port of `hazard_scan` from [Perception & Hazard Scan](/development/ros/perception-and-hazard-scan). The web UI only visualises the marks that node makes, which are also the ones the planner avoids. Three numbers in `msd_webui_views/config/views.yaml` must equal the robot's `terrain_analysis.yaml`:

| `views.yaml` | `terrain_analysis.yaml` |
| --- | --- |
| `obstacle_height` | `obstacleHeightThre` |
| `forced_intensity` | `vehicleHeight` |
| `hole_depth` | \|`negObstacleRelZThre`\| |

Two consequences to know:

- `negObstacle` is `-1` (off) on every branch that contains the CMU stack today, so the hole overlay and the hole trail stay empty until the navigation team turns it on.
- `terrain_analysis` marks holes per frame. ROS 1 `hazard_scan_node` confirmed a hole before reporting it. `min_hits` is the substitute, and should be revisited once the terrain parameters are final.

The live 2D map is a picture for the dashboard, not for localisation. A saved map is localized against through its 3D twin (`<map>.pcd`, [Navigation stack modes](#stack-modes)); while it is open, `string/map` shows the saved map instead of the live grid.

## What the bringup has to do

1. Send `twist_mux` output to `mux/cmd_vel` and give it the two web UI entries above (`hardware_prototype.launch.py` does this on the robot).
2. Include `webui.launch.py` (`profile:=sim use_sim_time:=true` in Gazebo).
3. Keep every other publisher off `cmd_vel`.
4. Leave navigation to the bridge (`run_navigation:=false` in Gazebo): it starts the CMU stack per mode through `msd_bringup.launch.xml`. A navigation stack started some other way is used as it is, but then a saved map is not localized against.

Run `webui.launch.py` next to a bringup whose `twist_mux` still writes `cmd_vel` and `motion_guard` will hold zero against it, so the robot stutters or stops.

## Status

| Part | State |
| --- | --- |
| MQTT, lease, presence watchdog, emergency stop, manual drive, robot pose | done, bench tested; not yet run against the real dashboard |
| Map, scan, hole and hole trail streams | done, checked with a synthetic terrain map; not yet run on the CMU stack, Gazebo or the robot |
| Robot hardware layer (`hardware_prototype.launch.py`), lidar onto `scan_3d/points` | done, checked on Jazzy with stand-in drivers; not yet run on the robot |
| GPS, follower and return to home | done, checked on Jazzy with stand-in follower and RTH processes; feature streams on the local broker only |
| Navigation with a saved map (M3), mapping (M4), autopilot (M5), exploration (M6), coverage, Auto Align, `stuck` | done (2026-10-21), checked end to end on Jazzy with `tools/ops_harness/ops_check.py`: the real bridge, `msd_bringup.launch.xml`, `msd_map_manager` and `msd_coverage` over MQTT, with a stand-in for the CMU stack and the robot and a fake media server; not yet run on the CMU stack, Gazebo, the robot or the real dashboard |
| `string/rth_path`, shared camera (`image_to_v4l2`) | done, unit tested; not yet run with msd_rth or a v4l2loopback device |
| Battery level | not available; reported as 0.0 |

Bench results on a Jazzy container without hardware: manual input stops 0.30 s after the key stream ends, a second `cmd_vel` publisher forces zero in 0.17 to 0.52 s, killing `webui_bridge` stops the robot in 0.53 s and killing `twist_mux` in 0.28 s. With a 3072 by 3072 map the guard heartbeat's longest gap stays at 0.21 s.

## Related

- [Message Contracts: Bridge Topics](/development/message-contracts/bridge-topics)
- [Message Contracts: MQTT Commands](/development/message-contracts/mqtt-commands)
- [Safety Watchdog](/development/ros/safety-watchdog)
- [Perception & Hazard Scan](/development/ros/perception-and-hazard-scan)
- [Coordinate Transforms (TF)](/development/ros/tf-transforms)
- [Unit Setup § Switching to the ROS 2 stack](/setup/unit-setup#ros2-stack)
