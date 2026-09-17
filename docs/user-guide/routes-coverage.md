---
search: false
---

# Routes & Coverage

<RoleBadge role="user" />

Once you have a map, you can save reusable **routes** (a sequence of points) and **areas** (a zone to sweep), then chain them into a **playlist** the robot runs automatically.

## Saving a Route

1. In [Navigation](/user-guide/navigation), drop pins on the map for each stop you want the robot to visit, in order.
2. Open the **Save Route** dialog.
3. Give the route a name (for example, "Morning Patrol") and confirm.

The route now appears under **Routes** and can be reused any time without re-clicking every point.

## Drawing a Coverage Area

Coverage areas tell the robot to systematically sweep an entire zone: for example, an aisle or an open room: rather than just visiting single points.

1. Draw the zone on the map toolbar by clicking to place corner points around it, following the edges of the room or aisle.
2. Double-click (or click the first point again) to close the shape.
3. In the save dialog, choose the area type: **Covered Area** (the robot sweeps it) or **Avoided Area** (the robot stays out of it entirely, e.g. around glass partitions or drop-offs).
4. Enter an area name and click **Save**.

The robot will plan an efficient back-and-forth (boustrophedon) sweep pattern that covers the full zone while avoiding any keep-out areas.

::: tip Getting full coverage
Adjacent sweep passes overlap so no strip is missed. For the fewest turns, draw the area so its long edge roughly matches the direction you'd naturally sweep the room in.
:::

## Running a Coverage Sweep

1. Open the saved area from the list.
2. Click **Start Coverage**.
3. The robot sweeps the area lane by lane. Progress is shown as a percentage or a highlighted overlay on the map.
4. When finished, the status changes to **Complete**.

## Building a Playlist

A playlist chains multiple routes and coverage areas into one unattended sequence.

1. Go to **Playlists** and click **New Playlist**.
2. Add routes and/or coverage areas in the order you want them run.
3. Optionally set a pause (dwell time) at a specific waypoint, for example to wait 30 seconds at an inspection checkpoint.
4. Save the playlist with a descriptive name.
5. From [Navigation](/user-guide/navigation), select the playlist and click **Start Autopilot** to run the whole sequence automatically.

## Renaming or Deleting

Double-click a route, area, or playlist name to rename it (duplicate names are handled automatically). Use the delete icon to remove one you no longer need.

## Troubleshooting

**Robot skips part of the area**
: A keep-out zone may overlap the coverage area. Review the area's shape and any overlapping keep-out zones.

**Coverage sweep stops early / shows "Complete" but the area looks unfinished**
: The robot may have given up after repeated obstacles blocked its path. Check the live camera for anything blocking the aisle, clear it, and re-run coverage.

**Playlist doesn't continue to the next item**
: Make sure Autopilot is still active: pausing manually will pause the whole playlist, not just the current step. Click Resume to continue.
