---
outline: deep
search: false
---

# Introduction to MSD700

<RoleBadge role="user" />

## What is MSD700?

The **MSD700** is an industrial-grade autonomous mobile robot designed and manufactured by **Nakayama Iron Works Ltd.** The **ROS Web UI** dashboard used to operate it is developed by **ITB de Labo**. It is specifically engineered to perform autonomous environmental mapping, point-to-point navigation, and systematic area coverage in complex indoor environments such as warehouses, office corridors, tunnels, and open industrial floors.

Equipped with a 360-degree laser sensor and a camera, the robot builds an accurate digital floor plan in real time as you drive it around. (The technique is called SLAM: the robot figures out where it is while drawing the map.)

![What is MSD700?](./diagrams/introduction-what-is-msd700.drawio)

## Key Operator Capabilities

1. **Mapping**: Drive the robot through a new space to create a digital floor plan.
2. **Point-to-Point Navigation**: Click anywhere on the map to send the robot there; it steers around obstacles on its own.
3. **Area Sweeps**: Outline a room or corridor and the robot cleans or scans the whole zone lane by lane.
4. **Mission Playlists**: Chain several routes and zones into one unattended sequence.
5. **Auto-Align**: If the robot's position on the map looks off, fix it in place without spinning the robot around.
6. **Live Video**: Watch what the robot sees in real time.
7. **Offline Operation**: No internet on site? Connect directly to the robot's Wi-Fi and use the full dashboard.

## System Architecture for Users

The system is composed of two primary layers:

| Layer | Component | User Interaction |
| --- | --- | --- |
| **Cloud Dashboard** | Central Server (`https://msd.nglobal.jp`) | The website where you log in, manage maps, assign routes, and check all rented robots. |
| **Physical Robot (Unit)** | Onboard Computer | The machine that carries out your commands. Each robot has a unique ID and connects securely to the cloud. |

## User Roles and Access

Access to robots is governed by **Rental Profiles**:

- **Fleet Operators**: Standard user accounts assigned to one or more rental profiles. You can drive assigned robots, record maps, create routes, and watch robot status.
- **Lab Administrators**: Manage tenant rental profiles, provision operator accounts, and approve new hardware robot registrations.

## Next Steps

- Proceed to the [Quick Start Guide](/user-guide/quick-start) to log in and control your first robot.
- Explore feature guides for [Mapping](/user-guide/mapping), [Navigation](/user-guide/navigation), and [Routes & Coverage](/user-guide/routes-coverage).
- Review [How the Robot Behaves](/user-guide/behavior) to understand safety watchdogs and Autopilot persistence.
