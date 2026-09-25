---
search: false
---

# ROS: Robot Software

<RoleBadge role="developer" />

The robot-side ROS 1 Noetic stack: the packages, algorithms, and control loops that make the physical MSD700 unit move, sense, and clean. This section has no operator-facing UI of its own: for how these subsystems surface as features an operator sees in the dashboard, see [ROS Web UI](/development/webui/).

## Core Robot Packages

<LinkCards>
  <LinkCard icon="📦" title="ROS Package Registry" details="Complete directory of ROS 1 Noetic nodes, launch files, and topics." link="/development/ros/ros-packages" />
</LinkCards>

## Perception & Localization

<LinkCards>
  <LinkCard icon="👁️" title="Perception & Hazard Scan" details="/scan for SLAM, /scan_hazard for costmaps, and the MSD700_HAZARD_SCAN switch." link="/development/ros/perception-and-hazard-scan" />
  <LinkCard icon="📡" title="Sensor Fusion & Control" details="Velodyne VLP-16 LiDAR, IMU filtering, and EKF state estimation." link="/development/ros/sensor-fusion-and-control" />
  <LinkCard icon="📐" title="Coordinate Transforms (TF)" details="REP-103/105 transform tree, sensor offsets, and BoundaryPublisher restamping." link="/development/ros/tf-transforms" />
</LinkCards>

## Navigation & Planning

<LinkCards>
  <LinkCard icon="🗺️" title="Costmaps & Planners" details="Move base, navfn global planner, and TEB local trajectory optimization." link="/development/ros/costmaps-and-planners" />
  <LinkCard icon="🔄" title="Dynamic Mode Switching" details="switch_mode.py, subprocess process spawning, and Autopilot sequencer." link="/development/ros/mode-switching" />
</LinkCards>

## Coverage Cleaning Algorithm

<LinkCards>
  <LinkCard icon="📐" title="Boustrophedon Coverage" details="Dual geometry models, cellular decomposition, and zero-spin alignment." link="/development/ros/boustrophedon-and-alignment" />
</LinkCards>

## Hardware & Firmware

<LinkCards>
  <LinkCard icon="⚡" title="Firmware & Hardware" details="Microcontroller serial link (/dev/stm32, 57600 baud), motor control, and sensor topics." link="/development/ros/firmware-and-hardware" />
</LinkCards>

## Simulation & Testing

<LinkCards>
  <LinkCard icon="🏭" title="Simulation" details="True-scale Gazebo simulation, AWS Small Warehouse world, and clearance testing." link="/development/ros/simulation" />
</LinkCards>
