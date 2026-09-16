---
outline: deep
search: false
---

# Navigation: ROS Integration

<RoleBadge role="developer" />

The wire contract behind the entire Navigation page: every MQTT command envelope, REST endpoint,
and rosbridge subscription that the Mode List's features (Map Sync, Coverage Area, pinpoint
driving, manual/autopilot) actually use. This page pulls only the Navigation-relevant subset out of
three larger, shared reference documents:
[Message Contracts](/development/message-contracts), [API Reference](/development/api-reference),
and [WebSocket and rosbridge Protocol](/development/rosbridge-protocol), and organizes it by
concern. Those three documents remain the exhaustive, authoritative reference for anything not
Navigation-specific; this page links back to them rather than duplicating their content wholesale.

For the feature-level behavior these wire calls implement, see
[Overview](/development/webui/navigation/overview),
[Map Sync & Auto Align](/development/webui/navigation/map-sync-and-alignment),
[Coverage Cleaning](/development/webui/navigation/coverage-cleaning),
[Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes), and
[Manual & Autopilot](/development/webui/navigation/manual-and-autopilot).

::: info Scope
This page covers the Navigation and Boustrophedon MQTT subsystems, the heartbeat/lease contract,
operation supervisor sync, the telemetry topics the Navigation canvas renders, the Navigation and
Auto Align REST endpoints, and the rosbridge subscriptions feeding the live canvas. It does not
cover Mapping (SLAM), hardware/enrolment, or WebRTC signalling: those belong to other feature
areas and are covered in full in the shared reference documents linked above.
:::

## MQTT commands: Navigation subsystem

Full envelope shape, retry/timeout parameters, and the `hardware`/`mapping` subsystems are in
[Message Contracts § Command Reference Catalogue](/development/message-contracts#command-reference-catalogue).
The Navigation-relevant commands (`header: "navigation"`) are:

| Command | Payload | Purpose |
| --- | --- | --- |
| `init` | `config.resource`: `map_name` (map ULID), `default_save_path`, `homebase_x/y/z`, `homebase_ox/oy/oz/ow`. Top-level `ensure_unpaused: true`. | Launches the navigation stack with a specific map. `ensure_unpaused` clears any standing `/emergency_pause` lock so navigation doesn't come up paused. |
| `pointstamped` | `config.resource`: `X`, `Y`, `Z`. | Dispatches a single waypoint goal to `move_base`. |
| `deactivate` | none | Terminates the active navigation stack. |

`map_name` in the command payload and `map_id` in the REST body below refer to the same map ULID:
the field is renamed at the HTTP boundary but not on the wire to the robot.

## MQTT commands: Boustrophedon subsystem

`header: "boustrophedon"` commands drive [Coverage Cleaning](/development/webui/navigation/coverage-cleaning):

| Command | Payload | Purpose |
| --- | --- | --- |
| `init` | `config`: `use_autocover` (bool), `polygon` (single custom-range boundary), `areas` (ordered array of polygons: Auto Coverage's whole-map case, Custom Range's one polygon, or a Playlist's cover entries), `exclusions` (keep-out polygons, a Playlist's `no_cover` entries), `ensure_unpaused: true`. | Starts a sweep. Which of `polygon`/`areas`/`exclusions` are populated depends on which Coverage Cleaning entry point dispatched it (Auto Coverage sends none, Custom Range sends `polygon`, Playlist sends both `areas` and `exclusions`). |
| `pause` | `{ "pause": true }` or `{ "pause": false }` | Pauses or resumes an in-progress sweep without discarding the plan. |
| `deactivate` | none | Stops coverage planning entirely. |

The algorithm that turns these polygons into an actual sweep path (cellular decomposition, lane
pitch, obstacle handling) is documented in
[Boustrophedon Coverage & Zero-Spin Alignment Architecture](/development/ros/boustrophedon-and-alignment)
and is out of scope here.

## Heartbeat/lease

Every Navigation page load and mode switch rides on the same heartbeat contract documented in full
in
[Message Contracts § Heartbeat Ping and Lease Contract](/development/message-contracts#heartbeat-ping-and-lease-contract).
The fields most relevant to this page:

- **Request**: `page: "navigation"` and `claim: true` are what an operational Navigation session
  sends on every ping, as opposed to the read-only fleet list (`claim: false`).
- **Response**: `robot_activity` (e.g. `navigating`, `stuck`) and `active_page` drive routing and
  the stuck-detector; `manual_override` and `autopilot` reflect the two modes covered in
  [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot); `in_use` and
  `origin_conflict` gate whether this tab is even allowed to issue the commands above.

The REST-facing shape of the same ping is `POST /api/units/ping`, documented in
[API Reference § Robot Heartbeat Ping](/development/api-reference#_2-robot-heartbeat-ping); the
`data` block matches the MQTT contract field-for-field.

## Operation Supervisor Synchronization

`operation_supervisor.py` mirrors whatever the browser dispatches on `/string/operation_sync` so a
Navigation mission, whether multi-pinpoint or coverage, keeps running if the browser tab closes;
the full protocol and sequence diagram are in
[Message Contracts § Operation Supervisor Synchronization](/development/message-contracts#operation-supervisor-synchronization).
For Navigation specifically:

- Starting Auto Coverage, Custom Range Coverage, or a Playlist run each send a `batch` sync
  recording the operation (`operation: "coverage" | "custom_coverage" | "playlist"` and the
  relevant `coverage` payload). This is a record-only mirror, since coverage execution already
  runs robot-side once dispatched; the supervisor does not additionally drive it.
- `takeover` and `release` are what [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot)'s
  Autopilot toggle sends to hand waypoint sequencing to the supervisor and back.
- `progress` is sent as the browser advances through a multi-pinpoint route under its own control
  (see [Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes)).

## Streaming Telemetry

The Navigation canvas is built entirely from topics serialized on the unit via `topic2string`,
carried over MQTT, and rehydrated to typed ROS messages on the cloud server for `rosbridge`. Full
hop-by-hop detail is in
[Message Contracts § Streaming Telemetry Topics](/development/message-contracts#streaming-telemetry-topics);
the topics that feed the Navigation canvas specifically:

| Robot Topic | Cloud Server Topic | Rate | Canvas role |
| --- | --- | --- | --- |
| `/string/robotpose` | `/unit_<ULID>/server/robot_pose` | 25 Hz | Robot icon position/heading, and the source pose stream for [Show/Hide Trace](/development/webui/navigation/coverage-cleaning#show-hide-trace). |
| `/string/map` | `/unit_<ULID>/server/slam/map` | On change, plus a heartbeat | The rendered floorplan bitmap. The canvas asks for it on mount rather than waiting for the next send, and shows "Loading map from robot..." until one is drawn. See [Message Contracts § Map delivery](/development/message-contracts#map-delivery). |
| `/string/laserscan` | `/unit_<ULID>/server/scan` | 2 Hz | Red laser-scan points around the robot. |
| `/string/move_base/NavfnROS/plan` | `/unit_<ULID>/server/move_base/NavfnROS/plan` | On plan | Blue global-plan line for pinpoint/route navigation. |
| `/string/move_base/TebLocalPlannerROS/local_plan` | `/unit_<ULID>/server/move_base/TebLocalPlannerROS/local_plan` | Continuous | Local trajectory line. |
| `/string/boustrophedon_path` | `/unit_<ULID>/server/boustrophedon_path` | On plan | The orange [coverage-path overlay](/development/webui/navigation/coverage-cleaning#the-coverage-path-overlay). |
| `/string/operation_snapshot` | `/unit_<ULID>/string/operation_snapshot` | Latched | Full mission snapshot used to recover Navigation state on reconnect/reload. |

## REST endpoints

From
[API Reference § Navigation and Mission Dispatch](/development/api-reference#navigation-and-mission-dispatch):

### Initialize Navigation Mode: `POST /api/navigation/init`

Launches the navigation stack with a `map_id`. The map must belong to the requesting unit within a
rental the caller is on; a map visible to the caller but recorded by a **different** robot on the
same rental is refused with `404` rather than forwarded. Forwarding it used to let the request
through while the robot silently failed to find map files it never recorded (see
[API Reference § Initialize Navigation Mode](/development/api-reference#_1-initialize-navigation-mode)
for the incident this fixed).

### Dispatch Waypoint Goal: `POST /api/navigation/pointstamped`

Sends a single `{ unit_id, X, Y, Z }` destination. This is the REST wrapper around the
`navigation`/`pointstamped` MQTT command above; see
[Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes) for how single vs. multi
pinpoint driving uses it.

### Start Boustrophedon Area Coverage: `POST /api/boustrophedon/init`

The REST wrapper around the `boustrophedon`/`init` MQTT command above (`unit_id`, `areas`,
`exclusions`). The frontend transport for this and the sibling `deactivate`/`pause` calls lives in
`src/components/navigationMap/coverageApi.ts`; see
[Coverage Cleaning](/development/webui/navigation/coverage-cleaning) for which UI action populates
which field.

### Save Custom Waypoint Route: `POST /api/routes`

Persists a named waypoint sequence (`profile_id`, `map_id`, `route_name`, `route_type`,
`waypoints`). Covered in depth in
[Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes); listed here only because it
lives in the same API Reference section.

### Auto Align System: `POST /api/autoalign/start`

From
[API Reference § Auto Align System](/development/api-reference#auto-align-system): initiates the
particle-filter/scan-match convergence check. `api-reference.md` documents only `start`; the
`status` and `reset` counterparts the frontend also calls
(`src/components/navigationMap/autoAlignApi.ts`) are documented from source in
[Map Sync & Auto Align](/development/webui/navigation/map-sync-and-alignment#api-autoalign-status),
since they are not currently written up in the REST reference itself.

## rosbridge subscriptions

The Navigation canvas talks to `rosbridge_suite` over the WebSocket protocol documented in full in
[WebSocket and rosbridge Protocol](/development/rosbridge-protocol): connection endpoints per
environment, the `subscribe`/`publish`/`call_service` operation shapes, and frontend
resilience/self-healing (the EaselJS `createjs.Stage` prototype patch and the three-strikes
reconnect debounce) all apply to Navigation unchanged and are not repeated here.

The subset of
[Primary Web Canvas Subscriptions](/development/rosbridge-protocol#primary-web-canvas-subscriptions)
Navigation actually renders is the same set of topics listed in
[Streaming Telemetry](#streaming-telemetry) above, addressed at their rosbridge-side names (e.g.
`/server/robot_pose`, `/server/boustrophedon_path`) rather than the MQTT-side
`/unit_<ULID>/server/...` form: rosbridge subscribes per-unit-relay, so the ULID segment is
implicit in which relay the browser is connected to rather than repeated in every topic name at
that layer.

## Related

- [Overview](/development/webui/navigation/overview): the Navigation page and its full Mode List.
- [Map Sync & Auto Align](/development/webui/navigation/map-sync-and-alignment): pose correction and
  the Auto Align REST calls in their feature context.
- [Coverage Cleaning](/development/webui/navigation/coverage-cleaning): the boustrophedon feature in
  its feature context.
- [Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes): single/multi pinpoint
  driving and saved routes.
- [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot): teleop and the
  autopilot sequencer, and the Operation Supervisor takeover/release calls.
- [Boustrophedon Coverage & Zero-Spin Alignment Architecture](/development/ros/boustrophedon-and-alignment):
  the sweep algorithm and the in-place rotation guard.
- [Message Contracts](/development/message-contracts): the full MQTT command/feedback reference.
- [API Reference](/development/api-reference): the full REST API reference.
- [WebSocket and rosbridge Protocol](/development/rosbridge-protocol): the full rosbridge wire
  protocol.
