---
search: false
---

# ROS Web UI User Guide

<RoleBadge role="user" />

Welcome to the **MSD700 Operator User Guide**. This documentation is designed for fleet operators, researchers, and field technicians who use the web dashboard to control, map, and supervise MSD700 autonomous robots. No programming or robotics experience is required.

## About MSD700

The **MSD700** is an autonomous mobile robot designed and manufactured by **Nakayama Iron Works Ltd.** for autonomous mapping and navigation in industrial environments.

The **ROS Web UI** dashboard is the operator interface for the MSD700 platform, developed by **ITB de Labo**. This web-based control center lets you monitor, command, and manage the robot's operations from any device with a web browser.

## What You Can Do

With the ROS Web UI, you can:

- **Create Maps**: Drive the robot through a new area to automatically build a digital floor plan
- **Navigate**: Click anywhere on a map to send the robot to that location with obstacle avoidance
- **Cover Areas**: Draw zones and command the robot to systematically sweep entire rooms or corridors
- **Monitor Live**: Watch the robot's camera feed in real time with ultra-low latency streaming
- **Manage Routes**: Save frequently traveled paths and chain them into automated mission playlists
- **Manage a Fleet**: If you're an administrator, oversee multiple robots, operators, and rental profiles
- **Work Offline**: Use the full dashboard directly on the robot's local Wi-Fi without internet

## How to Use This Guide

Each section below walks through a specific feature with step-by-step instructions written for everyday use, not for developers. New to MSD700? Start with **Introduction** and **Quick Start**. Already familiar with the platform? Jump straight to the feature you need.

<LinkCards>
  <LinkCard icon="📖" title="Introduction" details="Learn about the MSD700 platform, hardware capabilities, and cloud architecture." link="/user-guide/introduction" />
  <LinkCard icon="🚀" title="Quick Start" details="Step-by-step instructions to log in, select a robot, and execute your first mission." link="/user-guide/quick-start" />
  <LinkCard icon="👥" title="Accounts & Access" details="Log in, create an account, and understand operator vs. admin permissions." link="/user-guide/accounts" />
  <LinkCard icon="🧭" title="Navigation" details="Manual joystick control, sending the robot to a location, and Autopilot missions." link="/user-guide/navigation" />
  <LinkCard icon="🗺️" title="Mapping" details="Create a new map by driving the robot around an area. Play, pause, and save." link="/user-guide/mapping" />
  <LinkCard icon="🗄️" title="Maps & Database" details="View, search, rename, and delete your saved maps." link="/user-guide/database" />
  <LinkCard icon="📍" title="Routes & Coverage" details="Save point-to-point routes and draw areas for systematic cleaning sweeps." link="/user-guide/routes-coverage" />
  <LinkCard icon="📷" title="Live Camera" details="Watch the robot's point of view in real time from anywhere." link="/user-guide/camera" />
  <LinkCard icon="🤖" title="How the Robot Behaves" details="Understand safety watchdogs, operating leases, Autopilot persistence, and session recovery." link="/user-guide/behavior" />
  <LinkCard icon="🛠️" title="Admin Console" details="For fleet managers: add operators, manage rentals, and monitor fleet status." link="/user-guide/admin-console" />
  <LinkCard icon="❓" title="Frequently Asked Questions" details="Answers to common operational questions regarding battery, maps, and connectivity." link="/user-guide/faq" />
  <LinkCard icon="🩹" title="Troubleshooting" details="Quick solutions for common operator symptoms like video stalls and goal aborts." link="/user-guide/troubleshooting" />
</LinkCards>

## Recommended Reading Order

![Recommended Reading Order](./diagrams/user-guide-recommended-reading-order.drawio)

1. **[Introduction](/user-guide/introduction)**: Understand the platform, hardware, and cloud architecture
2. **[Quick Start](/user-guide/quick-start)**: Log in and run your first mission in a few minutes
3. **[Accounts & Access](/user-guide/accounts)**: Set up your login and understand operator vs. admin roles
4. **[Navigation](/user-guide/navigation)**: Learn to control the robot
5. **[Mapping](/user-guide/mapping)**: Create your first map
6. **[Maps & Database](/user-guide/database)**: Manage your saved maps
7. **[Routes & Coverage](/user-guide/routes-coverage)**: Plan automated missions
8. **[Live Camera](/user-guide/camera)**: Monitor the robot remotely
9. **[How the Robot Behaves](/user-guide/behavior)**: Understand safety pauses, leases, and Autopilot
10. **[Admin Console](/user-guide/admin-console)**: (Fleet managers only) Manage operators and units

## System Requirements

- **Supported Browsers**: Google Chrome (recommended) or Microsoft Edge.
- **Desktop only**: Use a laptop or desktop with a window at least 1366 x 768. Phones and tablets are blocked with a full-page notice, and smaller desktop windows are covered by a blocking overlay: a half-visible control bar must never drive a live robot.
- **Network**: Internet access for the cloud dashboard (`msd.nglobal.jp`), or a local Wi-Fi connection when operating robots offline in the field.

## Need Help?

- Check the **Troubleshooting** section at the end of each guide, or the dedicated [Troubleshooting](/user-guide/troubleshooting) page
- Review the [FAQ](/user-guide/faq)
- Contact your system administrator or ITB de Labo support

---

**MSD700** is a product of **Nakayama Iron Works Ltd.**
**ROS Web UI** is developed by **ITB de Labo**
