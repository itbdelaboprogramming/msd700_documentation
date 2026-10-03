---
outline: deep
search: false
---

# Perception and Hazard Scan

<RoleBadge role="developer" />

How the Velodyne cloud becomes the two 2D scans the rest of the stack consumes: `/scan` for SLAM and localization, `/scan_hazard` for the costmaps. One 3D cloud in, two 2D scans out: simulation and the real robot share the pipeline exactly.

## The two scans

| Topic | Contents | Consumed by |
| --- | --- | --- |
| `/scan` | Positive obstacles only. Hole marks must never reach it | `slam_gmapping`, AMCL |
| `/scan_hazard` | Same cloud **plus holes** (injected as walls at their near lip) | `move_base` costmaps |
| `/scan_holes` | Holes only | Dashboard overlay |
| `/msd700/hazard_cells` | Cumulative trail of hazard cells (`nav_msgs/Path`) | Dashboard hole trail, relayed as `<root>/server/hazard_cells` |

Baking a hole edge into the static map would haunt localization forever, so the split is structural: SLAM gets the clean scan, the costmaps get the dangerous one. Height gating is disabled in the costmaps (`min/max_obstacle_height ∓100.0`) because it already happened upstream, here.

The hole trail is not the costmap's latch. It keeps a cell after the robot drives away and while the cell sits in the blind zone, and drops it once the detector looks again and sees floor: `memory.clear_hits` (3) frames in which floor returns on the cell's bearing reach past it, nothing stands in front of it, and it lies within `expected_max_range` (3.5 m), with no fresh detection of the cell in between. A misdetection therefore leaves the dashboard as it leaves the costmap in RViz. A disproved cell comes back only after `confirm_frames` (3) fresh detections.

## Pipeline (`msd700_perception/launch/cloud_hazard.launch`)

![Pipeline (msd700perception/launch/cloudhazard.launch)](./diagrams/perception-and-hazard-scan-pipeline-msd700perception-launch-cloudha.drawio)

Bands are metres **above the fitted ground surface**, not the sensor: `ground_tolerance 0.06`, `min_obstacle_height 0.08` (above the floor band means a real obstacle), `max_obstacle_height 0.65` (above this the robot drives under it), `hole_depth_threshold 0.12` (`config/hazard_scan.yaml`). The fit is quadratic (order 2, needed to cross rolling ground) over floor returns inside 3.0 m, re-weighted 3 times, with a floor-vs-wall discriminator (`steepest_ring_deg 15.0`) so walls don't tilt the ground.

`hazard_scan.launch` wraps the node (`hazard_scan_node.py`, respawn on): `scan_topic /scan_hazard`, `obstacles_topic /scan_obstacles`, `holes_topic /scan_holes`, `cells_topic /msd700/hazard_cells`, base frame `base_footprint`. Lidar mount height comes from TF, not this config.

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
From the ramp, the first few metres past the crest are hidden: rays pass over them at 1 to 5 deg and land several metres further on. A hole in that band leaves no return below the far plane and no ground landing again, so it is cleared along with the crest (the harness keeps this as a test, `test_what_the_crest_gate_cannot_see`). Once the body tips level onto the top, those metres are inside the 1.87 m blind zone, so nothing in this package sees them from either side. This is a limit of the sensor's geometry, not of the tuning. Drive slowly over crests.
:::

## The `MSD700_HAZARD_SCAN` switch

One environment variable, two halves that must agree:

- **Lidar half** (`lidar_scanner.launch`): `true` swaps the plain `pointcloud_to_laserscan` flattener for `velodyne_hazard.launch` (same driver and `/scan` for SLAM/AMCL, plus `/scan_hazard`). Prerequisite: the Velodyne fitted at `192.168.103.231` and the `ros-noetic-velodyne` + `ros-noetic-pointcloud-to-laserscan` packages (baked into the image).
- **Costmap half** (`navigation_core.launch`, `msd700_navigation.launch`): all four costmap observation topics follow one `obstacle_scan` arg: `scan` by default, `scan_hazard` when perception runs. Deliberately unit-wide, never per-mode (`switch_mode.yaml` says so): per-mode overrides would let the costmaps ask for a topic nobody publishes.

::: warning Never add `scan_hazard` as a second source
Point `obstacle_scan` at one scan or the other, not both. The plain scan's raytrace would clear the very hole mark `scan_hazard` just painted (`move_base.launch` carries this warning). Manual override without the env var: `obstacle_scan:=scan_hazard` on the navigation launch.
:::

Live default is `MSD700_HAZARD_SCAN=true` in the unit's `docker/.env` (template ships `false`). Keep `.env` in sync with `velodyne_scanner.launch device_ip`.

## Testing it

`msd700_hazard_test.launch`: field robot with a real VLP-16 in a world with a hole: trench, 0.15 m kerb, drive-under bench, must-block beam. `msd700_mine.launch`: 44 m open-pit/underground rig with a 3.0 m chasm. `msd700_world.launch` dispatches by `MSD700_SIM_WORLD`: `warehouse` (flat AWS, `/scan_hazard` = `/scan`), `hazard`, `mine`.

The latch test rule, from the launch header: drive **inside 1.87 m** of a hole. A standstill demo at 3 m proves nothing.

## Related Documentation

- [Costmaps and Planners](/development/ros/costmaps-and-planners): Which scan each costmap layer consumes.
- [Sensor Fusion and Control](/development/ros/sensor-fusion-and-control): The plain `/scan` pipeline.
- [Simulation](/development/ros/simulation): Warehouse and hazard test worlds.
- [ROS Package Registry](/development/ros/ros-packages): Package and launch file map.
