---
outline: deep
search: false
---

# Admin Console: Rentals

<RoleBadge role="developer" />

The Rentals tab (`ProfilesPanel.tsx`) manages `rental_profiles`: **who a robot is rented to**, a
question kept deliberately distinct from `users`, **who drives it**. An operator account and a
rental profile are different tables for a reason (see
[Overview § Three identity spaces, three
tabs](/development/webui/admin-console/overview#three-identity-spaces-three-tabs)) and this tab is
where the two, plus a unit, actually get connected. For the operator-account side, see
[Operators](/development/webui/admin-console/operators); for the unit side, see
[Units](/development/webui/admin-console/units).

## The tables underneath this tab

From [Database Schema § Identity and access](/development/database-schema#identity-and-access):

| Table | Purpose | Key columns |
| --- | --- | --- |
| `rental_profiles` | One row per rental | `id` (ULID, PK), `profile_name` (unique), `tenant_name`, `status` |
| `profile_members` | Which accounts belong to which profile | `UNIQUE(profile_id, user_id)`, both `ON DELETE CASCADE` |
| `profile_units` | Which units a profile can access | `UNIQUE(unit_id)`, **not** `(profile_id, unit_id)` |

## Create / edit / delete a rental profile

A profile carries a `tenant_name` and free-form notes. Deleting one is not uniformly destructive:
per [Database Schema § Foreign keys, in
full](/development/database-schema#foreign-keys-in-full), `rental_profiles` relates to its
dependents in three different ways, and only one of them blocks the delete outright.

- `profile_id RESTRICT` on `maps_data`: a profile that owns any maps **cannot** be deleted until
  those maps are dealt with (for example, by archiving the profile first; see
  [Backups](/development/webui/admin-console/backups)).
- `profile_id CASCADE` on `profile_members` and `profile_units`: membership rows and unit
  assignments disappear automatically with the profile.
- `profile_id SET NULL` on `profile_backups`: an existing archive of this profile survives the
  profile's own deletion, per the same "an archive must outlive what it archived" rule described in
  [Database Schema § Backup and sync](/development/database-schema#backup-and-sync).

Suspending a profile, rather than deleting it, is the softer lever: per
[Database Schema § Identity and access](/development/database-schema#identity-and-access),
"suspending it hides both the unit and its data from members, without touching either." Nothing is
deleted or reassigned, and reactivating the profile restores exactly what was there. This is a
different mechanism from suspending an *operator* account (see
[Operators](/development/webui/admin-console/operators)), which is currently unenforced at login;
suspending a rental profile takes effect immediately for every member.

## Add / remove members

`profile_members` links `users` rows to a `rental_profiles` row, `UNIQUE(profile_id, user_id)` so
the same operator cannot be added twice to one profile. Both foreign keys cascade: removing an
operator's account removes their membership everywhere, and deleting a profile removes every
membership row that pointed at it. Being a member of a profile is what actually lets an operator
account log in and see the profile's units and data; account creation on
[Operators](/development/webui/admin-console/operators) grants none of that by itself.

## Assign / release units

`profile_units` links a `units` row to a `rental_profiles` row. The unique index is on `unit_id`
alone, not on the `(profile_id, unit_id)` pair:

::: warning A unit can only be assigned to one profile at a time
`profile_units.unique_rented_unit (unit_id)` exists specifically so that "a double-assignment fails
loudly instead of silently overwriting the existing one" (see
[Database Schema § Indexes worth knowing the reason
for](/development/database-schema#indexes-worth-knowing-the-reason-for)). Reassigning a unit that
is already assigned to a different profile is rejected outright; it does not quietly move the unit
out from under its current tenant. Releasing the unit from its current profile first is what makes
it assignable elsewhere.
:::

## One-click backup from this tab

A shortcut into the [Backups](/development/webui/admin-console/backups) flow: creating a
profile-scoped archive of the selected profile without leaving the Rentals tab. It produces the
same archive described there: everything the profile owns, never the operator accounts that are
members of it.

## Related

- [Message Contracts: HTTP API § Admin API](/development/message-contracts/http-api#admin-api): `GET/POST /admin/api/profiles`, `GET/PATCH/DELETE /admin/api/profiles/:id`, `POST/DELETE /admin/api/profiles/:id/members`, `POST/DELETE /admin/api/profiles/:id/units`.
- [Overview](/development/webui/admin-console/overview): the five-tab shell, admin vs superadmin roles, and the account menu.
- [Operators](/development/webui/admin-console/operators): register, search, suspend/reactivate, and reset passwords for operator accounts.
- [Units](/development/webui/admin-console/units): registering, renaming, and deleting the units this tab assigns.
- [Backups](/development/webui/admin-console/backups): the full archive and restore flow this tab's shortcut leads into.
- [ROS Integration](/development/webui/admin-console/ros-integration): how admin actions reach the robot and the unit relay container.
- [Architecture](/development/architecture): high-level system structure and two-machine model.
- [Database Schema](/development/database-schema): the full schema reference for `rental_profiles`, `profile_members`, and `profile_units`.
- [Unit Container Lifecycle](/development/unit-container-lifecycle): the standalone reference for `unit_manager.js` and the unit relay.
- [Backup, Restore, and Data Migration](/development/backup-and-restore): the standalone reference for the archive format and REST operations.
