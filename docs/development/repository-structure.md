---
search: false
---

# Repository Structure

<RoleBadge role="developer" />

MSD700 spans four repositories. This one (`msd700_documentation`) is just the docs site; the product
itself lives in the other three, which are siblings on a Server checkout and submodules of
`msd700_noetic` on a Unit checkout: same code, two different ways of assembling it.

## `ros-web-ui`: web-facing packages, backend, and frontend build context

```
ros-web-ui/
├── docker-compose.yml          # Server-side services (see Architecture)
├── docker-compose.robot.yml    # Robot-side container (used when this repo runs the robot half alone)
├── Docker/                     # Dockerfile, HiveMQ config, coturn config, patches
├── Certificates/                # Robot credential cache (token.cred always; device.json written here by scripts/enroll.py at enrolment), MQTT/SQL certs
├── run_msd.sh                  # Launches roscore + ROS bringup + camera client + switch_mode in tmux
├── scripts/
│   ├── docker-manager.sh        # Runs the robot half in a container (Ubuntu 24/ARM64 hosts)
│   ├── enroll.py                 # Talks to /enroll on the backend; prints the claim code
│   ├── secrets.sh                # JWT keyring management (see Setup > Maintenance)
│   └── ros_log_janitor.sh        # Caps ~/.ros/log growth
├── source/                      # Catkin workspace source, this is what actually builds
│   ├── msd700_webui_bringup/     # Top-level launch files (bringup_msd.launch, bringup_cloud.launch)
│   ├── msd700_webui_control/     # switch_mode and related control nodes
│   ├── msd700_webui_msg/         # Custom messages for the web-facing layer
│   ├── msd700_webui_utils/
│   ├── msd700_robot/              # msd700_robot, present here too (see below)
│   └── dependencies/
│       ├── ROS-dashboard-backend/  # backend_node, see Message Contracts: HTTP API
│       ├── ROS-dashboard-next-ts/  # frontend build context (own git repo, gitignored here)
│       ├── media-server/
│       ├── signalling_server/
│       ├── camera_client/
│       ├── aws_mqtt/               # MQTT bridge launch files (local + cloud)
│       ├── topic2string/           # Geometric topics ↔ MQTT string bridge
│       ├── robot_pose_publisher/
│       ├── ssl_update/             # Certbot renewal + HiveMQ keystore rebuild
│       ├── network-agent/          # Unit network helper
│       └── shared/                 # Shared JS (jwt_keyring.js et al.)
└── logs/
```

`ros-web-ui` is the one repository used in **three different contexts**: built as the Server's
backend/rosbridge (`docker-compose.yml`), sourced into a Unit's workspace for the robot's web-facing
nodes (`msd700_noetic/src/ros-web-ui`), and run standalone as the robot half via
`docker-compose.robot.yml` on a non-Jetson host (a dev laptop, or this documentation server, testing
the simulator). Which one you get depends entirely on which compose file / script invokes it, not on
anything in the repo itself.

## `msd700_robot`: the ROS packages that make the robot move

```
msd700_robot/
├── msd700_bringup/           # Launch files for primitive robot tasks
├── msd700_control/           # Sensor fusion (robot_localization), twist_mux
├── msd700_coverage/          # Boustrophedon sweep planner (path_coverage_node)
├── msd700_description/       # URDF, including msd700_field.urdf.xacro (real size)
├── msd700_firmware/          # Legacy Arduino firmware (reference only; the unit runs the STM32 firmware from firmware-msd700)
├── msd700_hardware/          # Hardware drivers (serial, Velodyne, odometry)
├── msd700_movement/          # Vendored third_party only
├── msd700_msgs/              # Robot-level messages
├── msd700_navigation/        # move_base, TEB, SLAM, costmaps
├── msd700_perception/        # Velodyne pipelines (scan, hazard)
├── msd700_simulation/        # Gazebo worlds and sim launches
│   ├── worlds/               #   small, TurtleBot-scale worlds, committed
│   ├── scripts/              #   fetch_sim_worlds.sh: pulls the AWS warehouse
│   └── vendor/               #   fetched third-party worlds, gitignored
└── third_party/              # ira_laser_tools et al.
```

Only `msd700_field.urdf.xacro` is the real 0.90 x 0.70 m robot; every other model here is a
TurtleBot3 Waffle derivative at 0.266 m, and the committed worlds are sized to match. See
[Simulation](/development/ros/simulation) for which combination can validate coverage geometry.

Sourced by both `msd700_noetic` (as a submodule, `src/msd700_robot`) and copied into `ros-web-ui`'s
own `source/msd700_robot`. The robot half of a build needs both this repo's navigation stack and
`ros-web-ui`'s web-facing packages in the same catkin workspace.

## `msd700_noetic`: Jetson/robot orchestration

```
msd700_noetic/
├── setup.sh                  # One-time host setup (Docker, xhost, script permissions)
├── scripts/docker-manager.sh # build / up / down / shell / logs / local-* commands
├── docker/
│   ├── Dockerfile             # osrf/ros:noetic-desktop-full based image
│   ├── Dockerfile.webui-local # Unit local-stack image (COPYs ros-web-ui source in)
│   ├── docker-compose.yml     # The single `msd700` robot container
│   ├── entrypoint.sh          # Container entrypoint
│   ├── .env.example           # Copied to .env on first run
│   ├── mosquitto/             # This unit's own local MQTT broker config
│   └── networkmanager/        # Unit NetworkManager dispatcher scripts
└── src/                       # Populated via git submodules:
    ├── msd700_robot/
    ├── ros-web-ui/
    └── ROS-dashboard-next-ts/
    # NOTE: on a Server checkout (like this one) the submodules are NOT
    # initialized: src/ holds only CMakeLists.txt. The robot code lives in
    # the sibling directories /msd700_robot and /ros-web-ui instead.
```

This is what a Unit actually runs. `src/` is bind-mounted into the container (not baked in), so
editing a launch file or a Python node on the host takes effect on the next launch with no rebuild;
only dependency or base-image changes need `docker-manager.sh build`. On a Server machine (like this
documentation site's own host), `src/` is legitimately absent or empty unless you're specifically
testing the robot half here. The Server runs `ros-web-ui`'s own `docker-compose.yml` instead, which
needs none of this.

## `ROS-dashboard-next-ts`: the operator dashboard

Its own Next.js app, built twice from the same source with different baked-in URLs:

- **Server build** (`frontend_prod`/`frontend_dev` in `ros-web-ui/docker-compose.yml`): talks to the
  Server's own backend/rosbridge/media/signalling, over the public HTTPS/WSS paths Apache proxies.
- **Unit build** (inside `msd700_noetic`'s container, or `ros-web-ui`'s `docker-compose.yml` when
  running the robot half standalone): talks to that same unit's own local services, baked in via
  `NEXT_PUBLIC_*` build args pointed at the unit's own IP.

Because those URLs are compiled **into** the JS bundle rather than read at runtime, changing which
server a build points at always requires a rebuild of the image, never just a restart.

## This repository (`msd700_documentation`)

Just the VitePress docs site, no product code.

```
msd700_documentation/
├── docs/                        # VitePress site source
│   ├── .vitepress/
│   │   ├── config.mts           # site config: nav, sidebar, search, markdown hooks
│   │   └── theme/                # custom theme (extends the default theme)
│   │       ├── index.ts          # registers global components
│   │       ├── custom.css        # site-wide style overrides
│   │       └── components/       # LinkCard(s), RoleBadge
│   ├── index.md                 # homepage
│   ├── user-guide/              # end-user docs
│   ├── setup/                   # technician / deployment docs
│   ├── development/             # developer docs (this section)
│   └── */diagrams/*.drawio      # diagram sources, next to the pages that use them
├── scripts/
│   ├── deploy.sh                 # builds the site and swaps it into docs/.vitepress/dist
│   ├── webhook-listener.mjs      # GitHub webhook receiver that triggers deploy.sh on push to main
│   ├── drawio-viewer.mjs         # pinned draw.io viewer (version/URL/hash) shipped to the browser
│   ├── diagram-hash.mjs          # .drawio content hash shared by the plugin and config.mts
│   ├── apache-snippet.conf       # ProxyPass rules for the Apache front end
│   └── systemd/                  # systemd unit for the webhook listener
├── package.json
└── package-lock.json
```

### Diagrams

Diagrams are draw.io files (`.drawio`), kept in a `diagrams/` folder next to the pages that use
them, for example `docs/setup/diagrams/wifi-hotspot-how-it-fits-together.drawio`. Readers see the
drawing, never an editor.

A page draws the `.drawio` itself with the official draw.io viewer, read-only. There is no image to
generate and no second copy to drift out of sync: the `.drawio` is the single source of truth, and
drawio-assets.mjs serves/emits it under a hash of its own bytes.

**Editing a diagram:** open the `.drawio` file in draw.io: the
[Draw.io Integration](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio)
extension in VS Code (edits the file in place), the desktop app, or
[app.diagrams.net](https://app.diagrams.net). Boxes, groups and lines are ordinary draw.io shapes:
move them, reroute a line by dragging its waypoints, and save. Keep the house style (white boxes,
thin black lines, Helvetica, right-angle connectors, group title in a tab at the top-left corner of
its group) by copying an existing shape rather than using the palette defaults.

**Embedding a diagram:** use image syntax with a path relative to the page. The alt text is what a
screen reader says and what shows if the image is missing:

```md
![How it fits together](./diagrams/wifi-hotspot-how-it-fits-together.drawio)
```

A translated page may point at the English file when the diagram has no text to translate
(for example `../../development/diagrams/architecture-system-topology-and-data-flow.drawio` from `docs/id/development/`), or at its own copy in `docs/id/.../diagrams/` or
`docs/ja/.../diagrams/` when the labels are translated.

| Piece | Job |
| --- | --- |
| `scripts/diagram-hash.mjs` | The content hash of a `.drawio` file. Shared by the Vite plugin and the markdown hook, so both name the same file |
| `scripts/drawio-viewer.mjs` | The pinned draw.io viewer (version, URL, SHA-256) and its downloader; drawio-assets.mjs ships the same bytes to the browser |
| `docs/.vitepress/drawio-assets.mjs` | Vite plugin: serves each `.drawio` by its hash in dev and emits it (plus the viewer) into the build, so the `.drawio` stays the single source of truth and nothing is copied into `docs/public` |
| `docs/.vitepress/theme/components/DrawioDiagram.vue` | Draws one `.drawio` read-only in the page (viewer fetched once per page) and opens the zoom viewer on click. Locked to light mode; no edit path |
| `docs/.vitepress/theme/zoom-viewer.ts` | The shared full-screen, view-only zoom/pan pop-up (wheel/buttons zoom to the cursor, drag pans, Esc closes) |
| `docs/.vitepress/config.mts`, `markdown.config` | Turns every `![...](....drawio)` into `<DrawioDiagram>`. A missing source logs a `[diagrams]` warning and renders a placeholder |

There is nothing to generate: edit the `.drawio` and the page reads it. Commit the `.drawio` with
the markdown change. If a dev page keeps showing the old drawing, restart `npm run docs:dev`
(`vitepress dev` caches rendered markdown by the `.md` content, which the `.drawio` edit does not
change).

::: warning A diagram is missing
The page's `![...](....drawio)` path is resolved at build time. If the file is not there, the build
logs a `[diagrams]` warning and the page shows a `Missing diagram` placeholder; fix the path or add
the file.
:::

::: info Why draw.io and not Mermaid
The diagrams used to be Mermaid fences laid out automatically. An automatic layout decides where
every box and line goes, so a line hugging a title or a box landing in an awkward place could only
be nudged indirectly. In draw.io every position is explicit and can be fixed by hand.
:::

### How the docs site is deployed

::: details Deployment pipeline (click to expand)
1. A push to `main` triggers a GitHub webhook.
2. `scripts/webhook-listener.mjs` verifies the webhook signature (HMAC SHA-256) and, on a `push` event to `refs/heads/main`, spawns `scripts/deploy.sh`.
3. `deploy.sh`:
   - refuses to run if the working tree has local changes, or if a deploy is already in progress (via `flock`)
   - fetches and hard-resets to `origin/main`
   - runs `npm ci`
   - builds the site into a fresh `docs/.vitepress/dist_new` directory
   - atomically swaps it into `docs/.vitepress/dist` (a plain `mv`)
4. In production, Apache serves `docs/.vitepress/dist` **directly off disk** via an `Alias` (see the
   `000-default-le-ssl.conf` vhost); there is no running `vitepress preview` process in the request
   path, and no systemd unit for one. `npm run docs:preview` is for local spot-checks only.
5. `webhook-listener.mjs` itself runs under the `msd700-docs-webhook` systemd unit on `127.0.0.1:4701`.
:::

::: danger Never put `vitepress preview` behind Apache in production
This used to be how the site was served (`ProxyPass` to a long-lived `vitepress preview` process on
port 4700), and it silently broke after every deploy: `preview`'s static server (`sirv`, in
production mode) scans the output directory once at startup and caches each file's name and size. A
rebuild that changes hashed asset filenames left that cache pointing at files that no longer existed
so every CSS/JS 404'd, and `index.html` was served truncated to its stale `Content-Length`. Serving
`dist/` directly via Apache's own `Alias` (current setup, see below) has no such cache: Apache stats
each file per request, so a `dist/` swap is picked up immediately with no restart.
:::

## Related

- [Contributing](/development/contributing) - local dev workflow
- [Architecture](/development/architecture)
