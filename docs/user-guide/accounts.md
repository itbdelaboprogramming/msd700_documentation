---
search: false
---

# Accounts & Access

<RoleBadge role="user" />

## Logging In

1. Open the dashboard URL in your web browser (ask your administrator for the address if you don't have it).
2. Enter your **username** and **password**.
3. Click **Proceed**.

If you don't have an account yet, click **Sign Up** and fill in your username, full name, email, and password (twice, to confirm). An administrator must assign your new account to a rental before any robots appear for you.

## Operator vs. Administrator

There are two kinds of users:

| Role | What they can do |
| --- | --- |
| **Operator** | Control robots, create maps, run navigation and coverage missions, view live camera. |
| **Administrator** | Everything an operator can do, plus manage other operators, robots, and rental profiles in the [Admin Console](/user-guide/admin-console). |

Your role is assigned by your administrator: you can't change it yourself.

## Choosing a Unit (Robot)

If your account has access to more than one robot, you'll see a list after logging in:

1. Each robot shows its **name**, **status** (Ready / In Use / Pinging / Not Set), and battery level.
2. Click a robot to connect to it.
3. If a robot shows **"In Use"**, another session is currently controlling it: you can still open it, but to drive you must take over explicitly. A dialog ("This unit is already being operated from …") offers **Take over control** (the other session is ended visibly) or **Leave it running**.

## Working Offline (Local Mode)

If you're on-site at a facility with no internet access, you can still use the full dashboard by connecting directly to the robot instead of the cloud:

1. Connect your laptop to the robot's onboard Wi-Fi hotspot (ask your administrator for its name).
2. Open `http://mymsd.jp` in Chrome or Edge instead of the usual cloud address. (On a different local network, use `http://<robot-ip>:3000`.) Mapping, navigation, and coverage all work exactly as they do online.
3. Once the robot is back on internet-connected Wi-Fi, use the **Sync** option in the dashboard to push anything recorded offline up to the cloud database.

## Logging Out

Logging out does **not** stop an unattended mission (Autopilot): the mission keeps running so it isn't interrupted by accident.

## Troubleshooting

**"The username or password you entered is incorrect"**
: Double-check your username and password. If you forgot your password, contact your administrator. (If the page instead says it can't reach the server, nothing is wrong with what you typed: check your connection.)

**No robots appear after login**
: Your account may not be assigned to any rental yet. Contact your administrator to be added.

**Robot always shows "In Use"**
: Another operator may have left a session open. Ask your administrator to check, or use the takeover option if available to your role.
