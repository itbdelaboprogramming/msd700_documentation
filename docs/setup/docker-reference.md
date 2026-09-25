---
outline: deep
---

# Docker Reference

<RoleBadge role="technician" />

Every Docker command, flag, and compose construct in MSD700, and what each one does. This is the reference the setup pages link to: follow [Server Setup](/setup/server-setup) and [Unit Setup](/setup/unit-setup) for the order of steps, come here when a flag or construct needs explaining.

## Which compose file?

Three files, three different jobs. They are not interchangeable.

| File | Runs on | Brings up |
| --- | --- | --- |
| `ros-web-ui/docker-compose.yml` | the **Server** | whole cloud stack: MySQL, HiveMQ, backend + rosbridge, media, signalling, dashboard, coturn |
| `msd700_noetic/docker/docker-compose.yml` | a **Unit** | the `msd700` robot container + the unit's own `local_dev` server stack |
| `ros-web-ui/docker-compose.robot.yml` | a dev laptop | robot half alone, standalone, no unit orchestration |

![Which compose file?](./diagrams/docker-reference-which-compose-file.drawio)

## Server: compose profiles

Compose runs a service when **any** of its profiles is active. Nothing starts without a profile: bare `docker compose up -d` in this repo does nothing useful.

| Profile | Services | Purpose |
| --- | --- | --- |
| `server_prod` | `db`, `hivemq`, `fix_perms_prod`, `nakayama_cloud`, `unit_relays`, `nakayama_media`, `nakayama_signalling`, `frontend_prod`, `coturn` | Live deployment |
| `server_dev` | `db_dev`, `hivemq_dev`, `fix_perms_dev`, `nakayama_cloud_dev`, `unit_relays_dev`, `nakayama_media_dev`, `nakayama_signalling_dev`, `frontend_dev` | Parallel stack: different ports, different database |
| `turn` | `coturn` only | Relay alone, without touching the rest of prod |
| `manual` | `dev`, `aws`, `hive`, `hive_serverless`, `nakayama_msd`, `nakayama_msd_sim` | Interactive shell + legacy services. Pick one explicitly; never start the whole profile |

::: warning `coturn` is in two profiles on purpose
`profiles: ["server_prod", "turn"]` means prod `up` brings the relay along, **and** you can start it alone with `--profile turn`. It is **not** in `server_dev`: one relay instance, belongs to prod. Sharing is safe because a relay holds no state; peers find each other through the signalling servers, which **are** split (3001 prod, 4001 dev).
:::

### Service and port map

| Service | Container | Network | Host port | Notes |
| --- | --- | --- | --- | --- |
| `db` / `db_dev` | `ros_web_ui_v2_db[_dev]` | bridge | `3307` / `3308` | Healthchecked; backend waits on it |
| `hivemq` / `hivemq_dev` | `ros_web_ui_v2_hivemq[_dev]` | bridge | `8883` / `8884` | Inside the container both use `8883` |
| `nakayama_cloud[_dev]` | `ros_web_ui_v2_nakayama_ros[_dev]` | **host** | `5000`/`5001` API, `9090`/`9091` rosbridge, `11311`/`11312` ROS master | One shared ROS graph per environment |
| `unit_relays[_dev]` | `ros_web_ui_v2_unit_relays[_dev]` | **host** | none (relay) | One data plane shared by all units (default) |
| `nakayama_media[_dev]` | `ros_web_ui_v2_nakayama_media[_dev]` | **host** | `3003` / `4003` | |
| `nakayama_signalling[_dev]` | `ros_web_ui_v2_nakayama_signalling[_dev]` | **host** | `3001`/`4001` WS, `3002`/`4002` HTTP | |
| `frontend_prod` / `frontend_dev` | `ros_web_ui_v2_frontend[_dev]` | bridge | `3000` / `3100` | Apache catch-all points at `3000` |
| `coturn` | `ros_web_ui_v2_coturn` | **host** | `3478` + relay range | Prod only |

## Compose command reference

### Starting services

```bash
# Normal case: whole profile, detached
docker compose --profile server_prod up -d

# Rebuild images first, then start (needed after pulling code changes)
docker compose --profile server_prod up -d --build

# One service from the profile
docker compose --profile server_prod up -d nakayama_cloud

# Relay alone, nothing else in prod touched
docker compose --profile turn up -d coturn
```

| Flag | Effect | When to use |
| --- | --- | --- |
| `--profile <name>` | Activates a profile (repeatable) | Whole stacks; targeting a service also activates it |
| `-d` | Return to shell instead of streaming logs | Always, except when debugging a startup failure |
| `--build` | Rebuild images before starting | After app source, dependency, or Dockerfile changes (server services don't bind-mount `source/`) |
| `--force-recreate` | Recreate containers even if unchanged | Targeted recovery; prefer over whole-project teardown |
| `--no-deps` | Start a service without its `depends_on` chain | Debugging with a dependency deliberately down |
| `--remove-orphans` | Delete containers of removed services | After a service is renamed/removed |
| `--pull always` | Pull images before `up` | Refreshing image tags (not pinned versions or Dockerfile bases; `build --pull` covers those) |

### Building

```bash
docker compose --profile server_prod build          # all services in profile
docker compose build nakayama_cloud                 # one service
docker compose build --no-cache nakayama_cloud      # ignore cached layers
docker compose build --progress plain nakayama_cloud # full output
```

`--no-cache` is for builds that "succeed" but serve stale content (a cached `COPY` / `apt-get` layer). Slow; use only after a normal build failed to pick the change up.

### Inspecting

```bash
docker compose ps                        # this project's services + health
docker compose ps -a                     # including stopped
docker compose logs -f nakayama_cloud    # follow one service
docker compose logs --tail=200 hivemq    # last 200 lines
docker compose logs --since=10m          # last 10 minutes
docker compose exec nakayama_cloud bash  # shell in a RUNNING container
docker compose --profile server_dev config --quiet    # validate without dumping
docker compose --profile server_dev config --services # list service names
```

`compose run` takes a **service name**, not an image. There is no service named `busybox`.

::: warning Keep diagnostics secret-safe
Plain `config`, `config --environment`, full `inspect`, and logs can hold credentials. Never paste them into tickets/chats. Check only the fields you need; redact passwords, tokens, and auth headers first.
:::

### Stopping and removing

```bash
docker compose --profile server_prod stop   # stop, keep containers
docker compose --profile server_prod down   # stop AND remove containers + networks
docker compose down --remove-orphans        # also drop deleted services' containers
docker compose down -v                      # ALSO DELETES NAMED VOLUMES
```

::: danger `down -v` deletes HiveMQ's data
`ros_webui_hivemq_data_prod` holds retained messages, client sessions, queued QoS>0 messages. Almost never use `-v` here. To clean a broker, delete that one volume by name, on purpose.
:::

## Compose constructs in this project

Each construct below exists because removing it broke something real.

### YAML anchors (`x-common-env`, `<<: *`)

```yaml
x-common-env: &common-env
  ROS_DISTRO: "noetic"
  MAPS_FOLDER: "${MAPS_FOLDER:-/home/ubuntu/ros_maps}"

x-common-env-prod: &common-env-prod
  <<: *common-env          # inherit, then override
  PORT_SQL: "${MYSQL_PORT_PROD:-3307}"
```

`&name` defines an anchor, `*name` uses it, `<<:` merges it. `${VAR:-default}` means: use `VAR` if set and non-empty, else the default.

### `network_mode: host`

Used by every ROS-carrying service and `coturn`. The container shares the host's network: no port mapping, no NAT, `localhost` inside is the host.

| Service | Why host networking |
| --- | --- |
| `nakayama_*` | ROS 1 nodes negotiate random ports with each other. Bridged networking breaks the master's returned URIs. |
| `coturn` | A relay hands out one port per allocation. Publishing a 16k-port range through the bridge spawns one `docker-proxy` per port and takes the machine down. The bridge also adds a second NAT layer, breaking the address the TURN server must advertise. |

### `depends_on` conditions

```yaml
depends_on:
  db:
    condition: service_healthy
  fix_perms_prod:
    condition: service_completed_successfully
```

| Condition | Meaning |
| --- | --- |
| `service_started` | Default. Only waits for the container to exist. Rarely enough. |
| `service_healthy` | Waits for the `healthcheck` to pass. Stops the backend racing MySQL (`Connection lost`). |
| `service_completed_successfully` | Waits for a one-shot to exit `0`. Used for the permissions fixer. |

### The one-shot permissions fixer

```yaml
fix_perms_prod:
  image: busybox
  profiles: ["server_prod"]
  network_mode: "none"
  user: root
  volumes:
    - /srv/msd/media/map:/srv/msd/media/map
  command: >
    sh -c "mkdir -p ... && chown -R $$USER_UID:$$USER_GID ..."
```

A missing bind-mount folder is auto-created **by the Docker daemon, as root**. App containers run unprivileged, so their first write fails. This root container runs first and fixes ownership, so a fresh host self-corrects.

::: warning `network_mode: "none"` is load-bearing
Without it, Compose attaches the service to the project default network, recorded by **ID**. After any `down` recreates that network (two checkouts share the project name `ros-web-ui`, so either can trigger it), the fixer can never start again (`network <old-id> not found`), and every service behind `service_completed_successfully` refuses to come up. It only mkdirs and chowns; it never needed networking.
:::

### `user:` and `group_add:`

```yaml
user: "itbdelabo"
group_add:
  - "${DOCKER_GID:-998}"
```

`group_add` puts the container user in the host's `docker` group so `backend_node` can use the mounted `/var/run/docker.sock`: multi-unit mode keeps the shared relay in step with the roster; legacy mode manages per-unit containers. Get the value with `getent group docker | cut -d: -f3` on the host.

HiveMQ uses `user: "1001:0"` instead, and both halves matter: uid `1001` owns the `0600` keystore (the container must *be* that user to read its key); gid `0` satisfies the image's writability check on `/opt/hivemq` without chowning anything.

### Long-syntax bind mounts

```yaml
- type: bind
  source: ${HIVEMQ_KEYSTORE:-/srv/msd/secrets/hivemq/keystore.p12}
  target: /opt/hivemq/conf/keystore.p12
  read_only: true
  bind:
    create_host_path: false
```

The long form is here only for `create_host_path: false`. Docker's default **creates** a missing bind source, and for a single file it creates a **directory**. A missing keystore would then fail deep in HiveMQ startup as an unreadable-key error instead of failing at `up` with "file not on host". Failing at `up` is the honest outcome.

### Named volumes vs bind mounts

| Path | Kind | Why |
| --- | --- | --- |
| `./mysql_data/prod` | bind | Lives in the repo, backed up with it |
| `hivemq_data_prod`, `hivemq_log_prod` | named volume | Docker-owned, seeded from image on first use, survive `rm -rf` under `$HOME` |
| `./Docker/hivemq/config.xml` | bind, `:ro` | Config belongs in git |
| `/srv/msd/secrets/...` | bind, `:ro` | Secrets never enter an image |

::: danger A bind mount hides the image's own folder
An empty host folder mounted over a config folder is not a degraded service: it is one that cannot start (`config.xml does not exist`). That is why the host holds nothing a broker needs to boot.
:::

### Healthchecks

```yaml
healthcheck:
  test: ["CMD", "bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 60s
```

Two details worth copying. It probes HiveMQ's **Control Center** port (8080), not MQTT: a bare TCP probe on the MQTT port closes before `CONNECT`, and HiveMQ logs each one as `disconnected ungracefully` (~2880 junk lines/day in the audit log). Same JVM, so 8080 is a good liveness signal.

It says `bash` explicitly because `/bin/sh` there is `dash`, which lacks `/dev/tcp` and fails every probe.

### Log rotation

```yaml
logging:
  driver: json-file
  options:
    max-size: "20m"
    max-file: "3"
```

In the **server** file only `coturn` sets this cap (its config logs allocations verbosely). Other server services use daemon defaults; changing that means recreating every touched service, so do it on purpose, not incidentally. The **unit** file differs: every service caps at 20 MB x 3 via the `x-local-logging` anchor.

### Image tags

| Tag | Used by |
| --- | --- |
| `ros-noetic-webui-app-v2:latest` | prod services (incl. unit relay) + legacy prod per-unit containers |
| `ros-noetic-webui-app-v2:dev` | dev services (incl. dev unit relay) + legacy dev per-unit containers |
| `ros-dashboard-next-v2:prod` / `:dev` | the two dashboard builds |
| `ros-noetic-webui-app-local:latest` | unit's own backend, media, signalling, network agent |
| `ros-dashboard-next-local:latest` | unit's own dashboard |
| `msd700:latest` / `msd700-simulator:latest` | robot container |

::: warning Prod and dev must never share a tag
Both profiles once built `:latest`. A dev build then silently changed what production would run on next recreate. Tags are split now, and `UNIT_IMAGE` is set per profile so legacy dev containers run dev code.
:::

## coturn: the production-only service

### Configuration

Per-host values go in as **flags**, not in the config file: coturn expands no environment variables in its config. Flags beat the file, so shared policy stays in git and addresses stay in `.env`.

```bash
# ros-web-ui/.env
TURN_LISTENING_IP=192.168.100.10     # this host's own LAN address
TURN_EXTERNAL_IP=118.22.31.252       # PUBLIC address, seen from the internet
TURN_USER=msd700
TURN_PASSWORD=<a long random string>
TURN_MIN_PORT=49152                  # optional, coturn default
TURN_MAX_PORT=65535                  # optional
```

All four first values are checked at **container start**, not by Compose `${VAR:?}` syntax. Compose interpolates every service regardless of profile, so a required variable here would break `--profile server_dev up` for a relay nobody asked to start.

::: warning `TURN_EXTERNAL_IP` breaks video silently
Without it, coturn advertises its private address. Every browser outside the LAN tries an unroutable address, and the camera feed never appears, with no dashboard error.
:::

### Running it

```bash
# Prod: comes up with the stack
docker compose --profile server_prod up -d

# Relay alone (restart, or start before joining the stack)
docker compose --profile turn up -d coturn

# Watch allocations (verbose logging to stdout)
docker compose logs -f coturn

# Stop just the relay
docker compose --profile turn stop coturn
```

### Dev stacks and the relay

`server_dev` excludes `coturn`, correctly. Testing WebRTC against dev? The dev signalling server (`4001`) hands peers the **prod** relay's address. One relay, shared, stateless: exactly what you want.

No prod relay running and you need one? Start it explicitly:

```bash
docker compose --profile turn up -d coturn
```

### Moving off apt/systemd coturn

If this host still runs coturn under systemd, order matters once. Port 3478 fits only one holder.

```bash
sudo systemctl disable --now coturn                 # 1. free the port
docker compose --profile turn up -d coturn          # 2. prove the container works
docker compose logs -f coturn                       # 3. confirm it listens
docker compose --profile server_prod up -d          # 4. now it's just another prod service
```

A prod `up` while systemd still holds the port fails to bind, then `restart: always` retries forever: noisy, harmless, far from its cause.

## Unit: `docker-manager.sh`

The unit never calls `docker compose` directly. `scripts/docker-manager.sh` wraps it, deciding shared values **once** and handing them to both halves (robot container + unit server stack) so they can't disagree.

### Commands

| Command | What it does |
| --- | --- | --- |
| `up` | Start robot container **and** `local_dev` stack, run `run_msd.sh` inside. Installs/enables `msd700.service` for reboot |
| `down` / `stop` | Stop and remove robot container + local stack, disable `msd700.service` |
| `build` | Build robot image + local stack images, pull MySQL/Mosquitto, so next `up` needs no internet |
| `build-clean` | Same, no Docker layer cache |
| `shell` | Bash login shell in the running container (starts it if needed) |
| `logs` | Follow robot container logs |
| `status` | `docker compose ps` for the robot container |
| `local-up` | Local server stack only, no robot bringup |
| `local-down` | Stop local server stack only |
| `local-build` | Rebuild local stack images |
| `local-logs` | Tail local stack logs |
| `local-status` | `docker compose ps` for the local stack |
| `reenroll` | Back up unit data, clear cached identity; next `up` prints a claim code. Prefer admin **Unbind** if the unit still exists in the console |
| `print-autostart-unit` | Print the rendered `msd700.service`, for installs where `up` can't sudo |
| `help` | Full flag + environment help |

### Flags

| Flag | Applies to | Effect |
| --- | --- | --- |
| `--simulator`, `-s` | `build`, `up` | Gazebo image (`msd700-simulator:latest`) + container. Also forwarded to `run_msd.sh`, which sets `use_simulator_val:=true` |
| `--dev` | `up` | Peer cloud: dev stack instead of production. MQTT 8884, this robot's ROS master 11322, dev backend enrolment |
| `--build` | `up` | Rebuild robot/local images + in-container catkin workspace. A running robot keeps its old image until recreated |
| `--no-autostart` | `up`, `down` | Leave `msd700.service` alone (`up` enables boot autostart, `down` disables it) |
| `-d` | `up` only | Return the terminal once everything runs |
| `--debug` | forwarded | `run_msd.sh` verbose. **Type in full**: `-d` here means detach |
| `--dry-run` | forwarded | Not a safe preview: still starts containers, changes host state, can kill the session and contact enrolment |
| `--kill` | forwarded | Kill the tmux session in the container |
| `--local` | accepted, ignored | Deprecated. Local stack starts either way |
| `--fresh` | `reenroll` only | Also wipe the local cache (`mysql_data_local`, `media_data_local`, `mosquitto_data_local`). For a robot going out on a **new** rental; without it the cache is kept and a full sync reconciles it |
| `--no-archive` | `reenroll` only | Skip the backup. Safe only if the unit has synced everything it holds; otherwise offline maps are lost |
| `-y`, `--yes` | `reenroll` only | No prompts, including the unit-id confirmation |
| `--unit_id` | **rejected** | Removed on purpose. Identity comes from the cloud admin console |

::: info What `-d` changes (and doesn't)
Startup still runs in the **foreground**: image build, claim code, failures all show, and Ctrl-C before services are up aborts and tears down the half-started stack. Only the end changes: once everything runs, the command returns, and closing the terminal no longer stops the robot. This is the form for systemd units and `ssh` one-liners.
:::

::: danger `--unit_id` is rejected, not ignored
It errors with an explanation. A robot with no cached identity self-enrols and prints a claim code; an admin **registers** it (new unit) or **adopts** it onto an existing ULID (hardware swap, lost cache) in the cloud console. Both need internet at that moment. Afterward `Certificates/robot/device.json` loads automatically every run.
:::

### Environment variables it forwards

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEVICE_FINGERPRINT` | derived from the **host** | sha256 of Jetson serial (or machine-id / first real MAC) + model. Read on the host so a rebuilt container doesn't reappear as a new pending unit |
| `ENROLL_SERVER_URL` | derived | Override the enrolment endpoint outright |
| `ENROLL_BOOTSTRAP_KEY` | unset | Shared image key. Trust marker in the console, never a gate |
| `ENROLL_CODE` | unset | Single-use registration voucher, skips the pending pool |
| `DEV_SERVER_HOST` | `118.22.31.252` | Where `--dev` points (`localhost` when running on that host) |
| `DEV_BACKEND_PORT` | `5001` | Backend port for `--dev` |
| `CLOUD_BASE_URL` | derived | Point every unit at another cloud without code change |
| `ROS_MASTER_PORT` | `11322` with `--dev`, else `11321` | Given to **both** container and `backend_local`. Never the cloud's `11311`/`11312` |
| `BACKEND_PORT_LOCAL` | `5002` | Local dashboard's backend port; `camera_client` fetches a unit-local token here |

`CLOUD_BASE_URL` and `ROS_MASTER_PORT` are resolved once and passed to both halves. They used to be derived separately on each side, which is how `--dev` broke: `run_msd.sh` moved the master while `backend_local` asked for the old port. Same rule inside `run_msd.sh` for enrolment: one `ENROLL_BASE_URL` serves both boot-time identity resolution and the 6-hour token refresher (they once diverged and every refresh failed with `401 reenroll`).

### What `up` does, in order

![What up does, in order](./diagrams/docker-reference-what-up-does-in-order.drawio)

Without `--build`, existing local images are reused and stale ones only warn (`[WARN] ... is OUT OF DATE`). Missing images, simulator assets, and first enrolment can still need internet. Rebuild on purpose (`build`, `local-build`, or `up --build`); `build-clean` drops the cache. A running robot is never recreated by `up`, even after a build: recreate it during a planned stop with the same `--dev`/`--simulator` flags.

Three steps exist because of silent failures:

- **Token file first.** Four services bind-mount `Certificates/robot/token.cred`. On a never-enrolled robot Docker creates a root-owned empty **directory** there, `enroll.py` can't write the earned token, and the robot re-enrols every boot.
- **Refresher never deletes identity.** On `401 reenroll` it logs and stops, keeping `device.json`. Only a real boot may clear it. Deleting it on any refresh failure once forced full admin re-approval nearly every restart.
- **Staleness check.** Local web images **COPY** source in (no bind mount). Source mtimes are compared against image build time, so the unit can notice it serves last week's backend (the classic "new endpoint 404s though source has it").

### Boot autostart (`msd700.service`)

`up` installs and enables a systemd unit (rendered from `msd700.service.tmpl`); `down` disables it. The rendered `ExecStart` runs `docker-manager.sh up -d --no-autostart` **with the flags of the `up` that armed it** (`--dev`/`--simulator` baked in), so a reboot never silently flips a dev/simulator robot to prod/hardware. `Type=oneshot`, `RemainAfterExit=yes`, after `docker.service`, 15-minute start timeout. Inspect with `print-autostart-unit` (or `grep ExecStart`); `--no-autostart` opts out; skipped automatically with no systemctl or inside a container.

### `manage-unit.sh` (server-side, manual/debug only)

Drives **legacy per-unit** cloud containers by ULID only (names rejected): `start|stop|restart|status|logs|list|loop`. `loop` polls every 10 s for the 7 expected relay nodes and restarts on missing. Normally unneeded: the backend auto-starts/stops unit containers on dashboard open plus idle timeout. Never use it on a unit in multi-unit mode.

## Unit: `run_msd.sh`

Runs **inside** the robot container, launching every ROS service in a tmux session (`robot_services`). Normally driven by `docker-manager.sh`; callable directly from `docker-manager.sh shell`.

| Flag | Effect |
| --- | --- |
| `-s`, `--simulator` | Gazebo instead of hardware |
| `--dev` | All dev: MQTT 8884, this robot's ROS master 11322, dev signalling + enrolment. The unit's **own** service ports don't move |
| `-d`, `--debug` | Verbose output |
| `-n`, `--dry-run` | Not read-only: skips some launches/builds but still runs setup, kills the tmux session, can contact enrolment |
| `-k`, `--kill` | Kill tmux session, exit |
| `--detach` | Start everything, print status, exit. Long form only |
| `--unit_id <ULID>` | Pin identity explicitly. Recovery override |
| `--camera_device <path>` | Override camera device path/index |
| `--build` / `--no-build` | Force/skip catkin build; default builds only if `devel/setup.bash` is missing |

| Environment | Default | Purpose |
| --- | --- | --- |
| `SERVICE_HOST` | `localhost` | Where this robot's server-side services live |
| `ROS_LOG_CAP_MB` | `512` | Cap for `~/.ros/log`, which ROS 1 never rotates |
| `ROS_LOG_SWEEP_SECONDS` | `60` | Janitor check interval |

These are **inner-launcher** settings. The wrapper doesn't forward them through `docker exec`; host exports or `docker/.env` entries don't reach the inner launcher. Log trees and limits: [Maintenance](/setup/maintenance#log-housekeeping).

tmux windows in `robot_services` (`robot_services` session, startup order `roscore → log_janitor → token_refresh → launch mode → the rest`):

| Window | Log | Purpose |
| --- | --- | --- |
| `roscore` | `logs/roscore.log` | Private unit roscore (11321 / 11322 `--dev`), started before enrolment |
| `ros_webui` | `logs/ros_webui.log` | `bringup_msd.launch` hardware or simulator + `unit_id:=` |
| `camera_client` | Python `RotatingFileHandler` into `$LOGDIR` (not piped) | `camera_client.py`, cloud + local signalling targets |
| `switch_mode` | `logs/switch_mode.log` | `switch_mode.launch` |
| `log_janitor` | `logs/log_janitor.log` | Bounds `~/.ros/log` to `ROS_LOG_CAP_MB` (512) every `ROS_LOG_SWEEP_SECONDS` (60) |
| `token_refresh` | `logs/token_refresh.log` | `enroll.py --refresh` every 6 h (half the 12 h token); must target the enrolment backend |
| `enrol_collect` | `logs/enrol_collect.log` | Conditional only: while re-enrolment waits for admin approval |

Piped logs cap at ~50 MB each (5×10 MB rotatelogs). Symptom → window: MQTT bridge silent → `ros_webui`; no video → `camera_client`; token/enrol loop → `token_refresh`/`enrol_collect`; disk filling → `log_janitor`.

```bash
docker exec -it msd700 tmux attach -t robot_services   # attach
# Ctrl-b then d to detach without stopping anything
docker exec -it msd700 tmux list-windows -t robot_services
```

::: danger `--detach` is wrong for `docker-compose.robot.yml`
There `run_msd.sh` **is** the container's main command, so returning stops the container and its tmux server. That path is already detached at compose level; the foreground loop keeps the container alive.
:::

## The unit's own stack (`local_dev` profile)

| Service | Container | Port | Bound to |
| --- | --- | --- | --- |
| `db_local` | `msd700_db_local` | `3306` | `127.0.0.1` |
| `mosquitto_local` | `msd700_mosquitto_local` | `1883` MQTT; `9001` WebSocket | MQTT: `127.0.0.1`; WebSocket: all interfaces |
| `backend_local` | `msd700_backend_local` | `5002` API, `9090` rosbridge | all interfaces |
| `media_local` | `msd700_media_local` | `3003` | all interfaces |
| `signalling_local` | `msd700_signalling_local` | `3001` WS, `3002` HTTP | all interfaces |
| `frontend_local` | `msd700_frontend_local` | `3000` | all interfaces |
| `network_local` | `msd700_network_local` | `5011` network API | loopback; proxied by backend |

Defaults, not measurements of your host. Every service uses `network_mode: host`, so **Docker publishes nothing**; the unit firewall controls access. Browser-facing defaults: `3000`, `5002`, `9090`, `3003`, `3001`, `3002`, `9001`. MySQL `3306`, plain MQTT `1883`, and network agent `5011` are unit-internal. The MQTT WebSocket listener allows anonymous clients in the checked-in config: keep it on a trusted operator network, never public internet.

Config lives in `msd700_noetic/docker/.env` (auto-created from `.env.example` on first run). The live file is per-host; the template is the tracked reference. `docker/.env` is git-tracked on the unit: a `git pull` that changes `MYSQL_*` after the data volume was initialized causes credential drift (see [Setup Troubleshooting](/setup/troubleshooting)).

## Unit `.env` reference

| Group | Key | Live default | Notes |
| --- | --- | --- | --- |
| Secrets | `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` | `change_me_*` | Rotate on first boot; must match the initialized volume |
| Secrets | `MYSQL_DATABASE`, `MYSQL_USER` | `ROS_DB`, `itbdelabo` | |
| Secrets | `JWT_SECRET` | `roswebui` | Must match the backend's `JWT_SECRET_KEY` |
| Identity | `USER_UID`, `USER_GID` | empty = autodetect | Jetson 2002, laptop 1000 |
| Identity | `UNIT_ID` | empty = cloud enrol | Pinned only for recovery |
| Identity | `MAPS_FOLDER_LOCAL` | `/home/ubuntu/ros_maps` | |
| Perception | `MSD700_HAZARD_SCAN` | `true` (template `false`) | Needs the Velodyne fitted; see [Perception](/development/ros/perception-and-hazard-scan) |
| Simulation | `MSD700_SIM_WORLD` | `mine` (template `warehouse`) | `warehouse`, `hazard`, `mine` |
| Simulation | `MSD700_SIM_HEADLESS` | `true` (template: absent) | |
| Simulation | `WITH_SIMULATOR` | `false` | Adds the Gazebo stack to the image; costs 1+ GB |
| Unit ports | `MYSQL_PORT_LOCAL` | `3306` | |
| Unit ports | `MOSQUITTO_PORT_LOCAL`, `MOSQUITTO_WS_PORT_LOCAL` | `1883`, `9001` (WS live only) | |
| Unit ports | `BACKEND_PORT_LOCAL` | `5002` | |
| Unit ports | `ROSBRIDGE_PORT_LOCAL` | `9090` | |
| Unit ports | `FRONTEND_PORT_LOCAL` | `3000` | |
| Unit ports | `MEDIA_SERVER_PORT_LOCAL` | `3003` | |
| Unit ports | `SIGNALLING_PORT_WS_LOCAL`, `SIGNALLING_PORT_HTTP_LOCAL` | `3001`, `3002` | |
| Unit ports | `NETWORK_AGENT_PORT_LOCAL` | `5011` | Loopback only |
| Network | `LOCAL_IP` | `192.168.4.1` (template: commented) | Commented = autodetect each run |
| Network | `AP_INTERFACE_LOCAL`, `STA_INTERFACE_LOCAL` | live NIC names (template: empty) | Per-host hardware names |
| Network | `AP_CONNECTION_NAME_LOCAL` | `msd700-hotspot` | |
| Network | `AP_SSID_LOCAL` | `MSD700-Unit01` (template: empty = `MSD700-<hostname>`) | |
| Network | `AP_PASSWORD_LOCAL` | fallback (template: empty, 8+ chars required) | Real passwords live in `/etc/hostapd/*.conf` (0600), not here |
| Network | `STA_SSID_LOCAL`, `STA_PASSWORD_LOCAL` | empty | Client uplink, optional |
| Network | `PORTAL_HOSTNAME_LOCAL` | `mymsd.jp` | |
| Velodyne | `VELODYNE_IFACE` | `end0` (template: empty = autodetect) | Read by `setup.sh` only, outside Docker |
| Velodyne | `VELODYNE_HOST_CIDR` | `192.168.103.100/24` | Keep in sync with `velodyne_scanner.launch device_ip` |
| Velodyne | `VELODYNE_SENSOR_IP` | `192.168.103.231` | |
| Camera ICE | `LOCAL_STUN_URLS`, `LOCAL_TURN_URL`, `LOCAL_TURN_USERNAME`, `LOCAL_TURN_CREDENTIAL` | absent live; template has commented examples | Literal `none` = no server; code default applies when unset |
| Paths | `WEBUI_PATH`, `DASHBOARD_PATH` | commented (autoresolved `src/<repo>` or `../<repo>`) | |

::: info `LOCAL_IP` no longer shapes the bundle
The dashboard JS takes its **host** from whatever address the browser used to open the page; only the **port** still comes from the build. IP, hostname, mDNS (`msd700.local`), or `localhost` SSH tunnel all work. `LOCAL_IP` remains only as a hint for printed URLs and the DHCP-less fallback.
:::

## Unit relay (default) vs per-unit containers (legacy)

Every robot's cloud data plane runs in ONE shared container: `ros_web_ui_v2_unit_relays` (prod) or `..._dev` (dev). It shares the backend's ROS master and rosbridge: one ROS graph per environment. It holds one `mqtt_client` nodelet/TLS connection for all units plus the multi-unit topic relays. Its start command builds the bridge map from the database roster (or `MULTI_UNIT_LIST` override). Empty roster or unreachable database: it waits and retries. Adding a robot creates no per-unit container.

Default because `UNIT_CONTAINERS_ENABLED` defaults to `false`: `unit_manager.js` runs in **Multi-unit mode**, tracking unit usage and keeping the single relay in step with the roster, never spawning per-unit anything.

```bash
docker ps --filter "name=unit_relays"       # shared unit relay
docker logs -f ros_web_ui_v2_unit_relays    # all units' MQTT/ROS bridge
docker restart ros_web_ui_v2_unit_relays    # pick up a roster change
```

::: warning Never run unit relay and per-unit containers together
Two bridges on the same MQTT topics deliver every goal and result twice, double-advancing the waypoint ACK loop (looks like skipped waypoints). The relay refuses to start while per-unit `cloud_mqtt_client` nodes are registered, and `unit_manager.js` logs (not kills) stray `rosweb_unit_*` containers in multi-unit mode.
:::

### Legacy: per-unit containers

`UNIT_CONTAINERS_ENABLED=true` **in the backend process environment** reverts to one relay container per robot: `rosweb_unit_<ULID>_nakayama` (prod) or `..._nakayama_dev` (dev), created on demand, reaped after 30 min idle (Autopilot pins it). The checked-in Compose file doesn't forward this variable, so `.env` edits alone don't enable it. Deployment config must pass it explicitly and exclude that environment's unit relay, or the next profile `up` starts the relay again. No Compose service describes these dynamic containers.

```bash
docker ps --filter "name=rosweb_unit_"           # per-unit bridges (legacy only)
docker logs -f rosweb_unit_<ULID>_nakayama       # one unit's relays
docker stop rosweb_unit_<ULID>_nakayama          # stops it; backend restarts on next use
```

Multi-unit mode: `unit_manager.init()` restarts the existing shared relay at backend startup so its nodes register with the new master; the 60-second roster poll also restarts it on unit-list changes. A missing relay is never created by the manager; Compose creates it. Every relay restart briefly interrupts all units' cloud data plane.

Legacy mode: `adoptExisting()` adopts running containers for lifecycle management but doesn't restart their ROS nodes. If the master was replaced, check registration and recover only affected containers in that environment. Never bulk-restart an unscoped `rosweb_unit_*` list spanning dev and production.

## Troubleshooting Docker itself

| Symptom | Cause | Fix |
| --- | --- | --- |
| `permission denied ... /var/run/docker.sock` | User not in `docker` group yet | `sudo usermod -aG docker $USER`, log out/in (or `newgrp docker`) |
| `network <id> not found` on start | Container recorded a recreated network | `docker compose down --remove-orphans`, then `up` |
| `port is already allocated` | Another process holds it (systemd service, or the other profile) | `sudo ss -lptn 'sport = :3478'` to find it |
| Backend `Connection lost` after `up` | Started before MySQL healthcheck | Retries; else `docker compose up -d <backend>` once DB is `healthy` |
| Build succeeds but change missing | Cached layer | `docker compose build --no-cache <service>` |
| Disk filling up | Old images + build cache | `docker system df`, `docker image prune -a`, `docker builder prune` |
| `the input device is not a TTY` | `docker exec -t` without a TTY | Expected in scripts; `docker-manager.sh` already drops `-t` without stdin TTY |

## Related

- [Server Setup](/setup/server-setup)
- [Unit Setup](/setup/unit-setup)
- [Maintenance](/setup/maintenance)
- [Troubleshooting](/setup/troubleshooting)
