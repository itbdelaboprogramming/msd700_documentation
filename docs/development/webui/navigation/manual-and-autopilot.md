---
outline: deep
search: false
---

# Navigation: Manual & Autopilot

<RoleBadge role="developer" />

The `ManualAutopilotPanel` sidebar component from the Navigation page's perspective, the Robot
Activity State Machine's mapping from activity key to dashboard tab, and the frontend-engineering
mechanics behind session reconnection and recovery on this page. For the Mode List/Action Bar
pattern and canvas pipeline this panel sits alongside, see
[Overview](/development/webui/navigation/overview). For the point-and-go modes it interacts with,
see [Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes).

## Manual Override and Autopilot on the Navigation page

`ManualAutopilotPanel` lives in the sidebar and is the same component rendered on the Mapping
page, but the two toggles carry different practical weight here:

- **Manual Override** stops any running autonomous operation on this page (a dispatched pinpoint,
  a multi-point route, or a coverage sweep) and hands the `twist_mux` over to the keyboard, so WASD
  input drives the robot directly.
- **Autopilot** keeps a dispatched run alive without the browser tab needing to stay open, because
  the unit-side `operation_supervisor` takes over dispatching the run itself.

The same panel appears in the Mapping page's sidebar as well, where the two toggles govern the
active SLAM session rather than a navigation run; that page's own write-up covers what Manual
Override and Autopilot mean there.

## Activity state machine: routing to dashboard tabs

The robot's activity string, tracked by `RobotStateTracker` and reported on every heartbeat ping,
is what decides which dashboard tab an operator lands on, including on reconnection (see
[Session Reconnection and Recovery](#session-reconnection-and-recovery) below). The two toggles on
this page each drive the robot into a specific activity:

- Engaging **Manual Override** drives the robot's activity to `manual`, which routes to the **Idle**
  tab, not Navigation, regardless of whether Manual Override was engaged from this page's panel or
  from Mapping's.
- Engaging **Autopilot** during a dispatched run drives the robot's activity to
  `supervisor_navigating`, which routes to the **Navigation** tab.

The full activity table:

| Activity Key | Target UI Tab | Description |
| --- | --- | --- |
| `idle` | Idle | System initialized; motor controllers enabled but no active goal. |
| `manual` | Idle | Manual teleop active via WASD keyboard controls. |
| `mapping_active` | Mapping | Active SLAM mapping with `explore_lite` frontier exploration. |
| `mapping_paused` | Mapping | SLAM exploration temporarily paused by operator. |
| `mapping_stop_failed` | Mapping | Map saving failed; SLAM state remains active so operator can retry. |
| `navigation_ready` | Navigation | Map loaded, `move_base` operational, waiting for goal dispatch. |
| `navigation_point_published` | Navigation | Robot actively traversing towards a navigation goal. |
| `boustrophedon_initializing` | Navigation | Generating coverage sweep lines (exempt from idle/stuck timeouts). |
| `boustrophedon_ready` | Navigation | Executing boustrophedon coverage sweep lines. |
| `supervisor_navigating` | Navigation | Autonomous waypoint dispatch managed by `operation_supervisor`. |
| `arrived` | Navigation | Successfully reached destination waypoint or completed coverage area. |
| `coverage_failed` | Navigation | Coverage planning or path execution aborted. |
| `auto_aligning` | Navigation | Executing Auto Align particle filter orientation calibration. |
| `paused` | Navigation | Mission paused by explicit operator command. |
| `paused_due_to_ping_loss` | (Internal) | Safety watchdog paused robot motion due to dropped heartbeat pings. |
| `emergency_stopped` | Idle | Hardware emergency stop engaged (zero velocity clamped at priority 255). |
| `emergency_cleared` | Idle | Emergency stop released; motors ready for re-initialization. |

The full state transition diagram and the safety watchdog behavior behind `paused_due_to_ping_loss`
are covered in [State & Behavior](/development/state-and-behavior); this table is reproduced here
because it is exactly what decides, on a fresh login or reconnect, whether the operator is routed
back into Navigation at all.

## Session Reconnection and Recovery

This section is frontend-engineering-heavy by nature: it covers the React state and canvas
mechanics `mapComponent.tsx` runs through when an operator reopens a closed browser tab or logs in
from a new workstation, not just the high-level behavior.

![Map Canvas Pipeline](/images/MSD700-RecoverySequenceDiagram.jpg)

### Recovery principles

1. **Routing by `active_page`**: the frontend redirects the operator directly to the active
   operational tab (Navigation or Mapping) based on live robot telemetry, using the activity table
   above.
2. **Latched snapshot rebuild**: the entire mission state (active waypoints, current index, travel
   direction, and coverage polygons) is restored from the latched `/string/operation_snapshot` ROS
   topic.
3. **Ghost state validation**: if the browser cache indicates a mission in progress but the robot
   reports `idle` across 8 consecutive telemetry samples, the frontend automatically resets to
   `idle` to prevent phantom execution displays.

### What triggers a snapshot rebuild

The rebuild is not limited to a brand-new tab. It runs whenever the tab has no local session worth
keeping, which is any of:

- the login router set `nav_recovery_pending` (it routed the operator here to resume), or
- the page auto-resolved the operating map for a tab that had nothing cached, or
- `navStatus` is absent **or `Idle`** and no mode is selected.

That third condition reads "or Idle" for a reason. Re-opening a map from the Database page throws
the tab's whole navigation state away on purpose (`flushNavigationRecoveryState`), and the
Navigation page then seeds `navStatus` from its own initial `Idle` state a tick later. While the
condition required the key to be **absent**, the one entry point that deliberately discarded its
local state was also the only one that could not rebuild it: an operator who left the map and came
back mid-run found the coverage-area overlay gone, no pins, and no way to get them back short of a
new login. Neither the page nor the map component now writes its persisted status or mode on mount;
only the restore path seeds those keys.

A snapshot naming a **different** map than the one the tab has open is ignored rather than applied.
The rebuild re-selects the map the run belongs to, which is correct for a tab that arrived with no
map and wrong for an operator who just picked one by hand.

Because the latched value cannot be relied on to reach a brand-new MQTT subscriber, the dashboard
also prompts the supervisor to republish, at 0, 0.9, 3.4 and 9.4 s. The count is kept small since an
idle robot answers none of them, but the **reach** matters more than the count: this is a
browser to rosbridge to MQTT to unit round trip, and a schedule that gave up after a few seconds
abandoned live runs on exactly the weak links the rest of the bandwidth work exists to survive. The
subscription outlives the schedule, so a later snapshot is still applied.

### What the rebuild paints first

Order matters as much as content. The rebuild used to draw the coverage overlay only after it had
fetched the map list and waited (up to 8 s) for the live grid to scale the stage, so an operator
signing back into a running sweep watched a bare map for seconds before the areas appeared. The
overlay needs neither: it is drawn in metres straight into the scene, and the snapshot already
carries the plan. It now goes up first, and the stage-scale wait is skipped entirely for a coverage
run, which has no pins to size. Pin restoration still waits for it, because a marker added to an
unscaled stage renders at an invisible 0.01 scale.

The same rule applies when a run **starts**: the areas are painted as the plan is dispatched, not
when the robot acknowledges it. `POST /api/boustrophedon/init` answers only once `switch_mode` has
brought the coverage stack up on the robot, which is seconds of the operator watching a map with
nothing on it. A refused run clears the overlay again, and a refused single custom area redraws the
cyan drawer polygon so the operator still has an area to retry with.

## Related

- [Overview](/development/webui/navigation/overview): the Mode List/Action Bar pattern and canvas
  pipeline this panel and recovery logic sit alongside.
- [Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes): the point-and-go modes
  whose pins and routes are what the recovery flow above restores.
- [Map Sync & Alignment](/development/webui/navigation/map-sync-and-alignment)
- [Coverage Cleaning](/development/webui/navigation/coverage-cleaning)
- [ROS Integration](/development/webui/navigation/ros-integration)
- [Architecture](/development/architecture)
- [State & Behavior](/development/state-and-behavior): the full activity state transition diagram
  and the safety watchdog behavior behind `paused_due_to_ping_loss`.
