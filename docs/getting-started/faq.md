---
outline: deep
search: false
---

# Frequently Asked Questions (FAQ)

<RoleBadge role="user" />

Answers to common operational questions regarding the MSD700 robotic platform.

---

::: details 1. What is the MSD700 robot designed to do?
The MSD700 is an autonomous mobile robot platform designed for environmental mapping (SLAM), autonomous point-to-point transport, and systematic area coverage (e.g. floor cleaning, disinfection, or surface scanning) in indoor facilities such as warehouses, office corridors, and industrial plants.
:::

::: details 2. I logged into the dashboard, but the fleet list is empty. Why?
Your user account exists, but an administrator has not yet assigned it to a **Rental Profile** containing active robots. Contact your facility administrator or lab supervisor to grant your account access to your organization's rental profile.
:::

::: details 3. Can two operators control the same robot simultaneously?
No. To ensure safety, each robot is governed by an **exclusive operating lease** held by a single active session:
- If a colleague is operating the robot, the unit displays an **In Use** badge and commands are blocked.
- If you open a second tab or switch devices under your own account, the dashboard displays a **Take Over Control** button, allowing you to explicitly transfer the lease to your new window.
:::

::: details 4. What happens if my laptop loses Wi-Fi or closes while the robot is moving?
The system responds based on the active operating mode:
- **Standard Manual / Navigation Mode**: If the robot loses contact with your browser for **10 seconds**, it automatically executes a **Safety Motion Pause** and comes to a stop while keeping the mission in memory. Reconnecting your browser automatically resumes the mission.
- **Autopilot Mode ON**: If Autopilot is enabled, the robot ignores browser disconnections and autonomously completes its entire waypoint sequence or area coverage playlist before returning to its homebase.
:::

::: details 5. What is the Homebase point and why is it important?
When creating a map during a SLAM session, clicking **Set Homebase Here** records the robot's physical docking station coordinates $(x=0, y=0, \theta=0)$. Future automated playlists use this coordinate to automatically navigate the robot back to its charging station upon completing a mission.
:::

::: details 6. How does the robot handle glass walls, mirrors, or drop-offs?
Optical 2D/3D LiDAR beams can penetrate clear glass or scatter off reflective mirrors, which may cause invisible boundaries on a raw SLAM map. To protect the robot:
1. Open the map in the dashboard.
2. Use the **Keep-Out Zone** tool to draw virtual red exclusion boundaries along all glass partitions and drop-offs.
3. The motion planner treats these virtual lines as solid impenetrable walls.
:::

::: details 7. How fast does the robot drive?
Maximum speed limits are enforced in software for workplace safety:
- **Default Speed**: `0.20 m/s` (approx. 0.72 km/h).
- **Adjustable Range**: You can adjust linear speed between `0.05 m/s` and `0.40 m/s` using the speed slider in the bottom-right control panel.
- **Angular Turning Speed**: Configurable up to `0.50 rad/s`.
:::

::: details 8. How long does the battery last and how is it monitored?
The robot is powered by a 24V LiFePO4 high-capacity battery pack providing **4 to 6 hours** of continuous autonomous operation:
- Live battery voltage and percentage are displayed in the top header bar.
- If the battery falls below **20%**, the dashboard surfaces an amber warning.
- If the battery falls below **15%**, running missions are paused and the robot prioritizes returning to its homebase charging station.
:::

::: details 9. Can I operate the robot if there is no internet connection in the building?
Yes. Every MSD700 robot runs an onboard web server. Connect your laptop or tablet directly to the robot's Wi-Fi network (`MSD700_Unit_<ULID>`) and open `http://<jetson-ip>:3000`. You can perform all mapping, teleoperation, and coverage routines completely offline.
:::

::: details 10. How does the Emergency Stop work?
Clicking the red **Emergency Stop** button (or pressing the `Escape` key on your keyboard) instantly overrides all active autonomous plans, brings motor velocity to zero within milliseconds, and latches the safety state. To resume operations, resolve the safety condition and click **Release Emergency Stop**.
:::

---

## Still have questions?

- Consult the [Operator Troubleshooting Guide](/getting-started/troubleshooting).
- For hardware maintenance and installation, see [System Setup](/setup/system-setup).
