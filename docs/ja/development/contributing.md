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
| **ROS Master** | `11311` | `11312` | TCP (XML-RPC) |
| **rosbridge** | `9090` | `9091` | WebSocket |
| **HiveMQ MQTT** | `8883` | `8884` | TLS Encrypted MQTTS |
| **MySQL Database** | `3307` | `3308` | TCP |
| **Backend REST API** | `5000` | `5001` | HTTP |
| **Next.js Dashboard**| `3000` | `3100` | HTTP |

A physical or simulated robot connects to the dev cloud peer by passing `--dev`:
```bash
./scripts/docker-manager.sh up --dev -d
```

### Robot-Side Development Workflow:
In `msd700_noetic`, the `src/` directory is bind-mounted directly into the robot runtime container. Changes to launch files, Python nodes, or URDF models take effect on the next launch without requiring an image rebuild. Image rebuilds (`docker-manager.sh build`) are only necessary when C++ catkin packages or base system dependencies are modified.

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
# 1. Validate all Mermaid diagrams syntax
node scripts/check_parse.mjs

# 2. Build VitePress bundle and test broken links
npm run docs:build

# 3. Verify zero forbidden punctuation characters
grep -rn $'\xe2\x80\x94' docs/ scripts/
```

### Custom Global Components:
This documentation theme extends VitePress with custom global components:
- `<RoleBadge role="user | technician | developer" />`: Displays target audience badge at the top of pages.
- `<LinkCards>` / `<LinkCard icon="..." title="..." details="..." link="..." />`: Interactive card grid used on section landing pages.
- `<Mermaid code="..." />`: Client-side SVG renderer for responsive architecture flowcharts and sequence diagrams.

### Commit and Pull Request Conventions:
Commits follow standard conventional commit formats (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).

## Related Documentation

- [Repository Structure](/ja/development/repository-structure): Full multi-repository layout.
- [Architecture](/ja/development/architecture): Two-machine system topology.
- [Changelog](/ja/development/changelog): Platform release history.
