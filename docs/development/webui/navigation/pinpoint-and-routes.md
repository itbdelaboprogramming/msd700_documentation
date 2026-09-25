---
outline: deep
search: false
---

# Navigation: Pinpoint & Routes

<RoleBadge role="developer" />

The point-and-go modes on the Navigation page: Single Pinpoint, Multiple Pinpoint with its
Save/Load Route and Round Trip/Loop Route controls, Set Home Base, and Delete All Pinpoints. For
the canvas rendering pipeline and coordinate math these modes sit on top of, and for the
Mode List/Action Bar pattern they're selected through, see
[Overview](/development/webui/navigation/overview). For manual driving and the Autopilot handoff,
see [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot).

## Placing points on the canvas

Every mode on this page that drops a marker (a single pinpoint, a waypoint in a multi-point route,
or a new home base position) goes through the same click-to-metric conversion described in
[Overview § Coordinate transforms](/development/webui/navigation/overview#coordinate-transforms-metric-space-to-screen-pixels):
a click on the canvas is converted from pixel coordinates to ROS metric coordinates via
`stage.globalToRos`, patched onto `createjs.Stage.prototype` as described in
[Overview § The `createjs.Stage.prototype` patch](/development/webui/navigation/overview#the-createjs-stage-prototype-patch).

This is a lighter-weight use of the canvas's interactive drawing engine than the closed-loop
polygon drawing used for keep-out zones and coverage areas (rubberbanding a temporary edge to the
cursor, then snapping closed within 15 pixels of the starting vertex). Pinpoint placement is a
single-vertex operation: each click records one metric coordinate and drops one marker, with no
closing step required, because a pinpoint is a destination, not a boundary.

## Single Pinpoint

A one-off point-and-go mode: the operator clicks a destination on the canvas, the click is
converted to a metric goal, and the robot is dispatched to that single point.

## Multiple Pinpoint

The same click-to-place mechanism repeated to build an ordered sequence of waypoints, which the
robot then traverses in order.

### Save Route / Load Route

A Multiple Pinpoint sequence can be named and persisted through `SaveRouteModal.tsx`, and recalled
later through `LoadRouteModal.tsx`, which repopulates the canvas with the saved waypoint sequence.
Failures on either path surface through the `TopToast` component described in
[Overview § Supporting UI](/development/webui/navigation/overview#supporting-ui).

### Round Trip / Loop Route

`RouteControls.tsx` exposes two independent toggles, Round Trip and Loop Route, that change what
happens once a Multiple Pinpoint route reaches its last waypoint, alongside the Save/Load Route
controls above.

## Set Home Base

Places or updates the robot's home position by clicking the canvas, calling `updateHomebase` in the
database services layer. This is the same home base position surfaced on the Database page (the
`homebase_x`/`homebase_y` columns; see
[Database Overview § Map list](/development/webui/database/overview#map-list)), and the destination
used by the Action Bar's Return to Home Base action
(see [Overview § One page, many modes](/development/webui/navigation/overview#one-page-many-modes)).

## Delete All Pinpoints

A permanent entry in the Mode List rather than something tied to a specific mode: it clears every
placed pinpoint at once. It is greyed out when there is nothing to delete.

## Related

- [Overview](/development/webui/navigation/overview): the Mode List/Action Bar pattern, canvas
  pipeline, and coordinate transforms these modes build on.
- [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot): manual driving, the
  Autopilot handoff, and activity-to-tab routing.
- [Map Sync & Alignment](/development/webui/navigation/map-sync-and-alignment)
- [Coverage Cleaning](/development/webui/navigation/coverage-cleaning)
- [ROS Integration](/development/webui/navigation/ros-integration)
- [Architecture](/development/architecture)
- [State & Behavior](/development/state-and-behavior)
