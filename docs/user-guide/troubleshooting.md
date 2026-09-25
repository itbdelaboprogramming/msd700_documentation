---
outline: deep
search: false
---

# Operator Troubleshooting Guide

<RoleBadge role="user" />

This guide provides quick solutions for common operational symptoms encountered while controlling the MSD700 robot from the web dashboard.

::: info Ownership
Three troubleshooting pages share symptoms by role: this page owns operator fixes (select map, refresh, retry), [Setup Troubleshooting](/setup/troubleshooting) owns technician fixes, and [Developer Diagnostics](/development/troubleshooting-guide) owns root causes. If a fix needs a terminal, it belongs on one of those pages, linked from here.
:::

::: tip Technical or Hardware Diagnostics
For low-level server errors, Docker container logs, or ROS driver diagnostics, see the [Technician Troubleshooting Guide](/setup/troubleshooting) or [Developer Diagnostics](/development/troubleshooting-guide).
:::

## Operator Diagnostic Flowchart

![Operator Diagnostic Flowchart](./diagrams/troubleshooting-operator-diagnostic-flowchart.drawio)

---

## Common Issues and Solutions

### 1. Map Canvas is Blank or Infinite Loading Spinner
- **Symptom**: The navigation page opens, but the center area remains a dark grey area with a spinning loader.
- **Probable Causes**:
  - No map is currently open for this unit.
  - The browser's live connection to the robot was temporarily interrupted.
- **Operator Actions**:
  1. Open your facility map from the **Database** page (or the map selector on the Navigation page).
  2. If a map is selected but still blank, refresh your browser tab (`Ctrl + F5` or `Cmd + Shift + R`).
  3. Verify that the connection badge in the header displays **Connected** (green).

---

### 2. Live Camera Video Feed Frozen or Black
- **Symptom**: The camera window shows a frozen frame, spinning wheel, or black rectangle.
- **Probable Causes**:
  - Temporary signal loss on the Wi-Fi link between robot and server.
  - The browser blocked the video connection.
- **Operator Actions**:
  1. Click **Restart camera** (or **Try Again**) if it appears over the video; otherwise the feed reconnects automatically after a short delay.
  2. If using Chrome, ensure hardware acceleration is enabled in browser settings.
  3. If operating on a local facility network without internet, ensure you are connected to the robot's Wi-Fi hotspot and opening `http://mymsd.jp` (or `http://<robot-ip>:3000` on another local network).

---

### 3. Navigation Goal Aborted / Robot Refuses to Move
- **Symptom**: You set a 2D Nav Goal or start a route, but the robot beeps and the status immediately flips from `On Progress` back to `Idle` or `Goal Aborted`.
- **Probable Causes**:
  - The destination is inside a wall, inside an obstacle, or too close to a wall. Aim for wide-open floor areas.
  - The robot no longer knows where it is on the map.
- **Operator Actions**:
  1. Click a goal in wide, open free space (light grey area) well clear of walls and pillars.
  2. Click the **Auto Align** button on the toolbar to match what the sensor sees with the saved map.
  3. If Auto-Align fails, drive the robot forward 0.5 meters manually and re-trigger Auto-Align.

---

### 4. "Robot Stuck" Banner Won't Clear
- **Symptom**: An amber banner reads "Robot Stuck - Please adjust the robot position manually".
- **Probable Causes**:
  - A person, forklift, or newly placed box is blocking the planned path.
  - The robot is attempting an area coverage sweep in a tight corridor narrower than about 1.24 meters, the width it needs to turn around. It can enter corridors down to 0.80 m but cannot pivot in them.
- **Operator Actions**:
  1. Check the live camera feed and the red sensor dots on the canvas for nearby obstructions.
  2. If the path is blocked by transient objects, wait 10 seconds; the local planner automatically steers around obstacles once clearance opens.
  3. If the robot cannot resolve the pinch, click **Pause**, turn on **Manual Override**, and jog the robot into open floor space before resuming.

---

### 5. Control Locked: "In Use by Another Operator"
- **Symptom**: You open a robot and all drive buttons are disabled with an "In Use" banner.
- **Probable Causes**:
  - Another operator account in your organization is currently driving this unit.
  - You left another tab or laptop open logged into the same robot.
- **Operator Actions**:
  1. If the banner shows a different colleague's name, coordinate with them before requesting control.
  2. If the dialog shows another session of your own (e.g. from an old tab), click **Take over control**. The previous session is ended visibly and control transfers to your active window.

---

### 6. Emergency Stop Engaged
- **Symptom**: The dashboard shows an "Emergency Stop Activated" page and all movement is locked.
- **Probable Causes**:
  - An operator clicked the E-Stop button in the dashboard.
- **Operator Actions**:
  1. Verify that the physical robot environment is completely safe.
  2. Restart the robot, then log in again via the **Go to LOGIN page** button to resume operations.

---

### 7. Kicked Back to the Login Page
- **Symptom**: The dashboard suddenly returns you to the login page mid-operation.
- **Probable Causes**: Your login session expired, or the connection to the server timed out.
- **Operator Actions**:
  1. Log in again. The dashboard asks the robot what it is doing and restores your operation (see [How the Robot Behaves](/user-guide/behavior#coming-back)): nothing is lost unless the robot itself was paused or shut down meanwhile.

### 8. Blank Page on a Phone/Tablet, or "Desktop Only" Overlay
- **Symptom**: The dashboard refuses to render on a mobile device, or a blocking overlay covers a desktop window.
- **Probable Causes**: The dashboard only supports desktop-size browser windows. Small windows are blocked deliberately so a half-visible control bar can never drive a live robot.
- **Operator Actions**:
  1. Switch to a laptop or desktop with Chrome or Edge.
  2. If you see the overlay on a desktop, maximize the window (at least 1366 x 768) until it clears.

---

## Escalation Path

If the steps above do not resolve the issue:
1. Contact your on-site **Field Technician** to inspect physical hardware power and sensors.
2. Provide the technician with the robot's ID (shown in the dashboard header).
3. Refer the technician to the [Technician Troubleshooting Guide](/setup/troubleshooting).
