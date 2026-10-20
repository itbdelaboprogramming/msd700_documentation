---
outline: deep
search: false
---

# Perception and Hazard Scan

<RoleBadge role="developer" />

How the 3D lidar cloud (a Velodyne VLP-16 or a Livox Mid-360, chosen per unit) becomes the two 2D scans the rest of the stack consumes: `/scan` for SLAM and localization, `/scan_hazard` for the costmaps. One 3D cloud in, two 2D scans out: simulation and the real robot share the pipeline exactly.

## The two scans

| Topic | Contents | Consumed by |
| --- | --- | --- |
| `/scan` | Positive obstacles only. Hole marks must never reach it | `slam_gmapping`, AMCL |
| `/scan_hazard` | Same cloud **plus holes** (injected as walls at their near lip) | `move_base` costmaps |
| `/scan_holes` | Holes only | Dashboard overlay |
| `/msd700/hazard_cells` | Cumulative trail of hazard cells (`nav_msgs/Path`) | Dashboard hole trail, relayed as `<root>/server/hazard_cells` |

Baking a hole edge into the static map would haunt localization forever, so the split is structural: SLAM gets the clean scan, the costmaps get the dangerous one. Height gating is disabled in the costmaps (`min/max_obstacle_height ∓100.0`) because it already happened upstream, here.

The hole trail is not the costmap's latch. It keeps a cell after the robot drives away and while the cell sits in the blind zone, and drops it once the detector looks again and sees floor: `memory.clear_hits` (3) frames in which floor returns on the cell's bearing reach past it, nothing stands in front of it, and it lies within `expected_max_range` (3.5 m), with no fresh detection of the cell in between. A misdetection therefore leaves the dashboard as it leaves the costmap in RViz. A disproved cell comes back only after `confirm_frames` (3) fresh detections.

## Lidar type and mount {#lidar-type-and-mount}

A unit carries either a Velodyne VLP-16 or a Livox Mid-360. `MSD700_LIDAR_TYPE` in the unit's `docker/.env` picks the driver, the mount and the perception tuning together, so the three cannot disagree:

| | `velodyne` (default) | `livox` |
| --- | --- | --- |
| Driver | `velodyne_driver` + `velodyne_pointcloud` | `livox_ros_driver2` 1.2.6 on Livox-SDK2 v1.3.1, built into the image under `/opt/livox_ws` |
| Cloud topic | `/velodyne_points` | `/livox/points` (re-stamped, [see below](#time-stamps)) |
| Mount file (TF `base_link -> laser`) | `msd700_xacro_irbot.yaml` | `msd700_xacro_irbot_livox.yaml` |
| Sensor profile | `config/sensor/velodyne_vlp16.yaml` | `config/sensor/livox_mid360.yaml` |
| Field of view | 360° x -15° to +15°, 16 rings | 360° x -7° to +52°, non-repetitive pattern |
| Sensor address | `192.168.103.231`, UDP 2368 | `192.168.103.232`, set in `msd700_hardware/config/livox/mid360.json` |

Both drivers publish in frame `laser`, so TF and everything downstream are the same for either sensor.

### Mount {#lidar-mount}

The mount is six numbers relative to `base_link`, in the REP-103 convention (x forward, y left, z up; angles in radians, applied roll, then pitch, then yaw about the fixed axes, as URDF does): `offset_x_lidar`, `offset_y_lidar`, `offset_z_lidar`, `lidar_roll`, `lidar_pitch` (nose-down positive) and `lidar_yaw`. `MSD700_LIDAR_POSE_FILE` (an absolute path) replaces the preset for a unit whose mount differs.

| Preset | x | y | z above `base_link` | roll | pitch | yaw | Height above the floor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VLP-16 on the mast | 0 | 0 | 0.427 m | 0 | 0 | 0 | 0.527 m |
| Mid-360 on the prototype | 0.21 m | 0 | 0.24 m | 0 | -0.7854 | 3.1416 | 0.34 m |

The Mid-360 pose comes from the prototype URDF (`msd700_prototype_robot.urdf.xacro`: `lidar_3d_xyz 0.21 0 0.23`, measured from a `base_link` 0.11 m above the floor; ours is 0.10 m, hence 0.24). Its rpy tilts the dome 45° forward and turns the sensor 180° about its own axis for cable routing. For coverage that equals a 45° nose-down pitch, because the Mid-360 sees 360° around its own axis, but keep the yaw: without it TF mirrors the cloud front to back. The robot body stays the one already configured; only the lidar pose follows the prototype.

### Where the floor is visible {#floor-reach}

The node does not assume a level sensor above the base origin. `src/msd700_perception/sensor_model.py` takes the mount from TF and the field of view from the sensor profile, and works out per output bearing the nearest floor the sensor can see and the furthest floor it can judge (beams at least `sensor.min_grazing_deg`, 8°, below horizontal). Hole detection, the floor checks behind the calibration advice, the latch timeout and the dashboard trail all use these per-bearing values. A hole latched behind a forward-looking sensor is therefore kept as unobservable instead of timing out.

| Bearing | VLP-16 on the mast | Mid-360 on the prototype |
| --- | --- | --- |
| Ahead | 1.97 m | 0.48 m |
| 60° | 1.97 m | 0.82 m |
| 90° (abeam) | 1.97 m | 3.1 m |
| Behind (past about 95°) | 1.97 m | never |

Closest visible floor, from the base origin, on flat floor. The node logs its own figures at start (`floor reach for this mount: ...`).

::: warning The Mid-360 is blind behind the robot
Tilted forward, it sees no floor and no low obstacle behind the robot, and walls behind it return above `max_obstacle_height`, so `/scan` for AMCL and gmapping is mostly the front half. Reverse slowly.
:::

::: tip A level Mid-360 cannot see the floor
Mounted level at mast height, it first meets the floor 5.65 m out, past the 3.0 m ground fit. The floor cannot be fitted and hole detection stays off. The forward tilt is what makes it work.
:::

### Body filter and dead zone {#body-filter}

Points inside the robot's own body box (`self_filter` in `config/robot/<profile>.yaml`, in `base_footprint`) are dropped before anything else, and the same box blocks beams in `sensor_model`. `livox_mid360` turns it on; it stays off for the mast-top VLP-16, which cannot see the body. Points nearer to the sensor than `sensor.min_range` are dropped too, which also removes the `(0, 0, 0)` the Livox driver emits for an empty beam.

### Time stamps {#time-stamps}

`livox_ros_driver2` stamps each cloud from the lidar's own clock. Without PTP that clock counts from the lidar's power-on, so every TF lookup at the stamp would fail and the node would publish nothing. `msd700_hardware/scripts/restamp_cloud.py` republishes `/livox/lidar` as `/livox/points` with the arrival time, accepting at most one frame (0.1 s) of latency. Pass `restamp:=false` to `livox_driver.launch` once the unit runs PTP.

### Checking the mount on the robot {#checking-the-mount}

On open, level floor:

```bash
rostopic echo /hazard_scan/ground_tilt     # deg: x = roll, y = pitch; about 0 when TF is right
rostopic echo /hazard_scan/ground_offset   # m; about 0 when offset_z_lidar is right
```

A steady non-zero reading means the mount file is off. The node logs what to add to `lidar_roll`, `lidar_pitch` or `offset_z_lidar` and names the file in use (the `/lidar_mount_config` param). Fix the tilt first: with the sensor ahead of `base_link`, a pitch error also shows up as an offset. Yaw cannot be read off the floor; square the robot to a straight wall and compare the wall in `/scan` with the robot's heading in RViz. The mount is applied by xacro at launch, so restart `robot_state_publisher` after editing it.

::: warning Mid-360 tuning is still the VLP-16's
The parameters that depend on how the sensor samples (dilation, ring gaps, `descent_run.max_gap`, the crest width) are inherited unchanged until a Mid-360 bag has been replayed through the node. `config/sensor/livox_mid360.yaml` lists them.
:::

## Pipeline (`msd700_perception/launch/cloud_hazard.launch`)

![Pipeline (msd700perception/launch/cloudhazard.launch)](./diagrams/perception-and-hazard-scan-pipeline-msd700perception-launch-cloudha.drawio)

Bands are metres **above the fitted ground surface**, not the sensor: `ground_tolerance 0.06`, `min_obstacle_height 0.08` (above the floor band means a real obstacle), `max_obstacle_height 0.65` (above this the robot drives under it), `hole_depth_threshold 0.12` (`config/hazard_scan.yaml`). The fit is quadratic (order 2, needed to cross rolling ground) over floor returns inside 3.0 m, re-weighted 3 times, with a floor-vs-wall discriminator (a candidate closer than the sensor's [floor reach](#floor-reach) on its bearing cannot be floor) so walls don't tilt the ground.

`hazard_scan.launch` wraps the node (`hazard_scan_node.py`, respawn on): `scan_topic /scan_hazard`, `obstacles_topic /scan_obstacles`, `holes_topic /scan_holes`, `cells_topic /msd700/hazard_cells`, base frame `base_footprint`. The lidar mount (position and tilt) comes from TF, not this config.

Parameters load in layers: `config/hazard_scan.yaml`, then `config/sensor/<sensor_profile>.yaml`, then `config/robot/<robot_profile>.yaml`, then the node's private rosparams. The base file is read from disk on every load, so an edit followed by `~reload_params` takes effect and a profile can override it. Until October 2026 the launch also copied the whole file into the node's rosparams, where it sat last in the merge, masked both profiles and pinned the values a reload should re-read.

### C fast path (`fastops`)

The grouped min/max reductions inside the pipeline (verticality, slope and descent runs, per-bin ranges, hole marks) run in a small C library, `src_cpp/fastops.cpp`, built by catkin as `libmsd700_perception_fastops.so` and called through `ctypes` from `src/msd700_perception/fastops.py`. On a 29k-point frame it cuts the pipeline from about 52-63 ms to 36-39 ms, with bit-identical output.

Every entry point keeps its numpy implementation. A workspace built without the C target, or a library that fails to load, falls back to numpy at the old speed instead of losing hazard detection. Set `MSD700_FASTOPS_DISABLE=1` to force the numpy path without rebuilding, for example to A/B a suspected difference on a real unit; `test/hazard_harness.py --selftest` runs both paths.

## Crest gate: the top of a climb

On a ramp, `base_footprint` tilts with the body. The ramp therefore reads as flat, and the level ground past its crest reads as a fall of the ramp's own grade. The ground fit only sees the ramp: the crest is a corner, not a curve, and the level top leaves the fit band within a metre. Every ray aimed over the crest flies past where the extended ramp plane says it should land, the ramp just short of the crest looks exactly like the near lip of a hole, and the hole detector marks the top of the hill as a drop-off. The robot stops short of every crest.

![Why the top of a climb reads as a hole](./diagrams/perception-and-hazard-scan-crest-side-view.drawio)

In the robot's own frame this is the same measurement as a real descent ahead of a level robot, so no gate that works in that frame can separate the two. `descent_run` does not help either: it stands down past about 8 deg, and a crest is past that by construction. The IMU is the only sensor that knows where gravity is. Turned into the gravity frame, the far side of a crest comes out level.

The crest gate (`src/msd700_perception/crest.py`) runs inside `negative.detect`, after the continuity gate and `descent_run` and before dilation, and only ever removes marks.

![Hole marks through the gates](./diagrams/perception-and-hazard-scan-crest-gate.drawio)

Per 2 deg sector that holds a mark, all six checks must pass before the sector's marks are dropped:

| # | Check | What it rules out |
| --- | --- | --- |
| 1 | A ray **landed** where the fitted ground predicted, within `lip_window` of the first mark | Marks with no confirmed ground in front of them |
| 2 | No ray lands on the fitted ground again **beyond** the first overshoot | A hole cut into a ramp that carries on: its far lip lands |
| 3 | One plane fits the overshooting rays within `far_half_width` of the bearing, with no cell below it by more than `max_residual` | A trench wall or pit floor under the far side |
| 4 | That plane, carried back to the lip, meets the fitted ground there: no step down larger than `step_tolerance` | A drop-off past the crest, however level the ground below it. Needs no IMU |
| 5 | The plane's steepest grade in the **gravity frame** is at most `max_world_grade` | A far side too steep to drive |
| 6 | Relative fall minus world fall along the bearing is at least `min_bend_explained` | A level robot facing a real descent: that fall is not the body's doing |

The far side is a **plane over a window of bearings**, not a line along one. From a moderate ramp often a single ring reaches the top, and a line through one ring is that ring's own ray: it runs back to the sensor and "meets the ground at the lip" over any drop at all. One ring swept across bearings is a curved arc, and the arc's shape pins down the far surface's tilt.

### IMU attitude

The node keeps a short buffer of `/imu/data` samples and judges each cloud against the sample **nearest its own stamp**, not whatever arrived last. The sample is turned through the `base_footprint` to IMU mounting from TF, so an IMU that is not square to the body is handled. The gate and the 30 deg slope guard both stand down, keeping every mark, when:

- the IMU carries no orientation (`orientation_covariance[0] = -1`, or an all-zero quaternion); the node warns once;
- no sample lies within `imu.stale_after` (0.5 s) of the cloud's stamp;
- TF has no transform from `base_footprint` to the IMU's frame.

### Configuration (`config/hazard_scan.yaml`, block `crest`)

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Turn the gate off without a rebuild (`~reload_params`) |
| `sector` | `2.0` deg | Azimuth judged together |
| `lip_window` | `1.2` m | How close inside the first mark the last landed ray must be |
| `far_window` | `16.0` m | How far past the mark far returns are gathered. From a 10 deg ramp the first ring reaches the top about 8 m out |
| `far_half_width` | `15.0` deg | Bearings either side used for the far plane |
| `radial_cell` | `0.15` m | Far returns are averaged per bin and radial cell before the fit |
| `min_cells`, `min_spread` | `8`, `0.10` m | Below these the plane is not pinned down along the bearing and the marks stay |
| `max_residual` | `0.08` m | A cell this far below the plane vetoes the sector |
| `step_tolerance` | `0.10` m | Largest step down allowed at the lip. Under `hole_depth_threshold` (0.12 m) |
| `max_world_grade` | `8.0` deg | Steepest far side, in the gravity frame, the gate will clear |
| `min_bend_explained` | `3.0` deg | How much of the fall the body's tilt must account for |

### Measured (`test/hazard_harness.py --selftest`)

| Case | Before | After |
| --- | --- | --- |
| Crests of 6 to 14 deg ramps, 1.5 to 3.0 m ahead (10 cases) | 38 to 142 hole bins | **0** in every case |
| Same 10 cases with 0.03 m range noise (a real VLP-16) | 35 to 142 | **0** |
| Same, IMU reading 3 deg off either way | 83 | **0** |
| Crest met 20 to 35 deg off square (pitch and roll together) | 20 to 167 | **0** |
| Hill: 10 deg up, 5 deg down the far side | 81 | **0** |
| Hill: 4 deg up, 10 deg down (past `max_world_grade`) | 102 | 102, unchanged |
| Drop-off of 0.3, 0.5 or 1.0 m just past a crest (12 cases; again at 0.03 m noise, and with the IMU 2 to 4 deg off) | all | **all unchanged** |
| Trenches, ditches and a 3 m chasm cut into a ramp that carries on | 245 each | **245, unchanged** |
| Level robot facing a real 10 or 14 deg descent | 83, 102 | unchanged |

The gate costs about 11 ms on a worst-case synthetic frame, inside the 100 ms scan period.

::: warning The crest shadow
From the ramp, the first few metres past the crest are hidden: rays pass over them at 1 to 5 deg and land several metres further on. A hole in that band leaves no return below the far plane and no ground landing again, so it is cleared along with the crest (the harness keeps this as a test, `test_what_the_crest_gate_cannot_see`). Once the body tips level onto the top, those metres are inside the blind zone (1.87 m on the VLP-16), so nothing in this package sees them from either side. This is a limit of the sensor's geometry, not of the tuning. Drive slowly over crests.
:::

## The `MSD700_HAZARD_SCAN` switch

One environment variable, two halves that must agree:

- **Lidar half** (`lidar_scanner.launch`): `true` swaps the plain flattener for `velodyne_hazard.launch` or `livox_hazard.launch`, whichever `MSD700_LIDAR_TYPE` names (same driver and `/scan` for SLAM/AMCL, plus `/scan_hazard`). Prerequisite: the sensor at its address (VLP-16 `192.168.103.231`, Mid-360 `192.168.103.232`) and its driver packages (all baked into the image).
- **Costmap half** (`navigation_core.launch`, `msd700_navigation.launch`): all four costmap observation topics follow one `obstacle_scan` arg: `scan` by default, `scan_hazard` when perception runs. Deliberately unit-wide, never per-mode (`switch_mode.yaml` says so): per-mode overrides would let the costmaps ask for a topic nobody publishes.

::: warning Never add `scan_hazard` as a second source
Point `obstacle_scan` at one scan or the other, not both. The plain scan's raytrace would clear the very hole mark `scan_hazard` just painted (`move_base.launch` carries this warning). Manual override without the env var: `obstacle_scan:=scan_hazard` on the navigation launch.
:::

Live default is `MSD700_HAZARD_SCAN=true` in the unit's `docker/.env` (template ships `false`). Keep `.env` in sync with `velodyne_scanner.launch device_ip` (VLP-16) or `msd700_hardware/config/livox/mid360.json` (Mid-360).

## Testing it

`msd700_hazard_test.launch`: field robot with a real VLP-16 in a world with a hole: trench, 0.15 m kerb, drive-under bench, must-block beam. `msd700_mine.launch`: 44 m open-pit/underground rig with a 3.0 m chasm. `msd700_world.launch` dispatches by `MSD700_SIM_WORLD`: `warehouse` (flat AWS, `/scan_hazard` = `/scan`), `hazard`, `mine`.

The latch test rule, from the launch header: drive **inside 1.87 m** of a hole (VLP-16; on a Mid-360 the distance depends on the bearing, see [the table above](#floor-reach)). A standstill demo at 3 m proves nothing.

With `MSD700_LIDAR_TYPE=livox` the simulator mounts a Mid-360 (`msd700_description/urdf/livox/mid360.urdf.xacro`) from `msd700_xacro_field_livox_sim.yaml`: the unit's height and tilt, but at x 0.50 m instead of 0.21 m. The simulated field body (0.90 x 0.70 m, roof 0.31 m) is far bigger than the prototype, and at x 0.21 its roof blocks the forward beams, so the floor would first show about 2.9 m out. `MSD700_SIM_LIDAR_POSE_FILE` replaces the sim preset for one run. The simulated beams are a fixed 360 x 24 grid, not the Mid-360's rosette: right for the mount geometry, not for tuning. Offline: `test/test_sensor_model.py` and `test/test_livox_mount.py` (raycast VLP-16 and Mid-360 at any mount through the real config).

## Related Documentation

- [Costmaps and Planners](/development/ros/costmaps-and-planners): Which scan each costmap layer consumes.
- [Sensor Fusion and Control](/development/ros/sensor-fusion-and-control): The plain `/scan` pipeline.
- [Simulation](/development/ros/simulation): Warehouse and hazard test worlds.
- [ROS Package Registry](/development/ros/ros-packages): Package and launch file map.
