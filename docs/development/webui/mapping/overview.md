---
outline: deep
search: false
---

# Mapping

<RoleBadge role="developer" />

The Mapping screen is where an operator drives a robot around a new space to build a SLAM map, then
saves it: `unit/mapping` in the dashboard (`pages/unit/mapping/index.tsx`), driven by
`MappingActionBar` (`src/components/mappingActionBar/mappingActionBar.tsx`). This page describes how
the screen behaves. For the two ways of actually moving the robot while a map is being built
(autonomous exploration and manual override), see
[Manual Override and Autonomous Exploration](/development/webui/mapping/manual-and-autonomous). For
the REST/MQTT wire contract and the robot-side save process underneath it, see
[ROS Integration](/development/webui/mapping/ros-integration).

## Before mapping starts: "Ready to Map"

Until the operator presses Play, the live map view is covered by `MappingOverlay`, a placeholder
telling the operator the screen is ready to begin a mapping session. There is nothing to render yet
because no SLAM node is running and no occupancy grid exists.

## Play, Pause, Stop

`MappingActionBar` exposes the three controls that drive a mapping session:

- **Play** starts the session. The default behavior once Play is pressed is autonomous frontier
  exploration (`explore_lite`) driving the robot on its own; see
  [Manual Override and Autonomous Exploration](/development/webui/mapping/manual-and-autonomous) for
  how that interacts with manual driving.
- **Pause** temporarily halts exploration without ending the session.
- **Stop** ends the session and moves into the save flow described below.

The robot reports its own activity string on every heartbeat (`mapping_active`, `mapping_paused`,
and, if a save fails, `mapping_stop_failed`, which keeps the SLAM session alive so the operator can
retry saving). The full state machine these keys belong to is out of scope for this page; see
[State & Behavior](/development/state-and-behavior) for the complete diagram and transition table.

## Live map view

While a session is active, the occupancy grid being built is rendered inline, reusing the same
canvas machinery as the Navigation screen: pan, zoom, rotate, and focus-follow on the robot's live
pose. No separate viewer or page is involved.

## Robot Stuck notification

`RobotStuckNotification` surfaces a banner when the robot appears to have stopped making progress
during mapping. The detection logic behind that banner is shared with Navigation and is not
re-documented here.

## Saving the map (Stop flow)

Pressing Stop does not save immediately. It opens `ConfirmSaving`
(`src/components/confirm-saving-mapping/confirmSaving.tsx`), a dialog where the operator names the
map before it is persisted. Once confirmed, a `MapSaving` progress overlay covers the screen while
the robot writes the map and uploads it (see
[ROS Integration § Starting and stopping a mapping session](/development/webui/mapping/ros-integration#starting-and-stopping-a-mapping-session)
for what happens on the wire during this window, including why the save does not complete inside a
single HTTP request/response).

::: info Homebase pose is captured automatically, not entered by hand
The map's homebase pose is captured automatically from the robot's first reported pose after mapping
starts. The operator is not asked to set it manually as part of the save dialog; it simply travels
along with the rest of the map's metadata once Stop is confirmed.
:::

## Emergency stop

`EmergencyButton` is available throughout the Mapping screen. Triggering it exits to
`/emergency-mode`, the same shared emergency flow used elsewhere in the dashboard.

## Shared chrome

The rest of the screen is chrome shared with other operational pages: `Header`, a sidebar carrying
page-switch links, the live camera feed, and the Manual Override / Autopilot panel (see
[Manual Override and Autonomous Exploration](/development/webui/mapping/manual-and-autonomous)),
plus `Footer`, `ControlInstruction`, and `TokenExpired`.

## Related

- [Manual Override and Autonomous Exploration](/development/webui/mapping/manual-and-autonomous):
  the two ways of driving the robot during a mapping session
- [ROS Integration](/development/webui/mapping/ros-integration): the REST/MQTT wire contract and the
  robot-side save process
- [Architecture](/development/architecture)
- [State & Behavior](/development/state-and-behavior): the robot activity state machine and session
  reconnection/recovery behavior (not duplicated on this page)
