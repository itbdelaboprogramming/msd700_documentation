---
outline: deep
search: false
---

# Admin Console: Backups

<RoleBadge role="developer" />

The Backups tab (`BackupsPanel.tsx`) is the admin console's front end onto the archive machinery
documented in full in [Backup, Restore, and Data
Migration](/development/backup-and-restore): archives of **whole rental profiles**. The Units tab
has its own, narrower entry point into the unit-scoped half of the same architecture (see
[Units & Fleet § Backup this unit's rental-scoped
data](/development/webui/admin-console/units-and-fleet#backup-this-unit-s-rental-scoped-data)) but
this tab is where an admin manages archives as first-class objects: create, delete, download,
upload, and restore.

## Two scopes, one tab for the profile half

[Backup and Restore § Dual-Scope Backup Architecture](/development/backup-and-restore#dual-scope-backup-architecture)
defines two independent backup scopes, keyed by `scope: 'profile'` or `scope: 'unit'`. This tab
works the profile-scoped side: a tenant-centric archive that captures "all maps, routes, areas, and
playlists owned by a rental profile across any robot" it has used, restored additively into a
new profile (or an existing one, if the admin chooses) with missing robots remappable. The unit-scoped side (a robot-centric archive of
everything one physical unit has ever recorded) is reached from the Units tab instead (see above).

## Create an archive of a profile

`POST /admin/api/profiles/:id/backups` produces a `.tar.gz` archive with the structure documented in
[Backup and Restore § Archive Structure](/development/backup-and-restore#archive-structure-tar-gz):
a `manifest.json` (the profile row, its members, its unit assignments, and every map with its
routes, areas and playlists nested underneath) plus a `files/` directory holding each map's
`<mapId>.pgm`, `.yaml` and `.png`. There is no SQL dump in the archive. Maps whose files were
already missing still carry their routes and areas, and the response lists them.

::: info What is, and is not, in the archive
Carried: the profile itself, its unit assignments, and every map, route, area, and playlist it
owns, plus the map image files those rows point to. **Never carried: operator accounts.**
Membership is recorded by id and username so it can be re-linked on restore, but only to an account
that already exists. `created_by` / `modified_by` are carried for attribution; any that point at an
account that no longer exists land as `NULL` and show as "unknown". Restoring an archive never
creates, modifies, or deletes anything in the `users` table.
:::

## Delete an archive

`DELETE /admin/api/backups/:id` removes the archive row and its file. Per
[Database Schema § Backup and sync](/development/database-schema#backup-and-sync), `profile_backups`
rows are independent of the profile they were taken from (`profile_id` is `ON DELETE SET NULL`, "an
archive must outlive what it archived"), but the reverse is not true: deleting the archive itself is
just deleting the archive, with no effect on the live profile it was taken from.

## Download / upload

- **Download**: `GET /admin/api/backups/:id/download` streams the stored `.tar.gz`. The download
  name is built from the profile name; the file on disk is named by the backup ULID.
- **Upload**: `POST /admin/api/backups/upload` takes the archive as the **raw request body** (not
  multipart). The server validates it (wrong file type, corrupt gzip and newer format versions are
  rejected), stores it as a new backup row with `profile_id` `NULL`, and returns the restore plan
  straight away.

## Plan a restore

`POST /admin/api/backups/:id/plan` is a real endpoint and writes nothing. It reports what a restore
would create, which robots in the archive are no longer registered, and which profile the data would
land in. The console sends the admin's choices back with it as `unit_remap` (archived unit →
registered unit) and `profile_remap` (archived profile → existing rental) until the plan has no
unresolved units. This matters because an archive is designed to outlive what it archived: a
`unit_id` inside it may belong to a robot that was deleted, replaced, or never existed on this
server.

## Execute the restore

`POST /admin/api/backups/:id/restore` applies the archive with the same `unit_remap` /
`profile_remap`. It answers `409` with the plan when some units are still unresolved or a chosen
destination profile has gone away.

::: warning Restore is always additive
Nothing existing is modified or overwritten; a restore only ever adds rows and files. Original
ULIDs are reused where they are still free, otherwise new ones are minted and every reference is
remapped. Without `profile_remap`, a profile archive always lands in a **new** profile (reusing
the archived ULID and name when both are free), so restoring the same archive twice gives two
profiles: noisy, never destructive. There is no "replace" mode.
:::


Schema evolution for the tables backups touch (`profile_backups.scope`, the sync tables, and so on)
is handled by the migration scripts in
[Backup and Restore § Schema Migration
Scripts](/development/backup-and-restore#schema-migration-scripts), not by anything on this tab:
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
