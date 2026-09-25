---
outline: deep
search: false
---

# Frequently Asked Questions (FAQ)

<RoleBadge role="user" />

Answers to common operational questions regarding the MSD700 robotic platform.

---

::: details 1. What is the MSD700 robot designed to do?
The MSD700 is a self-driving robot for indoor spaces like warehouses, office corridors, and plants. It builds floor plans as it drives, carries out point-to-point trips on its own, and systematically covers zones (e.g. for cleaning or inspection).
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
- **Standard Manual / Navigation Mode**: If the robot loses contact with your browser for **2 seconds**, it automatically executes a **Safety Motion Pause** and comes to a stop while keeping the mission in memory. Reconnecting your browser automatically resumes the mission.
- **Autopilot Mode ON**: If Autopilot is enabled, the robot ignores browser disconnections and finishes its whole route or playlist on its own before returning to its homebase.
:::

::: details 5. What is the Homebase point and why is it important?
Wherever the robot is standing when you click Play to start a new map becomes that map's home base (position zero). So park it at its charging or docking spot first. Future playlists use this point to send the robot back to its charging station automatically when a mission finishes. If you forget, you can correct it later from [Navigation](/user-guide/navigation) with **Set Home Base**.
:::

::: details 6. How does the robot handle glass walls, mirrors, or drop-offs?
The robot's sensor can see through clear glass or get confused by mirrors, so glass walls may be missing from the map. To protect the robot, draw an **Avoided Area** over all glass partitions and drop-offs (see [Routes & Coverage](/user-guide/routes-coverage)): the robot will treat that zone as off-limits.
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
Yes. Every MSD700 robot runs an onboard web server. Connect your laptop directly to the robot's Wi-Fi hotspot (ask your administrator for its name) and open `http://mymsd.jp` in Chrome or Edge (on another local network, `http://<robot-ip>:3000`). You can perform all mapping, teleoperation, and coverage routines completely offline. Note the dashboard requires a desktop-size browser window even offline: phones and tablets are not supported.
:::

::: details 10. How does the Emergency Stop work?
Clicking the red **Emergency Stop** button instantly overrides all active autonomous plans, brings the robot to a stop, and latches the safety state. The dashboard then shows an **Emergency Stop Activated** page: check the situation in the field, and when everything is safe, restart the robot and log in again via the **Go to LOGIN page** button.
:::

---

## Still have questions?

- Consult the [Troubleshooting Guide](/user-guide/troubleshooting).
- For hardware maintenance and installation, see [System Setup](/setup/system-setup).
