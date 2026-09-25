---
outline: deep
search: false
---

# Quick Start Guide

<RoleBadge role="user" />

This guide walks you through logging in to the MSD700 dashboard, taking control of an assigned robot unit, loading a map, and executing your first navigation mission.

## Prerequisites

Before starting, ensure you have:
1. An active user account on the dashboard.
2. At least one robot assigned to your account by an administrator.
3. Google Chrome or Microsoft Edge on a laptop or desktop computer.

---

## Step 1: Log In to the Dashboard

1. Open your browser and navigate to: `https://msd.nglobal.jp`.
2. Enter your username and password, then click **Proceed**.

![Step 1: Log In to the Dashboard](./diagrams/quick-start-step-1-log-in-to-the-dashboard.drawio)

---

## Step 2: Select a Robot Unit

After logging in, a table lists all robots assigned to your rental profile:

| Status | Meaning | What to do |
| --- | --- | --- |
| **Ready** | Robot is connected and free. | Select its row and click **Start**. |
| **In Use** | Another operator is driving it. | Wait, or coordinate with them. |
| **Pinging** | The dashboard is still checking on it. | Wait a few seconds; it updates automatically. |
| **Not Set** | Robot can't be reached right now. | Wait for it to reconnect or check hardware power. |

Select a **Ready** row and click **Start**: the dashboard opens [Navigation](/user-guide/navigation) (or [Mapping](/user-guide/mapping), if that is what the robot is doing).

---

## Step 3: Understand the Operator Workspace

The operator interface is divided into three main operational panels:

![Step 3: Understand the Operator Workspace](./diagrams/quick-start-step-3-understand-the-operator-workspace.drawio)

---

## Step 4: Load a Map

1. Open a map from the **Database** page (or the map selector on the Navigation page).
2. Choose a saved map (e.g. `Warehouse_Floor_1`).
3. The 2D floor plan appears on the canvas along with the robot's current position (robot icon with direction arrow).

::: tip No map available?
If no maps exist in the dropdown, see [Mapping](/user-guide/mapping) to create your first map.
:::

---

## Step 5: Drive Manually (Teleoperation)

You drive the robot manually with your keyboard:

![Step 5: Drive Manually (Teleoperation)](./diagrams/quick-start-step-5-drive-manually-teleoperation.drawio)

### Teleoperation Controls:
- **W / S**: Drive forward / backward at normal speed (`0.40 m/s`).
- **A / D**: Turn left / right.
- **Hold Shift for slow mode**: Precise movement at `0.20 m/s` for tight spaces and mapping. The hint under the controls reads "Drive with W A S D · hold Shift = slow".
- **Release all keys** (or click **Stop**) to halt the robot immediately.

---

## Step 6: Dispatch a Navigation Goal (Point-to-Point)

To send the robot to a target destination autonomously:

1. Click **Single Pinpoint** on the canvas toolbar.
2. Click on the desired destination point on the map.
3. Click and drag outward to orient the target heading arrow, then release.
4. The robot calculates a collision-free global path (blue line) and navigates autonomously to the target.

![Step 6: Dispatch a Navigation Goal (Point-to-Point)](./diagrams/quick-start-step-6-dispatch-a-navigation-goal-point.drawio)

---

## Step 7: Emergency Stop (E-Stop)

The **Emergency Stop** button is prominently located at the top right of every page:

- **Activate E-Stop**: Click the red **Emergency Stop** button. The robot brakes immediately and halts all autonomous routines.
- **After E-Stop**: The dashboard shows an **Emergency Stop Activated** page. Check the situation in the field; when everything is safe, restart the robot and log in again via the **Go to LOGIN page** button to resume operations.

---

## Next Steps

- Learn how to perform systematic area coverage in [Routes & Coverage](/user-guide/routes-coverage).
- Understand safety timers and Autopilot in [How the Robot Behaves](/user-guide/behavior).
