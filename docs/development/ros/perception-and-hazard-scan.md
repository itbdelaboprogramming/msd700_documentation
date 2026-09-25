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
| `/msd700/hazard_cells` | Cumulative trail of hazard cells (`nav_msgs/Path`) | Debugging |

Baking a hole edge into the static map would haunt localization forever, so the split is structural: SLAM gets the clean scan, the costmaps get the dangerous one. Height gating is disabled in the costmaps (`min/max_obstacle_height ∓100.0`) because it already happened upstream, here.

## Pipeline (`msd700_perception/launch/cloud_hazard.launch`)

![Pipeline (msd700perception/launch/cloudhazard.launch)](./diagrams/perception-and-hazard-scan-pipeline-msd700perception-launch-cloudha.drawio)

Bands are metres **above the fitted ground surface**, not the sensor: `ground_tolerance 0.06`, `min_obstacle_height 0.08` (above the floor band means a real obstacle), `max_obstacle_height 0.65` (above this the robot drives under it), `hole_depth_threshold 0.12` (`config/hazard_scan.yaml`). The fit is quadratic (order 2, needed to cross rolling ground) over floor returns inside 3.0 m, re-weighted 3 times, with a floor-vs-wall discriminator (`steepest_ring_deg 15.0`) so walls don't tilt the ground.

`hazard_scan.launch` wraps the node (`hazard_scan_node.py`, respawn on): `scan_topic /scan_hazard`, `obstacles_topic /scan_obstacles`, `holes_topic /scan_holes`, `cells_topic /msd700/hazard_cells`, base frame `base_footprint`. Lidar mount height comes from TF, not this config.

### C fast path (`fastops`)

The grouped min/max reductions inside the pipeline (verticality, slope and descent runs, per-bin ranges, hole marks) run in a small C library, `src_cpp/fastops.cpp`, built by catkin as `libmsd700_perception_fastops.so` and called through `ctypes` from `src/msd700_perception/fastops.py`. On a 29k-point frame it cuts the pipeline from about 52-63 ms to 36-39 ms, with bit-identical output.

Every entry point keeps its numpy implementation. A workspace built without the C target, or a library that fails to load, falls back to numpy at the old speed instead of losing hazard detection. Set `MSD700_FASTOPS_DISABLE=1` to force the numpy path without rebuilding, for example to A/B a suspected difference on a real unit; `test/hazard_harness.py --selftest` runs both paths.

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
