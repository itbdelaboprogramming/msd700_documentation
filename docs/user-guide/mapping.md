---
search: false
---

# Mapping

<RoleBadge role="user" />

Before the robot can navigate a space, it needs a **map** of that space. Mapping is the process of driving the robot around so it can build that map automatically.

## Starting a New Map

1. Move the robot to its intended charging or parking spot first: wherever it's standing when you click Play becomes the map's **home base**, used later to send it back here automatically.
2. From the main menu, select **Mapping**.
3. Click **Create a New Map** and give it a name (for example, "Warehouse Floor 2").
4. Click **Play** to begin recording.

## Building the Map

You can build a map in two ways:

- **Manual driving**: Use the **W A S D** keys (hold **Shift** for slow `0.20 m/s` mode) to drive the robot slowly around the entire area, including corners and dead ends, so nothing is missed.
- **Autonomous exploration**: Turn the **Autopilot** toggle ON in the Robot Control panel and the robot investigates the area on its own, backing off automatically if it senses it's cornered. (Manual Override must be off: driving yourself always wins.)

As you drive, the map fills in on screen in real time: walls and obstacles appear as dark lines, open floor appears in a lighter shade.

## Pausing and Reviewing

- Click **Pause** at any time to stop recording and check the map so far.
- Click **Play** again to resume from where you left off: nothing is lost.
- Drive back over an area if a section looks incomplete or noisy.

## Saving the Map

1. Once the area is fully covered, click **Stop**.
2. Confirm the map name and click **Save**.
3. The finished map (grid, thumbnail, and homebase position) now appears in [Maps & Database](/user-guide/database), ready to use for [Navigation](/user-guide/navigation).

::: warning Don't close the browser mid-recording
Closing the tab while Play is active may lose unsaved progress. Always click Stop and Save first.
:::

## Tips for a Good Map

- Drive at a moderate, steady speed: going too fast can blur sensor readings.
- Cover every room, corridor, and doorway you plan to navigate later.
- Avoid highly reflective or glass surfaces where possible; they can confuse the laser sensor.
- If a room looks patchy or misaligned afterward, it's usually faster to re-record that section than to try to fix it manually.

## Troubleshooting

**Map looks distorted or walls don't line up**
: The robot may have moved too fast, or wheels slipped on a surface. Pause, back up to the last good section, and continue more slowly.

**Robot stopped moving with Autopilot running**
: It may believe the area is fully explored, or it's stuck near an obstacle. Turn on Manual Override to finish any missed corners.

**"Save" button is greyed out**
: Make sure recording is stopped (not just paused) and the map has a name entered.

**Forgot to start from the charging spot**
: The home base was captured from wherever the robot stood when you clicked Play. You don't need to re-record: open the map in [Navigation](/user-guide/navigation), drive the robot to the correct spot, and use **Set Home Base** on the toolbar to update it.
