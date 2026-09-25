---
outline: deep
search: false
---

# Admin Console: Operators

<RoleBadge role="developer" />

The Operators tab (`UsersPanel.tsx`) is where an admin manages `users`: the accounts that log in
at the [operator login](/development/webui/accounts/overview#operator-login) and drive robots. For
the tab shell and the roles that can reach it, see
[Overview](/development/webui/admin-console/overview); for how an operator gets access to any
actual robot once the account exists, see [Rentals](/development/webui/admin-console/rentals).

## What the tab does

- **Register** a new operator account.
- **Search / list** operator accounts.
- **Suspend / reactivate** an operator account.
- **Reset** an operator's password.

There is no delete. Removing an operator account outright is deliberately not offered anywhere on
this tab: an operator's maps, routes, areas, and playlists are frequently shared with other
operators on the same rental profile and unit, and deleting the account would cascade-destroy that
data out from under people still relying on it. Suspending the account, not removing it, is the
only way to shut off an operator who should no longer be using the system.

## Suspend / reactivate

`PATCH /admin/api/users/:id/status` writes `users.status` (`active` or `suspended`), per
[Database Schema § Identity and access](/development/database-schema#identity-and-access).

::: warning Suspension is written, not yet enforced at login
`/user/login` does not read `users.status`. A suspended operator's existing session keeps working,
and they can still log back in. This is a known, current gap, not a subtlety of the UI: the console
itself surfaces it directly via a `NotYetWiredNote` next to the control, rather than implying the
suspend button already locks the account out. The two were kept deliberately separate so that
standing up the admin console could never, by itself, lock a live deployment out of its own robots;
enforcing suspension at the login boundary is distinct, not-yet-done work.
:::

This is a different mechanism from suspending a *rental profile*, which does immediately remove a
unit and its data from every member's view even though the member accounts themselves stay active
and able to log in: see [Rentals](/development/webui/admin-console/rentals) and
[Database Schema § Identity and access](/development/database-schema#identity-and-access) for that
distinction. If the goal is to actually cut an operator off from a robot today, suspending the
profile membership or the unit assignment is the lever that works; suspending the operator account
itself is a record-keeping action for now.

## Reset password

Resets an operator's password to a new value set by the admin. This is separate from the
change-own-password flow an operator or admin can trigger for their own account (see
[Overview § Account menu](/development/webui/admin-console/overview#account-menu)); here, an admin
is setting the password on someone else's account, not their own.

## Related

- [Overview](/development/webui/admin-console/overview): the five-tab shell, admin vs superadmin roles, and the account menu.
- [Units & Fleet](/development/webui/admin-console/units-and-fleet): the Fleet and Pending sub-views over the robot roster.
- [Rentals](/development/webui/admin-console/rentals): where an operator account actually gets access to a robot.
- [Backups](/development/webui/admin-console/backups): archiving and restoring whole rental profiles.
- [ROS Integration](/development/webui/admin-console/ros-integration): how admin actions reach the robot and the container fleet.
- [Architecture](/development/architecture): high-level system structure and two-machine model.
- [Database Schema](/development/database-schema): the full schema reference, including the `users.status` caveat.
- [Unit Container Lifecycle](/development/unit-container-lifecycle): the standalone reference for `unit_manager.js` and the fleet relay.
- [Backup, Restore, and Data Migration](/development/backup-and-restore): the standalone reference for the archive format and REST operations.
