---
outline: deep
---

# Unit Setup

<RoleBadge role="technician" />

How to install and configure an **MSD700 Unit**: the physical robot on an NVIDIA Jetson.

You need a running [Server](/setup/server-setup) first. Run every command below **on the unit**, not on the cloud server.

::: info Production first
This page connects a real robot to the **production cloud**. Simulator (`--simulator`) and dev cloud (`--dev`) are in [Advanced Configurations](#advanced-configurations).
:::

::: info ROS 1 by default
Steps 1 to 6 set up the ROS 1 robot (`msd700_robot`, Noetic). To run the ROS 2 robot (`msd_system`, Jazzy) on the same unit, finish them first, then follow [Switching to the ROS 2 stack](#ros2-stack).
:::

## System topology

![MSD700 System Diagram](../development/diagrams/msd700-system-diagram.drawio)

## Folder layout

The Jetson workspace keeps robot packages, web bridges, and the onboard web UI as plain clones under `src/` (not submodules):

```
~/msd700_noetic/
├── setup.sh
├── scripts/
│   └── docker-manager.sh
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env
└── src/
    ├── msd700_robot/
    ├── ros-web-ui/
    ├── ROS-dashboard-next-ts/
    └── msd_system/          # only for the ROS 2 stack
```

---

## Setup steps

Do Steps 1-4, then Step 6 (hotspot provisioning), then Step 5 (start). The hotspot files must exist before the first start.

### Step 1: Clone the workspace and sources

```bash
# 1. Orchestration workspace
git clone -b master git@github.com:itbdelaboprogramming/msd700_noetic.git ~/msd700_noetic
cd ~/msd700_noetic

# 2. Source repos into src/ (msd700_robot on master, the others on main)
git clone --recurse-submodules -b master git@github.com:itbdelaboprogramming/msd700_robot.git src/msd700_robot
git clone -b main git@github.com:itbdelaboprogramming/ros-web-ui.git src/ros-web-ui
git clone -b main git@github.com:itbdelaboprogramming/ROS-dashboard-next-ts.git src/ROS-dashboard-next-ts
```

::: tip Why clone by hand into `src/`?
`msd700_noetic` ignores `src/*/` so each repo keeps its own branch without Git-in-Git conflicts.
:::

---

### Step 2: One-time host setup

```bash
cd ~/msd700_noetic
./setup.sh
```

This installs Docker if missing, sets group access and `xhost`, makes scripts executable, configures the Velodyne wired link, installs STM32/RealSense udev rules and the RealSense recovery service, and downloads simulator worlds. It changes the host; it is not a read-only check.

::: warning Docker group
If the script added you to the `docker` group, log out and back in, or run `newgrp docker` (current shell only).
:::

A missing `DISPLAY` (headless SSH session) is only a warning here. X11 is needed only for RViz or Gazebo.

::: details Velodyne VLP-16 wired link (only on units with a VLP-16)
The VLP-16 streams UDP to a fixed host IP on port 2368 with no DHCP. Without a static host IP on its
subnet, the ROS driver times out silently and no point cloud appears.

`./setup.sh` (or `./setup.sh --configure-lidar` on its own) creates the NetworkManager profile
`msd700-velodyne`: static `192.168.103.100/24`, IPv6 off, autoconnect priority 100, never the default
route. The wired interface is auto-detected (the one with a carrier, no IP yet, not the default
route). With 0 or 2+ candidates it is skipped with a warning, never guessed.

| Variable (`docker/.env`) | Default | Purpose |
| --- | --- | --- |
| `VELODYNE_IFACE` | auto-detect | Wired NIC facing the sensor (e.g. `end0`) |
| `VELODYNE_HOST_CIDR` | `192.168.103.100/24` | Host static IP |
| `VELODYNE_SENSOR_IP` | `192.168.103.231` | Sensor IP, used for validation |
| `VELODYNE_CONNECTION_NAME` | `msd700-velodyne` | NetworkManager profile name |

`VELODYNE_SENSOR_IP` must sit inside `VELODYNE_HOST_CIDR` and match `device_ip` in
`src/msd700_robot/msd700_hardware/launch/velodyne_scanner.launch`.

Verify: `ping 192.168.103.231` answers, and inside the container `rostopic list | grep velodyne`
shows the point cloud topics.
:::

---

### Step 3: Check `docker/.env`

The startup scripts create `docker/.env` from `docker/.env.example` **only if missing**. Placeholder MySQL passwords are replaced only while the local database is still uninitialized; this does not rotate existing passwords.

::: warning Credentials in this file
`docker/.env` is tracked in git. Check the per-unit values yourself before first use. Never print, commit, or copy them to another unit. Changing the password of an existing database needs a matching SQL rotation, not just editing the file.
:::

To review settings by hand before launch:

```bash
cd ~/msd700_noetic
test -e docker/.env || cp docker/.env.example docker/.env
nano docker/.env
```

Main settings:

```ini
# Map storage on the Jetson
MAPS_FOLDER_LOCAL=/home/ubuntu/ros_maps

# Local user UID/GID (blank = auto-detect: Jetson 2002, dev laptop 1000)
USER_UID=
USER_GID=

# Gazebo simulator (true only on machines without robot hardware)
WITH_SIMULATOR=false

# Leave empty; filled automatically during cloud enrolment
UNIT_ID=

# Local ports (onboard stack defaults)
MYSQL_PORT_LOCAL=3306
MOSQUITTO_PORT_LOCAL=1883
BACKEND_PORT_LOCAL=5002
ROSBRIDGE_PORT_LOCAL=9090
FRONTEND_PORT_LOCAL=3000
MEDIA_SERVER_PORT_LOCAL=3003
SIGNALLING_PORT_WS_LOCAL=3001
SIGNALLING_PORT_HTTP_LOCAL=3002
NETWORK_AGENT_PORT_LOCAL=5011

# Optional static IP hint (the dashboard follows the browser address anyway)
#LOCAL_IP=192.168.4.1
```

::: info Which cloud does it talk to?
Default is `https://msd.nglobal.jp/services/rosbackend`, or the dev backend with `--dev`. `CLOUD_BASE_URL` overrides the default. Keep enrolment and sync pointed at the same cloud; these settings do not move the MQTT broker by themselves.
:::

---

### Step 4: Build the robot image

Build while you have internet. The robot base is `ros:noetic-robot`; the Dockerfile copies `src/` in and runs `catkin build`.

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh build
```

This builds `msd700:latest`, `ros-noetic-webui-app-local:latest`, and `ros-dashboard-next-local:latest`, and pulls MySQL and Mosquitto. A pull failure only warns; check upstream images are reachable before going offline. Plain `up` reuses images and only warns about stale ones; rebuild on purpose after source changes.

Create the maps folder first, owned by your UID/GID. Docker creates a missing bind folder as root otherwise:

```bash
sudo install -d -o "$(id -u)" -g "$(id -g)" /home/ubuntu/ros_maps
```

**If this unit uses the hotspot, do Step 6 before Step 5.** The stack bind-mounts `/run/msd700-hotspot-active`; starting Docker before that file exists can create a folder in its place.

---

### Step 5: Start the robot and enrol

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh up -d
```

This starts the robot container plus the always-on `local_dev` stack (database, MQTT, backend/rosbridge, network agent, media, signalling, dashboard). Despite the name, `local_dev` runs for either cloud. `-d` returns after startup and enrolment finish. `up` also installs `msd700.service` for boot autostart; add `--no-autostart` to skip that.

**Enrolment, first launch only:**

1. The robot contacts the cloud and prints an 8-character **claim code** (for example `K7M2QP4R`). It is a display handle, not a secret.
2. An admin opens the cloud admin console (`https://msd.nglobal.jp/admin`, or the dev backend on port 5001 with `--dev`) and logs in.
3. Under **Pending Units**, find the code, then either register it as a new unit on an active **Rental Profile**, or **Adopt** it onto an existing unit's ULID (hardware swap path; keeps maps already in the cloud).
4. The unit saves its identity to `src/ros-web-ui/Certificates/robot/device.json` plus a token in `token.cred`. Treat both as secrets. Later launches reuse them.
5. The production bridge targets HiveMQ TLS port `8883`. Approval alone proves nothing about connectivity; check the cloud and local dashboards separately.

::: info Production and dev on one unit
Each cloud registers the unit separately, and the unit keeps one identity per cloud. The first `up --dev` on a unit registered with production (or the first plain `up` on one registered with dev) is a first enrolment for that cloud: a claim code, then the unit waits until that cloud's admin approves it, and starts on the new id. Switching back later needs no approval. See [Hardware Enrolment § One robot, two clouds](/development/webui/accounts/enrolment#one-robot-two-clouds).
:::

---

### Step 6: Provision the WiFi hotspot

A provisioned unit offers a hotspot and can keep a WiFi client connection on the same onboard radio, if the driver supports both at once. Check the real driver first, not just the chip name. Do this provisioning **before the first `up`**, from a local console or wired connection: NetworkManager restarts and WiFi can drop.

```bash
cd ~/msd700_noetic

# Optional: backup dongle driver (one-time, DKMS). Skip if the onboard radio does the hotspot alone.
./scripts/install-wifi-dongle-driver.sh

# Provision the hotspot (udev rules, PolicyKit rule, hostapd/dnsmasq services)
./setup.sh --provision-network
```

`--provision-network` runs in a terminal and asks for interface names and SSID (with detected defaults). Password typing is hidden; an existing password shows as `[keep current]`, never displayed. A new password is typed twice. It is saved to the hostapd configs under `/etc/hostapd/` (mode 0600), **not** back to `docker/.env`. The upstream client network goes to its NetworkManager profile. After this, the hotspot comes up on every boot by itself, no Docker needed.

::: info Scripted provisioning
Without a TTY (or with `MSD700_NONINTERACTIVE=1`), prompts are skipped. An existing hostapd password wins over env values. Typing a password inline can leak it into shell history. Prefer the hidden interactive prompt. Secure unattended password rotation is still unsolved. Full walkthrough: [WiFi Hotspot](/setup/wifi-hotspot#provisioning-the-hotspot-once-per-unit).
:::

---

## Driving locally (offline)

Without internet, join the robot's local network or its [hotspot](/setup/wifi-hotspot) from Step 6:

1. Open `http://<jetson-ip>:3000`.
2. After cloud enrolment and one successful sync (rental assignment + operator accounts), the local dashboard drives, maps, and runs routes offline. A never-enrolled unit cannot start offline.
3. When internet returns, sync exchanges maps, routes, areas, and database rows with the configured cloud, limited to this unit and its rental profile. Check sync status; do not assume everything uploaded.

---

## Switching to the ROS 2 stack (msd_system) {#ros2-stack}

During the ROS 1 to ROS 2 migration a unit can run either robot stack. The flag `--ros2` on `docker-manager.sh` picks the ROS 2 one: [msd_system](/ros2-msd-system/) on ROS 2 Jazzy, with its web UI bridge (`msd_webui_bridge`). The bridge speaks the same MQTT contract as a ROS 1 unit, so the server and dashboard need no change.

| | ROS 1 (default) | ROS 2 (`--ros2`) |
| --- | --- | --- |
| Robot source | `src/msd700_robot` | `src/msd_system` |
| Image | `msd700:latest` | `msd_system:robot`, layered on `msd_system:pc` |
| Container | `msd700` | `msd_system` |
| Session runner | `run_msd.sh` | `run_ros2.sh` (`docker/ros2/`) |
| Local stack | full (dashboard on `:3000`) | MQTT broker only |

Only one stack runs at a time: both use the host network, `/dev` and the same unit identity. `up --ros2` refuses to start while `msd700` or `msd700_simulator` is running.

::: warning What works on ROS 2 today
- **Works:** enrolment, Initialize/Stop hardware, manual driving, emergency stop, GPS. The scan, hole and map views, follower and return to home also need the CMU navigation stack running (`MSD_ROS2_BRINGUP_CMD`, below). All bridged and tested in containers only, not yet on a real robot.
- **Not yet:** navigation and mapping from the dashboard, autopilot, coverage and auto align. The dashboard gets "not available" for them.
- **Cloud dashboard only.** In `--ros2` mode the local stack runs only its MQTT broker (the rest needs a ROS 1 roscore), so the local dashboard on `:3000` does not open.
- **No simulator.** `--ros2` cannot be combined with `--simulator`.
- **VLP-16 only.** The ROS 2 hardware layer defaults to the Velodyne. Passing `MSD700_LIDAR_TYPE` (Livox Mid-360) into the container is on the `msd700_noetic` branch `ros2-lidar-type`, not merged yet.
:::

### Step 1: Clone msd_system

```bash
cd ~/msd700_noetic
git clone -b web-ui-bridge git@github.com:itbdelaboprogramming/msd_system.git src/msd_system
```

The web UI bridge (`src/msd_webui/`) is on the `web-ui-bridge` branch, not yet on `develop`. The repo carries `CATKIN_IGNORE`, so the ROS 1 `catkin build` skips it.

### Step 2: Build the ROS 2 images

```bash
./scripts/docker-manager.sh build --ros2
```

This builds `msd_system:pc` from `src/msd_system/Docker/Dockerfile.pc` (Jazzy, rosdep dependencies, Livox-SDK2), then the thin `msd_system:robot` layer (`docker/Dockerfile.ros2`: tmux and the session runner), and pulls Mosquitto. It needs internet and takes long on a Jetson the first time. The ROS 1 images stay, so switching back needs no rebuild.

### Step 3: Stop ROS 1, start ROS 2

```bash
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up --ros2 -d
```

- **The first start compiles the workspace.** `msd_system:pc` holds dependencies only, so `run_ros2.sh` runs `colcon build` inside the container. This needs no internet, but takes a while on a Jetson, so do the first start by hand, not through a reboot (`msd700.service` times out after 15 minutes).
- The build is kept in named volumes (`msd_system_build`, `msd_system_install`, `msd_system_log`), so later starts, `down` and reboots skip it.
- `up --ros2` bakes `--ros2` into `msd700.service`, like `--simulator`, so the unit reboots into ROS 2.
- `--dev` works as on ROS 1 (dev cloud, MQTT `8884`).

::: warning Until `ros2-persistent-build` is merged
The kept build is on the `msd700_noetic` branch `ros2-persistent-build`. On `master` the build still lives in the container and `down` removes it: use `up --ros2 --build -d --no-autostart` there, and add `--build` again after every `down` or reboot.
:::

**Identity.** The ROS 2 container mounts the same `src/ros-web-ui/Certificates/robot/`, so the unit keeps its ULID and no new claim code appears. A unit that never enrolled prints a claim code exactly as in [Step 5](#step-5-start-the-robot-and-enrol).

### Step 4: Bring up the hardware

Open the unit on the cloud dashboard and press **Initialize**. The bridge then starts `msd_webui_bridge/hardware_prototype.launch.py`: the MCU (`hardware_interface_node`), `twist_mux`, odometry and sensors, with the web UI wiring that `motion_guard` needs. **Stop** shuts it down again.

Do not start `msd_hardware.launch.xml` or `msd_bringup` with `run_robot:=hardware` by hand next to it: that hardware has no web UI wiring, and the bridge will not start a second copy.

### Session and checks

`run_ros2.sh` opens the tmux session `robot_services`, the same name as on ROS 1:

| Window | Runs |
| --- | --- |
| `bringup` | `MSD_ROS2_BRINGUP_CMD`, or a notice when it is empty (default) |
| `webui` | `ros2 launch msd_webui_bridge webui.launch.py profile:=prototype ...` |
| `token_refresh` | renews `token.cred` |

```bash
./scripts/docker-manager.sh status --ros2                    # container state
docker exec -it msd_system tmux attach -t robot_services     # session (Ctrl-b d to leave)
./scripts/docker-manager.sh shell --ros2                     # bash in the container
```

Commands that target the robot container (`status`, `shell`, `logs`) need `--ros2` too, or they look at the ROS 1 one.

**Options** (environment or `docker/.env`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `MSD_ROS2_PROFILE` | `prototype` | Bridge profile: `prototype` (real robot) or `sim` |
| `MSD_ROS2_BRINGUP_CMD` | empty | Command for the `bringup` window, for example navigation. Leave the hardware out (see Step 4) |
| `MSD_ROS2_WEBUI_ARGS` | empty | Extra launch arguments for `webui.launch.py` |

**After pulling msd_system:** `src/` is mounted into the container, so `up --ros2 --build` recompiles it. If `Docker/Dockerfile.pc` or package dependencies changed, run `build --ros2` first; the next start then rebuilds the workspace by itself, since it was built on the old image. For a build from scratch: `down`, then `build-clean --ros2`, which also drops the three volumes.

### Switching back to ROS 1

```bash
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up -d
```

`up` without `--ros2` starts the ROS 1 robot and the full local stack, and arms `msd700.service` for ROS 1 again.

---

## Advanced configurations

<details>
<summary><b>Simulation mode (Gazebo warehouse)</b></summary>

For testing on a laptop with no robot hardware. `build --simulator` sets `WITH_SIMULATOR=true` and picks `msd700-simulator:latest`; `fetch_sim_worlds.sh` downloads the warehouse world while online. Use the spawn pose of the selected world.

```bash
./scripts/docker-manager.sh build --simulator
./scripts/docker-manager.sh up --simulator -d
```

With `MSD700_SIM_HEADLESS=true` in `docker/.env`, Gazebo runs without its window.

</details>

<details>
<summary><b>Dev cloud (`--dev`)</b></summary>

Point the unit at the dev cloud instead of production:

```bash
./scripts/docker-manager.sh up --dev -d
```

This moves the cloud bridge to the dev backend (port 5001), MQTT to `8884`, and this robot's roscore to `11322`.

**The broker hostname stays `msd.nglobal.jp` on dev too.** Dev and production share one machine, split only by port, and the TLS certificate names that host. A bare IP would fail verification. Read the port, not the hostname:

| Peer | Broker | Backend | ROS master |
| --- | --- | --- | --- |
| Production (no flag) | `msd.nglobal.jp:8883` | `https://msd.nglobal.jp/services/rosbackend` | `11321` |
| Dev (`--dev`) | `msd.nglobal.jp:8884` | `http://118.22.31.252:5001` | `11322` |

::: danger Keep this unit off the cloud's ROS master
This robot's roscore is `11321`/`11322`, deliberately different from the cloud's `11311`/`11312`. Never forward the server's ROS port to the unit (no `ssh -L`, no VS Code port forward of 11311/11312): the unit stack would register on the **cloud** master and evict the server's own nodes. Symptoms: cloud dashboard goes empty (mapping map first) while the local dashboard looks fine.

```bash
ss -ltnp | grep :11322
docker exec -e ROS_MASTER_URI=http://localhost:11322 msd700 bash -lc 'source /opt/ros/noetic/setup.bash; bash /workspace/src/ros-web-ui/scripts/ros_doctor.sh'
```

Close the forward (VS Code: PORTS panel), or move this robot with `ROS_MASTER_PORT=11323 ./scripts/docker-manager.sh up --dev -d`.
:::

**The mode sticks across reboots.** `up` writes its `--dev` / `--simulator` flags into `msd700.service`, so the unit reboots into the same mode. Check what is armed:

```bash
./scripts/docker-manager.sh print-autostart-unit --simulator --dev   # what would be written
grep ExecStart /etc/systemd/system/msd700.service                    # what is armed now
```

Re-running `up` with different flags rewrites the unit; `down` removes autostart.

</details>

<details>
<summary><b>Non-Ubuntu laptops (sim/dev only)</b></summary>

Set `MAPS_FOLDER_LOCAL` in `docker/.env` to a real writable folder, not a Jetson-style `/home/ubuntu` path. Match the image UID/GID. `backend_local` bind-mounts it at the same path (`docker/docker-compose.yml`), and `run_msd.sh` checks that it is writable before launching, so a bad path fails at start-up instead of when a map is saved.

</details>

---

## Check robot health

```bash
# 1. Robot + local stack status
./scripts/docker-manager.sh status

# 2. ROS session inside the container
./scripts/docker-manager.sh shell
tmux attach -t robot_services

# 3. Robot logs (follow); local stack: local-logs
./scripts/docker-manager.sh logs -f

# 4. Stack health (master, foreign nodes, rosbridge)
docker exec -e ROS_MASTER_URI=http://localhost:11321 msd700 bash -lc 'source /opt/ros/noetic/setup.bash; bash /workspace/src/ros-web-ui/scripts/ros_doctor.sh'

# 5. Sync state on the unit
curl -s http://localhost:5002/local/status
```

## Related

- [Server Setup](/setup/server-setup): cloud backend.
- [System Setup](/setup/system-setup): check server + unit together.
- [Docker Reference](/setup/docker-reference): full CLI reference.
- [WiFi Hotspot](/setup/wifi-hotspot): hotspot setup and troubleshooting.
- [MT7922 Wi-Fi](/setup/wifi-mt7922): onboard-radio firmware fix.
- [Troubleshooting](/setup/troubleshooting): wider diagnostics.
