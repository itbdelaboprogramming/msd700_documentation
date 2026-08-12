# Quick Start

<RoleBadge role="user" />

This page walks you through using MSD700 for the first time, assuming a technician has already
installed and enrolled the unit (see [Setup](/setup/) if that hasn't happened yet).

## Before you start

You'll need:

- An **account** on the MSD700 dashboard. Sign up at the login page, or ask your lab admin to create
  one for you.
- Access to at least one **unit**, granted by an admin through a rental profile. A brand-new account
  can log in but won't see any units until an admin adds it to one.
- A modern desktop browser (Chrome or Edge recommended, since the dashboard uses WebRTC for the live
  camera feed, which some browsers restrict on non-HTTPS pages).

::: info Desktop only
The dashboard is designed for a single, reasonably large browser window (1400×720 or bigger): the
map, controls and camera feed all need to be visible at once. It isn't meant for phones or small
tablets.
:::

## Step 1: Log in

Open [msd.nglobal.jp](https://msd.nglobal.jp) and sign in with your account. If you don't have one
yet, use the **Sign up** link on the same page; an admin still needs to grant you access to a unit
before you'll see anything useful.

## Step 2: Pick a unit

After logging in you land on the **Unit Dashboard**, which lists every unit your account has access
to. Click one to open it.

- A unit marked **In Use** already has an operator connected. You can still open it: the badge just
  tells you someone else is currently driving, and taking over control is an explicit action, not
  something that happens by opening the page.
- If the list is empty, nobody has granted your account access to a unit yet. Ask your admin.

## Step 3: Choose what to do

Opening a unit takes you to its **Navigation** page. From there:

- If a map already exists for this unit, it loads automatically and you can start driving or sending
  the robot to a point.
- If no map exists yet, go to the **Mapping** page first to build one (see
  [Features](/getting-started/features)). This is normally done once per new area, often by a
  technician.

## Step 4: Everyday use

Once a map is loaded, the Navigation page is where you'll spend most of your time:

- **Drive manually** with the on-screen controls or the W-A-S-D keys on your keyboard.
- **Click a point on the map** to send the robot there directly.
- **Queue several points** as a playlist and switch on **Autopilot** to have the robot visit them
  one after another, unattended.
- Watch the **live camera feed** to see what the robot sees.
- Use the **Emergency Stop** button any time: it works immediately, regardless of what the robot is
  doing.

If you close the browser or lose connection mid-operation, the robot pauses itself automatically as
a safety measure; see [FAQ](/getting-started/faq) for exactly when that happens.

## What's next

- Explore the full list of [Features](/getting-started/features).
- Check the [FAQ](/getting-started/faq) for common questions.
- If something isn't working, see [Troubleshooting](/getting-started/troubleshooting).
