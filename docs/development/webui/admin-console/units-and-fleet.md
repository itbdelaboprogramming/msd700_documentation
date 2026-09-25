---
outline: deep
search: false
---

# Admin Console: Units & Fleet

<RoleBadge role="developer" />

The Units tab (`UnitsPanel.tsx`) is where an admin manages `units`: the row-per-physical-robot
table described in
[Database Schema § Identity and access](/development/database-schema#identity-and-access). It has
two sub-views, **Fleet** and **Pending**, plus a live badge count of pending robots. This page
covers what each view does and, wherever the source material supports it, exactly which backend
mechanism in [Unit Container Lifecycle](/development/unit-container-lifecycle) or
[Database Schema](/development/database-schema) an action is actually changing. For how a
registered unit becomes drivable by anyone, see [Rentals](/development/webui/admin-console/rentals);
for the enrolment protocol and container orchestration underneath these actions in more depth, see
[ROS Integration](/development/webui/admin-console/ros-integration).

::: info Registering a unit does not grant driving access
A row in `units` only means the robot exists in the fleet. Whether anyone can drive it is decided
entirely on the [Rentals](/development/webui/admin-console/rentals) tab, by which rental profile
(if any) the unit is assigned to: see `profile_units` in
[Database Schema § Identity and access](/development/database-schema#identity-and-access).
:::

## Fleet view

### Register a unit manually

Creates a `units` row directly (a new ULID and a `unit_name`), ahead of any physical robot
contacting the cloud. This is the admin-side counterpart to the `unit_enrollment_codes` table
described in [Database Schema § Enrolment](/development/database-schema#enrolment): "single-use
vouchers to claim a specific unit before its robot exists." A manually-registered unit is exactly
that kind of unit: a placeholder identity a robot will claim later, rather than one that already
announced itself in the Pending view below.

### Rename a unit

Edits `unit_name` only. Per
[Database Schema § Identity and access](/development/database-schema#identity-and-access),
`unit_name` "is a renameable display label, not an identity": the row's `id` (ULID) is the robot's
actual address (`/unit_<id>/...`) on every ROS topic and MQTT subscription. Renaming a unit changes
nothing about routing, the fleet relay's roster, or any topic the robot publishes to.

### Delete a unit

Removes the `units` row, gated by a confirmation that is explicitly aware the change may not have
reached the running system yet. That staleness is real, not defensive UI copy: the fleet relay
holds its roster in memory and only re-reads the `units` table on a poll, `FLEET_ROSTER_POLL_MS`
(default 60 s): see
[Unit Container Lifecycle § The roster comes from the database](/development/unit-container-lifecycle#the-roster-comes-from-the-database).
Deletion is explicitly called out there as one of the ways the roster changes without going through
the enrolment endpoint the reconciler was originally built to catch:

> Polling rather than hooking the enrolment endpoint, because enrolment is not the only way the
> table changes: deletion, a profile restore, or an admin fixing a row by hand all count.

So a deleted unit's relay subscriptions do not disappear at the instant of the click; they age out
within one poll interval, which is what the confirmation dialog's staleness framing is warning
about. Per the foreign keys on `units`
([Database Schema § Foreign keys, in full](/development/database-schema#foreign-keys-in-full)),
deleting the row also cascades to its rental assignment (`profile_units`) and its device binding
(`unit_devices`), and to its recorded maps: see
[Database](/development/webui/database/ros-integration) for what happens to a unit's maps
specifically, which is out of scope here.

### Backup this unit's rental-scoped data

Creates a **unit-scoped** archive (`scope: 'unit'`), the second axis of the dual-scope backup
architecture in [Backup and Restore](/development/backup-and-restore#dual-scope-backup-architecture):
"Captures: Complete operational history recorded by a specific physical robot." Because
`maps_data` is locked to whichever rental profile recorded it rather than to the unit (see
[Database Schema § Operational data (per map)](/development/database-schema#operational-data-per-map)),
"this unit's data" in practice means the data belonging to the rental the unit is currently assigned
to. The typical use for this scope, per the same source, is "Archiving a robot before factory
hardware servicing or refurbishment."

### Swap data between two units

Exchanges the unit-scoped dataset (the same "complete operational history recorded by a specific
physical robot" defined above) between two existing units, rather than lifting it out into an
archive. This is the bidirectional counterpart to the backup and restore operations described in
[Backups](/development/webui/admin-console/backups): a robot's own history moves to a different
unit identity instead of leaving the live system.

### Clear all data for a unit/rental

Erases the maps, routes, areas, and playlists held in one of two scopes: everything a specific unit
has ever recorded, or everything a specific rental owns on that unit. This mirrors the profile vs.
unit scope split used for backups (see
[Backup and Restore § Dual-Scope Backup Architecture](/development/backup-and-restore#dual-scope-backup-architecture)),
applied as a deletion instead of an archive.

### Transfer unit data to another registered robot

This is the profile-scoped backup's canonical use case, spelled out directly in the dual-scope
table: "Migrating a customer's maps and routes to a replacement robot." Because a **profile**-scoped
restore is additive and lets missing robots be remapped (see
[Backups](/development/webui/admin-console/backups)), transferring a tenant's data to a different
physical unit is the same underlying mechanism as a profile backup and restore, surfaced here as a
direct action instead of a two-step export/import.

### Unbind a unit's enrolled device

Removes the unit's live `unit_devices` binding, forcing re-enrollment. See
[ROS Integration § Unit enrolment and unbinding](/development/webui/admin-console/ros-integration#unit-enrolment-and-unbinding)
for exactly what this breaks on the robot side and why the robot cannot silently recover its old
identity afterward.

## Pending view

Robots that have completed the "hello" stage of the nonce protocol (`POST /enroll/claim`) but are
not yet claimed onto a `units` row sit in `pending_units`
([Database Schema § Enrolment](/development/database-schema#enrolment)), with `status` one of
`pending`, `approved`, `claimed`, or `rejected`. The badge count next to the Pending tab is a count
of the rows currently sitting at `pending`. The full three-stage handshake a robot goes through to
land in this table is documented in
[Hardware Enrolment § Cryptographic hardware enrolment (the nonce
protocol)](/development/webui/accounts/enrolment#cryptographic-hardware-enrolment-the-nonce-protocol);
this page only covers what an admin does with a row once it is here.

- **Register as a brand-new unit**: approves the pending robot by creating a fresh `units` row for
  it: the administrator-authorization stage of the nonce protocol, completing the handshake for
  hardware nobody has seen before.
- **Adopt into an existing unit record**: approves the pending robot onto an *already-existing*
  `units` row instead of creating a new one: the same "adopted... onto a different unit" language
  used in
  [Hardware Enrolment § Self-heal recovery](/development/webui/accounts/enrolment#self-heal-recovery-a-lost-device-json-without-a-new-approval)
  to describe a unit whose hardware changed underneath it. This is how replacement hardware keeps a
  unit's existing history, rental assignment, and maps rather than starting over as a new robot.
- **Reject**: sets `status` to `rejected` and goes no further.

## Related

- [Overview](/development/webui/admin-console/overview): the five-tab shell, admin vs superadmin roles, and the account menu.
- [Operators](/development/webui/admin-console/operators): register, search, suspend/reactivate, and reset passwords for operator accounts.
- [Rentals](/development/webui/admin-console/rentals): who a registered unit is actually rented to, and who can drive it.
- [Backups](/development/webui/admin-console/backups): archiving and restoring whole rental profiles.
- [ROS Integration](/development/webui/admin-console/ros-integration): the enrolment mechanics and container orchestration behind this tab.
- [Architecture](/development/architecture): high-level system structure and two-machine model.
- [Database Schema](/development/database-schema): the full schema reference, including `units`, `profile_units`, and `unit_devices`.
- [Unit Container Lifecycle](/development/unit-container-lifecycle): the standalone reference for `unit_manager.js`, the roster, and the fleet relay.
- [Backup, Restore, and Data Migration](/development/backup-and-restore): the standalone reference for the archive format and REST operations.
