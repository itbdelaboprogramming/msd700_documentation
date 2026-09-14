---
search: false
---

# ROS: Perangkat Lunak Robot

<RoleBadge role="developer" />

Stack ROS 1 Noetic sisi robot: paket, algoritma, dan loop kontrol yang membuat unit fisik MSD700 bergerak, merasakan lingkungan, dan membersihkan. Bagian ini tidak memiliki UI operator sendiri — untuk bagaimana subsistem ini muncul sebagai fitur yang dilihat operator di dashboard, lihat [ROS Web UI](/id/development/webui/).

## Paket Inti Robot

<LinkCards>
  <LinkCard icon="📦" title="Daftar Paket ROS" details="Direktori lengkap node, launch file, dan topic ROS 1 Noetic." link="/id/development/ros/ros-packages" />
</LinkCards>

## Persepsi & Lokalisasi

<LinkCards>
  <LinkCard icon="📡" title="Sensor Fusion & Kontrol" details="LiDAR Velodyne VLP-16, filtering IMU, dan estimasi state EKF." link="/id/development/ros/sensor-fusion-and-control" />
  <LinkCard icon="📐" title="Transformasi Koordinat (TF)" details="Pohon transformasi REP-103/105, offset sensor, dan restamping BoundaryPublisher." link="/id/development/ros/tf-transforms" />
</LinkCards>

## Navigasi & Perencanaan

<LinkCards>
  <LinkCard icon="🗺️" title="Costmap & Planner" details="Move base, global planner navfn, dan optimisasi trajektori lokal TEB." link="/id/development/ros/costmaps-and-planners" />
  <LinkCard icon="🔄" title="Pergantian Mode Dinamis" details="switch_mode.py, spawning proses roslaunch Python API, dan sequencer Autopilot." link="/id/development/ros/mode-switching" />
</LinkCards>

## Algoritma Pembersihan Cakupan

<LinkCards>
  <LinkCard icon="📐" title="Cakupan Boustrophedon" details="Dua model geometri, dekomposisi selular, dan alignment zero-spin." link="/id/development/ros/boustrophedon-and-alignment" />
</LinkCards>

## Perangkat Keras & Firmware

<LinkCards>
  <LinkCard icon="⚡" title="Firmware & Perangkat Keras" details="Protokol serial UART mikrokontroler, loop kecepatan PID, dan telemetri baterai." link="/id/development/ros/firmware-and-hardware" />
</LinkCards>

## Simulasi & Pengujian

<LinkCards>
  <LinkCard icon="🏭" title="Simulasi" details="Simulasi Gazebo berskala nyata, dunia AWS Small Warehouse, dan pengujian clearance." link="/id/development/ros/simulation" />
</LinkCards>
