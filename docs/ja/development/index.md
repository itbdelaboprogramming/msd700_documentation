---
search: false
---


# Developer Documentation

<RoleBadge role="developer" />

Comprehensive technical documentation for software engineers, robotics developers, and systems architects working on the MSD700 platform.

## Architecture and Core Systems

<LinkCards>
  <LinkCard icon="🏗️" title="Architecture" details="Two-machine peer model, system topology, trust domains, and seams." link="/ja/development/architecture" />
  <LinkCard icon="🛡️" title="Security & Authentication" details="JWT keyring, 3-stage cryptographic enrolment nonce, and trust isolation." link="/ja/development/security-and-auth" />
  <LinkCard icon="🔁" title="State and Behavior" details="Robot activities, safety watchdog tiers, Autopilot mode, and session recovery." link="/ja/development/state-and-behavior" />
  <LinkCard icon="🗂️" title="Repository Structure" details="Codebase layout across msd700_robot, ros-web-ui, and msd700_noetic." link="/ja/development/repository-structure" />
</LinkCards>

## ROS & Robot Subsystems

<LinkCards>
  <LinkCard icon="📦" title="ROS Package Registry" details="Complete directory of ROS 1 Noetic nodes, launch files, and topics." link="/ja/development/ros-packages" />
  <LinkCard icon="📐" title="Coordinate Transforms (TF)" details="REP-103/105 transform tree, sensor offsets, and BoundaryPublisher restamping." link="/ja/development/tf-transforms" />
  <LinkCard icon="📡" title="Sensor Fusion & Control" details="Velodyne VLP-16 LiDAR, IMU filtering, and EKF state estimation." link="/ja/development/sensor-fusion-and-control" />
  <LinkCard icon="⚡" title="Firmware & Hardware" details="Microcontroller serial UART protocol, PID velocity loops, and battery telemetry." link="/ja/development/firmware-and-hardware" />
  <LinkCard icon="🗺️" title="Costmaps & Planners" details="Move base, navfn global planner, and TEB local trajectory optimization." link="/ja/development/costmaps-and-planners" />
  <LinkCard icon="🔄" title="Dynamic Mode Switching" details="switch_mode.py, roslaunch Python API process spawning, and Autopilot sequencer." link="/ja/development/mode-switching" />
</LinkCards>

## Navigation, Coverage & Simulation

<LinkCards>
  <LinkCard icon="📐" title="Boustrophedon Coverage" details="Dual geometry models, cellular decomposition, and zero-spin alignment." link="/ja/development/boustrophedon-and-alignment" />
  <LinkCard icon="🏭" title="Simulation" details="True-scale Gazebo simulation, AWS Small Warehouse world, and clearance testing." link="/ja/development/simulation" />
</LinkCards>

## Communications & Interfaces

<LinkCards>
  <LinkCard icon="📨" title="Message Contracts" details="MQTT command envelopes, feedback schemas, and ARQ ACK protocols." link="/ja/development/message-contracts" />
  <LinkCard icon="🔌" title="API Reference" details="Exhaustive REST API endpoints, request parameters, and response bodies." link="/ja/development/api-reference" />
  <LinkCard icon="🌐" title="rosbridge Protocol" details="WebSocket JSON streaming protocol, topic subscriptions, and canvas rendering." link="/ja/development/rosbridge-protocol" />
  <LinkCard icon="🎨" title="Frontend Canvas & Web UI" details="EaselJS stage rendering, metric-to-pixel math, and createjs prototype patches." link="/ja/development/frontend-canvas" />
  <LinkCard icon="📷" title="Camera Streaming" details="WebRTC video pipeline, STUN/TURN relays, and mDNS candidate filtering." link="/ja/development/camera-streaming" />
</LinkCards>

## Data, Storage & Cloud Sync

<LinkCards>
  <LinkCard icon="🗄️" title="Database Schema" details="MySQL 8.0 tables, uniform timestamps, and rental profile foreign keys." link="/ja/development/database-schema" />
  <LinkCard icon="🔄" title="Data Sync" details="Offline-first database reconciliation, conflict resolution, and Local badge." link="/ja/development/data-sync" />
  <LinkCard icon="💾" title="Backup & Migration" details="Profile and unit scoped backups, tar.gz manifests, and schema migrations." link="/ja/development/backup-and-restore" />
</LinkCards>

## Operations & Diagnostics

<LinkCards>
  <LinkCard icon="🐳" title="Unit Container Lifecycle" details="unit_manager.js, Docker socket proxying, and idle reaper sweeps." link="/ja/development/unit-container-lifecycle" />
  <LinkCard icon="🔧" title="Diagnostics & Troubleshooting" details="Developer failure decision trees, root cause mappings, and recovery." link="/ja/development/troubleshooting-guide" />
  <LinkCard icon="🤝" title="Contributing Guide" details="Development workflow, commit conventions, and pull request procedures." link="/ja/development/contributing" />
  <LinkCard icon="📝" title="Changelog" details="Historical platform changelog and release notes." link="/ja/development/changelog" />
</LinkCards>

## Recommended Reading Order

For engineers newly onboarding to MSD700, the recommended foundational progression is:

1. [Architecture](/ja/development/architecture): Understand the two-machine model and the separation between MQTT and rosbridge.
2. [Security & Authentication](/ja/development/security-and-auth): Learn the three trust domains and cryptographic device enrolment.
3. [ROS Package Registry](/ja/development/ros-packages): Explore the ROS nodes and package bindings.
4. [Coordinate Transforms (TF)](/ja/development/tf-transforms): Understand the spatial reference tree and clock domain restamping.
5. [Message Contracts](/ja/development/message-contracts): Master the exact wire formats crossing machine boundaries.
6. [State and Behavior](/ja/development/state-and-behavior): Trace finite state machine transitions and safety watchdogs.
7. [API Reference](/ja/development/api-reference): Integrate web and external client controllers.
