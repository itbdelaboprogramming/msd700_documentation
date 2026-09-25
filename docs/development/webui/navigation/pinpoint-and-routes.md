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

**Contracts:** placing the pin sends nothing. Play sends a
[`move_base` goal over rosbridge](/development/message-contracts/rosbridge#move-base-action) (carried to the robot as
[`string/move_base/goal`](/development/message-contracts/bridge-topics#json-goal)) and records the run with an
[`operation_sync` `batch`](/development/message-contracts/operation-sync#batch) (`single_pinpoint`). Completion comes back on
`server/move_base/status` and `/result`, each result ACKed on
[`result_ack`](/development/message-contracts/bridge-topics#acks). Pause and Stop cancel the goal
([`cancel`](/development/message-contracts/bridge-topics#json-cancel)) and send
[`pause`](/development/message-contracts/operation-sync#pause) or [`stop`](/development/message-contracts/operation-sync#stop-complete).

## Multiple Pinpoint

The same click-to-place mechanism repeated to build an ordered sequence of waypoints, which the
robot then traverses in order.

**Contracts:** the browser sends one [`move_base` goal](/development/message-contracts/rosbridge#move-base-action) per
waypoint and advances on completion. The run is recorded with a
[`batch`](/development/message-contracts/operation-sync#batch) (`multi_pinpoint`, with `route_mode` and all `waypoints`), each
dispatched waypoint is mirrored with [`progress`](/development/message-contracts/operation-sync#progress), and the end of the
route with [`complete`](/development/message-contracts/operation-sync#stop-complete). With Autopilot on, the robot's supervisor
dispatches instead ([`takeover`](/development/message-contracts/operation-sync#takeover)).

### Save Route / Load Route

A Multiple Pinpoint sequence can be named and persisted through `SaveRouteModal.tsx`, and recalled
later through `LoadRouteModal.tsx`, which repopulates the canvas with the saved waypoint sequence.
Failures on either path surface through the `TopToast` component described in
[Overview § Supporting UI](/development/webui/navigation/overview#supporting-ui).

**Contracts:** Save Route is [`POST /api/routes`](/development/message-contracts/http-api#routes) with the pinpoints as
`route_points` (one ROS pose each), then the canvas thumbnail to
[`POST /api/media/uploadRouteImage`](/development/message-contracts/http-api#media-server). Load Route is
[`GET /api/routes/:map_id`](/development/message-contracts/http-api#routes) plus `GET /api/media/images/<route id>.jpg` for the
thumbnails; rename and delete are `PUT` and `DELETE /api/routes/:id`. None of these reach the robot.

### Round Trip / Loop Route

`RouteControls.tsx` exposes two independent toggles, Round Trip and Loop Route, that change what
happens once a Multiple Pinpoint route reaches its last waypoint, alongside the Save/Load Route
controls above.

**Contracts:** the mode is not sent to the robot on its own and is not stored with a saved route. It
travels as `route_mode` (`basic`, `round-trip`, `loop`) plus the travel `direction` in the
[`operation_sync` `batch`](/development/message-contracts/operation-sync#batch), so the supervisor can continue the pattern if
it takes over.

## Set Home Base

Places or updates the robot's home position by clicking the canvas, calling `updateHomebase` in the
database services layer. This is the same home base position surfaced on the Database page (the
`homebase_x`/`homebase_y` columns; see
[Database Overview § Map list](/development/webui/database/overview#map-list)), and the destination
used by the Action Bar's Return to Home Base action
(see [Overview § One page, many modes](/development/webui/navigation/overview#one-page-many-modes)).

**Contracts:** [`PUT /api/maps_data/homebase/:mapId`](/development/message-contracts/http-api#map-homebase) with
`{ x, y, z, ox, oy, oz, ow }`, then a drive to it as a
[`move_base` goal](/development/message-contracts/rosbridge#move-base-action) recorded with a
[`batch`](/development/message-contracts/operation-sync#batch) of operation `homebase`. On a freshly saved map the home base
instead travels inside [`mapping.stop`](/development/message-contracts/mqtt-commands#mapping), and `navigation.init` hands it
to the robot's `/initialpose` ([MQTT `navigation`](/development/message-contracts/mqtt-commands#navigation)).

## Delete All Pinpoints

A permanent entry in the Mode List rather than something tied to a specific mode: it clears every
placed pinpoint at once. It is greyed out when there is nothing to delete.

**Contracts:** client only; nothing is sent to the robot or the backend.

## Related

- [Overview](/development/webui/navigation/overview): the Mode List/Action Bar pattern, canvas
  pipeline, and coordinate transforms these modes build on.
- [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot): manual driving, the
  Autopilot handoff, and activity-to-tab routing.
- [Map Sync & Alignment](/development/webui/navigation/map-sync-and-alignment)
- [Coverage Cleaning](/development/webui/navigation/coverage-cleaning)
- [ROS Integration](/development/webui/navigation/ros-integration)
- [Message Contracts § Navigation page](/development/message-contracts/#trace-navigation): every message these modes send, in one table.
- [Architecture](/development/architecture)
- [State & Behavior](/development/state-and-behavior)
