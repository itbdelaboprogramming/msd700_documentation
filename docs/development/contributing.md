---
search: false
---

# Contributing Guide

<RoleBadge role="developer" />

This guide covers developer workflows for contributing to the **MSD700 Core Product** (`ros-web-ui`, `msd700_robot`, `msd700_noetic`, `ROS-dashboard-next-ts`) and this **documentation site**.

## Product Development Workflow

To test server-side modifications safely without impacting production operators, use the isolated `server_dev` Docker Compose profile:

```bash
cd ~/ros-web-ui
docker compose --profile server_dev up -d --build
```

### Dev Stack Port Offsets:
The development stack uses dedicated port offsets to allow concurrent operation alongside production:

| Service | Production Port | Development Port | Protocol |
| --- | --- | --- | --- |
| **Cloud ROS Master** | `11311` | `11312` | TCP (XML-RPC) |
| **Unit ROS Master** | `11321` | `11322` | TCP (XML-RPC, `--dev` on the unit) |
| **rosbridge** | `9090` | `9091` | WebSocket |
| **HiveMQ MQTT** | `8883` | `8884` | TLS Encrypted MQTTS |
| **MySQL Database** | `3307` | `3308` | TCP |
| **Backend REST API** | `5000` | `5001` | HTTP |
| **Next.js Dashboard**| `3000` | `3100` | HTTP |
| **Signalling (WS / HTTP)** | `3001` / `3002` | `4001` / `4002` | WebSocket / HTTP |
| **Media Server** | `3003` | `4003` | HTTP |

A physical or simulated robot connects to the dev cloud peer by passing `--dev`:
```bash
./scripts/docker-manager.sh up --dev -d
```

### Robot-Side Development Workflow:
In `msd700_noetic`, the `src/` directory is bind-mounted directly into the robot runtime container. Changes to launch files, Python nodes, or URDF models take effect on the next launch without requiring an image rebuild. Image rebuilds (`docker-manager.sh build`) are only necessary when C++ catkin packages or base system dependencies are modified.


### Continuous Integration (develop):
Each product repo runs a GitHub Actions build and test on **every push to `develop` and every pull request into `develop`**, and nowhere else (`main` and other branches run nothing). A newer push cancels the run in progress, and every workflow can also be started by hand (**Run workflow**).

| Repo | Workflow | Checks |
| --- | --- | --- |
| `ros-web-ui` | `ci-develop.yml` | `catkin_make` of `source/` in `ros:noetic`, the 12 Python test scripts (`*/scripts/test/test_*.py`), `npm ci` and `node --check` for the four Node services |
| `msd700_robot` | `ci-develop.yml` | the robot image's dependencies (`noetic_dep.sh`, rosdep), `catkin build`, the Python tests under `*/test/test_*.py` |
| `ROS-dashboard-next-ts` | `CI-CD.yml` | `next build`, ESLint and Prettier (auto-fix commit), `tsc --noEmit`, `vitest` (Node 20) |
| `msd700_noetic` | `ci-develop.yml` | `bash -n`, `docker compose config`, Dockerfile checks, then builds and smoke-tests the robot and webui-local images against `ros-web-ui` and `msd700_robot` at `develop` |

`msd700_noetic` clones the two private repos, so it needs the repository secret `CI_REPO_TOKEN`: a fine-grained token with read-only **Contents** access to `ros-web-ui` and `msd700_robot`. Without it the build job fails with a message saying so.

The ROS checks live in `.github/ci/build_and_test.sh`, so a run can be reproduced locally before pushing:

```bash
docker run --rm -v "$PWD":/repo:ro ros:noetic bash /repo/.github/ci/build_and_test.sh
```

---

## Working on this Documentation Site

### Local Development Server:

```bash
cd ~/msd700_documentation
npm install
npm run docs:dev       # Starts local dev server at http://localhost:5700/itbdelabo/docs/
npm run docs:build     # Validates production build -> docs/.vitepress/dist
npm run docs:preview   # Serves production build preview
```

### Automated Validation Scripts:
Before committing documentation changes, run:

```bash
# 1. Build VitePress bundle and test broken links
npm run docs:build

# 2. Verify zero forbidden punctuation characters
grep -rn $'\xe2\x80\x94' docs/ scripts/
```

Diagrams need no generation step: the page reads the `.drawio` file itself. Just edit,
save, and commit it with the markdown that references it.

### Custom Global Components:
This documentation theme extends VitePress with custom global components:
- `<RoleBadge role="user | technician | developer" />`: Displays target audience badge at the top of pages.
- `<LinkCards>` / `<LinkCard title="..." details="..." link="..." icon="..." />`: Interactive card grid used on section landing pages.

### Commit and Pull Request Conventions:
Commits follow standard conventional commit formats (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).

## Related Documentation

- [Repository Structure](/development/repository-structure): Full multi-repository layout.
- [Architecture](/development/architecture): Two-machine system topology.
- [Changelog](/development/changelog): Platform release history.
