---
search: false
---
# Dokumentasi Pengembang

<RoleBadge role="developer" />

Dokumentasi teknis yang komprehensif untuk insinyur perangkat lunak, pengembang robotika, dan arsitek sistem yang bekerja pada platform MSD700.

## Arsitektur dan Sistem Inti

<LinkCards>
  <LinkCard icon="🏗️" title="Architecture" details="Two-machine peer model, system topology, trust domains, and seams." link="/development/architecture" />
  <LinkCard icon="🛡️" title="Security & Authentication" details="JWT keyring, 3-stage cryptographic enrolment nonce, and trust isolation." link="/development/security-and-auth" />
  <LinkCard icon="🔁" title="State and Behavior" details="Robot activities, safety watchdog tiers, Autopilot mode, and session recovery." link="/development/state-and-behavior" />
  <LinkCard icon="🗂️" title="Repository Structure" details="Codebase layout across msd700_robot, ros-web-ui, and msd700_noetic." link="/development/repository-structure" />
</LinkCards>

## Subsistem ROS & Robot

<LinkCards>
  <LinkCard icon="📦" title="ROS Package Registry" details="Complete directory of ROS 1 Noetic nodes, launch files, and topics." link="/development/ros-packages" />
  <LinkCard icon="📐" title="Coordinate Transforms (TF)" details="REP-103/105 transform tree, sensor offsets, and BoundaryPublisher restamping." link="/development/tf-transforms" />
  <LinkCard icon="📡" title="Sensor Fusion & Control" details="Velodyne VLP-16 LiDAR, IMU filtering, and EKF state estimation." link="/development/sensor-fusion-and-control" />
  <LinkCard icon="⚡" title="Firmware & Hardware" details="Microcontroller serial UART protocol, PID velocity loops, and battery telemetry." link="/development/firmware-and-hardware" />
  <LinkCard icon="🗺️" title="Costmaps & Planners" details="Move base, navfn global planner, and TEB local trajectory optimization." link="/development/costmaps-and-planners" />
  <LinkCard icon="🔄" title="Dynamic Mode Switching" details="switch_mode.py, roslaunch Python API process spawning, and Autopilot sequencer." link="/development/mode-switching" />
</LinkCards>

## Navigasi, Cakupan & Simulasi

<LinkCards>
  <LinkCard icon="📐" title="Boustrophedon Coverage" details="Dual geometry models, cellular decomposition, and zero-spin alignment." link="/development/boustrophedon-and-alignment" />
  <LinkCard icon="🏭" title="Simulation" details="True-scale Gazebo simulation, AWS Small Warehouse world, and clearance testing." link="/development/simulation" />
</LinkCards>

## Komunikasi & Antarmuka

<LinkCards>
  <LinkCard icon="📨" title="Message Contracts" details="MQTT command envelopes, feedback schemas, and ARQ ACK protocols." link="/development/message-contracts" />
  <LinkCard icon="🔌" title="API Reference" details="Exhaustive REST API endpoints, request parameters, and response bodies." link="/development/api-reference" />
  <LinkCard icon="🌐" title="rosbridge Protocol" details="WebSocket JSON streaming protocol, topic subscriptions, and canvas rendering." link="/development/rosbridge-protocol" />
  <LinkCard icon="🎨" title="Frontend Canvas & Web UI" details="EaselJS stage rendering, metric-to-pixel math, and createjs prototype patches." link="/development/frontend-canvas" />
  <LinkCard icon="📷" title="Camera Streaming" details="WebRTC video pipeline, STUN/TURN relays, and mDNS candidate filtering." link="/development/camera-streaming" />
</LinkCards>

## Data, Penyimpanan & Sinkronisasi Cloud

<LinkCards>
  <LinkCard icon="🗄️" title="Database Schema" details="MySQL 8.0 tables, uniform timestamps, and rental profile foreign keys." link="/development/database-schema" />
  <LinkCard icon="🔄" title="Data Sync" details="Offline-first database reconciliation, conflict resolution, and Local badge." link="/development/data-sync" />
  <LinkCard icon="💾" title="Backup & Migration" details="Profile and unit scoped backups, tar.gz manifests, and schema migrations." link="/development/backup-and-restore" />
</LinkCards>

## Operasi & Diagnostik

<LinkCards>
  <LinkCard icon="🐳" title="Unit Container Lifecycle" details="unit_manager.js, Docker socket proxying, and idle reaper sweeps." link="/development/unit-container-lifecycle" />
  <LinkCard icon="🔧" title="Diagnostics & Troubleshooting" details="Developer failure decision trees, root cause mappings, and recovery." link="/development/troubleshooting-guide" />
  <LinkCard icon="🤝" title="Contributing Guide" details="Development workflow, commit conventions, and pull request procedures." link="/development/contributing" />
  <LinkCard icon="📝" title="Changelog" details="Historical platform changelog and release notes." link="/development/changelog" />
</LinkCards>

## Urutan Bacaan yang Direkomendasikan

Untuk teknisi yang baru bergabung dengan MSD700, perkembangan dasar yang disarankan adalah:

1. [Arsitektur](/id/development/architecture): Memahami model dua mesin dan pemisahan antara MQTT dan rosbridge.
2. [Keamanan & Otentikasi](/id/development/security-and-auth): Pelajari tiga domain kepercayaan dan pendaftaran perangkat kriptografi.
3. [ROS Package Registry](/id/development/ros-packages): Jelajahi node ROS dan pengikatan paket.
4. [Coordinate Transforms (TF)](/id/development/tf-transforms): Memahami pohon referensi spasial dan penataan ulang domain jam.
5. [Kontrak Pesan](/id/development/message-contracts): Kuasai format kabel yang tepat melintasi batas mesin.
6. [Status dan Perilaku](/id/development/state-and-behavior): Melacak transisi mesin negara yang terbatas dan pengawas keselamatan.
7. [Referensi API](/id/development/api-reference): Integrasikan pengontrol klien eksternal dan web.