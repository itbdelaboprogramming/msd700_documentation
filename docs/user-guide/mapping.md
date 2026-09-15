---
search: false
---

# Mapping

<RoleBadge role="user" />

Before the robot can navigate a space, it needs a **map** of that space. Mapping is the process of driving the robot around so it can build that map automatically.

## Starting a New Map

1. From the main menu, select **Mapping**.
2. Click **New Map** and give it a name (for example, "Warehouse Floor 2").
3. Click **Play** to begin recording.

## Building the Map

You can build a map in two ways:

- **Manual driving**: Use the joystick or **W A S D** keys to drive the robot slowly around the entire area, including corners and dead ends, so nothing is missed.
- **Autonomous exploration**: Click **Auto Explore** and the robot investigates the area on its own, backing off automatically if it senses it's cornered.

As you drive, the map fills in on screen in real time: walls and obstacles appear as dark lines, open floor appears in a lighter shade.

## Pausing and Reviewing

- Click **Pause** at any time to stop recording and check the map so far.
- Click **Play** again to resume from where you left off: nothing is lost.
- Drive back over an area if a section looks incomplete or noisy.

## Saving the Map

1. Once the area is fully covered, click **Stop**.
2. Confirm the map name and click **Save**.
3. The finished map now appears in [Maps & Database](/user-guide/database), ready to use for [Navigation](/user-guide/navigation).

::: warning Don't close the browser mid-recording
Closing the tab while Play is active may lose unsaved progress. Always click Stop and Save first.
:::

## Tips for a Good Map

- Drive at a moderate, steady speed: going too fast can blur sensor readings.
- Cover every room, corridor, and doorway you plan to navigate later.
- Avoid highly reflective or glass surfaces where possible; they can confuse the LiDAR sensor.
- If a room looks patchy or misaligned afterward, it's usually faster to re-record that section than to try to fix it manually.

## Troubleshooting

**Map looks distorted or walls don't line up**
: The robot may have moved too fast, or wheels slipped on a surface. Pause, back up to the last good section, and continue more slowly.

**Robot stopped moving during Auto Explore**
: It may believe the area is fully explored, or it's stuck near an obstacle. Switch to manual driving to finish any missed corners.

**"Save" button is greyed out**
: Make sure recording is stopped (not just paused) and the map has a name entered.
