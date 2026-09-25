---
outline: deep
search: false
---

# Unit Container Lifecycle Management (Legacy)

<RoleBadge role="developer" />

::: warning Superseded Architecture Notice
The 1-container-per-unit lifecycle orchestration managed by `unit_manager.js` is **superseded** by the fleet relay described in [Fleet Relay: One Container for Every Unit](#fleet-relay-one-container-for-every-unit) below, which is now the default. The per-unit path still ships and is one environment variable away; this document covers both.
:::

This document details the dynamic lifecycle management of per-unit relay containers (`rosweb_unit_<ULID>`) on the cloud server, managed by `unit_manager.js` over the Docker socket, and the fleet relay that replaces them.

## Container Architecture Overview (Legacy)

To scale across large robot fleets without wasting server CPU and RAM on idle machines, the server spins up a dedicated ROS relay container only when an operator opens that robot's dashboard.

![Container Architecture Overview (Legacy)](./diagrams/unit-container-lifecycle-container-architecture-overview-legacy.drawio)

## Container Lifecycle State Machine

![Container Lifecycle State Machine](./diagrams/unit-container-lifecycle-container-lifecycle-state-machine.drawio)

## Lifecycle Rules and Policies

### 1. Autopilot Mission Retention
When a robot executes an autonomous mission in **Autopilot Mode**, its relay container enters the **Retained** state. Retained containers are exempt from the 30-minute idle reaper and are **never stopped upon operator logout**. This guarantees that autonomous operations proceed uninterrupted even if operators close their laptops or drive out of Wi-Fi range.

### 2. Idle Timeout Reaper
The background reaper sweeps every 60 seconds (`UNIT_REAP_INTERVAL_MS: 60000`). If a container has no active operator heartbeat pings for 30 minutes (`UNIT_IDLE_TIMEOUT_MS: 1800000`) and is not retained by Autopilot, the manager calls `docker.stop()`.

### 3. Restart Policy: `unless-stopped`
Per-unit containers run with the Docker restart policy `unless-stopped`. If the host server reboots, Docker automatically revives previously running unit containers. Conversely, when the reaper explicitly stops a container, Docker respects the stop state and does not revive it.

## Configuration Parameters

| Environment Variable | Default Value | Description |
| --- | --- | --- |
| `UNIT_MANAGER_ENABLED` | `true` (server), `false` (unit) | Master switch. Off disables holder tracking as well, which breaks lease handback on logout. |
| `UNIT_CONTAINERS_ENABLED` | `false` | Default is fleet mode. Set `true` to go back to one container per robot, and then stop the relay. |
| `FLEET_RELAY_CONTAINER` | derived from `UNIT_MODE` | Name of the single relay container the reconciler restarts. |
| `FLEET_ROSTER_POLL_MS` | `60000` | How often the roster is re-read from `units`. A backstop against a missed change, not the mechanism. |
| `MULTI_UNIT_LIST` | (unset) | Optional override. Comma- or space-separated ULIDs. Set it and the roster stops following enrolments. |
| `FLEET_CLIENT_ID` | `fleet_nakayama_cloud` (prod), `fleet_dev_nakayama_cloud` (dev) | Fleet relay only. MQTT client id for the one shared connection. Must be unique per broker: `clean_session` is true, so a duplicate id disconnects the other client and the two flap. |
| `FLEET_MAX_INFLIGHT` | `200` | Fleet relay only. Bounds in-flight messages for the whole fleet, where the per-unit value of `20` bounded one robot. Left low, one robot's map burst stalls pose updates for every other robot. |
| `UNIT_IMAGE` | `ros-noetic-webui-app-v2:latest` | Target Docker image instantiated for the unit relay. |
| `UNIT_IDLE_TIMEOUT_MS` | `1800000` (30 minutes) | Inactivity threshold before an idle container is stopped. |
| `UNIT_REAP_INTERVAL_MS` | `60000` (1 minute) | Execution period of the background reaper sweep. |
| `UNIT_REMOVE_ON_REAP` | `false` | When true, deletes the container; when false, preserves stopped state. |
| `UNIT_MODE` | `prod` (or `dev`) | Sets container naming suffix (`_nakayama` vs `_nakayama_dev`). |

## Fleet Relay: One Container for Every Unit

The per-unit design pays for each robot with a whole container: its own workspace build, its own set of ~10 Python relay nodes, and its own TLS connection to the broker. Nothing about ROS required that. Every topic is already fully qualified with `/unit_<ULID>/...`, and every MQTT bridge entry is a `primitive: true` `std_msgs/String` passthrough, so one process can serve the whole fleet by holding one subscriber/publisher pair per unit.

The fleet relay collapses **both halves** of the data plane into a single container, `ros_web_ui_v2_unit_relays` (`_dev` suffix on the dev stack):

| Half | Per-unit path | Fleet path |
| --- | --- | --- |
| ROS relays | `topic2string/launch/cloud.launch`, one node set per unit | `topic2string/launch/cloud_multi.launch`, one node set for all units |
| MQTT bridge | `aws_mqtt/launch/nakayama_cloud.launch`, one nodelet per unit | `aws_mqtt/launch/nakayama_cloud_multi.launch`, one nodelet, one connection |

`bringup_cloud.launch` switches both together behind `use_multi_unit_bridge:=true`, so the two halves can never be half-enabled.

### Where the topic map comes from

roslaunch XML cannot loop, which is the only reason the bridge map was ever per-unit. `aws_mqtt/scripts/gen_bridge_params.py` does the loop: it expands the map over a roster of ULIDs and writes a YAML file that the fleet launch loads in one `<rosparam command="load">`. It must run **before** roslaunch, because the file is read while the XML is parsed.

The generated config feeds the same stock `mqtt_client/MqttClient` nodelet with the same topic names and the same `primitive` flag, so the robot side cannot tell which path is running. `scripts/test/test_gen_bridge_params.py` asserts that a roster of one reproduces the inline map in `nakayama_cloud.launch` entry for entry, which is what stops the two from drifting while both exist.

### The roster comes from the database

The roster is **not configured**. `fleet_roster.js` reads every row of the `units` table and decodes each `BINARY(16)` id into its ULID, so enrolling a robot is the only thing anyone has to do to make it reachable. `MULTI_UNIT_LIST` still overrides it, for pinning a subset while debugging, and a pinned roster then stops following enrolments.

It is deliberately **every** unit, not the units visible to some account through an active rental profile. A robot whose rental lapsed is still a robot that can power on and publish, and bridging an idle unit costs a few subscribers that never fire. Filtering fails in the worse direction: a live robot unreachable because of a billing state is not a connection anyone would think to look for.

One query serves two callers, on purpose. `backend_node` uses it as a module with the pool it already owns; the relay container runs it as a CLI, because no backend runs inside it. Two implementations would let the relay bridge one set of units while the backend believed it was bridging another.

### Enrolment restarts the relay automatically

The relay reads its roster once, at start, because the MQTT bridge nodelet's topic map is fixed at load time. So "a unit was enrolled" has to become "the relay was restarted", and `startRosterReconciler()` in `unit_manager.js` is what does it: every `FLEET_ROSTER_POLL_MS` (default 60 s) it re-reads the roster and restarts the relay if it changed.

Polling rather than hooking the enrolment endpoint, because enrolment is not the only way the table changes: deletion, a profile restore, or an admin fixing a row by hand all count, and a backstop that catches all of them beats an event that catches the common one.

An empty roster **waits** rather than exits. On a fresh install no units exist yet, and a crash-looping container should not be the normal state of a new deployment; the relay logs that it is waiting and starts working on its own once the first unit is enrolled. A database that cannot be reached is reported separately from a database with no units, because the two want opposite responses.

### The relay never creates the ROS master

Its command waits for a master and exits if none appears within 60 s, rather than letting roslaunch start one. If the relay owned the master, restarting the relay would take the master down and every other container with it.

The reverse case is handled too. The master lives inside `backend_node`, so a backend restart is a **new** master and the relay's nodes are orphaned against it: their processes are alive, they are simply no longer registered, and no amount of pinging heals that. `unit_manager.init()` therefore restarts the relay on every backend start, which is what makes a backend redeploy survivable.

### What this does and does not save

It does **not** reduce bandwidth. Message volume is set by the robots, not by how many containers the cloud runs, and the broker delivers the same messages either way. The only wire saving is one keepalive stream per retired connection.

What it saves is server-side: process count (N × 10 relay nodes becomes 10), RAM, disk (one workspace build instead of N), cold-start time (no per-unit `catkin_make`), broker connection count, and the whole per-unit lifecycle problem surface.

### Why not fold it into the backend container

A backend redeploy would then take the entire fleet's data plane down with it. Keeping the relay in its own container means a code deploy is not a fleet-wide outage. This is the same reasoning that keeps `hivemq` out of the app image.

### Blast radius changes shape

Each relay type is still its own process, so a crash takes out one function rather than everything. But it now takes that function out **for every robot** instead of for one. Before: robot A dead, robot B untouched. After: all robots lose the lidar overlay while position, map and navigation keep working. The single MQTT connection is the one genuinely fleet-wide point: if it drops, every robot loses its bridge until reconnect (`reconnect_delay`, 5 s).

### Running it

There is nothing to configure. The relay is part of the normal profiles and fleet mode is the default, so a plain bring-up gives you the merged architecture:

```bash
docker compose --profile server_prod up -d   # or --profile server_dev
```

| | Dev | Prod |
| --- | --- | --- |
| Relay container | `ros_web_ui_v2_unit_relays_dev` | `ros_web_ui_v2_unit_relays` |
| Image | `ros-noetic-webui-app-v2:dev` | `ros-noetic-webui-app-v2:latest` |
| Roster override (optional) | `MULTI_UNIT_LIST_DEV` | `MULTI_UNIT_LIST_PROD` |

Both relays share one start command (the `x-fleet-relay-command` anchor in `docker-compose.yml`), deliberately: a preflight that protected one stack but not the other would be worse than none.

### Reverting to one container per robot

Set `UNIT_CONTAINERS_ENABLED=true` on the backend service and stop the relay.

::: danger Never run both paths for the same unit
Two bridges subscribed to the same MQTT topics deliver every message twice. Duplicated `move_base` `/result` double-advances the waypoint ACK loop, which reads on the dashboard as the robot **skipping a pinpoint**. ROS cannot protect against this automatically because the two node sets have different names, so nothing gets auto-killed.
:::

Two guards make that mistake loud rather than silent:

- The relay's start command refuses to launch if any `/unit_<ULID>/cloud_mqtt_client` is already registered on the master.
- `unit_manager.init()` logs an error naming every per-unit container it finds still running while in fleet mode.

### `UNIT_CONTAINERS_ENABLED` is not `UNIT_MANAGER_ENABLED`

Turning the whole manager off would also stop `holders` from being recorded, and holders are what `listActorUnits()` reads to hand operating leases back on logout. A lease is held **on the robot** and outlives any container, so disabling the module wholesale would strand a lease on every logout with nothing in the logs connecting the two.

`UNIT_CONTAINERS_ENABLED=false` therefore gates only the Docker half. Holder tracking stays on, the manager never connects to the daemon, and `getRunningForUser()` returns empty so the verified-shutdown overlay reports "already down" instead of waiting for a container that will never appear.

## Docker Socket Security

`backend_node` communicates with the host Docker engine via a bind mount of `/var/run/docker.sock`. Container execution is restricted to managing units matching the `rosweb_unit_*` namespace, preventing arbitrary container manipulation on the host.

## Related Documentation

- [Architecture](/development/architecture): High-level system structure and two-machine model.
- [State and Behavior](/development/state-and-behavior): Robot activity states and Autopilot handover.
- [Setup: Docker Reference](/setup/docker-reference): Complete compose profile specifications.
