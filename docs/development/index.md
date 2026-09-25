---
search: false
---

# Developer Documentation

<RoleBadge role="developer" />

Comprehensive technical documentation for software engineers, robotics developers, and systems architects working on the MSD700 platform, split into two domains: the robot's own software, and the platform that operates it.

## ROS: Robot Software

The ROS 1 Noetic stack running on the physical unit: packages, algorithms, sensors, and control loops. Organized per subsystem, since this side has no operator-facing UI of its own.

<LinkCards>
  <LinkCard icon="🤖" title="ROS Section" details="Package registry, perception & localization, navigation & planning, the boustrophedon coverage algorithm, firmware & hardware, safety watchdog, and simulation." link="/development/ros/" />
</LinkCards>

## ROS Web UI: Platform

The operator dashboard, admin console, and the backend/bridge services connecting them to the robot. Organized per actual feature page, not by protocol layer.

<LinkCards>
  <LinkCard icon="🧭" title="Navigation" details="Manual control, Autopilot, pinpoint/routes, map sync & alignment, and coverage cleaning." link="/development/webui/navigation/overview" />
  <LinkCard icon="🗺️" title="Mapping" details="Building a new map: Play/Pause/Stop, manual vs. autonomous exploration, and save-on-stop." link="/development/webui/mapping/overview" />
  <LinkCard icon="🗄️" title="Database" details="The Map DB page: listing, searching, renaming, and deleting recorded maps." link="/development/webui/database/overview" />
  <LinkCard icon="🛠️" title="Admin Console" details="Operators, Units & Fleet, Rentals, Backups, and superadmin-only Admins tabs." link="/development/webui/admin-console/overview" />
  <LinkCard icon="🔑" title="Accounts & Access" details="Operator login/signup, admin login, JWT keyring, and hardware enrolment." link="/development/webui/accounts/overview" />
  <LinkCard icon="📷" title="Camera & Live View" details="The WebRTC video pipeline behind the dashboard's live feed." link="/development/webui/camera/overview" />
</LinkCards>

## Start Here & Reference

Cross-cutting material that applies to both domains, so it isn't duplicated into either section.

<LinkCards>
  <LinkCard icon="🏗️" title="Architecture" details="Two-machine peer model, system topology, trust domains, and state ownership." link="/development/architecture" />
  <LinkCard icon="🗂️" title="Repository Structure" details="Codebase layout across msd700_robot, ros-web-ui, and msd700_noetic." link="/development/repository-structure" />
  <LinkCard icon="📨" title="Message Contracts" details="The full MQTT wire format: command envelopes, feedback schemas, and ARQ ACK protocols." link="/development/message-contracts" />
  <LinkCard icon="🔧" title="Diagnostics & Troubleshooting" details="Whole-stack failure decision trees and root cause mappings." link="/development/troubleshooting-guide" />
  <LinkCard icon="🤝" title="Contributing Guide" details="Development workflow, commit conventions, and pull request procedures." link="/development/contributing" />
  <LinkCard icon="📝" title="Changelog" details="Historical platform changelog and release notes." link="/development/changelog" />
</LinkCards>

## Recommended Reading Order

For engineers newly onboarding to MSD700, the recommended foundational progression is:

1. [Architecture](/development/architecture): Understand the two-machine model and the separation between MQTT and rosbridge.
2. [Accounts & Access: Security & Tokens](/development/webui/accounts/security-and-tokens): Learn the three trust domains and cryptographic device enrolment.
3. [ROS Package Registry](/development/ros/ros-packages): Explore the ROS nodes and package bindings.
4. [Coordinate Transforms (TF)](/development/ros/tf-transforms): Understand the spatial reference tree and clock domain restamping.
5. [Message Contracts](/development/message-contracts): Master the exact wire formats crossing machine boundaries.
6. [Navigation: Manual Override & Autopilot](/development/webui/navigation/manual-and-autopilot): Trace the robot activity state machine and session recovery.
7. [REST API Reference](/development/api-reference): Integrate web and external client controllers.
