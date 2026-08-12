# Features

<RoleBadge role="user" />

An overview of what you can do with MSD700 once a unit is set up and you have access to it.

| Feature | Description | Learn more |
| --- | --- | --- |
| Manual driving | Drive the robot with on-screen controls or the W-A-S-D keys, with an on-screen Emergency Stop always available. | [Quick Start](/getting-started/quick-start) |
| Click-to-navigate | Click a point on the map and the robot plans a path and drives there on its own. | [Quick Start](/getting-started/quick-start) |
| Autopilot playlists | Queue up several waypoints in order and let the robot visit all of them unattended; you can still pause or take over at any time. | [Quick Start](/getting-started/quick-start) |
| Autonomous mapping | Drive (or let the robot explore) an unmapped area once, and it builds a reusable map via SLAM. | [Mapping page](#autonomous-mapping) |
| Autonomous area coverage | Give the robot a boundary (a saved or custom-drawn area) and it sweeps it systematically, avoiding places you've marked as no-go. | [Mapping page](#area-coverage) |
| Live camera feed | Watch a live video stream from the robot's onboard camera while you drive or monitor it. | - |
| Map Database | Save, rename, and reopen maps, routes, custom areas, and playlists for later use. | - |
| Multi-unit access | See every unit your account has access to from one dashboard, and switch between them. | [Quick Start](/getting-started/quick-start) |
| Session handoff | Only one operator actively drives a unit at a time; taking over is an explicit, visible action. | [How the Robot Behaves](/getting-started/behavior#only-one-person-drives-at-a-time) |
| Automatic safety pause | If your connection drops mid-operation, the robot pauses itself rather than continuing blind. | [How the Robot Behaves](/getting-started/behavior#what-happens-when-you-disconnect) |
| Session recovery | Refresh, close the tab, or log in from another machine: the running operation comes back intact. | [How the Robot Behaves](/getting-started/behavior#coming-back) |
| Local operation | Every unit also serves its own dashboard on its own address, and keeps working with no internet at all. | [Unit Setup](/setup/unit-setup#_6-the-unit-s-own-dashboard-always-on) |

## Autonomous mapping

Used the first time a unit operates in a new area, or whenever the environment changes enough that
the old map no longer matches. You drive (or let the robot explore) the space once; the system
builds a map from what the lidar sees. Save the finished map from the Mapping page, and it becomes
selectable from then on. Most day-to-day operation after that uses [Navigation](/getting-started/quick-start),
not Mapping.

## Area coverage

Rather than driving to a single point, area coverage sends the robot back and forth across a whole
region until it's fully swept, useful for inspection or cleaning-style tasks. You can draw a custom
area shape and mark parts of it as off-limits; the robot's path plan works around those automatically.

### Drawing a custom area

You can draw an area on the map yourself rather than picking a saved one. Points are placed in
order and the shape closes when you come back near the first point, so the outline you draw is the
outline the robot sweeps. A draft survives a page refresh, so you do not lose a half-drawn area to a
stray reload.

Areas can be marked **cover** or **no-cover**. No-cover areas are subtracted from every cover area in
the run, not just the one you drew them inside.

### Operation playlists

Several areas can be saved together as an ordered playlist, and the robot sweeps them one after
another. A playlist keeps its own copy of each area's shape, so renaming or deleting the original
area later does not break a playlist that used it.

## Related

- [How the Robot Behaves](/getting-started/behavior): what the robot does on its own
- [Introduction](/getting-started/introduction): what MSD700 is
- [FAQ](/getting-started/faq): common questions
