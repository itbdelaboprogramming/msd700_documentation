---
title: Boustrophedon Coverage & Zero-Spin Alignment Architecture
---

# Boustrophedon Coverage & Zero-Spin Alignment Architecture

<RoleBadge role="developer" />

How the MSD700 plans a sweep, how much of an area it can physically cover, how it handles obstacles it did not know about, and how it aligns without spinning.

---

## 1. Two robot geometries

The single most important thing to know before reading any number below: **the robot has two sizes, and they are used for different things.**

| Geometry | Size | Used for | Getting it wrong |
|---|---|---|---|
| **Body** | 0.90 m x 0.70 m | Lane pitch, swept-area maths | Using the envelope claims 0.85 m of coverage from a 0.70 m body and consumes the whole overlap budget |
| **Envelope** | 1.20 m x 0.85 m | Clearances, turn feasibility | Using the body puts lanes where the local planner refuses to go |

The envelope is the footprint in `costmap_common_params.yaml`. It carries **deliberate safety padding** of 0.075 m laterally and 0.150 m longitudinally per side. It is not the physical robot and must not be "corrected" to match one.

`path_coverage_node` reads the envelope from `/move_base/global_costmap/footprint`, so the coverage planner can never disagree with what TEB enforces, and reads the body from its own `~body_footprint` parameter.

### Derived clearances

Nothing types a clearance literal. Every length comes from `libs/coverage_geometry.py`:

| Symbol | Value | Formula |
|---|---|---|
| `wall_clearance` | **0.575 m** | `env_r_inscribed 0.425 + min_obstacle_dist 0.15 + safety_margin 0.0` |
| `turn_clearance` | **0.885 m** | `env_r_circumscribed 0.735 + min_obstacle_dist 0.15 + safety_margin 0.0` |
| `pitch` | **0.574 m** | `body_width 0.70 x (1 - coverage_overlap 0.18)` |

`safety_margin` defaults to **zero on purpose**. The footprint padding and `min_obstacle_dist` are already two safety layers; stacking a third is exactly how the old `boundary_inflation` ended up being applied twice.

The node prints all of this in one block at startup. **Read that block before blaming anything else.**

### What follows from the geometry

| Question | Answer |
|---|---|
| Narrowest corridor the robot can enter | **1.15 m** |
| Narrowest corridor it can turn around in | **1.77 m** |
| Narrowest corridor worth sweeping (2 lanes) | **1.72 m** |
| Strip along every wall nothing can ever cover | **0.225 m** |

That last one is a geometric floor, not a planner defect: it is `wall_clearance - body_half_width`. A 3 x 6 m room therefore tops out at **78.6 %** coverage no matter how good the plan is. Judge a plan by its **attainment** (how much of the reachable region it swept), not by raw coverage.

::: warning Only one simulated robot can test any of this
Every model in `msd700_description/urdf` except `msd700_field.urdf.xacro` is a TurtleBot3 Waffle derivative at 0.266 x 0.266 m. Against that body a `wall_clearance` of 0.575 m and a 1.77 m turnaround corridor are meaningless, and the small worlds shipped alongside them make it worse: `turtlebot_world` has a maximum clearance of 0.39 m, less than this robot's inscribed radius alone. Use `msd700_simulation msd700_warehouse_nav.launch`; see [Simulation](/development/simulation).
:::

---

## 2. How a sweep is planned

```
drawn area
   │  clip to free space   (erosion by wall_clearance, ONCE)
   ▼
coverable polygons
   │  boustrophedon decomposition
   ▼
obstacle-free cells
   │  lanes + headland + residual pass
   ▼
strokes
   │  turn primitives between strokes
   ▼
(x, y, yaw) waypoints  →  move_base
```

**Clip.** `extract_free_space_regions` erodes the map by `wall_clearance` and returns **every** drivable region with its holes. Regions the erosion severed from the robot are returned flagged unreachable and reported, not deleted.

**Decompose.** A vertical line sweeps across the area; wherever its connectivity changes (an obstacle's left or right extreme) the area is cut. Every resulting cell is crossed in exactly one interval, which is what makes a plain back-and-forth correct inside it. Without this an L-shaped room arrives as one polygon and the zig-zag crosses the obstacle. Controlled by `~boustrophedon_decomposition`, **on by default**.

**Lanes.** Placed inside the `wall_clearance` band at `pitch` spacing, running along the cell's long axis, swept in the order they were scanned: a plain back-and-forth serpentine.

**Bands.** A scan column that crosses a hole yields two segments. They are chained into separate **bands**, joined only where the y intervals of adjacent columns overlap, and a band that splits or two bands that merge both end there. Those are the IN and OUT events of the decomposition, and honouring them is what keeps the serpentine on one side of an obstacle until it is finished with it. Without band grouping the path hops the obstacle at every column: on a 10 x 6 m room with a 2 x 2 m pillar that alone was 76 m of transit instead of 22 m.

**Lane order.** `~lane_order: adjacent` is the default and is what an operator expects to see. `skip` sweeps 1, 3, 5 then 6, 4, 2, which leaves `2 x pitch` between consecutive lanes and more room for a turnaround, at the cost of a figure that is hard to read and hard to predict. Coverage is identical either way.

**Turns.** `~turn_style: square` is the default: pivot 90 degrees at the lane end, cross to the next lane, pivot 90 again. Where the two lane ends are not level the difference is walked along the lane axis as its own leg, so the comb never draws a diagonal. Where the robot cannot pivot (`is_turnable` fails at either corner) or the crossing leg is not clear end to end, the planner falls back to the shortest manoeuvre that fits, in order: point turn, omega, switchback, or plain goal. `~turn_style: adaptive` always takes the shortest manoeuvre and produces the older, visually irregular path.

**Chaining.** Lanes keep their scanned order and orientation. Headland and residual strokes are placed by cheapest insertion into that fixed chain, so they no longer cost a full cell transit apiece while the zigzag still reads as a zigzag. This is deliberately not a route solve: reordering lanes buys a few metres of transit and costs the operator any ability to predict where the robot goes next. Measured on the standard cases, the readable serpentine costs about 1 m more transit on a 3 x 6 m room and about 4 m more on a 6 x 8 m room than a full reorder, and is slightly **cheaper** on an L-shape.

**Headland.** A lane end sits `wall_clearance` from the far wall, but an in-place turn needs `turn_clearance`, so the turning disc would punch through the wall. Lanes therefore stop `turn_clearance` short, and the strip that leaves is closed by one perpendicular pass at each end. Coverage is unchanged; every turn becomes feasible. Two extra passes per cell. Disable with `~headland:=false`.

**Residual pass.** Measures what the lanes actually cover against what is attainable and sweeps the difference, each gap on its own optimal axis, up to three iterations. **This is what guarantees completeness.** Overlap only absorbs localisation error.

**Attainment gate.** Each area reports `planned_coverage_ratio`. Below `~min_attainment` (0.90) it is reported **partial**, not done.

---

## 3. Obstacle handling, in five layers

Obstacle avoidance at the navigation layer has always worked: TEB steers around people and boxes, navfn routes around walls. What was missing was **replanning** — noticing that the lane behind the box is now two lanes, driving around, and finishing it.

| Layer | Horizon | Handles | Decision |
|---|---|---|---|
| **L0** area | whole run | permanent obstacles | decompose into cells, cut lanes into sub-lanes |
| **L1** transit | between strokes | permanent obstacles on the way | navfn routes around |
| **L2** steering | 3 x 3 m | small dynamic obstacles | TEB deviates |
| **L3** failure | per waypoint | a goal that cannot be reached | classify, nudge sideways, defer, record |
| **L4** replan | rest of the running cell | large dynamic obstacles | re-cut the remaining lanes |

### L3: why a waypoint failed

| Class | Detected by | Treatment | Marker |
|---|---|---|---|
| `static` | blocked in `/map` | permanent, never retried | red cross |
| `dynamic` | free in `/map`, blocked in the live costmap | retried once at the end of the run | amber dash |
| `planner` | costmap clear but move_base aborted | nudged up to `pitch/2` sideways, twice, then demoted to `static` | dark amber |

The pre-flight check blocks at cost **>= 99** (inscribed), not 100. At 99 the footprint already overlaps the obstacle; the old threshold let those through to fail in move_base and burn a retry each time.

### L4: the replan loop

1. A cell is a **discovered obstacle** when the live costmap blocks it but the static map does not.
2. Discoveries accumulate; a single noisy cell never triggers anything.
3. Re-cut when `~replan_blocked_fraction` (0.15) of the remaining lane is blocked, **or** `~replan_failure_streak` (3) waypoints fail in one region, subject to `~replan_min_interval` (10 s).
4. Only the **remaining** lanes in the **running** cell are re-cut. Finished cells are untouched and a run is never cancelled because of an obstacle.
5. New sub-lanes are joined by transits through navfn, so the robot drives around and carries on.
6. Regions lost to a `dynamic` obstacle are retried once at the end (`~dynamic_retry_at_end`).

### TEB coverage profile

A boustrophedon reverses direction at every lane end. `weight_kinematics_forward_drive: 1000` is right for point-to-point navigation and wrong here: a 0.9 m long differential-drive robot refuses to reverse and oscillates until move_base gives up. The node lowers it to `~teb_coverage_forward_weight` (5.0) via `dynamic_reconfigure` for the duration of the run and restores it afterwards. The yaml is deliberately left alone, because the same planner still serves ordinary navigation.

---

## 4. Route optimisation

**The playlist order is never changed.** The operator decided it, and re-ordering it silently would be a regression of a feature they can see.

What is optimised is **where each area is entered and left**. With the sequence fixed, that is a shortest path through a layered graph rather than a travelling-salesman problem, so `chain_areas` returns the true optimum for the candidate corners in `O(n x m^2)` instead of a heuristic. Transit cost is **geodesic** over the reachability grid, because a wall between two areas makes straight-line distance lie about which corner is nearer.

Within an area, cell order is free (the operator never specified it) and is solved by nearest-neighbour over cell entry points plus 2-opt.

Disable with `~route_optimize:=false`.

---

## 5. Diagnostics

| Topic | Type | Carries |
|---|---|---|
| `/msd700/coverage_debug` | `std_msgs/String` (JSON) | per area: drawn area, area after clipping, coverable area, piece count, attainment, status |
| `/msd700/uncovered_regions` | `std_msgs/String` (JSON) | polygons left unswept, each with a reason code |
| `/msd700/skipped_waypoints` | `nav_msgs/Path` | skipped points; `position.z` carries the reason class |
| `/msd700/boustrophedon_path` | `nav_msgs/Path` | the planned sweep; `position.z = 1.0` starts a new stroke |

::: warning The orange overlay is the PLAN, not what was swept
`/msd700/boustrophedon_path` is published **before** the drive loop runs. Skipped waypoints still appear inside it as a continuous line. Never treat a tidy orange trace as evidence that an area was covered; read `/msd700/uncovered_regions` and the attainment figure instead.
:::

### Diagnosing a bad run, in order

1. **Did the area reach the planner?** Compare `raw_area` with `cover_area` in `coverage_debug`. A large drop means the clip stage, not the sweep.
2. **Was the plan any good?** Check `attainment`. Below 0.90 the plan itself did not cover, so the execution is not to blame.
3. **Did execution match the plan?** Compare the path against `uncovered_regions` and `skipped_waypoints`.

```bash
rostopic echo -n1 /msd700/coverage_plan        # what the operator sent
rostopic echo -n1 /msd700/coverage_debug       # what the robot thought it could cover
rostopic echo -n1 /msd700/uncovered_regions    # what it did not manage
rosnode info /path_coverage                    # the startup geometry block
```

### Offline replay

`msd700_navigation/test/coverage_harness.py` runs the real geometry code without ROS:

```bash
./coverage_harness.py --selftest              # synthetic cases plus regressions
./coverage_harness.py --plan dump.json        # replay a captured plan
./coverage_harness.py --plan dump.json --compare   # against the pre-overhaul numbers
```

---

## 6. Parameters

| Parameter | Default | Meaning |
|---|---|---|
| `~body_footprint` | `[0.9, 0.7]` | Physical body; sets the lane pitch |
| `~coverage_overlap` | `0.18` | Overlap between neighbouring lanes |
| `~safety_margin` | `0.0` | Extra clearance. Zero on purpose |
| `~boustrophedon_decomposition` | `true` | Split areas into obstacle-free cells |
| `~lane_order` | `adjacent` | `adjacent` (plain serpentine) or `skip` |
| `~turn_style` | `square` | `square` (right-angled comb) or `adaptive` (shortest manoeuvre) |
| `~headland` | `true` | Pull lanes back and close the strip with a perpendicular pass |
| `~min_gap_area` | `0.10` m² | Smallest leftover patch worth a pass |
| `~min_attainment` | `0.90` | Below this an area reports partial |
| `~route_optimize` | `true` | Choose entry and exit corners (never the order) |
| `~replan_blocked_fraction` | `0.15` | Blocked fraction that triggers a re-cut |
| `~replan_failure_streak` | `3` | Failures in one region that trigger a re-cut |
| `~replan_min_interval` | `10.0` s | Minimum time between re-cuts |
| `~dynamic_retry_at_end` | `true` | Retry regions a moving obstacle blocked |
| `~amcl_wait_timeout` | `15.0` s | Bound on waiting for `/amcl_pose` |
| `~decomposition_timeout` | `60.0` s | Bound on the Ruby decomposition |
| `~teb_coverage_profile` | `true` | Swap TEB into a reverse-friendly profile |

**Removed.** `~robot_width` and `~boundary_inflation` no longer exist. Both are still detected and produce a deprecation warning, because ignoring a stale launch file silently would reintroduce the double inset they used to cause. `~costmap_max_non_lethal`, `~goal_search_tolerance`, `~simplify_factor` and `~max_polygon_points` are gone from this node too.

---

## 7. Config layout

```
msd700_navigation/config/
├── costmap/
│   ├── costmap_common_params.yaml      # footprint (envelope) + inflation_radius 0.575
│   ├── costmap_common_params_sim.yaml
│   ├── global_costmap_params.yaml      # inflation_layer namespaced value: keep in step
│   └── local_costmap_params.yaml       # inflation stated explicitly, not inherited
├── planner/ ...
└── mapping/ ...
```

::: tip inflation_radius must be >= the inscribed radius
Below it, costmap_2d cannot mark the band where the footprint is already colliding, and every consumer of that costmap goes blind exactly where it matters most. All three places now say 0.575 m. The namespaced value in `global_costmap_params.yaml` **wins** over the common file, so the two drifting apart is invisible until something misbehaves.
:::

---

## 8. Thread preemption and lifecycle

Switching from playlist A to playlist B:

1. `_abort_active_coverage()` bumps the generation token, so superseded threads self-terminate deterministically rather than relying on a join timeout.
2. `internal_cancel_all_goals()` aborts active `move_base` goals.
3. The worker thread is joined with a 1.5 s timeout.
4. Latched overlays and the reachability field are reset.
5. Playlist B starts in a fresh worker thread.

Every blocking wait inside the worker is bounded and re-checks the token, so Cancel always reaches it. An unbounded `wait_for_message("/amcl_pose")` used to park the thread forever precisely when relocalisation was struggling.

**Respawn guard.** The node runs with `respawn="true"` and the plan topic is latched, so a crash mid-run used to come back, receive the same plan, and silently restart the sweep from area one. Each plan now carries an id recorded to `~plan_state_path`; a respawn that sees the same id reports it instead of replaying it.

---

## 9. Hybrid zero-spin alignment

Two tiers:

1. **Zero-spin solver.** Correlative Scan Matching of a stationary LiDAR scan against the static map over a local `(dx, dy, dyaw)` search grid. Confidence >= 65 % publishes straight to `/initialpose`: no translation, no rotation, under 50 ms.
2. **Linear micro-jog fallback.** In featureless or symmetric spaces where the score is low, a gentle 15 cm forward and backward jog rather than a 360 degree spin.

`clearing_rotation_allowed` stays `false`. Before L4 existed that removed the only recovery able to free the robot from a tight corner, which made it a gap; with L4 able to re-cut lanes around whatever it finds, disabling the spin is the right call.
