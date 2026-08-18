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
├── Certificates/                # Robot credential cache (device.json, token.cred), MQTT/SQL certs
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
│       ├── ROS-dashboard-backend/  # backend_node, see API Reference
│       ├── ROS-dashboard-next-ts/  # frontend build context (own git repo, gitignored here)
│       ├── media-server/
│       ├── signalling_server/
│       ├── camera_client/
│       ├── aws_mqtt/               # MQTT bridge launch files (local + cloud)
│       ├── topic2string/           # Geometric topics ↔ MQTT string bridge
│       ├── robot_pose_publisher/
│       └── ssl_update/             # Certbot renewal + HiveMQ keystore rebuild
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
├── msd700_movement/
│   ├── msd700_bringup/       # Launch files for primitive robot tasks
│   ├── msd700_control/       # Sensor fusion (robot_localization)
│   ├── msd700_firmware/      # Arduino firmware for the motor controller
│   ├── msd700_msg/           # Robot-level messages
│   └── msd700_navigations/   # SLAM, autonomous mapping, autonomous navigation, coverage
├── msd700_simulation/        # Gazebo worlds and sim launches
│   ├── worlds/               #   small, TurtleBot-scale worlds, committed
│   ├── scripts/              #   fetch_sim_worlds.sh: pulls the AWS warehouse
│   └── vendor/               #   fetched third-party worlds, gitignored
├── msd700_visual/            # RViz/Gazebo robot visuals
├── msd700_hardware/          # Hardware drivers
├── msd700_description/       # URDF, including msd700_field.urdf.xacro (real size)
└── ros_msd700_msgs/
```

Only `msd700_field.urdf.xacro` is the real 0.90 x 0.70 m robot; every other model here is a
TurtleBot3 Waffle derivative at 0.266 m, and the committed worlds are sized to match. See
[Simulation](/development/simulation) for which combination can validate coverage geometry.

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
│   ├── docker-compose.yml     # The single `msd700` robot container
│   ├── .env.example           # Copied to .env on first run
│   └── mosquitto/             # This unit's own local MQTT broker config
└── src/                       # Populated via git submodules:
    ├── msd700_robot/
    ├── ros-web-ui/
    └── ROS-dashboard-next-ts/
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
│   │       └── components/       # LinkCard(s), RoleBadge, Mermaid
│   ├── index.md                 # homepage
│   ├── getting-started/         # end-user docs
│   ├── setup/                   # technician / deployment docs
│   └── development/             # developer docs (this section)
├── scripts/
│   ├── deploy.sh                 # builds the site and swaps it into docs/.vitepress/dist
│   ├── webhook-listener.mjs      # GitHub webhook receiver that triggers deploy.sh on push to main
│   ├── check-mermaid.mjs         # syntax-checks every diagram in the tree
│   ├── apache-snippet.conf       # ProxyPass rules for the Apache front end
│   └── systemd/                  # systemd unit for the webhook listener
├── package.json
└── package-lock.json
```

### Diagrams

Diagrams are authored as ```` ```mermaid ```` fences in markdown and rendered as real SVG in the
browser. Two pieces make that work:

| Piece | Job |
| --- | --- |
| `docs/.vitepress/config.mts`, `markdown.config` | Rewrites every `mermaid` fence into `<Mermaid code="<base64>" />`. Base64 because the diagram source is full of quotes, newlines and angle brackets that Vue would parse as template syntax once the fence became an element attribute |
| `docs/.vitepress/theme/components/Mermaid.vue` | Decodes it and renders on mount. Client-side only: mermaid needs a DOM to measure text before it can lay a graph out, and the dynamic `import('mermaid')` keeps the layout engine out of every page with no diagram on it |

The component follows the reader's light or dark theme and re-renders on a theme flip, because
mermaid bakes its palette into the SVG at render time. If a diagram fails to parse, the raw source is
shown instead of an empty gap.

```bash
npm run docs:check-diagrams    # parse every diagram; exits non-zero on a syntax error
```

::: warning A broken diagram does not fail the build
VitePress never parses the diagram source; it only passes it through. A syntax error surfaces as a
red block of source on the published page. Run the checker after editing diagrams.
:::

::: info Keep `<br/>` out of state-diagram transition labels
It works in `flowchart` node labels and in sequence-diagram notes, which is where this site uses it.
State-diagram edge labels are plain text, so a `<br/>` there renders literally.
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
