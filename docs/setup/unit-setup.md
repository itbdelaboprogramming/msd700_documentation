# Unit Setup

<RoleBadge role="technician" />

How to install and configure an **MSD700 Unit**, the physical robot. Complete [Prerequisites](/setup/prerequisites) first, and have a running Server to enrol against (see [Server Setup](/setup/server-setup)).

::: info The short version
Everything below boils down to: clone the workspace, run one setup script, run one build command,
run one `up` command. The robot enrols itself the first time it starts; you do not type an id
anywhere. Everything past this box is what those four steps actually do and why, for when something
doesn't go as expected.
:::

## 1. Clone the workspace

The robot's software lives across three repositories, wired together as one workspace by
`msd700_noetic`:

```bash
git clone --recursive https://github.com/itbdelaboprogramming/msd700_noetic.git
cd msd700_noetic
```

If you already cloned without `--recursive`:

```bash
git submodule update --init --recursive
```

::: info Why three repos and not one?
`msd700_noetic/src/` holds `msd700_robot` (the ROS packages: navigation, mapping, hardware drivers),
`ros-web-ui` (the web-facing packages: MQTT bridge, camera streaming, the launch files that tie
everything together), and `ROS-dashboard-next-ts` (the dashboard this unit serves on its *own* IP,
for local operation with no internet). They're separate repositories because `ros-web-ui` and the
dashboard are shared with the Server side too: a Unit and a Server both build from the same
`ros-web-ui` source, just launched differently.
:::

## 2. One-time host setup

```bash
./setup.sh
```

This installs Docker if it's missing, adds your user to the `docker` group, installs `xhost` (needed
for GUI tools like RViz), and makes the project's scripts executable.

::: warning
If the script just added you to the `docker` group, **log out and back in** before continuing:
group membership doesn't apply to your current shell session.
:::

You can re-run the check on its own at any time without installing anything:

```bash
./setup.sh --check
```

## 3. Build the Docker image

```bash
./scripts/docker-manager.sh build
```

::: info Why Docker instead of installing ROS on the Jetson directly?
ROS Noetic only ships packages for Ubuntu 20.04, and this project targets Ubuntu 22/24 hosts (the
Jetson's own OS, and most developers' laptops). Docker sidesteps the mismatch entirely: the same
image runs identically everywhere, so "it built for me but not for you" isn't a category of bug you
have to debug.
:::

## 4. Bring the robot up

```bash
# On real hardware, talking to production:
./scripts/docker-manager.sh up

# Testing with the Gazebo simulator instead of real sensors:
./scripts/docker-manager.sh up --simulator
```

The first `up` on a fresh unit **enrols itself automatically**, no id to type. Watch the terminal:
it prints a short **claim code**, then waits.

::: info Why does the robot ask a human to approve it, instead of just picking an id?
This is the one place a wrong guess would be dangerous rather than merely inconvenient: a fabricated
id lets *anything* claiming that id command a real robot. Requiring a human to approve a specific
claim code in the admin console, once, is the cheapest check that closes that door without asking a
technician to manage credentials by hand on every boot.
:::

Meanwhile, in the admin console (as an admin, on the Server):

1. Open the **Pending Units** tab: the new claim code should appear within a few seconds.
2. Click **Register** (brand-new unit) or, if you're replacing hardware for a unit that already
   exists, **Adopt** onto that unit's existing ID instead of creating a duplicate.

Once approved, the robot picks up its identity and finishes booting, no restart required. From then
on, every future boot remembers this identity (`ros-web-ui/Certificates/robot/device.json`) and
needs no approval step at all, with or without internet.

::: info What "identity" actually means here
The robot is assigned a **ULID** (a 26-character id), and every ROS topic and MQTT message for this
robot lives under `/unit_<ULID>/`. This replaced an earlier scheme based on a human-chosen username
and unit name. Those could be renamed in the admin console at any time, and renaming one silently
moved the robot to an address the dashboard was no longer listening on, with no error anywhere,
just a robot that looked dead. A ULID can't be renamed, so that failure mode is gone by construction.
:::

## 4b. The unit's own dashboard (always on)

`up` also starts this unit's **entire own server stack**: dashboard, backend, database, MQTT
broker, media server, listening on the unit's own IP, in addition to talking to the cloud. This
isn't a mode you opt into; every unit runs it.

| Service | Port |
| --- | --- |
| Dashboard (Next.js) | `3000` |
| Backend API + rosbridge | `5002` / `9090` |
| Media server | `3003` |
| WebRTC signalling | `3001` |
| MySQL (loopback only) | `3306` |
| MQTT broker (loopback only) | `1883` |

Open `http://<unit-ip>:3000` to reach it directly.

::: info Why does a robot need its own dashboard at all?
"Local is a cache of the cloud, not a silo." The unit keeps working with no internet: you can drive
it from its own IP with zero cloud dependency, but its *identity and accounts* still come from the
cloud enrolment in step 4. A unit that has never enrolled can't start even locally; one that has
enrolled works from its cached identity regardless of what the network is doing. The cloud MQTT link
also stays up alongside the local one, so the unit remains visible on the cloud dashboard even while
someone drives it from the local one.
:::

Firewall note: every local service uses host networking directly (no port mapping), so what matters
is the *unit's own firewall*, not Docker. Allow the five browser-facing ports above; MySQL and the
MQTT broker are deliberately bound to `127.0.0.1` and need no firewall rule at all.

## 5. Verify

```bash
./scripts/docker-manager.sh shell        # open a shell inside the running container
rostopic list                            # should include /unit_<ULID>/... topics
rosnode list                             # should show the bringup nodes running
```

From the Server side, check the admin console's **Registered Units** list: the unit you just
approved should show as online. See [System Setup](/setup/system-setup) for the full end-to-end
check.

## Stopping / restarting

```bash
./scripts/docker-manager.sh down    # stops the container AND this unit's local server stack
```

::: warning
`up` **holds your terminal** by default: Ctrl-C stops everything, which matters if you're on a
flaky SSH session. Use `up -d` instead to let it detach once services are confirmed running; you can
still watch startup output and abort with Ctrl-C *before* that point.
:::

## Next step

Continue to [System Setup](/setup/system-setup) to confirm Server and Unit are fully connected.

If something goes wrong, see [Troubleshooting](/setup/troubleshooting).
