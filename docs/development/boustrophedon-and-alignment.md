---
title: Boustrophedon Coverage & Zero-Spin Alignment Architecture
---

# Boustrophedon Coverage & Zero-Spin Alignment Architecture

<RoleBadge role="developer" />

This document describes the architecture and behavior of the Boustrophedon coverage planner, thread preemption model, obstacle avoidance synchronization, configuration organization, and hybrid zero-spin alignment.

---

## 1. Overview

The MSD700 coverage planning system provides automated sweeping for defined polygon areas and multi-area operation playlists.

Key capabilities introduced in `v2-bostro`:
1. **Thread Preemption & Playlist Flushing**: Atomic thread cancellation and queue flushing when switching playlists.
2. **Direct Costmap Obstacle Probing**: High-rate raycast collision checking along sweeping lines, eliminating planner freeze.
3. **MultiPolygon & Concave Polygon Support**: Robust slice generation in `trapezoidal_coverage.py` handling complex L-shaped geometries without dropping coverage bands.
4. **Unified Configuration Hierarchy**: All navigation and costmap configurations consolidated into `msd700_navigation/config/`.
5. **Hybrid Zero-Spin Scan-to-Map Alignment**: Correlative Scan Matching (CSM) directly against the static map for instantaneous alignment without spinning 360 degrees.

---

## 2. Parameter & Config Organization

All navigation, planner, costmap, and SLAM configurations are stored in `msd700_navigation/config/`:

```
msd700_navigation/config/
├── costmap/
│   ├── costmap_common_params.yaml
│   ├── costmap_common_params_sim.yaml
│   ├── global_costmap_params.yaml
│   └── local_costmap_params.yaml
├── planner/
│   ├── move_base_params.yaml
│   ├── teb_local_planner_params.yaml
│   ├── teb_local_planner_params_sim.yaml
│   ├── navfn_ros_params.yaml
│   └── carrot_planner_params.yaml
└── mapping/
    └── gmapping_params.yaml
```

Shared parameters (such as physical robot footprint `[[-0.6, -0.425], [0.6, -0.425], [0.6, 0.425], [-0.6, 0.425]]`) are synchronized across both local planners and costmap layers.

---

## 3. Thread Preemption & Lifecycle Management

When switching from Playlist A to Playlist B:
1. `_abort_active_coverage()` sets `cancelled = True`, `_sweep_aborted = True`.
2. `internal_cancel_all_goals()` aborts all active `move_base` action goals.
3. Worker thread is joined with a 1.5s timeout.
4. Latched topics `/msd700/coverage_plan` and `/msd700/coverage_polygon` are flushed.
5. Playlist B starts cleanly in a fresh worker thread.

---

## 4. Hybrid Zero-Spin Alignment

Alignment utilizes a two-tier strategy:

1. **Tier 1 (Zero-Spin Solver)**:
   - Captures stationary 2D LiDAR scan and static map.
   - Evaluates Correlative Scan Matching over local search grid `(dx, dy, dyaw)`.
   - If confidence score >= 65%, publishes optimal pose to `/initialpose` immediately (0 cm translation, 0 deg rotation, elapsed < 50ms).
2. **Tier 2 (Linear Micro-Jog Fallback)**:
   - If in featureless symmetric areas where score < 65%, executes gentle linear micro-jog (forward 15 cm, then backward 15 cm) without spinning 360 degrees.
