---
outline: deep
search: false
---

# Admin Console: Backups

<RoleBadge role="developer" />

The Backups tab (`BackupsPanel.tsx`) is the admin console's front end onto the archive machinery
documented in full in [Backup, Restore, and Data
Migration](/development/backup-and-restore): archives of **whole rental profiles**. The Units tab
has its own, narrower entry point into the unit-scoped half of the same architecture — see
[Units & Fleet § Backup this unit's rental-scoped
data](/development/webui/admin-console/units-and-fleet#backup-this-unit-s-rental-scoped-data) — but
this tab is where an admin manages archives as first-class objects: create, delete, download,
upload, and restore.

## Two scopes, one tab for the profile half

[Backup and Restore § Dual-Scope Backup Architecture](/development/backup-and-restore#dual-scope-backup-architecture)
defines two independent backup scopes, keyed by `scope: 'profile'` or `scope: 'unit'`. This tab
works the profile-scoped side: a tenant-centric archive that captures "all maps, routes, areas, and
playlists owned by a rental profile across any robot" it has used, restored additively into a
target profile with missing robots remappable. The unit-scoped side — a robot-centric archive of
everything one physical unit has ever recorded — is reached from the Units tab instead (see above).

## Create an archive of a profile

Produces a `.tar.gz` archive with the structure documented in
[Backup and Restore § Archive Structure](/development/backup-and-restore#archive-structure-tar-gz):
a `manifest.json`, a `database_dump.sql` of scoped SQL insert statements, and a `maps/` directory of
the binary map files (`.pgm`, `.yaml`, `.png`) that go with them.

::: info What is, and is not, in the archive
Carried: the profile itself, its unit assignments, and every map, route, area, and playlist it
owns, plus the map image files those rows point to. **Never carried: operator accounts.** The
manifest and `database_dump.sql` do stamp individual rows with a `created_by` user ULID for
attribution — the same `manifest.json` example in Backup and Restore shows a top-level `created_by`
field — but that is attribution only, the same "Attribution is never authorization" rule called out
in [Database Schema § Foreign keys, in full](/development/database-schema#foreign-keys-in-full).
Restoring an archive never creates, modifies, or deletes anything in the `users` table.
:::

## Delete an archive

Removes the archive. Per
[Database Schema § Backup and sync](/development/database-schema#backup-and-sync), `profile_backups`
rows are independent of the profile they were taken from (`profile_id` is `ON DELETE SET NULL`, "an
archive must outlive what it archived"), but the reverse is not true: deleting the archive itself is
just deleting the archive, with no effect on the live profile it was taken from.

## Download / upload

- **Download** corresponds to
  [Backup and Restore § Create Backup](/development/backup-and-restore#_1-create-backup),
  `POST /api/backup/export`, which generates and downloads the `.tar.gz` for a given
  `{ scope, profile_id }`.
- **Upload** corresponds to
  [Backup and Restore § Restore Archive](/development/backup-and-restore#_4-restore-archive),
  `POST /api/backup/import`, a multipart request carrying the archive file and a target
  `profile_id`.

## Plan a restore

A preview step in front of the import call above: it shows what would merge into the target
profile versus what has to be created fresh, and lets an admin remap the archive's tenants or
robots to different ones in the live system before anything is written. This matters because an
archive is designed to outlive what it archived — a `unit_id` referenced inside the dump may no
longer correspond to a registered unit by the time the archive is restored (the unit was deleted,
or the archive is being restored onto a different fleet entirely), and "missing robots can be
remapped" is exactly the restore behavior the profile-scoped row of the dual-scope table promises.
The REST API documented in Backup and Restore covers the commit step (`POST /api/backup/import`)
as a single call; the plan/preview step is the admin console's UX layered in front of that commit,
not a separately documented endpoint.

## Execute the restore

::: warning Restore is always additive
Per [Backup and Restore § Dual-Scope Backup
Architecture](/development/backup-and-restore#dual-scope-backup-architecture), a profile-scoped
restore is an "additive restore into target profile," and the import endpoint itself "applies it
additively." Executing a restore never overwrites an existing profile's data; at worst it adds
rows alongside what is already there. There is no destructive "replace" mode.
:::

Schema evolution for the tables backups touch (`profile_backups.scope`, the sync tables, and so on)
is handled by the migration scripts in
[Backup and Restore § Schema Migration
Scripts](/development/backup-and-restore#schema-migration-scripts), not by anything on this tab —
those run against the database directly and are out of scope for `BackupsPanel.tsx`.

## Related

- [Overview](/development/webui/admin-console/overview): the five-tab shell, admin vs superadmin roles, and the account menu.
- [Operators](/development/webui/admin-console/operators): register, search, suspend/reactivate, and reset passwords for operator accounts.
- [Units & Fleet](/development/webui/admin-console/units-and-fleet): the unit-scoped backup entry point reached from the Fleet view.
- [Rentals](/development/webui/admin-console/rentals): the one-click backup shortcut into this tab, and the profile this archive belongs to.
- [ROS Integration](/development/webui/admin-console/ros-integration): how admin actions reach the robot and the container fleet.
- [Architecture](/development/architecture): high-level system structure and two-machine model.
- [Database Schema](/development/database-schema): the full schema reference, including `profile_backups`.
- [Unit Container Lifecycle](/development/unit-container-lifecycle): the standalone reference for `unit_manager.js` and the fleet relay.
- [Backup, Restore, and Data Migration](/development/backup-and-restore): the full reference this tab is built on.
