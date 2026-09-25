---
outline: deep
search: false
---

# Coverage Cleaning

<RoleBadge role="developer" />

Coverage Area is the Mode List entry that turns Navigation from "drive to a point" into "clean a
region": the operator defines one or more polygons and the robot sweeps them autonomously in a
boustrophedon (back-and-forth, "ox-plowing") pattern. This page covers the feature from the
operator's side: the sub-menu, what each entry does, and what it saves, not the sweep algorithm
itself. For that, see
[Boustrophedon Coverage & Zero-Spin Alignment Architecture](/development/ros/boustrophedon-and-alignment),
which is the source of truth for the geometry model, cellular decomposition, and obstacle handling
this page deliberately does not re-explain. For the wire contract behind every action on this page,
see [ROS Integration](/development/webui/navigation/ros-integration).

::: info Scope
This page is "what the operator does and sees." The lane pitch, clearance constants, cellular
decomposition into sweepable cells, and the five-layer obstacle-avoidance stack are documented in
[Boustrophedon Coverage & Zero-Spin Alignment Architecture](/development/ros/boustrophedon-and-alignment)
and linked from here rather than repeated.
:::

## Entering Coverage Area mode

Selecting `Coverage Area` in the Mode List (which relabels to `Finish Coverage Area` while active,
`NAV_MODE.COVERAGE` / `NAV_MODE.COVERAGE_ACTIVATE` in `ModeListPanel.tsx`) opens a sub-menu of
coverage-specific controls in place of the pinpoint/route entries. Coverage does not use
point-based pins, so any single/multi pinpoint marker left over from an unfinished session is
cleared on entry. An instruction popup is shown every time the operator enters this mode, unlike
Map Sync's instruction, which is shown only once per session, because a mis-drawn or misunderstood
coverage area is more consequential to redo than a mis-set pose.

## Auto Coverage

Auto Coverage sweeps the whole loaded map with no operator-drawn boundary: the robot's own boundary
detection decides what is reachable floor. Starting it (`src/components/navigationMap/coverageApi.ts`,
`POST /api/boustrophedon/init` with `use_autocover: true`) clears any leftover pinpoints, wipes the
previous run's [robot-trace overlay](#show-hide-trace) so the new run draws a clean line, and
revives the [coverage-path overlay](#the-coverage-path-overlay) subscription if a prior Cancel had
torn it down. Because there is no bounded polygon to mark, the drawn-area overlay itself is cleared
rather than populated: the sweep boundary is discovered by the robot, not drawn by the operator.

## Custom Range Coverage

Custom Range Coverage is the operator-drawn counterpart: the operator outlines a boundary on the
map by hand (`src/components/navigationMap/customAreaDraw.ts`) instead of relying on
auto-detection, then starts a sweep of exactly that polygon
(`POST /api/boustrophedon/init` with `use_autocover: false` and the drawn `polygon`).

Two drawing algorithms exist, selected at build time via
`NEXT_PUBLIC_CUSTOM_AREA_DRAW_MODE` (`manual` is the default):

- **`manual`**: the operator clicks the boundary vertex by vertex, in order, and edges follow the
  click order exactly. This is the only mode that can represent a concave outline (an L-shaped
  room, an area that wraps a pillar), because nothing auto-completes the shape. A click that would
  cross an already-drawn edge is refused outright, since a self-intersecting boundary has no
  well-defined inside and would be rejected or mangled robot-side. A click landing back on the
  first vertex (within a configurable snap tolerance) closes the loop.
- **`hull` (legacy)**: every click is a loose hint point, and the polygon is continuously
  auto-completed as the convex hull of all points placed so far. The loop is always closed, but a
  concave area can never be drawn precisely: the hull swallows any inward notch.

### Close Loop and Clear Area

While drawing, the same button slot does double duty depending on drawing mode and progress:

- **Close Loop**: in `manual` mode, the explicit control that finishes the boundary early,
  equivalent to clicking back onto the first vertex. In `hull` mode the outline is already
  auto-completed as points are added, so "finishing" is just a phase change from drawing to ready,
  gated on at least 3 points having been placed.
- **Clear Area**: once a boundary is complete (`ready`), the button relabels to `Clear Area`.
  Clicking it wipes every drawn vertex and the overlay, but returns to the drawing phase rather than
  exiting Custom Range mode, so the operator can immediately redraw without re-entering the sub-menu.

Starting the sweep clears any leftover pinpoints, wipes the previous run's robot-trace overlay, and
swaps the cyan "drawing" polygon marker for the green sweep overlay immediately rather than waiting
for the backend's acknowledgment, because the robot's mode switch on `/api/boustrophedon/init` takes
long enough that waiting for the response before updating the canvas would leave the map looking
idle for several seconds. If the start is refused, the polygon is restored to the drawer so the
operator can retry rather than having to redraw it.

## Save Area

Save Area (`src/components/save-area/SaveAreaModal.tsx`) persists a drawn boundary into a reusable
library instead of consuming it immediately: the operator names it and marks it as a **Cover**
area (something to sweep) or a **Not-to-Cover** area (a keep-out zone), and it is written via
`POST /api/areas` (`src/components/area-playlist/areaApi.ts`). Saved areas are listed, renamed, and
deleted through the same `areaApi.ts` module (`fetchAreas`, `renameArea`, `deleteArea`) and are
scoped to the map they were drawn on (`map_id`), matching the Database feature's per-map, per-unit
scoping described in
[Database § ROS Integration](/development/webui/database/ros-integration). Areas saved here are
what the Operation Playlist below draws from.

## Operation Playlist

Operation Playlist (`src/components/area-playlist/AreaPlaylistModal.tsx`) builds and runs an
**ordered sequence** of saved areas in one dispatch, mixing cover and keep-out entries. Each entry
in the playlist snapshots the source area's polygon at the time it was added
(`PlaylistItem.polygon_points`), so a playlist keeps running correctly even if the original saved
area is later renamed or deleted. Playlists are persisted with `POST /api/playlists` and listed
with `GET /api/playlists/:mapId` (`areaApi.ts`).

Running a playlist splits its items by type before dispatch: every `cover` entry's polygon becomes
one of the `areas` in the coverage-init call, and every `no_cover` entry becomes one of the
`exclusions`, the same `areas`/`exclusions` shape documented in
[ROS Integration § MQTT commands: Boustrophedon subsystem](/development/webui/navigation/ros-integration#mqtt-commands-boustrophedon-subsystem).
At least one cover area is required; a playlist made only of keep-out zones is rejected client-side
before it reaches the robot. Once dispatched, a playlist run is routed through the same
custom-coverage (`use_autocover: false`) path as Custom Range Coverage for its subsequent
pause/deactivate calls, since from the robot's point of view it is one bounded multi-polygon sweep,
not a sequence of separate ones.

## Show/Hide Trace

Show/Hide Trace toggles a visual overlay of the robot's traveled path during a coverage run: a red
polyline (`src/components/navigationMap/robotTrace.ts`) drawn on the canvas by subscribing to the
robot's live pose topic and appending each new pose to a trace shape, independent of the
[coverage-path overlay](#the-coverage-path-overlay) described below. It answers a different
question than that overlay: the trace shows where the robot has actually been, not what the
planner intends to sweep. The trace is reset (cleared and restarted) at the beginning of every
fresh coverage run (Auto, Custom Range, or Playlist), but deliberately preserved across a
pause/resume, so a paused-and-resumed run keeps showing its progress rather than restarting the
line.

## The coverage-path overlay

Separately from the trace, an orange overlay renders the boustrophedon planner's own intended sweep
path (`nav_msgs/Path` on `/server/boustrophedon_path`, described in
[ROS Integration § Streaming Telemetry](/development/webui/navigation/ros-integration#streaming-telemetry)).
This overlay's subscription is torn down on Cancel/Finish and revived at the start of the next run
(Auto Coverage, Custom Range Coverage, and Playlist all call the same "initialize if needed, then
show" sequence), and it is deliberately hidden rather than destroyed at the end of a run so the
completed sweep line stays visible until a new one begins.

## Related

- [Overview](/development/webui/navigation/overview): the Navigation page and its full Mode List.
- [Map Sync & Auto Align](/development/webui/navigation/map-sync-and-alignment): the other
  stationary-start, autonomous-run feature on this page.
- [Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes): single/multi pinpoint
  driving and saved routes.
- [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot): teleop and the
  autopilot sequencer.
- [ROS Integration](/development/webui/navigation/ros-integration): the full Navigation wire
  contract, including the boustrophedon command envelopes referenced above.
- [Boustrophedon Coverage & Zero-Spin Alignment Architecture](/development/ros/boustrophedon-and-alignment):
  the sweep algorithm itself: geometry model, cellular decomposition, obstacle management.
- [Message Contracts](/development/message-contracts): the full MQTT command/feedback reference.
- [API Reference](/development/api-reference): the full REST API reference.
- [WebSocket and rosbridge Protocol](/development/rosbridge-protocol): the full rosbridge wire
  protocol.
