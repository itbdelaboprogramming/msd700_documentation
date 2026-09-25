---
outline: deep
search: false
---

# Navigation

<RoleBadge role="developer" />

The Navigation feature is the `unit/navigation` page. `pages/unit/navigation/index.tsx` is a thin
layout shell; essentially all real functionality lives in
`src/components/navigationMap/mapComponent.tsx` (`MapComponent`) and the sub-components it renders,
reached through a "Mode List" dropdown (`ModeListPanel.tsx`) and a persistent action bar
(`actionBar.tsx`). This document covers the mechanics shared across every mode on this page: the
mode-switching pattern itself, the canvas rendering pipeline and coordinate math every mode draws
on top of, and the small supporting UI pieces that appear regardless of which mode is active.

The individual modes each have their own page:

| Mode / feature | Covered in |
| --- | --- |
| Single Pinpoint, Multiple Pinpoint, Save/Load Route, Round Trip/Loop Route, Set Home Base, Delete All Pinpoints | [Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes) |
| Manual teleop (WASD), Autopilot toggle, dashboard tab routing by robot activity, session reconnection/recovery | [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot) |
| Map Sync / Auto Align | [Map Sync & Alignment](/development/webui/navigation/map-sync-and-alignment) |
| Coverage Area (boustrophedon cleaning) | [Coverage Cleaning](/development/webui/navigation/coverage-cleaning) |
| ROS-side wire contracts underneath all of the above | [ROS Integration](/development/webui/navigation/ros-integration) |

## One page, many modes

This is worth stating explicitly because it is easy to assume otherwise: Navigation is **one
route** rendering **one long-lived component tree**, not a set of separate pages. Choosing Single
Pinpoint, Multiple Pinpoint, Set Home Base, Delete All Pinpoints, Map Sync/Auto Align, or Coverage
Area in `ModeListPanel.tsx` is a mode selection inside `MapComponent`'s own state, not a Next.js
route change or a fresh mount of the map canvas. The action bar (`actionBar.tsx`) sits alongside
the mode list and exposes actions available across modes rather than per mode: Play/Pause
navigation, Stop, Return to Home Base, and Focus View (the camera follows the robot on the canvas).

Because the canvas itself never remounts when the operator switches modes, the rendering pipeline,
the coordinate conversion helpers, and the supporting UI described below are shared infrastructure
underneath every mode, not something each mode reimplements.

## Canvas rendering pipeline

`MapComponent` composes its view as a stack of EaselJS layers on a single HTML5 Canvas stage, fed
by rosbridge WebSocket topics:

![Map Canvas Pipeline](./diagrams/msd700-draw-map-pipeline.drawio)

Layer 6, the interactive vertex overlay, is what Single Pinpoint, Multiple Pinpoint, and Set Home
Base draw onto when the operator clicks the canvas; see
[Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes) for how that overlay is
driven. Layers 2 and 4 (keep-out polygons and boustrophedon sweep lanes) belong to the modes the
sibling pages cover.

## Coordinate transforms: metric space to screen pixels

The ROS coordinate frame is metric (meters, with $(0, 0)$ at the map origin), while HTML5 Canvas
uses top-left origin pixel coordinates $(p_x, p_y)$. Every click on the canvas and every robot pose
drawn onto it crosses this boundary.

Given map resolution $r$ (meters per pixel), image height $H$ (pixels), and map origin
$\mathbf{o} = [x_0, y_0]^T$:

**Variable definitions:**

| Variable | Description |
| --- | --- |
| $(x, y)$ | Position in ROS metric coordinate frame (meters) |
| $(p_x, p_y)$ | Position in canvas pixel coordinate frame |
| $r$ | Map resolution (meters per pixel) |
| $H$ | Canvas image height in pixels |
| $(x_0, y_0)$ | Map origin in ROS coordinates (meters) |

**Metric to canvas pixel** (used to draw the robot, paths, and any latched state onto the map):

$$p_x = \frac{x - x_0}{r}$$

$$p_y = H - \frac{y - y_0}{r}$$

*(The $y$-axis is inverted because ROS $Y$ increases upward while Canvas $Y$ increases downward.)*

**Canvas pixel to metric** (used to convert an operator's click into a goal to dispatch):

$$x = x_0 + (p_x \cdot r)$$

$$y = y_0 + ((H - p_y) \cdot r)$$

## The `createjs.Stage.prototype` patch

Code in `mapComponent.tsx` that patches `createjs.Stage.prototype` before any canvas is
constructed looks odd out of context, so it's worth explaining why it exists. EaselJS can
re-evaluate `createjs.Stage` into a brand-new constructor whose prototype no longer has the
`ROS2D` coordinate helpers (`globalToRos`, `rosToGlobal`, `rosQuaternionToGlobalTheta`). A viewer
built afterwards then throws a fatal `TypeError: this.stage.globalToRos is not a function` the
moment the operator tries to click the canvas.

To guarantee the canvas never crashes this way, `ensureStagePrototype()` in `mapComponent.tsx`
re-applies the helpers idempotently on the current prototype right before every viewer creation.
The math mirrors `public/script/ros2d.js` exactly, so behaviour is unchanged on the happy path
(`rosScriptLoader.ts` is only the sequential script loader: the patch does not live there).
See [Frontend Canvas](/development/frontend-canvas) for the full snippet.

Every mode's click handling on this page (pinpoint placement, home base placement, polygon
drawing) ultimately calls through `stage.globalToRos`, so this patch is a prerequisite for all of
them rather than a detail specific to any one mode.

## Supporting UI

A handful of components appear across modes rather than belonging to any single one:

- **`RobotStuckNotification`**: a warning shown on the page when the robot appears unable to make
  progress toward its current goal.
- **`HoverTooltip`**: contextual tooltips shown as the operator hovers elements on the canvas.
- **`TopToast`**: surfaces errors from save/load operations (for example, a failed route save or
  load) as a transient toast rather than a blocking dialog.
- **`PreviewMap`**: a thumbnail rendering of the map, distinct from the full interactive canvas.

## Related

- [Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes): Single/Multiple Pinpoint,
  Save/Load Route, Round Trip/Loop Route, Set Home Base, Delete All Pinpoints.
- [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot): the shared
  `ManualAutopilotPanel`, activity-to-tab routing, and session reconnection/recovery.
- [Map Sync & Alignment](/development/webui/navigation/map-sync-and-alignment)
- [Coverage Cleaning](/development/webui/navigation/coverage-cleaning)
- [ROS Integration](/development/webui/navigation/ros-integration)
- [Architecture](/development/architecture)
- [State & Behavior](/development/state-and-behavior)
