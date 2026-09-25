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

1. Turn the **Manual Override** toggle ON in the Robot Control panel.
2. Use the **W A S D** keys on your keyboard to drive:
   - **W**: move forward (`0.40 m/s`)
   - **S**: move backward
   - **A / D**: turn left / right
   - Hold **Shift** for slow mode (`0.20 m/s`) when precision matters
3. Release all keys (or click **Stop**) to halt the robot immediately.

::: info Note
Manual Override always takes priority over any automatic mission: the two toggles are mutually exclusive, so turning it on pauses autonomous driving.
:::

## Sending the Robot to a Point (Pinpoint)

1. Make sure Manual Override is **OFF**.
2. Click anywhere on the map where you want the robot to go.
3. A pin appears at that location. Confirm to send the robot.
4. The robot automatically plans a path and steers around obstacles along the way.
5. Watch the **status display** for progress: "On Progress", "Arrived", or "Robot Stuck" if something is blocking the way.

You can queue several stops in order and save them as a reusable route (see [Routes & Coverage](/user-guide/routes-coverage)).

### Reading the Map Canvas

While the robot is moving, the canvas shows a few indicators worth knowing:

- **Blue line**: the planned path across the map.
- **Green/red short path**: the few meters the robot is actively following right now.
- **Red dots**: what the robot's sensor currently sees around it.
- **Translucent outline around the robot**: its safety zone; the robot keeps this clear of obstacles.

## Auto Align

If the robot's position on the map looks slightly off (for example, after moving it by hand), use **Auto Align** to correct it without spinning in place:

1. Click **Auto Align** on the toolbar.
2. The robot compares what its sensor sees with the saved map to fix its position, usually in under a second and without moving.
3. Wait for the confirmation message before sending a new goal.

## Autopilot (Unattended Missions)

Autopilot keeps a running, unattended operation alive on the robot even after you close the browser tab — whether that's a route you're driving through or an [Operation Playlist](/user-guide/routes-coverage) sweep.

1. Start the operation: load a saved route and click **Play**, or open **Operation Playlist** and click **Run Playlist**.
2. Turn the **Autopilot** toggle ON in the Robot Control panel.
3. The robot keeps working through it automatically. You can close the dashboard: the mission keeps running on the robot itself.
4. To stop early, reopen the dashboard and turn **Autopilot** OFF (you'll be asked to confirm).

## Pausing and Resuming

- Click **Pause** to freeze the robot in place at any time.
- Click **Resume** to continue exactly where it left off.
- If you refresh the browser while a mission is in progress, the dashboard automatically reconnects and shows the current state: you won't lose your place.

## Troubleshooting

**Robot shows "Stuck"**
: Something is blocking the planned path. Check the live camera, clear the obstacle if possible, then click Resume.

**Clicking on the map does nothing**
: Manual Override may still be ON: turn it off first, or check that you're connected to the correct robot (see the connection indicator).

**Robot pauses before turning instead of spinning on the spot**
: This is expected: the planner prefers a safe path over turning in place. Give it a moment to find its way.

**Autopilot mission stopped after I closed the tab**
: This shouldn't happen: Autopilot runs on the robot, not the browser. If it did, check with your administrator; there may be a connectivity issue.
