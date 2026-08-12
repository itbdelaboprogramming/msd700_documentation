# Prerequisites

<RoleBadge role="technician" />

MSD700 is two separate machines that work together: a **Server** (the cloud/dashboard side) and one
or more **Units** (the physical robots). Confirm the right list below before starting: you don't
need everything on this page, only the section for the machine you're setting up.

::: info Why split it this way?
Every Unit is a self-contained robot with its own copy of the whole software stack (it can keep
working with no internet). The Server is the one shared place that accounts, maps, and routes live.
Keeping the two prerequisite lists separate mirrors that: a Unit needs ROS and hardware drivers, a
Server needs none of that.
:::

## For an MSD700 Unit (the robot)

### Hardware

| Item | Required? | Notes |
| --- | --- | --- |
| Compute (NVIDIA Jetson, or an x86 PC for bench testing) | Required | Runs Ubuntu + Docker; ROS itself runs *inside* a container, so the host OS version matters less than Docker's |
| Robot base + motor controller | Required | ITB de Labo's own MSD700 chassis and Arduino-based firmware |
| Lidar (Velodyne VLP-16, Ethernet) | Required | Primary sensor for SLAM mapping and obstacle avoidance |
| IMU / wheel encoders (odometry source) | Required | Fused with the lidar for pose estimation, so the robot knows roughly where it is between lidar scans |
| Camera | Required | Feeds the live video stream operators see in the dashboard |
| Remote control (RC transmitter) | Recommended | Lets someone take over by hand near the robot if software control isn't available: a physical fallback, not a software one |

::: info Why Velodyne and not the original RPLidar?
Early MSD700 prototypes used an RPLidar A1. The fleet has since moved to a Velodyne VLP-16 over
Ethernet for better range and reliability. If you're working from an old bill of materials, this is
the one hardware change worth knowing about before you order parts.
:::

### Software (on the Unit's own machine)

| Item | Version | Why |
| --- | --- | --- |
| Ubuntu | 20.04 or 22.04 | Host OS. ROS Noetic itself runs inside the Docker image, so this host version is about Docker/driver compatibility, not ROS compatibility |
| Docker Engine | 20.10+, with the Compose plugin | Everything ROS-related (roscore, navigation, the unit's own local dashboard) runs in one container, built and managed by `msd700_noetic`'s scripts |
| Git | any recent version | To clone the workspace and its submodules |
| X11 display server | only if you'll use RViz/Gazebo GUIs directly on this machine | Not needed for normal headless operation |

::: info Why does ROS run in Docker instead of being installed on the Jetson directly?
Two reasons converge here. First, `msd700_noetic`'s own README notes it targets **Ubuntu 22/24
hosts, where ROS Noetic (ROS1) can't run natively**, since Noetic only ships packages for 20.04.
Second, even where it could run natively, one Docker image is the same on every Jetson and every
developer's laptop, so "works on my machine" stops being a real category of bug.
:::

## For the MSD700 Server (cloud / dashboard side)

### Hardware

Any Linux server reachable from the internet (or from your local network, for a purely local
deployment) with enough resources to run several Docker containers: a MySQL database, a Node.js
backend, a Next.js dashboard, an MQTT broker, and supporting services. There's no MSD700-specific
sizing requirement beyond "big enough to comfortably run Docker Compose."

### Software

| Item | Notes |
| --- | --- |
| Docker Engine + Compose plugin | Every server-side service is a container; see [Server Setup](/setup/server-setup) |
| Apache2 (with `mod_proxy`, `mod_proxy_wstunnel`, `mod_ssl`) | Terminates HTTPS and reverse-proxies each service's port to a clean public path (`/services/...`) |
| A TLS certificate for your domain (e.g. via Let's Encrypt / certbot) | The dashboard, MQTT broker, and rosbridge all need to be reachable over TLS from an operator's browser |
| Python 3 + OpenSSL | Used by `scripts/secrets.sh` to generate the JWT signing keyring; no separate install needed on most Linux distros |
| Git | To clone `ros-web-ui` and the dashboard frontend it builds |

::: warning Do not run production and a dev deployment on the same host casually
The Docker Compose file supports `server_prod` and `server_dev` profiles side by side (different
ports, different databases), and that's intentional: it's how new server-side changes get tested
against a real MQTT broker before touching production. But the comment in the compose file is blunt
about it: **don't run both profiles at once on a host that doesn't have the resources for it.** If
you're not sure, ask whoever runs the existing deployment before starting a second profile.
:::

## Access you'll need, either way

- [ ] Admin console credentials (to approve new units, create dashboard accounts, and grant unit access)
- [ ] SSH / physical access to whichever machine you're configuring
- [ ] If you're joining an *existing* deployment: the Server's address (e.g. `msd.nglobal.jp`), and for enrolling a new Unit, nothing else. Enrolment itself needs no pre-shared secret; see [Unit Setup](/setup/unit-setup)

## Safety

::: danger
Follow your organization's standard electrical and workplace safety procedures when installing or
handling hardware units. The robot base can move under its own power once the software stack is
running: keep the Emergency Stop reachable, and don't leave a freshly-enrolled unit unattended near
people or obstacles until you've confirmed manual control works.
:::

## Next step

Continue to [Server Setup](/setup/server-setup) if you're standing up the cloud side, or straight to [Unit Setup](/setup/unit-setup) if the Server already exists.
