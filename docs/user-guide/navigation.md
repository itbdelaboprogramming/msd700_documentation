---
search: false
---

# Navigation

<RoleBadge role="user" />

The Navigation screen is where you drive and dispatch the robot on a map you've already created. If you haven't made a map yet, start with [Mapping](/user-guide/mapping) first.

## Opening a Map

1. From the main menu, select **Navigation**.
2. Choose a saved map from the list, or the last-used map loads automatically.
3. The map appears on screen with the robot's current position marked as a colored arrow.

## Manual Control (Joystick / WASD)

Use manual control when you want to drive the robot yourself, step by step.

1. Click the **Manual Control** button to activate it.
2. Use the **W A S D** keys on your keyboard to drive:
   - **W**: move forward (`0.40 m/s`)
   - **S**: move backward
   - **A / D**: turn left / right
   - Hold **Shift** for slow mode (`0.20 m/s`) when precision matters
3. Release all keys (or click **Stop**) to halt the robot immediately.

::: info Note
Manual control always takes priority over any automatic mission. If Autopilot is running, taking manual control will pause it.
:::

## Sending the Robot to a Point (Pinpoint)

1. Make sure Manual Control is **off**.
2. Click anywhere on the map where you want the robot to go.
3. A pin appears at that location. Click **Go** (or confirm) to send the robot.
4. The robot automatically plans a path and avoids obstacles along the way.
5. Watch the **status bar** for progress: "Moving", "Arrived", or "Stuck" if something is blocking the way.

You can also drop multiple pins in sequence: the robot visits them in order.

### Reading the Map Canvas

While the robot is moving, the canvas overlays a few indicators worth knowing:

- **Blue line**: the planned path across the map.
- **Green/red trajectory**: the short-range path the robot is actively following right now (up to a few meters ahead).
- **Red dots**: live LiDAR points, showing what the robot currently sees.
- **Translucent outline around the robot**: its safety footprint; the path planner keeps this clear of obstacles.

## Auto Align

If the robot's position on the map looks slightly off (for example, after moving it by hand), use **Auto Align** to correct it without spinning in place:

1. Click **Auto Align** on the toolbar.
2. The robot matches its live LiDAR scan against the map to fine-tune its position, usually in well under a second, without moving. In a symmetric corridor it may jog a few centimeters forward and back to disambiguate heading.
3. Wait for the confirmation message before sending a new goal.

## Autopilot (Unattended Missions)

Autopilot lets the robot run a pre-planned route or playlist on its own, even if you close the browser tab.

1. Select a saved [route or playlist](/user-guide/routes-coverage).
2. Click **Start Autopilot**.
3. The robot works through each waypoint automatically. You can close the dashboard: the mission keeps running on the robot itself.
4. To stop early, reopen the dashboard and click **Stop Autopilot**.

## Pausing and Resuming

- Click **Pause** to freeze the robot in place at any time.
- Click **Resume** to continue exactly where it left off.
- If you refresh the browser while a mission is in progress, the dashboard automatically reconnects and shows the current state: you won't lose your place.

## Troubleshooting

**Robot shows "Stuck"**
: Something is blocking the planned path. Check the live camera, clear the obstacle if possible, then click Resume.

**Clicking on the map does nothing**
: Manual Control may still be active: turn it off first, or check that you're connected to the correct robot (see the connection indicator).

**Robot pauses before turning instead of spinning on the spot**
: This is expected: the planner prefers a safe path over turning in place. Give it a moment to find its way.

**Autopilot mission stopped after I closed the tab**
: This shouldn't happen: Autopilot runs on the robot, not the browser. If it did, check with your administrator; there may be a connectivity issue.
