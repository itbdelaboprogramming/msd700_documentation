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

**Contracts:** Play, Pause and Stop act on `move_base` goals over
[rosbridge](/development/message-contracts/rosbridge#move-base-action) and mirror the run with
[operation sync](/development/message-contracts/operation-sync); Return to Home Base is a `move_base` goal to the stored home base;
Focus View is client only. The per-button list is
[Message Contracts § Navigation page](/development/message-contracts/#trace-navigation).

Because the canvas itself never remounts when the operator switches modes, the rendering pipeline,
the coordinate conversion helpers, and the supporting UI described below are shared infrastructure
underneath every mode, not something each mode reimplements.

## Canvas rendering pipeline

`MapComponent` composes its view as a stack of EaselJS layers on a single HTML5 Canvas stage, fed
by rosbridge WebSocket topics:

![Map Canvas Pipeline](./diagrams/msd700-draw-map-pipeline.drawio)

**Contracts:** each layer is one rosbridge subscription, listed with its message type in
[rosbridge § Subscriptions](/development/message-contracts/rosbridge#subscriptions); the map itself is requested on mount through
[`string/map_request`](/development/message-contracts/bridge-topics#map-delivery).

Layer 6, the interactive vertex overlay, is what Single Pinpoint, Multiple Pinpoint, and Set Home
Base draw onto when the operator clicks the canvas; see
[Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes) for how that overlay is
driven. Layers 2 and 4 (the coverage area overlay, green for areas to cover and red for keep-out
zones, and the boustrophedon sweep lanes) belong to the modes the
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

## EaselJS 0.7.1 has no `numChildren` {#easeljs-numchildren}

The vendored EaselJS (`public/script/easeljs.js`) is 0.7.1. Its containers have
`getNumChildren()`, `getChildIndex()` and `setChildIndex()`, but no `numChildren` property, which
only arrived in 0.8. Reading it here returns `undefined` without an error, and 0.7.1's
`setChildIndex()` does not reject the `NaN` that `numChildren - 1` produces: it moves the child to
index 0, under the map bitmap.

That is what kept the coverage area overlay (layer 2) invisible after every start, until a later
map message happened to move the grid back to index 0. It also made the pin wait in the session
recovery run out its full timeout every time. Count children with `getNumChildren()`. The overlay's
placement now lives in `coverageOverlayLayer.ts` (`placeAboveGrid`), with a unit test built on a
copy of 0.7.1's `setChildIndex()`.

## Mouse and touch input {#map-input}

Every touch gesture on the canvas mirrors a mouse gesture and ends in the same code:

| Gesture | Mouse path | Touch path |
| --- | --- | --- |
| Zoom | Native `wheel` listener, `whenWheel` → `zoomBy` (`viewControls.ts`) | `usePinch` → `applyPinch` → `zoomBy` (`touchGestures.ts`) |
| Pan | Middle-button drag, `whenMouseDown/Move` → `PanView.pan` | Same `usePinch` frame: the finger midpoint's travel moves `stage.x/y` |
| Pin with heading | `stagemousedown/move/up` → Nav2D `mouseEventHandler` | Same, fed by EaselJS Touch |
| Custom-area point | `stagemousedown` with `button === 0` → `placeCustomVertex` | Tap from `createTapTracker` → `placeCustomVertex` |
| Delete pin or point | DOM `dblclick` → EaselJS `dblclick` on the object under the cursor | Double-tap → `dispatchStageDoubleClick` → same EaselJS `dblclick` |

`createjs.Touch.enable(stage)` in `Nav2D.js` turns each finger into its own
`stagemousedown/move/up`, with the `TouchEvent` as `nativeEvent`. That is why a one-finger pin drag
needs no extra code, and also why three guards exist:

- **Two fingers never place a pin.** Nav2D's `mouseEventHandler` sets `multiTouchActive` as soon as
  `nativeEvent.touches.length > 1`, drops the pin being dragged, and ignores input until the last
  finger lifts (`touches.length === 0`). The older "two presses in 1 s" delete counters on pin
  markers also skip presses that are part of a pinch.
- **Pinch is relative.** `usePinch` (`@use-gesture/react`, touch events, `pinchOnWheel: false` so it
  never doubles the wheel handler) keeps the previous frame in its memo. Each frame pans by the
  midpoint's movement, then zooms about the new midpoint by the spread ratio, so the map stays under
  both fingers and the zoom buttons or auto-fit can change the view between gestures without a jump.
  The viewport has `touch-action: none` so the browser does not zoom the page instead.
- **Taps are recognised by hand.** EaselJS Touch calls `preventDefault()` on `touchstart`, so the
  browser never synthesizes `click` or `dblclick` for a finger. `createTapTracker` reads raw touch
  events on the viewport (tap: under 350 ms and 10 px; double-tap: second tap within 300 ms and 30 px;
  any gesture that had two fingers is never a tap). A double-tap calls EaselJS 0.7.1's
  `_updatePointerPosition(-1, ...)` and `_handleDoubleClick`, so it hit-tests and fires exactly like a
  mouse double-click. These are private, but the library is vendored in `public/script`, so they cannot
  change under the dashboard.

Touch input reaches operators on touchscreen laptops and monitors, which keep the desktop layout,
and on phones and tablets, which get the touch layouts described in
[Phone & Tablet Layouts](/development/webui/touch-layouts).

## Supporting UI

A handful of components appear across modes rather than belonging to any single one:

- **`RobotStuckNotification`**: a warning shown on the page when the robot appears unable to make
  progress toward its current goal.
- **`HoverTooltip`**: contextual tooltips shown as the operator hovers elements on the canvas.
- **`TopToast`**: surfaces errors from save/load operations (for example, a failed route save or
  load) as a transient toast rather than a blocking dialog.
- **`PreviewMap`**: a thumbnail rendering of the map, distinct from the full interactive canvas.

## Related

- [Message Contracts § Navigation page](/development/message-contracts/#trace-navigation): every message the page sends and receives.
- [Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes): Single/Multiple Pinpoint,
  Save/Load Route, Round Trip/Loop Route, Set Home Base, Delete All Pinpoints.
- [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot): the shared
  `ManualAutopilotPanel`, activity-to-tab routing, and session reconnection/recovery.
- [Map Sync & Alignment](/development/webui/navigation/map-sync-and-alignment)
- [Coverage Cleaning](/development/webui/navigation/coverage-cleaning)
- [ROS Integration](/development/webui/navigation/ros-integration)
- [Architecture](/development/architecture)
- [State & Behavior](/development/state-and-behavior)
