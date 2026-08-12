# Introduction

<RoleBadge role="user" />

## What is MSD700?

MSD700 is an autonomous mobile robot platform built by **ITB de Labo Research Lab**. Its original
purpose is mapping and navigating **featureless indoor spaces** (tunnels, corridors, and similar
areas with few visual landmarks) on its own: the robot builds a map of an area by driving through
it (SLAM), and afterwards uses that map to localize itself and move from point to point without
being driven by hand.

You interact with all of that through a **web dashboard**: you don't need to know ROS, Linux, or
anything about the robot's internals to use it day-to-day. This section covers that dashboard.

The system has two halves:

- **MSD700 Server**: the cloud service at [msd.nglobal.jp](https://msd.nglobal.jp) that hosts the
  web dashboard, keeps track of accounts, maps, routes and saved playlists, and relays commands to
  robots.
- **MSD700 Unit**: the physical robot itself. There can be more than one; each one is identified by
  a unique ID and shows up as a separate entry in the dashboard once your account has access to it.

If you're installing or configuring either of these, see the [Setup](/setup/) guide instead. This
section only covers using the dashboard once someone else has already set everything up.

## Who this section is for

The **Getting Started** section is written for **end users**: people who log into the dashboard to
drive, monitor, or map with a robot that a technician has already installed and connected. You do
not need any technical or programming background to follow these pages.

| If you want to... | Go to... |
| --- | --- |
| Learn how to use MSD700 for the first time | [Quick Start](/getting-started/quick-start) |
| See what MSD700 can do | [Features](/getting-started/features) |
| Fix a problem you're running into | [Troubleshooting](/getting-started/troubleshooting) |
| Install or configure the server/unit | [Setup](/setup/) |
| Understand the codebase or API | [Documentation](/development/) |

## Next steps

Continue to [Quick Start](/getting-started/quick-start) to start using the system.
