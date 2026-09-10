---
outline: deep
---

# Unit Setup

<RoleBadge role="technician" />

This guide provides step-by-step instructions for installing and configuring an **MSD700 Unit** (the physical robot running on an NVIDIA Jetson single-board computer).

Ensure that a running [MSD700 Server](/setup/server-setup) exists before proceeding.

::: info Production-First Architecture
This guide defaults to deploying a real hardware robot connecting to the **Production Cloud**. Simulation options (`--simulator`) and development cloud routing (`--dev`) are in the [Advanced Configurations](#advanced-configurations) section.
:::

## System Topology

![Arsitektur Sistem MSD700](/images/MSD700-System-Diagram.jpg)



## Directory Structure Overview

The Jetson workspace manages robot packages, web bridges, and onboard web UI as submodules:

```
~/msd700_noetic/                              # Main Jetson Orchestration Workspace
├── setup.sh                                  # Host Dependency Installer (Docker, xhost)
├── scripts/
│   └── docker-manager.sh                     # Core Lifecycle CLI (build, up, down, logs)
├── docker/
│   ├── Dockerfile                            # ROS 1 Noetic Desktop Full Container
│   ├── docker-compose.yml                    # Robot Container Definition
│   └── .env                                  # Local Environment Variables
└── src/                                      # Catkin Workspace Submodules
    ├── msd700_robot/                         # Navigation, EKF Control, Hardware Drivers
    ├── ros-web-ui/                           # Web Bridges, MQTT nodes, System Command
    └── ROS-dashboard-next-ts/                # Local Operator Web Dashboard
```

---

## Core Step-by-Step Setup

Follow these 6 steps in sequence to set up the physical robot, including provisioning its own WiFi
hotspot.

### Step 1: Clone Workspace and Source Repositories

Clone the `msd700_noetic` orchestration workspace, then clone the three required repositories into the `src/` directory:

```bash
# 1. Clone orchestration workspace
git clone git@github.com:itbdelaboprogramming/msd700_noetic.git ~/msd700_noetic
cd ~/msd700_noetic

# 2. Clone source packages into src/ on branch v2
git clone -b v2 git@github.com:itbdelaboprogramming/msd700_robot.git src/msd700_robot
git clone -b v2 git@github.com:itbdelaboprogramming/ros-web-ui.git src/ros-web-ui
git clone -b v2 git@github.com:itbdelaboprogramming/ROS-dashboard-next-ts.git src/ROS-dashboard-next-ts
```

::: tip Why Manual Clone into `src/`?
`msd700_noetic` ignores `src/*/` in its `.gitignore` to avoid Git-in-Git conflicts and allow each sub-repository to be managed on its own independent branch.
:::

---

### Step 2: One-Time Host Setup

Run the host setup script to configure Docker group permissions and graphics forwarding:

```bash
cd ~/msd700_noetic
./setup.sh
```

::: warning Apply Group Permissions
If the script added your user to the `docker` group, log out and back in, or run:
```bash
newgrp docker
```
:::

---

### Step 3: Review Environment Configuration (`docker/.env`)

On first launch, `./scripts/docker-manager.sh` automatically creates `docker/.env` from `docker/.env.example` and generates secure, loopback-only local MySQL passwords (`ensure_local_secrets`).

If you wish to pre-configure or review settings manually before launch:

```bash
cd ~/msd700_noetic
cp docker/.env.example docker/.env
nano docker/.env
```

Key settings in `docker/.env`:

```ini
# Storage path for map occupancy grids on the Jetson
MAPS_FOLDER_LOCAL=/home/ubuntu/ros_maps

# Local User UID/GID (leave blank to auto-detect from host `id -u` / `id -g`: Jetson=2002, dev=1000)
USER_UID=
USER_GID=

# Gazebo simulator support (set to true only for machines without MSD700 hardware)
WITH_SIMULATOR=false

# Leave UNIT_ID empty; assigned and cached automatically during cloud enrolment
UNIT_ID=

# Local Ports (Default settings for on-board local stack)
MYSQL_PORT_LOCAL=3306
MOSQUITTO_PORT_LOCAL=1883
BACKEND_PORT_LOCAL=5002
ROSBRIDGE_PORT_LOCAL=9090
FRONTEND_PORT_LOCAL=3000
MEDIA_SERVER_PORT_LOCAL=3003
SIGNALLING_PORT_WS_LOCAL=3001
SIGNALLING_PORT_HTTP_LOCAL=3002
NETWORK_AGENT_PORT_LOCAL=5011

# Optional: static IP hint (the dashboard dynamically adapts to operator browser address)
#LOCAL_IP=192.168.4.1
```

::: info Cloud Connection Routing
Cloud connection parameters (Production Cloud `https://msd.nglobal.jp/services` or Dev Cloud via `--dev`) are managed automatically by `docker-manager.sh` during launch and enrolment, and are not configured in `docker/.env`.
:::

---

### Step 4: Build Robot Docker Image

Build the ROS Noetic robot runtime container:

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh build
```

This builds the `msd700:latest` image containing ROS Noetic, navigation stacks, sensor drivers, and web bridges.

---

### Step 5: Start Robot and Complete Enrolment

Launch the robot stack in detached mode:

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh up -d
```

#### Automated Enrolment Flow:
1. On its very first launch, the robot contacts the cloud server and outputs a 6-character **Claim Code** (e.g. `K7M2QP`).
2. An administrator opens `https://msd.nglobal.jp/admin` and logs in.
3. Under **Pending Units**, locate the matching claim code, assign the unit to an active **Rental Profile**, and click **Approve**.
4. The robot receives its cryptographically signed credentials (`Certificates/robot/device.json`), binds to HiveMQ over TLS port 8883, and appears live on the fleet map.

---

### Step 6: Provision the WiFi Hotspot

Every unit broadcasts its own WiFi hotspot for an operator to connect to directly (alongside the
onboard radio staying a normal WiFi client). Plug in the validated USB WiFi dongle and run two
commands from an interactive terminal:

```bash
cd ~/msd700_noetic

# 1. Install the dongle's driver (one-time, builds via DKMS so it survives kernel upgrades)
./scripts/install-wifi-dongle-driver.sh

# 2. Provision the hotspot
./setup.sh --provision-network
```

Run directly at the keyboard (not piped or over a non-TTY session), `--provision-network` walks
through every setting create-next-app style: interface names, SSID, and password are shown as
auto-detected `[defaults]`, press Enter to accept each one, or type a new value. The hotspot
password is typed twice to confirm and is never written to `docker/.env` or any other file on disk.
The hotspot comes up on its own on every boot afterward, independent of Docker or
`docker-manager.sh`.

::: info Unattended / scripted provisioning
Without a TTY (or with `MSD700_NONINTERACTIVE=1`), the prompts are skipped and `--provision-network`
takes `docker/.env` and the environment as-is instead, so `AP_PASSWORD_LOCAL='your-hotspot-password'
./setup.sh --provision-network` still works for automation. See
[WiFi Hotspot + Client](/setup/wifi-hotspot#provisioning-the-hotspot-once-per-unit) for the full
provisioning walkthrough, the validated dongle hardware, and troubleshooting.
:::

---

## Operating the Unit Locally (Offline Mode)

When the robot operates in locations without internet connectivity, connect your laptop or tablet directly to the robot's local network, or the [robot's WiFi hotspot](/setup/wifi-hotspot) provisioned in Step 6:

1. Open your browser and navigate to: `http://<jetson-ip>:3000`.
2. The local dashboard allows full teleoperation, SLAM mapping, route creation, and area coverage sweeps.
3. When internet connectivity is restored, all locally recorded maps automatically synchronize back to the central cloud server.

---

## Advanced Configurations

<details>
<summary><b>Simulation Mode (Gazebo Warehouse)</b></summary>

To test algorithms on a laptop without physical robot hardware:

1. Build the simulator-enabled image:
   ```bash
   ./scripts/docker-manager.sh build --simulator
   ```

2. Start the simulation stack:
   ```bash
   ./scripts/docker-manager.sh up --simulator -d
   ```

</details>

<details>
<summary><b>Development Cloud Routing (`--dev`)</b></summary>

To point the unit at a development cloud server instead of production:

```bash
./scripts/docker-manager.sh up --dev -d
```

This connects MQTT to dev port `8884` and synchronizes with the development database.

**The broker hostname stays `msd.nglobal.jp` on the dev cloud too.** Dev and production are the
same machine, separated only by the published port, and the broker's TLS certificate is issued for
that name, so pointing MQTT at a bare IP would fail verification. A log line reading
`mqtts://msd.nglobal.jp:8884` is therefore the **dev** broker. Read the port, not the hostname:

| Peer | Broker | Backend | ROS master |
| --- | --- | --- | --- |
| Production (no flag) | `msd.nglobal.jp:8883` | `https://msd.nglobal.jp/services/rosbackend` | `11321` |
| Dev (`--dev`) | `msd.nglobal.jp:8884` | `http://118.22.31.252:5001` | `11322` |

::: danger Never let this unit reach the cloud's ROS master
This robot's roscore is on `11321`/`11322`, deliberately clear of the cloud server's
`11311`/`11312`. They used to share those numbers, so `localhost:11312` meant a different master
depending on the machine. A VS Code Remote session or `ssh -L` forwarding the server's port was
enough: `roscore` could not bind and quit, the readiness probe still passed because the tunnel
answered, and the whole unit stack registered on the **cloud** master. ROS kills the older node
whenever a name is claimed twice, so it evicted the server's own `/rosbridge_websocket` and
`/backend_node`; live topics vanished from the cloud dashboard (the mapping map first) while the
local dashboard looked perfectly fine. That was 2026-09-10.

Two guards now. The ports no longer overlap, and `run_msd.sh` refuses to start unless a `rosmaster`
of its own runs on that port and the master's `/msd700/stack_role` is not `cloud` (every roscore
stamps that param; `run_msd.sh` adds `/msd700/stack_host`). Cloud node names carry a `_cloud`
suffix as a last resort, so a stack that does end up on the wrong master no longer evicts anything.

```bash
ss -ltnp | grep :11322                     # who owns the port
rosparam get /msd700/stack_role            # whose master answers
src/ros-web-ui/scripts/ros_doctor.sh       # owner, foreign nodes, rosbridge, in one verdict
```

Close the forward (VS Code: PORTS panel), or move this robot with
`ROS_MASTER_PORT=11323 ./scripts/docker-manager.sh up --dev -d`.
:::

**The mode is remembered across reboots.** `up` arms `msd700.service`, and since the
September 2026 fix the `--dev` and `--simulator` flags of that `up` are written into the unit's
`ExecStart`. Before it, the boot unit re-ran a bare `up`, so a robot started with
`up --simulator --dev` came back after a reboot as **hardware, against production**. Confirm what
is armed with:

```bash
./scripts/docker-manager.sh print-autostart-unit --simulator --dev   # what would be written
grep ExecStart /etc/systemd/system/msd700.service                    # what is armed now
```

`up` also prints it: `Boot autostart armed (DEV cloud, simulator)`. Re-running `up` with different
flags rewrites the unit; `down` disarms it entirely.

</details>

<details>
<summary><b>Host Networking Fixes for Non-Ubuntu/Arch Laptops</b></summary>

If running on Arch Linux or non-standard distributions:

1. **Hostname Resolution**:
   ```bash
   grep "$(hostname)" /etc/hosts || echo "127.0.0.1 $(hostname)" | sudo tee -a /etc/hosts
   ```

2. **Disable IPv6 Loopback Mapping**:
   ```bash
   sudo sed -i 's/^::1[[:space:]].*/::1 ip6-localhost ip6-loopback/' /etc/hosts
   ```

3. **Create Shared Maps Directory**:
   ```bash
   sudo mkdir -p /home/ubuntu/ros_maps
   sudo chown -R $(id -u):$(id -g) /home/ubuntu/ros_maps
   ```

</details>

---

## Verification & Diagnostics

Use these diagnostic commands to verify robot health:

```bash
# 1. View overall container and service status
./scripts/docker-manager.sh status

# 2. Attach to the ROS tmux session inside the container
./scripts/docker-manager.sh shell
tmux attach -t robot_services

# 3. View real-time container logs
./scripts/docker-manager.sh logs -f
```

## Related Documentation

- [Server Setup](/setup/server-setup): Cloud backend installation.
- [System Setup](/setup/system-setup): Sensor calibration and verification.
- [Docker Reference](/setup/docker-reference): Comprehensive CLI syntax reference.
- [WiFi Hotspot + Client](/setup/wifi-hotspot): Full hotspot architecture, dongle hardware, and troubleshooting.
