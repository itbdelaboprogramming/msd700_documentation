---
search: false
---

# Admin Console

<RoleBadge role="admin" />

The Admin Console is only visible to accounts with **Administrator** access. It's used to manage operators, robots, and rental profiles across all your units.

## Operators

1. Go to **Admin Console → Operators**.
2. Here you can see every operator account, invite new ones, and adjust their role or which rentals they can access.
3. To remove access, click **Remove** next to the operator's name.

## Units

The **Units** tab has two views: **Registered Units** (every registered robot) and **Pending** (new robots waiting for approval).

- A brand-new robot shows up under **Pending** first. An administrator reviews it there and clicks **Register** (or **Adopt**) to register it as a unit. Registering alone grants nobody access: who may drive it is decided by its rental assignment.
- The **Registered Units** view lists every registered robot: which rental it's rented to, its operator and map counts, when it was registered, and per-unit actions (Rename, Move data, Backup, Swap, Clear data, Unbind, Delete).
- **Unit Status** is checked live every few seconds, the same way the operator's unit table checks it. **On** shows what the robot is doing (**Ready**, **In use by** an operator, or **Starting up**) and its ping time in milliseconds. **Off** means it did not answer: it is switched off or has no internet connection. Point at the status for battery and how long it has been on.
- Operators see the same robots in the unit table right after logging in: select a **Ready** row and click **Start** to connect.

## Rentals

A **rental** groups together the maps, routes, and operators associated with a specific site or contract.

1. Go to **Rentals** to see all active rental profiles.
2. Create a new rental profile to set up a new site, then assign robots and operators to it.
3. Use **Backup** on a rental to archive all of its maps and routes: useful before making major changes or ending a contract.

## Backups

1. Go to **Admin Console → Backups**.
2. Choose to back up an entire **rental** or a single **unit's** data.
3. Click **Create Backup**: this downloads or stores an archive you can restore from later if needed.
4. To restore, select a backup file and click **Restore**. Restoring adds data back in; it won't overwrite maps that already exist under a different name.

## System Health

**System Health** shows whether the server side is working. Every admin can open it; it changes nothing.

- **Services**: the database, the backend, the MQTT broker that carries robot messages, the live link (live map and robot position), the web dashboard, the media server (map files) and camera signalling. Each says what it is for and whether it is working.
- **SSL certificates**: the website certificate (HTTPS) and the MQTT broker certificate, with the days left, when each was last renewed and when certbot renews it next. Robots refuse the broker once its certificate expires, even while the website still works.
- **Connections and ports**: every port the server uses, whether it answers, and how fast.

A status is **Working**, **Needs attention** (act soon), **Not working** (operators are likely affected) or **Not used**. When something needs action, a short note under it says what to do. **Details** lists the technical facts to pass to whoever maintains the server. The page checks again every 30 seconds; **Check now** checks at once.

## Admins (Superadmin Only)

If your account has superadmin privileges, the **Admins** tab lets you promote other operators to administrator, or revoke that access.

## Troubleshooting

**I don't see the Admin Console**
: Your account is set as an Operator, not an Administrator. Ask an existing administrator to upgrade your role.

**A robot shows Off although it is switched on**
: Off means the robot did not answer the server for about 12 seconds. Check its internet connection. If every robot shows Off, open **System Health**: the MQTT broker or its certificate is the usual cause.

**System Health says the MQTT broker certificate needs attention**
: The website certificate was renewed but the broker still uses the old one. Ask whoever maintains the server to rebuild the broker certificate (see [Maintenance § Certificates](/setup/maintenance#certificates)) before the date shown, or robots can no longer connect.

**A robot disappeared from the Units list**
: It may have been moved to a different rental, or is temporarily offline. Check its last-seen status.

**Restoring a backup didn't bring back a deleted robot's data**
: If the original robot no longer exists, the restore process will prompt you to remap the data to a different unit: follow the instructions in the console to complete the transfer.
