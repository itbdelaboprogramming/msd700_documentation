---
search: false
---

# Admin Console

<RoleBadge role="admin" />

The Admin Console is only visible to accounts with **Administrator** access. It's used to manage operators, robots, and rental profiles across your fleet.

## Operators

1. Go to **Admin Console → Operators**.
2. Here you can see every operator account, invite new ones, and adjust their role or which rentals they can access.
3. To remove access, click **Remove** next to the operator's name.

## Units & Fleet

The **Units** tab has two views: **Fleet** (every registered robot) and **Pending** (new robots waiting for approval).

- A brand-new robot shows up under **Pending** first. An administrator reviews it there and clicks **Register** (or **Adopt**) to accept it into the fleet. Registering alone grants nobody access: who may drive it is decided by its rental assignment.
- The **Fleet** view lists every registered robot: which rental it's rented to, its operator and map counts, when it was registered, and per-unit actions (Rename, Move data, Backup, Swap, Clear data, Unbind, Delete). It doesn't show live connection status: that's only in the operator's unit table.
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

## Admins (Superadmin Only)

If your account has superadmin privileges, the **Admins** tab lets you promote other operators to administrator, or revoke that access.

## Troubleshooting

**I don't see the Admin Console**
: Your account is set as an Operator, not an Administrator. Ask an existing administrator to upgrade your role.

**A robot disappeared from the Units list**
: It may have been moved to a different rental, or is temporarily offline. Check its last-seen status.

**Restoring a backup didn't bring back a deleted robot's data**
: If the original robot no longer exists, the restore process will prompt you to remap the data to a different unit: follow the instructions in the console to complete the transfer.
