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
- If another session is already driving (a second tab, another operator, or the unit's own local dashboard), the dashboard displays a dialog with **Take over control**, allowing you to explicitly transfer control to your window. The other session is ended visibly.
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
You drive with the **W A S D** keys; there are two fixed speeds:
- **Normal**: `0.40 m/s` forward.
- **Slow mode**: hold **Shift** for `0.20 m/s` precise movement, e.g. in tight spaces or while mapping.
:::

::: details 8. How long does the battery last and how is it monitored?
The robot is powered by a 24V LiFePO4 high-capacity battery pack providing **4 to 6 hours** of continuous autonomous operation:
- Live battery status is displayed in the dashboard header while you operate a unit.
- The dashboard surfaces a warning when the battery runs low. If you see one, wrap up the mission and send the robot back to its homebase charging station.
:::

::: details 9. Can I operate the robot if there is no internet connection in the building?
Yes. Every MSD700 robot runs an onboard web server. Connect your laptop directly to the robot's Wi-Fi hotspot (ask your administrator for its name) and open `http://<robot-ip>:3000` in Chrome or Edge. You can perform all mapping, teleoperation, and coverage routines completely offline. Note the dashboard requires a desktop-size browser window even offline: phones and tablets are not supported.
:::

::: details 10. How does the Emergency Stop work?
Clicking the red **Emergency Stop** button instantly overrides all active autonomous plans, brings the robot to a stop, and latches the safety state. The dashboard then shows an **Emergency Stop Activated** page: check the situation in the field, and when everything is safe, restart the robot and log in again via the **Go to LOGIN page** button.
:::

---

## Still have questions?

- Consult the [Troubleshooting Guide](/user-guide/troubleshooting).
- For hardware maintenance and installation, see [System Setup](/setup/system-setup).
