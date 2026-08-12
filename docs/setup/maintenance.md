# Maintenance

<RoleBadge role="technician" />

Routine maintenance tasks for a deployed MSD700 system, split by which machine they apply to.

## Routine checklist

| Task | Frequency | Where | Notes |
| --- | --- | --- | --- |
| Check `~/.ros/log` disk usage | Passive: a janitor does this automatically | Unit | See [Log housekeeping](#log-housekeeping) below; only worth checking by hand if a unit is offline for other reasons |
| Rotate the JWT signing keyring | Every few months, or immediately after a suspected leak | Server | See [Rotating secrets](#rotating-secrets) |
| Renew the TLS certificate (Let's Encrypt) | Before expiry (certbot can automate this) | Server | The HiveMQ keystore must be **rebuilt** from the renewed cert; a plain certbot renewal alone does not update it |
| Check for idle per-unit containers that should have been reaped | Occasionally | Server | `docker ps`: a container named `rosweb_unit_*` still running long after its unit went idle is worth investigating, not restarting blindly |
| Prune expired keys from the JWT keyring | After a rotation's grace window passes | Server | `./scripts/secrets.sh prune` |
| Update the software stack | As releases land | Both | See [Updating](#updating) |

## Log housekeeping

ROS 1 does not rotate its own logs (`~/.ros/log`), and left alone they grow without bound: one unit
with an unreachable cloud broker measured about 860 MB/day, almost all of it in `rosout.log`, written
straight onto the Jetson's root filesystem. Every unit runs a log janitor automatically as one of its
tmux windows, capping that tree (512 MB by default, swept every 60 seconds) and clearing the previous
session's logs at startup.

```bash
# Watch what it's doing:
tmux attach -t robot_services   # window: log_janitor
tail -f ros-web-ui/logs/log_janitor.log
```

You generally don't need to touch this. Raise `ROS_LOG_CAP_MB` only if you're deliberately chasing
something in `rosout.log` and have the disk budget for it.

## Rotating secrets

```bash
./scripts/secrets.sh status          # see what's active, without printing secret values
./scripts/secrets.sh rotate          # mint a new active key; the old one stays valid for a grace window
# after the grace window has passed:
./scripts/secrets.sh prune
```

::: info Why rotate instead of just replacing the secret?
A single shared secret makes rotation a blunt instrument: overwrite it, and every logged-in operator
and every connected robot is rejected at once. The keyring format signs new tokens with one active
key while still *accepting* the previous one for a configurable grace window (48 hours by default),
so a rotation is invisible to anyone already connected.
:::

After rotating, restart the services that read the keyring (`nakayama_cloud_dev`,
`nakayama_media_dev`, `nakayama_signalling_dev`, and their prod equivalents) so they pick up the new
active key.

## Backups

What needs backing up, and where it already lives:

| Data | Location | How |
| --- | --- | --- |
| Maps, routes, custom areas, playlists | MySQL (`db`/`db_dev` container) + map files under `/srv/msd/media/map` | Use the admin console's **profile backup** feature: it produces a single `.tar.gz` per profile, restore is additive |
| Per-unit data (for a hardware swap or a unit-specific archive) | Same sources, scoped to one unit | The backup system supports a `scope` column for exactly this: archive one unit without pulling in the whole profile |
| The JWT keyring / TLS keystore | `/srv/msd/secrets` | Not part of the app-level backup; back this directory up at the filesystem/infra level |

::: warning
Backup archives are written by the backend into `/srv/msd/media/backup` (`/srv/msd/media/backup_dev`
for the dev stack). If that directory doesn't exist yet or isn't writable by the app's user, backups
fail; see [Troubleshooting](/setup/troubleshooting).
:::

## Updating

```bash
# Server side, after pulling new code:
docker compose --profile server_prod build
docker compose --profile server_prod up -d

# Unit side, after pulling new code:
./scripts/docker-manager.sh build
./scripts/docker-manager.sh up
```

::: info Why does the unit rebuild instead of just restarting?
`src/` is bind-mounted into the container, so day-to-day script edits need no rebuild at all: the
container picks them up on the next launch. A full `build` is only needed when a *dependency* or the
base image itself changed, not for every code change. When in doubt, `build` is always safe, just
slower.
:::

There's no separate firmware update path documented here for the Arduino-based motor controller;
that's a manual re-flash, not part of this Docker-based stack.

## Related

- [Troubleshooting](/setup/troubleshooting): if maintenance uncovers a problem
- [System Setup](/setup/system-setup): system topology reference
