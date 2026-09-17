---
search: false
---

# Accounts & Access

<RoleBadge role="user" />

## Logging In

1. Open the dashboard URL in your web browser (ask your administrator for the address if you don't have it).
2. Enter your **email/username** and **password**.
3. Click **Log In**.

If you don't have an account yet, click **Sign Up** and fill in your details. A fleet administrator may need to approve your account or assign you to a rental before you can see any robots.

## Operator vs. Administrator

There are two kinds of users:

| Role | What they can do |
| --- | --- |
| **Operator** | Control robots, create maps, run navigation and coverage missions, view live camera. |
| **Administrator** | Everything an operator can do, plus manage other operators, robots, and rental profiles in the [Admin Console](/user-guide/admin-console). |

Your role is assigned by your administrator: you can't change it yourself.

## Choosing a Unit (Robot)

If your account has access to more than one robot, you'll see a list after logging in:

1. Each robot shows its **name**, **status** (Online / Offline / In Use), and battery level.
2. Click a robot to connect to it.
3. If a robot shows **"In Use"**, another session is currently controlling it: you can still open it, but to drive you must take over explicitly. A dialog ("This unit is already being operated from …") offers **Take over control** (the other session is ended visibly) or **Leave it running**.

## Working Offline (Local Mode)

If you're on-site at a facility with no internet access, you can still use the full dashboard by connecting directly to the robot instead of the cloud:

1. Connect your laptop to the robot's onboard Wi-Fi hotspot (ask your administrator for its name).
2. Open `http://<robot-ip>:3000` in Chrome or Edge instead of the usual cloud address. Mapping, navigation, and coverage all work exactly as they do online.
3. Once the robot is back on internet-connected Wi-Fi, use the on-screen **Sync** option to push anything recorded offline up to the cloud database.

## Logging Out

Click your account name in the top corner, then **Log Out**. If the robot is running an unattended mission (Autopilot), logging out does **not** stop it: the mission keeps running so it isn't interrupted by accident.

## Troubleshooting

**"Invalid credentials" when logging in**
: Double-check your email and password. If you forgot your password, contact your administrator.

**No robots appear after login**
: Your account may not be assigned to any rental yet. Contact your administrator to be added.

**Robot always shows "In Use"**
: Another operator may have left a session open. Ask your administrator to check, or use the takeover option if available to your role.
