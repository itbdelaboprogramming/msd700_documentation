---
search: false
---

# Routes & Coverage

<RoleBadge role="user" />

Once you have a map, you can save reusable **routes** (a sequence of pins) and **areas** (a zone to sweep). Saved areas can also be chained into an **Operation Playlist** that sweeps all of them in one run.

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

The robot will plan an efficient back-and-forth sweep pattern that covers the full zone while staying out of any Avoided Areas.

::: tip Getting full coverage
Adjacent sweep passes overlap so no strip is missed. For the fewest turns, draw the area so its long edge roughly matches the direction you'd naturally sweep the room in.
:::

## Running a Coverage Sweep

1. Open the saved area from the list.
2. Click **Start Coverage**.
3. The robot sweeps the area lane by lane. Progress is shown as a percentage or a highlighted overlay on the map.
4. When finished, the status changes to **Complete**.

## Building an Operation Playlist

An Operation Playlist chains multiple saved **areas** into one run: it doesn't include routes, only cover and avoided areas.

1. Click **Operation Playlist** on the Navigation toolbar.
2. Add cover areas from your saved areas, in the order you want them swept (drag to reorder). Add any avoided areas too: they apply as keep-outs across the whole run, not as a sequence step.
3. Type a name and click **Save New** (or pick an existing playlist and click **Update**; rename it with the pencil icon, or **Delete** it).
4. Click **Run Playlist** to sweep the whole sequence in one dispatch. At least one cover area is required: a playlist made only of avoided areas is rejected before it reaches the robot.
5. To keep the run going after you close the dashboard, turn on **Autopilot** in the Robot Control panel.

## Renaming or Deleting

Double-click a route, area, or playlist name to rename it (duplicate names are handled automatically). Use the delete icon (or the **Delete** button, for playlists) to remove one you no longer need.

## Troubleshooting

**Robot skips part of the area**
: An Avoided Area may overlap the coverage zone. Review the area's shape and any overlapping Avoided Areas.

**Coverage sweep stops early / shows "Complete" but the area looks unfinished**
: The robot may have given up after repeated obstacles blocked its path. Check the live camera for anything blocking the aisle, clear it, and re-run coverage.

**"Save New" / "Run Playlist" is disabled**
: A playlist needs at least one cover area and a name before it can be saved or run; avoided areas alone aren't enough.
