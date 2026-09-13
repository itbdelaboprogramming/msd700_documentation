---
outline: deep
search: false
---

# Manual Override and Autonomous Exploration

<RoleBadge role="developer" />

Two ways of moving the robot while a map is being built, both available from the same
[Mapping](/development/webui/mapping/overview) screen once a session is `mapping_active`: letting the
robot explore on its own, or taking the sticks yourself. For the wire contract behind the mapping
session itself, see [ROS Integration](/development/webui/mapping/ros-integration).

## Autonomous exploration is the default

Pressing Play on `MappingActionBar` starts autonomous frontier exploration (`explore_lite`) by
default. The robot drives itself, pushing outward into unmapped space, without the operator steering
it. This is the ordinary way a map gets built: the operator presses Play and mostly watches, using
Pause/Stop and the emergency stop as needed.

## Manual Override

The sidebar renders `ManualAutopilotPanel`, the same shared component used on the Navigation screen.
Toggling **Manual Override** on the Mapping screen hands WASD keyboard teleop to the operator,
taking over driving from the autonomous exploration behavior described above. This is the same
component and toggle as Navigation's; only what it hands control *away from* differs (autonomous
exploration here, rather than a dispatched goal or coverage sweep on Navigation), so its mechanics
are not repeated on this page.

## What "Autopilot" means on this page

The same panel also exposes an **Autopilot** toggle. On Mapping specifically, enabling it keeps the
autonomous exploration session running headless: exploration continues even if the operator closes
the browser tab. This is a different practical meaning from Autopilot on the Navigation screen
(which governs autonomous waypoint/coverage dispatch there); the toggle and component are shared, but
each screen defines what "keep going without the browser" means for its own operation.

::: info Heartbeat exemption
The safety watchdog's 10-second motion pause on lost heartbeats is suspended while Autopilot is
active, so a mapping session can keep running through a dropped connection or a closed laptop lid.
See [Safety Watchdog](/development/ros/safety-watchdog) for the full timing tiers; that page is not
duplicated here.
:::

## Related

- [Overview](/development/webui/mapping/overview): Play/Pause/Stop, the live map view, and the
  save-on-stop flow
- [ROS Integration](/development/webui/mapping/ros-integration): the REST/MQTT wire contract behind
  a mapping session
- [Architecture](/development/architecture)
- [State & Behavior](/development/state-and-behavior): the robot activity state machine and safety
  watchdog timing
