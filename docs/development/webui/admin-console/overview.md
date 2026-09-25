---
outline: deep
search: false
---

# Admin Console

<RoleBadge role="developer" />

The back-office side of MSD700, reached through the separate [admin login](/development/webui/accounts/overview#admin-login-admin)
described in Accounts & Access: a five-tab shell (`admin/dashboard.tsx`, one `*Panel.tsx` component
per tab under `src/components/admin/`) for the staff who run the whole fleet rather than drive any
one robot. This page introduces the shell itself, the two admin roles it serves, and the account
menu shared across every tab. Each tab gets its own page: [Operators](/development/webui/admin-console/operators),
[Units & Fleet](/development/webui/admin-console/units-and-fleet),
[Rentals](/development/webui/admin-console/rentals), and
[Backups](/development/webui/admin-console/backups). What ties the console's actions back to the
robot and the container fleet underneath it is
[ROS Integration](/development/webui/admin-console/ros-integration).

## The five tabs

| Tab | Component | Visible to | Manages |
| --- | --- | --- | --- |
| Operators | `UsersPanel.tsx` | admin, superadmin | `users`: the accounts that log in and drive robots |
| Units | `UnitsPanel.tsx` | admin, superadmin | `units`: which physical robots exist, fleet and pending |
| Rentals | `ProfilesPanel.tsx` | admin, superadmin | `rental_profiles`: who a unit is rented to |
| Backups | `BackupsPanel.tsx` | admin, superadmin | Archives of whole rental profiles |
| Admins | `AdminsPanel.tsx` | superadmin only | `admin_accounts`: back-office staff themselves |

The first four tabs manage the *operator-facing* fleet: the people who drive, the robots they
drive, and the rental relationship that connects the two. The fifth tab manages the console's own
operators. That asymmetry is deliberate, not an oversight: an admin can do everything needed to run
tenants and robots day to day without ever being able to create or remove another back-office
account.

## Two admin roles, enforced on both sides

`admin_accounts.role` is one of `admin` or `superadmin` (see
[Database Schema § Identity and access](/development/database-schema#identity-and-access)). The
Admins tab is not merely styled away for a plain `admin`; it is omitted from the tab list entirely,
and the actions it exposes are gated server-side as well.

::: warning The Admins tab is a UI convenience, not the security boundary
Hiding the tab for a plain `admin` stops the tab from being clicked; it is not what actually stops
the action. The corresponding server-side checks are what enforce the superadmin-only rule, the
same way `admin_accounts` is kept as a table entirely separate from `users` rather than a role flag
on one shared table (see [Accounts & Access § Operator accounts and admin accounts are separate
systems](/development/webui/accounts/overview#operator-accounts-and-admin-accounts-are-separate-systems)).
A plain admin hitting an Admins-tab action directly, bypassing the UI, is expected to be rejected by
the backend, not merely kept from seeing the button.
:::

## Three identity spaces, three tabs

The console keeps three questions deliberately separate, each with its own tab and its own table:

- **Who can drive at all**: an operator account, managed on [Operators](/development/webui/admin-console/operators).
- **What robots exist**: a unit row, managed on [Units & Fleet](/development/webui/admin-console/units-and-fleet).
- **Who is renting which robot**: a rental profile and its assignments, managed on
  [Rentals](/development/webui/admin-console/rentals).

Creating an operator account grants no access to anything by itself, and registering a unit grants
no one the ability to drive it either: both only become meaningful once a rental profile connects
them, by holding the operator as a member and the unit as an assignment. See
[Units & Fleet](/development/webui/admin-console/units-and-fleet) and
[Rentals](/development/webui/admin-console/rentals) for how each side of that connection works.

## Admins tab (superadmin only)

`AdminsPanel.tsx` manages the `admin_accounts` table directly, and is the one tab a plain `admin`
never sees:

- **Create** a back-office admin account, choosing its role (`admin` or `superadmin`).
- **Suspend / reactivate** an admin account.
- **Reset** an admin's password.
- **Delete** an admin account.

Unlike an operator account (see [Operators](/development/webui/admin-console/operators)), an admin
account can be deleted outright. Nothing in the schema hangs off `admin_accounts` the way an
operator's maps, routes, areas, and playlists hang off `users`: an admin's `created_by` /
`modified_by` stamps on `rental_profiles`, `units`, `profile_backups`, `pending_units`, and
`unit_enrollment_codes` are attribution only, so removing the account does not orphan or destroy
anything it touched (see [Database Schema § Foreign keys, in
full](/development/database-schema#foreign-keys-in-full)).

## Account menu

`AccountMenu.tsx` sits in the header and is available to every signed-in admin, plain or
superadmin. It is scoped to the signed-in admin's own identity only, never another account's, and
covers three things:

- Viewing the signed-in admin's own identity (username, role).
- Editing that admin's own profile (username, full name).
- Jumping to the change-own-password page, the same voluntary mode described in
  [Accounts & Access § Admin change password](/development/webui/accounts/overview#admin-change-password-admin-change-password).

Resetting *another* account's password is a separate, tab-specific action (the Admins tab above
for a fellow back-office account, [Operators](/development/webui/admin-console/operators) for an
operator account) not something reachable from this menu.

## Related

- [Operators](/development/webui/admin-console/operators): register, search, suspend/reactivate, and reset passwords for operator accounts.
- [Units & Fleet](/development/webui/admin-console/units-and-fleet): the Fleet and Pending sub-views over the robot roster.
- [Rentals](/development/webui/admin-console/rentals): rental profile CRUD, membership, and unit assignment.
- [Backups](/development/webui/admin-console/backups): archiving and restoring whole rental profiles.
- [ROS Integration](/development/webui/admin-console/ros-integration): how these actions reach the robot and the container fleet.
- [Architecture](/development/architecture): high-level system structure and two-machine model.
- [Database Schema](/development/database-schema): the full schema reference underneath every tab.
- [Unit Container Lifecycle](/development/unit-container-lifecycle): the standalone reference for `unit_manager.js` and the fleet relay.
- [Backup, Restore, and Data Migration](/development/backup-and-restore): the standalone reference for the archive format and REST operations.
