# System Setup

<RoleBadge role="technician" />

How to confirm a configured [Server](/setup/server-setup) and a configured [Unit](/setup/unit-setup)
are actually working together as one system. If you followed both of those pages in order and the
unit enrolled successfully, most of this is verification rather than new configuration.

## Overview

A Unit and the Server talk over two independent channels, and both need to be healthy:

- **MQTT (HiveMQ)**, TLS, over the internet: carries commands and status between the robot and the
  backend. This is what makes a unit "online" in the admin console.
- **rosbridge**, over the local network or a tunnel: carries the live map, robot pose, and video
  signalling data an operator's browser needs while actively driving.

A unit can be enrolled and "known" to the Server via MQTT while still being unreachable for live
operation if rosbridge or the video signalling path isn't open; those are different failure modes,
worth telling apart when something looks half-broken.

## 1. Confirm the network path

- The Unit needs outbound access to the Server's MQTT port (`8883` production, `8884` dev) and, if
  it's meant to be driven remotely rather than only from its own local dashboard, to the Server's
  rosbridge/media/signalling ports as well.
- The Server needs its Apache reverse proxy (see [Server Setup](/setup/server-setup)) actually
  fronting those services with valid TLS: a self-signed or expired certificate will make the
  dashboard's WebSocket connections fail silently in most browsers rather than showing a clear error.

::: info Choosing production vs. dev
`--dev` on the unit side (`./scripts/docker-manager.sh up --dev`) points enrolment and the MQTT
bridge at the Server's `server_dev` profile instead of `server_prod`: different port, different
database, different fleet. It's the right choice while you're testing a new unit or a server-side
change; drop the flag once you're deploying for real. A unit's identity is *not* shared between the
two: enrolling against dev does not register it in prod, and vice versa.
:::

## 2. Confirm the unit registered correctly

In the admin console, under **Registered Units**, find the unit you approved in
[Unit Setup](/setup/unit-setup). Note its ULID; you'll want it for the next check.

```bash
# On the Server, inside a container with the ROS master reachable:
rostopic list | grep unit_<ULID>
```

You should see topics like `/unit_<ULID>/system_command` and `/unit_<ULID>/system_feedback`. Seeing
nothing here, with no error anywhere else, is the single most common "it looks broken but isn't
telling you why" symptom in this system; see [Troubleshooting](/setup/troubleshooting).

## 3. End-to-end verification checklist

- [ ] Server is running (`docker compose ps` shows every service healthy: [Server Setup, step 6](/setup/server-setup#6-verify))
- [ ] Unit is running and shows its bringup nodes (`rosnode list` inside the unit's container: [Unit Setup, step 5](/setup/unit-setup#5-verify))
- [ ] Unit shows **online** in the admin console's Registered Units list
- [ ] Opening the unit from a test dashboard account shows a live camera feed and an up-to-date robot position on the map
- [ ] Sending a small manual movement command (W-A-S-D) actually moves the robot, and the dashboard's position updates to match
- [ ] Emergency Stop, tested once, actually stops the robot immediately

Don't skip the last two: a unit can look fully "connected" (online badge, video feed working) while
the command path is broken in one direction, which only shows up once something is asked to move.

## 4. Handover

Once verification passes, the unit is ready for day-to-day use. Two things still need doing before
handing it to an operator:

1. **Grant dashboard access.** In the admin console, add the operator's account to the rental
   profile that includes this unit. A unit existing and being enrolled does not, by itself, make it
   visible to any user account: units are shared, fleet-wide resources, and access to them is
   controlled entirely through profiles, not through the unit itself.
2. **Point them at [Getting Started](/getting-started/).** That section assumes exactly this state:
   a unit that's already installed, connected, and access-granted.

## Next step

- Set up a [Maintenance](/setup/maintenance) schedule for the new deployment.
- Keep [Troubleshooting](/setup/troubleshooting) handy for future issues.
