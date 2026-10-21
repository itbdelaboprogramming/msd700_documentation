# Installation

msd_system runs on **ROS 2 Jazzy** (Ubuntu 24.04). There are two ways to set it up:

- [Docker Setup](#docker-setup) (recommended)
- [Manual Setup](#manual-setup)

Both start by cloning the repository:

```bash
git clone git@github.com:itbdelaboprogramming/msd_system.git
cd msd_system
```

## Docker Setup

Everything is defined in `Docker/Dockerfile.pc` (ROS 2 Jazzy / Ubuntu 24.04) and `Docker/docker-compose.yml`.

### Requirements

- Docker with Docker Compose.
- On a PC or laptop with an NVIDIA GPU, install the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) so the container can access the GPU.

The Docker setup has also been tested on **Jetson AGX Orin**.

### Build the image

From the repository root:

```bash
docker build -f Docker/Dockerfile.pc -t msd_system:pc .
```

### Run the container

```bash
docker compose -f Docker/docker-compose.yml up -d
docker exec -it msd_system_pc bash
```

`/opt/ros/jazzy/setup.bash` and `install/setup.bash` are already sourced in the container's `.bashrc`.

## Manual Setup

Build the workspace directly in a ROS 2 Jazzy environment, without Docker.

### 1. Prepare Ubuntu 24.04 with ROS 2 Jazzy

Choose one:

- **Native or VM** (Ubuntu 24.04 only): follow the [official ROS 2 Jazzy install guide](https://docs.ros.org/en/jazzy/Installation.html) and install `ros-jazzy-desktop-full`.
- **Distrobox** (if your machine is not Ubuntu 24.04): use [Distrobox](https://distrobox.it/) to run a containerized Ubuntu 24.04 environment.

  ```bash
  distrobox create --name ros-jazzy \
    --image docker.io/osrf/ros:jazzy-desktop-full \
    --additional-flags "--privileged"
  distrobox enter ros-jazzy
  ```

  Run all ROS 2 commands inside the container (`distrobox enter ros-jazzy`).

### 2. Install build tools and rosdep

```bash
sudo apt-get update && sudo apt-get install -y --no-install-recommends \
  build-essential cmake git wget curl python3-pip \
  python3-colcon-common-extensions python3-rosdep python3-vcstool

sudo rosdep init
rosdep update
```

### 3. Install msd_follower's Python dependencies

These are not picked up by `rosdep`. They are pinned in the package's `pyproject.toml`. From the workspace root (`msd_system/`):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

sudo env "PATH=$PATH" uv pip install --system --break-system-packages \
  -r src/msd_feature/msd_follower/pyproject.toml
```

### 4. Install package dependencies

From the workspace root:

```bash
source /opt/ros/jazzy/setup.bash
rosdep install --from-paths src --ignore-src -r -y --skip-keys="rmw_connextdds"
```

### 5. Build

```bash
colcon build --symlink-install
```

### 6. Source the workspace

Run this in every new terminal before using ROS 2 commands:

```bash
source install/setup.bash
```
