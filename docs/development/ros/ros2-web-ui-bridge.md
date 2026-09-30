---
outline: deep
search: false
---

# ROS 2 Web UI Bridge (msd_system)

<RoleBadge role="developer" />

How a ROS 2 Jazzy robot from `msd_system` appears in the dashboard as a **unit** and is driven from it. Everything lives in `src/msd_webui/` of that workspace and speaks the same MQTT contract as a ROS 1 unit, so the dashboard, backend and cloud relay need no change. This page is the robot side; the payloads are in [Message Contracts](/development/message-contracts/), and how the dashboard uses them is in [ROS Web UI](/development/webui/).

The folder does not bring the robot up. The base controller, `twist_mux`, sensors and the navigation stack belong to the robot's bringup, and `webui.launch.py` runs next to it. Nothing outside `src/msd_webui/` is edited (`tools/check_additive.sh` fails otherwise).

## Packages

| Package | Nodes | Role |
| --- | --- | --- |
| `msd_webui_bridge` | `webui_bridge` | The unit agent: MQTT to the local and cloud brokers, command handling, operating lease, presence watchdog, emergency stop, manual drive, robot pose, and the encoders for the map, scan and hole streams |
| | `motion_guard` | The last hop before the base: the only node that writes `cmd_vel` |
| `msd_webui_views` | `scan_flattener`, `hole_trail`, `grid_mapper` | What the dashboard draws, built from the CMU terrain map |

`webui.launch.py` starts all of it. Arguments: `profile` (`sim` or `prototype`), `use_sim_time`, `unit_id` or `cred_dir`, `enable_cloud`, `enable_local`, `guard_input`, `guard_output`, `enable_views` and `terrain_topic` (default `/terrain_map_ext`). The unit is enrolled once with ros-web-ui's `scripts/enroll.py`; see [Firmware & Enrolment](/development/message-contracts/firmware-and-enrolment).

## Commands

`webui_bridge` subscribes to `/unit_<ULID>/system_command` on both brokers and answers on `system_feedback`, with the same envelope, request-id dedupe and lease rules as `system_command.py` (see [MQTT Commands](/development/message-contracts/mqtt-commands) and [Heartbeat & Lease](/development/message-contracts/heartbeat-and-lease)).

| Header | State | Notes |
| --- | --- | --- |
| `hardware` (`ping`, `heartbeat`, `check`, `init`, `stop`) | done | `init` and `stop` start and stop a bringup launch only if `hardware_managed` is set in the profile; otherwise the bridge reports liveness |
| `emergency_stop`, `manual` | done | See [Safety chain](#safety-chain) |
| `navigation`, `mapping`, `autopilot` | answers `status:false` | Milestones M3, M4 and M5 |
| `boustrophedon`, `autoalign` | answers `status:false` | Not available on msd_system units |

A header the unit does not serve is answered at once with a reason instead of leaving the dashboard to wait 30 s for a 504. Commands that only tear something down (`deactivate`, `discard`, `reset`) succeed as no-ops, so a logout flow shows no error.

## Safety chain {#safety-chain}

![Drive chain and motion guard](./diagrams/ros2-web-ui-bridge-drive-chain-and-motion-guard.drawio)

`base_controller_node` keeps the last `cmd_vel` forever, and the firmware keeps the last wheel speed forever, so a stalled node would leave the robot driving. `motion_guard` prevents that. It publishes at 20 Hz, always, and sends zero unless all four hold:

- the motion lock (`webui/motion_lock`) is released;
- the bridge heartbeat (`webui/guard_heartbeat`, 5 Hz) is less than 0.6 s old;
- `mux/cmd_vel` is less than 0.3 s old;
- it is the only publisher of `cmd_vel`.

`twist_mux` therefore publishes to `mux/cmd_vel`, not `cmd_vel`, and carries two web UI entries next to the navigation and teleop ones: input `webui/manual_vel` (priority 90, timeout 0.5) and lock `webui/motion_lock` (priority 255). `msd_webui_bridge/config/twist_mux_webui.yaml` is a reference file.

| Tier | Trigger | Effect |
| --- | --- | --- |
| Pause | No presence for 2 s (`ping_pause_timeout`, sampled every 0.2 s) | Holds the motion lock. The next ping or heartbeat lifts it |
| Idle | No presence for 10 min (`ping_timeout`) | The lease is dropped and the mode is stopped |
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

`grid_mapper/reset` and `hole_trail/clear` (`std_srvs/Trigger`) empty the two layers.

| ROS 2 topic | MQTT (`/unit_<ULID>/...`) | Format | Default rate |
| --- | --- | --- | --- |
| `webui/scan` | `string/laserscan` | [Q1](/development/message-contracts/bridge-topics#compressed-formats) | 2 Hz |
| `webui/scan_holes` | `string/laserscan_holes` | Q1 | 2 Hz |
| `webui/hazard_cells` | `string/hazard_cells` | compressed path | 0.5 Hz, on change |
| `webui/map` | `string/map` | M1 | every 5 s if changed, heartbeat 60 s |
| (MQTT in) `string/map_request` | | | answered within `request_min_interval` |

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

The 2D map is a picture for the dashboard, not for localisation. `map` is a static identity to `odom` in msd_system, so a saved map lines up only if the next session starts at the same pose. Localisation against a saved map is still open.

## What the bringup has to do

1. Send `twist_mux` output to `mux/cmd_vel` and give it the two web UI entries above.
2. Include `webui.launch.py` (`profile:=sim use_sim_time:=true` in Gazebo).
3. Keep every other publisher off `cmd_vel`.
4. Run the CMU stack in every mode the web UI is used in: without `/terrain_map_ext` and TF `map` to `base_link` and `base_footprint`, the dashboard shows no scan and no map.

Run `webui.launch.py` next to a bringup whose `twist_mux` still writes `cmd_vel` and `motion_guard` will hold zero against it, so the robot stutters or stops.

## Status

| Part | State |
| --- | --- |
| MQTT, lease, presence watchdog, emergency stop, manual drive, robot pose | done, bench tested; not yet run against the real dashboard |
| Map, scan, hole and hole trail streams | done, checked with a synthetic terrain map; not yet run on the CMU stack, Gazebo or the robot |
| Navigation with a saved map (M3), mapping (M4), autopilot (M5) | not started; answer `status:false` |
| Battery level, `stuck` activity | not available; the battery is reported as 0.0 |

Bench results on a Jazzy container without hardware: manual input stops 0.30 s after the key stream ends, a second `cmd_vel` publisher forces zero in 0.17 to 0.52 s, killing `webui_bridge` stops the robot in 0.53 s and killing `twist_mux` in 0.28 s. With a 3072 by 3072 map the guard heartbeat's longest gap stays at 0.21 s.

## Related

- [Message Contracts: Bridge Topics](/development/message-contracts/bridge-topics)
- [Message Contracts: MQTT Commands](/development/message-contracts/mqtt-commands)
- [Safety Watchdog](/development/ros/safety-watchdog)
- [Perception & Hazard Scan](/development/ros/perception-and-hazard-scan)
- [Coordinate Transforms (TF)](/development/ros/tf-transforms)
