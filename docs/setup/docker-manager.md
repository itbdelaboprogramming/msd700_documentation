---
outline: deep
---

# docker-manager.sh Guide

<RoleBadge role="technician" />

`scripts/docker-manager.sh` is the one command for running a unit. It builds the images, starts and stops the robot container and the unit's own server stack, enrols the robot, and arms boot autostart. Run it **on the unit**, from the workspace root:

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh <command> [flags]
```

- Flags go before or after the command, in any order: `up -d --dev` is the same as `--dev up -d`.
- No arguments prints the help. Flags without a command mean `up`.
- `build up` is the same as `up --build`.
- Flags this script does not know are passed unchanged to `run_msd.sh`, the ROS 1 session runner inside the container.
- `./scripts/docker-manager.sh help` prints the built-in help.

Compose files, images and volumes behind these commands are in the [Docker Reference](/setup/docker-reference#unit-docker-manager-sh).

## Common tasks

| Task | Command |
| --- | --- |
| Start the robot on the production cloud and get the terminal back | `up -d` |
| Start it on the dev cloud | `up --dev -d` |
| Start the ROS 2 robot (msd_system) | `up --ros2 -d` |
| Start the Gazebo simulator (laptop, no hardware) | `up --simulator -d` |
| Start the ROS 2 robot in Gazebo | `up --ros2 --simulator -d` |
| Stop everything | `down` |
| Use new code after `git pull` | `build`, then `down` and `up -d` ([what needs a rebuild](/setup/docker-reference#what-needs-a-rebuild)) |
| Open a shell in the robot container | `shell` (ROS 2: `shell --ros2`) |
| Follow the robot container's output | `logs` |
| See whether the containers run | `status` and `local-status` |
| Restart only the web stack, robot untouched | `local-down`, then `local-up` |
| Register the robot with the cloud again | `reenroll` |
| See what a reboot will start | `print-autostart-unit` |

## Commands

### `up`

Starts the robot container and the unit's local stack, then runs the robot session inside the container (`run_msd.sh` on ROS 1, `run_ros2.sh` with `--ros2`).

- **Builds nothing** unless `--build` is given or an image is missing altogether, so it works offline. An out-of-date image only prints `[WARN] ... is OUT OF DATE` and starts anyway.
- **Enrols** a robot that has no identity yet: it prints a claim code for an admin to approve ([Unit Setup Step 5](/setup/unit-setup#step-5-start-the-robot-and-enrol)).
- **Holds the terminal** without `-d`: Ctrl-C, or the session ending, stops everything like `down`.
- **Arms boot autostart**: installs and enables `msd700.service` with this run's mode flags (`--dev`, `--simulator`, `--ros2`), so a reboot starts the same robot on the same cloud. `--no-autostart` skips this.
- **Refuses** while another robot container runs (`msd700`, `msd700_simulator`, `msd_system` or `msd_system_simulator`). Run `down` first.
- **Never recreates** a running container, even after a build. To start on a new image: `down`, then `up`.

### `down` / `stop`

Stops and removes every robot container (`msd700`, `msd700_simulator`, `msd_system`, `msd_system_simulator`) and the local stack, and disables `msd700.service`. Maps, the local database, credentials and the ROS 2 build volumes are kept. `--no-autostart` leaves the service enabled.

### `build`

Builds everything the unit needs while it is online, so later `up` runs need no internet:

- ROS 1: the robot image `msd700:latest` (or `msd700-simulator:latest` with `--simulator`) with its `catkin build`, the local stack images `ros-noetic-webui-app-local:latest` and `ros-dashboard-next-local:latest`, and pulls MySQL and Mosquitto. The three images build in parallel; `BUILD_PARALLEL=false` builds them one at a time on a unit short on memory.
- ROS 2 (`--ros2`): `msd_system:pc` from `src/msd_system/Docker/Dockerfile.pc`, the `msd_system:robot` layer on top, and pulls Mosquitto.

Python, launch and Node edits need no build: `src/` and `ros-web-ui/source` are mounted into the containers, so `up` runs them.

### `build-clean`

Same as `build`, without the Docker layer cache. The apt, pip, npm and ccache download caches are kept. With `--ros2` it also removes the ROS 2 build volumes, so the next start compiles from scratch; this works only while the `msd_system` container is gone, so run `down` first.

### `shell`

Opens a bash login shell in the robot container and starts the container if it is not running. Give the same mode flag as `up` to reach that container: `shell --simulator`, `shell --ros2`.

### `logs`

Follows the robot container's output. Ctrl-C stops following; the robot keeps running. The session's own logs per tmux window are in `logs/` ([run_msd.sh windows](/setup/docker-reference#unit-run-msd-sh)).

### `status`

`docker compose ps` for the robot container. Add the mode flag (`--ros2`, `--simulator`) to see that container. `local-status` shows the local stack.

### `reenroll`

Registers the robot with the cloud again when the cloud no longer knows it: the unit was deleted in the console, or its credentials are gone. If the unit still exists in the console, ask an admin to press **Unbind** instead; that keeps the unit's ULID and every map in the cloud.

It shows the current unit id and sync state, then:

1. Backs up the unit's maps and credentials to `unit_backups_local/`. This needs the local stack up (`local-up`).
2. Deletes `device.json`, its copy in `identities/`, and `token.cred`.
3. Asks you to type the unit id to confirm.

The next `up` prints a claim code. Options: `--fresh`, `--no-archive`, `-y` (below).

### `print-autostart-unit`

Prints the `msd700.service` that `up` would install for the given flags, without installing it. Use it on a unit where `up` cannot run sudo, or to check a mode before arming it:

```bash
./scripts/docker-manager.sh print-autostart-unit --ros2 --dev   # what would be written
grep ExecStart /etc/systemd/system/msd700.service               # what is armed now
```

### `local-up`, `local-down`, `local-build`, `local-logs`, `local-status`

Act on the unit's server stack only (database, MQTT broker, backend and rosbridge, network agent, media, signalling, dashboard), never the robot. `up` already starts this stack; use these to restart or rebuild only the web half. With `--ros2`, `local-up` starts only the MQTT broker.

### `help`

Prints the built-in help (also `-h`, `--help`, or no arguments).

## Flags

### `--ros2`

Runs the ROS 2 robot ([msd_system](/ros2-msd-system/), Jazzy) instead of the ROS 1 robot (`msd700_robot`, Noetic).

- **Use with:** `build`, `build-clean`, `up`, `shell`, `logs`, `status`, `local-up`, `print-autostart-unit`.
- **What changes:** image `msd_system:robot`, container `msd_system`, session runner `run_ros2.sh`. The local stack runs only its MQTT broker, so drive the robot from the cloud dashboard.
- **First start** compiles the workspace in the container (`colcon build`, offline); it is kept in volumes for later starts.
- **Same identity:** uses the same credentials as ROS 1, so the unit keeps its ULID.
- **With `--simulator`:** the same robot in Gazebo (see `--simulator` below).

```bash
./scripts/docker-manager.sh build --ros2
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up --ros2 -d
```

Full walkthrough: [Unit Setup § Switching to the ROS 2 stack](/setup/unit-setup#ros2-stack).

### `--simulator`, `-s`

Runs the Gazebo simulator image (`msd700-simulator:latest`, container `msd700_simulator`) instead of the hardware robot. For a laptop with no robot attached. Build it first with `build --simulator`, which also downloads the simulator worlds. `MSD700_SIM_HEADLESS=true` in `docker/.env` runs Gazebo without its window.

With `--ros2` it runs msd_system's own simulation (`msd_sim`) instead:

- **Same image.** `msd_system:pc` already carries Gazebo, so `build --ros2` is enough. Only the container differs: `msd_system_simulator`.
- **What runs.** The `bringup` window starts `msd_sim` through `msd_bringup.launch.xml`, without navigation, which the bridge starts per mode as on the robot. The bridge uses its `sim` profile.
- **World.** `MSD_ROS2_SIM_WORLD` picks a file from `msd_sim/worlds/` (for example `campus_hall.sdf`) or an absolute path. Empty: msd_bringup's default.
- **Always with a window.** `MSD700_SIM_HEADLESS` does not apply: `msd_sim` has no headless option yet.

```bash
./scripts/docker-manager.sh build --ros2
./scripts/docker-manager.sh up --ros2 --simulator -d
```

- **Use with:** `build`, `build-clean`, `up`, `shell`, `logs`, `status`, `print-autostart-unit`.
- Baked into `msd700.service`, so a reboot does not come back as a hardware robot.

### `--dev`

Connects to the **dev cloud** instead of production:

| | Production (no flag) | Dev (`--dev`) |
| --- | --- | --- |
| Backend | `https://msd.nglobal.jp/services/rosbackend` | `http://118.22.31.252:5001` |
| MQTT broker | `msd.nglobal.jp:8883` | `msd.nglobal.jp:8884` |
| Robot's own ROS master (ROS 1) | `11321` | `11322` |

- The unit keeps a separate identity per cloud. The first `up --dev` on a unit registered with production prints a claim code and waits for the dev admin ([one robot, two clouds](/development/webui/accounts/enrolment#one-robot-two-clouds)).
- The local stack and local dashboard run either way.
- Baked into `msd700.service`, so a reboot comes back on dev.
- `DEV_SERVER_HOST` and `DEV_BACKEND_PORT` move the dev backend.

### `--build`

With `up`: rebuild the images first, then compile the workspace in the container (`catkin build` on ROS 1, `colcon build` on ROS 2). Needs internet. A container that is already running keeps its old image, so run `down` first:

```bash
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up --build -d
```

### `-d`, `--detach`

With `up` only. Startup still runs in the foreground, so build output, the claim code and errors stay visible, and Ctrl-C before the robot is up aborts and cleans up. Once everything runs, the terminal returns, and closing it (or the ssh session) no longer stops the robot.

Without `-d`, the terminal stays attached and Ctrl-C stops everything. To look at a detached session later:

```bash
docker exec -it msd700 tmux attach -t robot_services       # ROS 1 (msd700_simulator for the simulator)
docker exec -it msd_system tmux attach -t robot_services   # ROS 2
# leave it running: Ctrl-b, then d
```

`-d` is **not** debug: use `--debug` in full for that.

### `--no-autostart`

With `up` or `down`: leave `msd700.service` as it is. `up --no-autostart` does not arm the service, and `down --no-autostart` does not disarm it (the service itself calls `down` this way). Use it for a test run that must not survive a reboot. A service armed earlier stays armed with its old flags.

### `--debug`

Passed to `run_msd.sh` (ROS 1): verbose output. Type it in full; `-d` means detach here.

### `--dry-run`

Passed to the session runner, which prints the commands it would launch instead of starting the session. **Not a safe preview:** the containers still start, `msd700.service` is still armed (add `--no-autostart`), and on ROS 1 it can kill a running session and contact enrolment. On ROS 2 it skips enrolment, compiles the workspace if needed, prints the three window commands and exits.

### `--kill`

Passed to the session runner: kills the robot's tmux session inside the container and exits. To stop everything, use `down` instead.

### `--fresh`

With `reenroll` only. Also wipes the local cache (`mysql_data_local`, `media_data_local`, `mosquitto_data_local`). For a robot going out on a **new** rental. Without it the cache is kept and a full sync reconciles it.

### `--no-archive`

With `reenroll` only. Skips the backup. Safe only when the unit has synced everything; otherwise maps recorded offline are lost.

### `-y`, `--yes`

With `reenroll` only. Asks nothing, including the unit id confirmation, and continues without a backup if the backup fails.

### `--local` (deprecated)

Accepted and ignored. The local stack starts either way; kept so old scripts do not break.

### `--unit_id` (rejected)

Removed on purpose and fails with an explanation. Identity comes from the cloud admin console: a new robot prints a claim code, and an admin registers it or adopts it onto an existing ULID.

### Other flags

Anything else goes to `run_msd.sh` unchanged, for example `--camera_device /dev/video2` or `--no-build`. The full list is in [Docker Reference § run_msd.sh](/setup/docker-reference#unit-run-msd-sh). With `--ros2` they are dropped with a warning, since `run_ros2.sh` knows only `--dry-run` and `--kill`.

## Rules

- **One robot stack at a time.** ROS 1, the simulator and ROS 2 share the host network, `/dev` and the unit identity.
- **Mode flags pick the robot.** `--dev`, `--simulator` and `--ros2` decide which robot runs where. Give the same ones to `shell`, `logs` and `status`; `up` bakes them into `msd700.service`.
- **A misplaced flag warns and is ignored**, for example `-d` on anything but `up`, or `--fresh` on anything but `reenroll`.

## Environment variables

Set them inline (`VAR=value ./scripts/docker-manager.sh up -d`) or in `docker/.env`, which the script reads. The most used:

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLOUD_BASE_URL` | production or dev backend | Point the unit at another cloud |
| `DEV_SERVER_HOST`, `DEV_BACKEND_PORT` | `118.22.31.252`, `5001` | Where `--dev` points |
| `ROS_MASTER_PORT` | `11321`, `11322` with `--dev` | The robot's own ROS master. Never the cloud's `11311`/`11312` |
| `BUILD_PARALLEL` | `true` | `false` builds the images one at a time |
| `ENROLL_CODE` | unset | Single-use registration code, skips the pending list |
| `MSD_ROS2_PROFILE` | `prototype` (`sim` with `--simulator`) | ROS 2 bridge profile: `prototype` or `sim` |
| `MSD_ROS2_BRINGUP_CMD` | empty | ROS 2: command for the `bringup` window, for example navigation |
| `MSD_ROS2_WEBUI_ARGS` | empty | ROS 2: extra arguments for `webui.launch.py` |
| `MSD_ROS2_SIM_WORLD` | empty | ROS 2 simulator: world file in `msd_sim/worlds/` or an absolute path |

Every variable: [Docker Reference § Environment variables it forwards](/setup/docker-reference#environment-variables-it-forwards) and [Unit `.env` reference](/setup/docker-reference#unit-env-reference).
