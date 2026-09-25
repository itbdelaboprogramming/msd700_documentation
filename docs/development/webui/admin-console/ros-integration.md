---
outline: deep
search: false
---

# Admin Console: ROS Integration

<RoleBadge role="developer" />

Despite the name, kept for consistency with the other ROS Web UI feature groups, most of what the
admin console does is a MySQL-and-REST concern with no ROS node on either end of it. Two things in
the console do reach all the way to the robot or to the unit relay container running underneath it: unit
enrolment and unbinding, and `unit_manager.js`'s orchestration of the relay containers a unit's data
actually flows through. This page covers both, plus the Docker socket boundary that limits what the
backend can do to the host in the process. For the pages themselves, see
[Units](/development/webui/admin-console/units); for the full nonce handshake a
robot runs on its own side, see
[Hardware Enrolment](/development/webui/accounts/enrolment).

## Unit enrolment and unbinding

Approving a pending robot (Register as brand-new / Adopt into an existing unit, see
[Units § Pending view](/development/webui/admin-console/units#pending-view)) is
the administrator-authorization stage of the three-stage nonce protocol described in full in
[Hardware Enrolment § Cryptographic hardware enrolment (the nonce
protocol)](/development/webui/accounts/enrolment#cryptographic-hardware-enrolment-the-nonce-protocol).
This page does not repeat that handshake; the admin console's role in it is a single step in the
middle: turning a `pending_units` row with `status: pending` into `approved`, bound to a specific
`units` row.

**Unbinding** a unit's device (see
[Units § Unbind a unit's enrolled
device](/development/webui/admin-console/units#unbind-a-unit-s-enrolled-device)) removes
the live `unit_devices` row that binds a `fingerprint` to that unit. The consequence is specific and
documented directly in the self-heal path a returning robot would otherwise take:

> Anything that fails those checks still falls through to the pending pool for a human: a changed
> nonce (a genuine re-image, or an impostor), or no live binding (the hardware was adopted onto a
> different unit, **or an admin unbound it on purpose**).
>
>: [Hardware Enrolment § Self-heal
> recovery](/development/webui/accounts/enrolment#self-heal-recovery-a-lost-device-json-without-a-new-approval)

In other words, unbinding does not just clear a database row: it deliberately breaks the third of
the three conditions self-heal recovery checks for ("a live `unit_devices` row still binds this
exact `fingerprint` to the unit"), so the next time that robot's `enroll.py` calls
`POST /enroll/claim`, it cannot silently recover its old identity. It falls through to the pending
pool exactly as if it were new hardware, and needs a fresh administrator approval (Register or
Adopt again) before it can rejoin the registered units. That is the entire point of offering "forces
re-enrollment" as a distinct action from deleting the unit outright: the unit's identity, history,
and rental assignment all survive; only the device credential is cut.

## `unit_manager.js` and the unit relay container

None of the Units tab's actions start or stop a robot's relay container. Container lifecycle: the
`Absent → Starting → Running → Retained → Stopped` state machine in
[Unit Container Lifecycle § Container Lifecycle State
Machine](/development/unit-container-lifecycle#container-lifecycle-state-machine): is driven
entirely by operator activity (opening a unit's dashboard, ping heartbeats, Autopilot state), not by
anything an admin clicks here. What admin actions *do* change is the data the unit relay's single
shared container bridges, and that connection is real:

- **Register / Delete a unit** changes the `units` table, which is also where the unit relay's
  roster comes from. `fleet_roster.js` "reads every row of the `units` table and decodes each
  `BINARY(16)` id into its ULID," per
  [Unit Container Lifecycle § The roster comes from the
  database](/development/unit-container-lifecycle#the-roster-comes-from-the-database); enrolling or
  deleting a unit is the whole mechanism, with no separate step to "turn on bridging" for it.
- **`startRosterReconciler()`** re-reads that roster every `FLEET_ROSTER_POLL_MS` (default 60 s) and
  restarts the relay container if it changed: see
  [Unit Container Lifecycle § Enrolment restarts the relay
  automatically](/development/unit-container-lifecycle#enrolment-restarts-the-relay-automatically).
  A unit registered or deleted from this console reaches the live relay within one poll interval,
  not instantly, which is what backs the staleness-aware delete confirmation on
  [Units](/development/webui/admin-console/units#delete-a-unit).
- The roster is deliberately **every** unit in the table, not filtered by rental status: "a robot
  whose rental lapsed is still a robot that can power on and publish." Suspending or reassigning a
  rental profile on [Rentals](/development/webui/admin-console/rentals) therefore does not remove a
  unit from the bridge; only deleting the `units` row itself does.

::: info The unit relay is the default; the legacy per-unit path still exists
`UNIT_CONTAINERS_ENABLED=false` (the default) means one shared container,
`rosweb_unit_relays`, bridges every unit. Setting it `true` reverts to a dedicated
`rosweb_unit_<ULID>` container per robot, the architecture in
[Unit Container Lifecycle § Container Architecture Overview
(Legacy)](/development/unit-container-lifecycle#container-architecture-overview-legacy). Nothing
in the admin console differs between the two modes: the same `units` table drives both, either as
the unit roster or as the set of containers `unit_manager.js` instantiates on demand. See
[Unit Container Lifecycle § Reverting to one container per
robot](/development/unit-container-lifecycle#reverting-to-one-container-per-robot) for the danger
of running both at once.
:::

## Docker Socket Security

`backend_node` (the process this entire console runs inside of) communicates with the host Docker
engine via a bind mount of `/var/run/docker.sock`. Per
[Unit Container Lifecycle § Docker Socket
Security](/development/unit-container-lifecycle#docker-socket-security), container execution
through that socket is restricted to managing containers matching the `rosweb_unit_*` namespace,
preventing arbitrary container manipulation on the host. Every admin action that ultimately touches
a container (starting, stopping, or restarting a relay as a side effect of the roster changing
above) goes through that same restricted surface, never a general-purpose Docker command.

## Related

- [Overview](/development/webui/admin-console/overview): the five-tab shell, admin vs superadmin roles, and the account menu.
- [Operators](/development/webui/admin-console/operators): register, search, suspend/reactivate, and reset passwords for operator accounts.
- [Units](/development/webui/admin-console/units): Registered Units and Pending sub-views these mechanics sit underneath.
- [Rentals](/development/webui/admin-console/rentals): rental profile CRUD, membership, and unit assignment.
- [Backups](/development/webui/admin-console/backups): archiving and restoring whole rental profiles.
- [Architecture](/development/architecture): high-level system structure and two-machine model.
- [Database Schema](/development/database-schema): the full schema reference for `units`, `unit_devices`, and `pending_units`.
- [Unit Container Lifecycle](/development/unit-container-lifecycle): the full reference for `unit_manager.js`, the roster, and the unit relay.
- [Backup, Restore, and Data Migration](/development/backup-and-restore): the standalone reference for the archive format and REST operations.
