---
outline: deep
search: false
---

# Simulation

<RoleBadge role="developer" />

How to run the MSD700 in Gazebo at the size it actually is, and what the simulator can and
cannot prove. For the geometry the coverage planner derives from that size, see
[Boustrophedon § Two robot geometries](/development/boustrophedon-and-alignment#_1-two-robot-geometries).

---

## The problem this replaced

Every robot model in `msd700_description/urdf` except one is a TurtleBot3 Waffle derivative:
a **0.266 x 0.266 m** body on a 0.287 m track. `msd700_sirius`, `msd700_canopus` and
`msd700_zenith` all inherit the Waffle base link and its collision box unchanged. The machine
in the field is **0.90 x 0.70 m**, carried by the costmap as a padded **1.20 x 0.85 m**
envelope.

That gap had three visible consequences.

- **Field complaints could not reproduce.** "The planner fails in a narrow area" is a
  statement about a 0.425 m inscribed radius. A robot with a 0.133 m radius sails through.
- **A wrong constant leaked into the coverage code.** `robot_width 0.32` is the Waffle's
  width plus its wheels, and it sat in the coverage parameters for months.
- **The worlds were sized to match.** Measured with a chamfer distance transform on the
  saved occupancy grids:

  | World | Max clearance | Robot fits? |
  |---|---|---|
  | `turtlebot_world` | **0.39 m** | No, not in a single cell. Inscribed radius alone is 0.425 m |
  | `custom_testing_world` | small-room scale | Marginal |
  | AWS Small Warehouse | **3.68 m** | Yes, with 58 % of the floor traversable and 38 % pivotable |

The last row is why the warehouse was adopted.

## The world

[AWS RoboMaker Small Warehouse](https://github.com/aws-robotics/aws-robomaker-small-warehouse-world):
a 13.98 x 20.91 m hall, 234 m² of floor, shelving rows, pallet jacks, desks, bins and
clutter. Aisles reach 7.4 m across.

It is **not** committed to this repository. 12 MB of DAE meshes whose upstream is archived
does not belong in git. Fetch it once:

```bash
rosrun msd700_simulation fetch_sim_worlds.sh
```

::: warning The upstream default branch is a stub
AWS RoboMaker reached end of support on 2025-09-10 and the repository was archived. Its
default branch is now a README saying so. The world files live on the **`ros1`** branch, which
is what the fetch script clones. A plain `git clone` of that URL gets you a README and nothing
else.
:::

The script is idempotent, reports the commit it fetched, and supports `--check` (report only)
and `--force` (delete and refetch). Every warehouse launch starts a `sim_world_guard` node
with `required="true"` that aborts the session if the fetch never ran, because **Gazebo does
not fail on a missing world**: it opens an empty grey grid, the robot spawns into the void,
gmapping produces a blank map, and nothing in the log says why.

### How the field was measured

Two independent methods, which is the only reason to trust either:

| Method | Max clearance | Robot can stand | Robot can pivot |
|---|---|---|---|
| Collision geometry in the world file, footprints clipped to the 0.06–0.51 m body band | 3.83 m | 65 % | 46 % |
| Chamfer transform on the occupancy grid AWS ships | 3.68 m | 58 % | 38 % |

The world-file figures are slightly optimistic because they ignore fine clutter detail. Both
sit far above the 0.425 m the robot needs to stand and the 0.735 m it needs to pivot in place.

### Spawn pose

`(0.50, -2.40)` facing north, where clearance is **3.79 m**. Alternates, same method:
`(1.81, -7.25)` 2.47 m, `(0.81, 2.75)` 1.49 m, `(-3.69, 9.05)` 1.41 m, `(-3.39, -9.10)` 1.35 m.

::: danger Do not spawn at (4.00, 1.00)
That is 0.29 m from a shelf, inside the robot's own inscribed radius. It is the pose
`msd700_world.launch` uses for its `turtlebot_house` branch, so it is the value you land on by
copying the older launch file. `msd700_world.launch`'s other default, `(-1.00, -1.00)`, is
clear with 2.26 m.
:::

Every obstacle the warehouse places was also checked against the scan plane at 0.61 m: all
twelve are visible there, so nothing is solid in Gazebo but absent from the costmap. The floor
paint and the ceiling lamp are correctly out of reach.

## The robot

`msd700_description/urdf/msd700_field.urdf.xacro`, with sensors in
`msd700_field.gazebo.xacro`. Frames and topics are **identical** to
`turtlebot3_waffle.urdf.xacro` — `base_footprint`, `base_link`, `base_scan`, `imu_link`,
`/cmd_vel`, `/odom`, `/scan`, `/imu` — so nothing downstream needed rewiring. Only the
dimensions differ. It also publishes a `laser` frame aliased to `base_scan`, which is the name
the real robot uses, so a bag recorded in simulation replays against real-robot configs.

| Property | Value | Why |
|---|---|---|
| Body | 0.90 x 0.70 x 0.45 m | The audited body. Matches `~body_footprint` in `msd700_boustrophedon.launch` |
| Mass | 60 kg | |
| Wheel separation | 0.60 m | Drive wheels **on the centre line** |
| Wheel radius | 0.10 m | Must equal half of `<wheelDiameter>` in the plugin |
| Lidar height | 0.61 m above ground | On a mast, clear of the 0.51 m roof |
| Casters | 4 spheres, µ = 0 | Four, not two: a 0.9 m body on two casters rocks, and a tilted 2D scan writes phantom obstacles |

Drive wheels sit on the centre line deliberately. `turn_clearance` is derived from a
circumscribed radius measured about the **footprint centre**; a robot pivoting about an axle
placed ahead of centre sweeps a larger circle than the planner budgeted for.

::: warning The wheel numbers are not measured hardware
`msd700_hardware/config/odometry_config.yaml` still carries 2.7 cm wheels on a 23 cm track,
which belongs to the 0.30 x 0.30 m prototype. The separation and radius here were chosen to
suit the audited body. Fix that config before quoting them as the real robot's.
:::

### Two arguments worth understanding

**`odometry_source`** defaults to `encoder`, which integrates the wheel joints, so odom drifts
and the `map` → `odom` correction actually does work. The Waffle models use `world`, handing
the plugin Gazebo's ground truth. That is convenient and it hides an entire class of bug: a
path published in the wrong frame still lands on target, because `odom` and `map` never
diverge. Set `world` only to take odometry out of an investigation.

**`lidar_min_range`** defaults to 0.25 m, matching the planar scanner on the prototype. The
VLP-16 on the field robot returns nothing closer than **0.9 m**, and the coverage planner
drives to within 0.575 m of a wall, so that sensor is blind exactly where the robot is about to
touch something. Set `0.9` to reproduce that blind zone on purpose; leave it at 0.25 for
everyday work, or every run fails for the same already-known reason.

## Launches

| Launch | Brings up |
|---|---|
| `msd700_simulation msd700_warehouse.launch` | World and robot only |
| `msd700_simulation msd700_warehouse_slam.launch` | Adds gmapping, `move_base`, frontier exploration. Produces the map |
| `msd700_simulation msd700_warehouse_nav.launch` | Adds `map_server`, AMCL and `path_coverage_node`. The coverage rig |
| `msd700_navigation msd700_explore.launch` | Web UI Mapping / Exploration default launch (now wired to AWS Warehouse) |
| `msd700_navigation msd700_navigation.launch` | Web UI Navigation default launch (now wired to AWS Warehouse) |

All of them accept `headless_mode:=true` for Docker or a display-less SSH session.

### Web UI Integration

The standard Web UI mode switching (`/switch_mode`) and dashboard buttons are natively integrated:
- **Mapping Button**: Runs `msd700_explore.launch`, spawning `msd700_field` at `(0.50, -2.40)` in the AWS Warehouse, running warehouse gmapping (`gmapping_params_warehouse.yaml`), `explore_lite`, and `move_base` with `sim_body:=field`.
- **Navigation Mode**: Runs `msd700_navigation.launch`, initializing AMCL pose at `(0.50, -2.40, yaw: 1.5708)` and setting LiDAR range to 12.0 m.
- **Coverage / Boustrophedon**: Runs `msd700_boustrophedon.launch` with real robot footprint parameters on top of the warehouse map.

### Getting a map via CLI

```bash
roslaunch msd700_simulation msd700_warehouse_slam.launch
# wait until the map stops changing, then
rosrun map_server map_saver -f $(rospack find msd700_navigation)/maps/simulator/warehouse
```

`auto_explore` is on by default and drives the robot itself. Pass `use_teleop:=true` to drive
by hand instead; the two are mutually exclusive because `explore_lite` and teleop fight over
`cmd_vel`.

::: tip The map AWS ships is not used
Its frame does not line up with the Gazebo world (shelf rows that run along `y` in the world
appear along `x` in that map) so localising against it puts the robot in the wrong aisle. It
also came from a TurtleBot-height sensor. Map the world with the robot that will drive it.
:::

Save at the gmapping resolution of **0.05 m/cell**. The coverage planner reads clearances off
that grid, so a coarser map quietly shrinks every aisle by up to one cell per side.

### Running coverage via CLI

```bash
roslaunch msd700_simulation msd700_warehouse_nav.launch
```

Then draw areas and playlists in the web UI as usual; the coverage node listens on the same
topics it does on the robot. That launch reuses `msd700_boustrophedon.launch` with
`use_navigation:=false`, which suppresses that file's own world, `map_server`, AMCL and
`move_base` and leaves just `path_coverage_node` with its full parameter set. Keeping those
~30 parameters in one place matters; a second copy is a second thing to forget to update.

## `sim_body`: which body move_base thinks it is steering

`use_simulator` used to decide the footprint on its own, and it always picked the Waffle
configs. `move_base.launch` now takes a separate `sim_body`:

| `sim_body` | Costmap config | TEB config |
|---|---|---|
| `waffle` | `costmap_common_params_sim.yaml` (0.28 x 0.31 m) | `teb_local_planner_params_sim.yaml` |
| `field` (default for warehouse/Web UI) | `costmap_common_params.yaml` (the real 1.20 x 0.85 m envelope) | `teb_local_planner_params.yaml` |

Real hardware ignores the argument and always loads the real configs. **A real-size robot
carrying a Waffle footprint plans straight between two shelf legs it cannot pass**, which is
the failure this separation exists to prevent. The warehouse launches pass `field`.

## Parameters raised for a hall this size

Two defaults were tuned for a room and do not survive a 21 m building. Both are now arguments,
with the old values as their defaults, so nothing else changed.

| Parameter | Room default | Warehouse | Why |
|---|---|---|---|
| gmapping `maxUrange` | 5.5 m | 12.0 m | At 5.5 m a scan in the open middle of the hall has no distant structure to lock onto, and the map shears along the long axis |
| gmapping `minimumScore` | 50 | 200 | Calibrated for short scans; with 12 m of range a good match scores far higher, so 50 accepts bad matches |
| gmapping `linearUpdate` | 1.0 m | 0.5 m | 1.0 m at 0.4 m/s is one scan every 2.5 s, coarse for 0.6 m gaps between shelf legs |
| gmapping initial bounds | ±10 m | x ±12, y ±14 | Growth reallocates every particle's map, and the stalls show up as dropped scans |
| AMCL `laser_max_range` | 3.5 m | 12.0 m | Throws away the only long returns a particle could be weighted with |

The warehouse set lives in `msd700_navigation/config/mapping/gmapping_params_warehouse.yaml`,
which repeats every key of the base file verbatim so the two can be diffed.

## What this rig proves, and what it does not

**It validates** geometry, cell decomposition, lane placement, turn feasibility, keep-out
handling and the replan loop, with the simulated body and the planned-for body finally being
the same body.

**It says nothing about** the real robot's traction, its motor limits, or Velodyne behaviour.
Its odometry drift is a plausible guess, not a measurement. A sweep that completes here can
still fail in the field for reasons no simulator models.

## New dependencies

`velodyne_gazebo_plugins` was missing from `install_requires/noetic_dep.sh`, which meant
`turtlebot3_waffle_vlp16.urdf.xacro` spawned with **no lidar at all** and Gazebo mentioned it
only in its own stderr. Added alongside `velodyne_driver`, `velodyne_pointcloud` and
`pointcloud_to_laserscan`, which the real robot's `velodyne_scanner.launch` already needed.

`msd700_simulation/package.xml` also gained the `exec_depend` entries its launches actually
use — `gazebo_ros`, `robot_state_publisher`, `xacro`, `msd700_description`, `git` — none of
which were declared, so `rosdep` never installed them and a fresh clone failed at roslaunch
time rather than at build time.
