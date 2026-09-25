---
outline: deep
search: false
---

# Boustrophedon Coverage & Zero-Spin Alignment Architecture

<RoleBadge role="developer" />

This document provides a comprehensive algorithmic specification of the Boustrophedon Cellular Decomposition coverage planning pipeline, dual-geometry clearance calculations, five-layer obstacle management, and Correlative Scan Matcher (CSM) zero-spin alignment.

## Dual Robot Geometries

A foundational design principle in MSD700 coverage planning is that **the robot has two distinct geometric dimensions used for different calculations**:

![Dual Robot Geometries](./diagrams/boustrophedon-and-alignment-dual-robot-geometries.drawio)

| Geometric Definition | Size Dimensions | Algorithmic Usage |
| --- | --- | --- |
| **Physical Body** (`~body_footprint`) | 0.90 m length x 0.70 m width | Determines lane pitch and swept-area attainment calculations. |
| **Costmap Safety Envelope** | 1.20 m length x 0.85 m width | Enforces TEB local planner clearances and turning feasibility. |

The envelope and body live in `costmap_common_params_field.yaml` and `msd700_coverage/config/robot/field.yaml`. `path_coverage_node` reads the footprint polygon from `/move_base/global_costmap/footprint` and derives inscribed/circumscribed radii from it (`coverage_geometry.py`); lane pitch always comes from the physical body, never the padded envelope.

### Derived Clearance Constants (`src/msd700_coverage/coverage_geometry.py`)

With TEB up (`min_obstacle_dist 0.05`, `safety_margin 0.0`):

| Clearance Constant | Value | Mathematical Formula |
| --- | --- | --- |
| `wall_clearance` | **0.400 m** | $r_{\text{inscribed}} (0.350\text{ m}) + d_{\min} (0.05\text{ m})$ |
| `turn_clearance` | **0.620 m** | $r_{\text{circumscribed}} (0.570\text{ m}) + d_{\min} (0.05\text{ m})$ |
| `pitch` | **0.644 m** | $w_{\text{body}} (0.70\text{ m}) \times (1 - \text{overlap} (0.08))$ |

Without TEB (fallback `min_obstacle_dist 0.15`): `wall_clearance 0.500 m`, `turn_clearance 0.720 m`.

`lane_edge_clearance` (the minimum distance from a cell boundary to a lane centre) is pinned to **0.35 m** in `config/boustrophedon_params.yaml` rather than left on `auto` (= `wall_clearance`); `lane_end_clearance` stays `auto` (= `turn_clearance`).

### Physical Geometric Limits (TEB up):
- **Narrowest corridor robot can enter**: **0.80 m** ($2 \times \text{wall\_clearance}$).
- **Narrowest corridor robot can pivot 180 degrees**: **1.24 m** ($2 \times \text{turn\_clearance}$).
- **Unreachable boundary strip along walls**: **0.05 m** ($\text{wall\_clearance} - \frac{w_{\text{body}}}{2}$).

::: info Attainment vs Raw Coverage
Because the 0.05 m perimeter strip cannot be traversed without collision, a rectangular room (e.g. 3 x 6 m) reaches a theoretical maximum coverage of about **95%**. System performance is measured by **Attainment Ratio** (fraction of reachable floor actually swept), rather than unadjusted raw area percentage.
:::

---

## Boustrophedon Cellular Decomposition Algorithm

The coverage planner decomposes arbitrary concave polygonal boundaries with internal obstacles into convex, obstacle-free sub-cells:

![Boustrophedon Cellular Decomposition Algorithm](./diagrams/boustrophedon-and-alignment-boustrophedon-cellular-decomposition-alg.drawio)

### Critical Point Classification:
During vertical sweep line progression along the $x$-axis, boundary vertices are classified based on the local connectivity of the free space:
1. **IN Critical Point**: A new cell opens as free space expands.
2. **OUT Critical Point**: A cell terminates as boundaries converge.
3. **SPLIT Critical Point**: An internal obstacle divides an active cell into two distinct parallel sub-cells.
4. **MERGE Critical Point**: Two parallel sub-cells rejoin past the trailing edge of an obstacle.

---

## Five-Layer Obstacle Management

![Five-Layer Obstacle Management](./diagrams/boustrophedon-and-alignment-five-layer-obstacle-management.drawio)

---

## Zero-Spin Orientation Alignment (Particle Align Validator)

When the robot is placed in an unknown pose on a pre-recorded map, traditional AMCL requires a 360-degree in-place rotation to collapse particle dispersion.

MSD700 implements a **coarse-to-fine particle search** (`particle_align_validator.py`) to calculate orientation and position instantly without motion. The dashboard triggers it over the `/align/solve_pose` service (Map Sync's Auto Align button, via `align_checker`):

![Zero-Spin Orientation Alignment (Particle Align Validator)](./diagrams/boustrophedon-and-alignment-zero-spin-orientation-alignment-particle.drawio)

### Mathematical Formulation:
Given $N$ laser scan points $\mathbf{p}_i = [x_i, y_i]^T$ and a static occupancy grid map $M(x, y)$, the scan matcher finds the rigid transform $(\Delta x, \Delta y, \Delta \theta)$ that maximizes the correlation score:

$$S(\Delta x, \Delta y, \Delta \theta) = \sum_{i=1}^N M\left( \mathbf{R}(\Delta \theta) \mathbf{p}_i + \begin{bmatrix} \Delta x \\ \Delta y \end{bmatrix} \right)$$

Where $\mathbf{R}(\Delta \theta)$ is the 2D rotation matrix:
$$\mathbf{R}(\Delta \theta) = \begin{bmatrix} \cos(\Delta \theta) & -\sin(\Delta \theta) \\ \sin(\Delta \theta) & \cos(\Delta \theta) \end{bmatrix}$$

When the match score confidence exceeds $65\%$, the estimated pose is published to `/initialpose`, localizing the robot in less than $50\text{ ms}$ with zero rotational motion.

---

## In-Place Rotation: Guard Removed, Sources Fixed

Zero-spin alignment removed the *reason* to rotate. There used to be a `rotation_guard` node between `twist_mux` and the base zeroing autonomous in-place turns; **it is deleted** (`twist_mux.launch` documents the removal). Each spin it existed to catch is now stopped at its own source, and the guard was measured not to be the cause of turn failures.

### What was turned off at the source

| Source | Was | Now |
| --- | --- | --- |
| `rotate_recovery` | Last rung of move_base's recovery ladder | Not loaded. `recovery_behaviors` lists only the two costmap resets, neither of which commands motion |
| TEB terminal pivot | Turned to face the goal heading at every waypoint | Tight. `yaw_goal_tolerance: 0.15` (coverage run: `0.10`): waypoints now carry a real heading from click-drag, so the pivot lands on an operator-chosen orientation |
| TEB initial pivot | Turned on the spot when the path led off behind the robot | Pivots rather than reversing: `allow_init_with_backwards_motion: false`, because the VLP-16 sees nothing within 0.40 m behind the robot |
| `SYNC` command (`nav_controller`) | 10 s of open-loop `0.5 rad/s`, no obstacle check | No-op. Use Auto Align, which scan-matches first |

Motion arbitration lives in `twist_mux` alone now: navigation on `/mux/nav_vel` (priority 10), keyboard on its own input (priority 90), emergency stop flooding `/mux/emergency_vel` (priority 255). A node that writes `/cmd_vel` directly bypasses the ladder and cannot be stopped by it.

## Related Documentation

- [Simulation](/development/ros/simulation): Warehouse testing environment and scale models.
- [Message Contracts](/development/message-contracts): Coverage command envelopes and ACK protocols.
- [State and Behavior](/development/state-and-behavior): Navigation and coverage finite state machines.
