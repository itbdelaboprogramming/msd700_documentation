---
search: false
---

# Platform Changelog & Release Milestones

<RoleBadge role="developer" />

This changelog summarizes key architectural milestones, platform overhauls, and protocol advancements across the MSD700 robotics ecosystem.

## Architectural Milestones

### September 2026: Bandwidth Optimisation & Per-Unit Data Scope
- **Presence-Gated Egress**: Robot-to-cloud telemetry now reads `/msd700/viewers` and sends at a rate matched to whether anyone is watching. Overlays and the occupancy grid are sent on change rather than on a timer, and the four overlay topics are latched on the cloud bridge so a reconnecting tab still gets its drawing.
- **Per-Unit Map Scope**: Map listings, single-map reads and `POST /api/navigation/init` are scoped to the unit being driven as well as the rental. A rental holding several robots no longer lists every robot's maps together, and a sibling's map is refused at the API instead of failing on the robot.
- **Recovery Reach over Message Count**: Snapshot rebuild now also triggers on an `Idle` tab with no mode selected (the state left by re-opening a map from the Database page), and the resync prompt reaches 9.4 s instead of 3.4 s. Neither the Navigation page nor the map component overwrites its persisted status or mode on mount.
- **Self-Join Prevention**: The unit's own hotspot is excluded from its WiFi scan and refused by `connect()`, so an operator reading the list through that hotspot cannot tell the unit to join itself.
- **Mode-Preserving Boot Autostart**: `msd700.service` now carries the `--dev` and `--simulator` flags of the `up` that armed it. The boot unit previously re-ran a bare `up`, so a robot started against the dev cloud, or as a simulator, silently returned after a reboot as hardware against production.

### August 2026: Documentation Overhaul & Precision Kinematics
- **Modular Documentation Architecture**: Exhaustive rewrite of all documentation pages with responsive Mermaid SVG diagrams, mathematical formulations, and zero-downtime operations.
- **True-Scale Gazebo Simulation**: Upgraded simulator model to `msd700_field` ($0.90 \times 0.70\text{ m}$ body footprint with 4 casters) operating in the AWS RoboMaker Small Warehouse.
- **Correlative Scan Matching (Auto-Align)**: Implemented zero-spin initial pose alignment (< 50 ms) to eliminate 360-degree rotation in narrow corridors.
- **32-Byte Nonce Cryptographic Enrolment**: Enforced CSPRNG nonce hashing protocol for robot device authentication.

### July 2026: Multi-Tenant Rental Security & ULID Migration
- **Rental Profile Authorization**: Added `attachUnit` Express middleware to enforce strict tenant isolation across maps and units.
- **ULID Architecture**: Migrated system addressing from raw hardware strings to Universally Unique Lexicographically Sortable Identifiers (`/unit_<ULID>/...`).
- **Uniform Database Timestamps**: Standardized `created_at` and `modified_at` columns with automatic `ON UPDATE CURRENT_TIMESTAMP` triggers across 15 database tables.

### June 2026: Offline-First Replication & Local Mode Stack
- **Bidirectional Data Sync Agent**: Deployed `sync_agent.js` and `sync_engine.js` with last-write-wins per-row conflict resolution and delete tombstones.
- **Two-Tier Map Storage**: Implemented mandatory local upload (`media_local :3003`) with best-effort cloud sync (`media-server :3003`).
- **Jetson Local Dashboard**: Bundled onboard `frontend_local` and `backend_local` stacks for autonomous offline field operations.

### May 2026: Ultra-Low Latency WebRTC Video Pipeline
- **mDNS Candidate Filter**: Introduced `_strip_mdns_candidates()` in `camera_client.py` to prevent RFC 8445 network resolution errors on offline LANs.
- **coturn TURN Relay**: Integrated production WebRTC media relaying across symmetric NATs.

---

## Repository Commit Histories

For line-by-line commit logs, refer to the respective GitHub repositories:

- [msd700_documentation Commits](https://github.com/itbdelaboprogramming/msd700_documentation/commits/main)
- [ros-web-ui Commits](https://github.com/itbdelaboprogramming/ros-web-ui/commits/v2)
- [msd700_robot Commits](https://github.com/itbdelaboprogramming/msd700_robot/commits/v2)
- [ROS-dashboard-next-ts Commits](https://github.com/itbdelaboprogramming/ROS-dashboard-next-ts/commits/v2)
- [msd700_noetic Commits](https://github.com/itbdelaboprogramming/msd700_noetic/commits/master)
