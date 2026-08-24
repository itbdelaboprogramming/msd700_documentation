---
outline: deep
search: false
---


# Backup, Restore, and Data Migration

<RoleBadge role="developer" />

This document details the database backup architecture, export/import archive structures, rental profile transfer mechanics, and migration scripts in MSD700.

## Dual-Scope Backup Architecture

The platform supports two independent backup scopes:

```mermaid
flowchart TD
  subgraph ProfileScope["1. Profile-Scoped Backup (Tenant Centric)"]
    P1["Scope: 'profile'"]
    P2["Captures: All maps, routes, areas, and playlists owned by a rental profile across any robot."]
    P3["Restore Behavior: Additive restore into target profile. Missing robots can be remapped."]
  end

  subgraph UnitScope["2. Unit-Scoped Backup (Robot Centric)"]
    U1["Scope: 'unit'"]
    U2["Captures: Complete operational history recorded by a specific physical robot."]
    U3["Restore Behavior: Restores robot calibration and recorded maps directly to that unit."]
  end
```

| Dimension | Profile-Scoped Backup | Unit-Scoped Backup |
| --- | --- | --- |
| **Primary Scope Key** | `profile_id` (Rental Profile) | `unit_id` (Physical Robot ULID) |
| **Typical Use Case** | Migrating a customer's maps and routes to a replacement robot. | Archiving a robot before factory hardware servicing or refurbishment. |
| **Data Included** | Maps, waypoints, playlists, and user metadata for that profile. | All maps and sensor records originating from that specific hardware unit. |
| **Restore Strategy** | Additive (upsert without overwriting unrelated tenant data). | Direct restoration to the hardware unit. |

## Archive Structure (`.tar.gz`)

Backups are exported as compressed `.tar.gz` archives containing structured metadata and binary map files:

```
msd700_backup_01JZ8QK2H.tar.gz
├── manifest.json            # Version 2 archive manifest and metadata
├── database_dump.sql        # Scoped SQL insert statements
└── maps/                    # Binary map images (.pgm, .yaml, .png)
    ├── 01JZ8QK2H0001.pgm
    ├── 01JZ8QK2H0001.yaml
    └── 01JZ8QK2H0001_thumb.png
```

### Manifest Format (`manifest.json`)

```json
{
  "manifest_version": "2.0",
  "scope": "profile",
  "profile_id": "01JZ7YV5CQPROF00000000000",
  "tenant_name": "Acme Logistics",
  "created_at": "2026-08-15T14:30:00Z",
  "created_by": "01JZ7YV5CQUSER00000000000",
  "counts": {
    "maps": 4,
    "routes": 12,
    "areas": 6,
    "playlists": 2
  }
}
```

## REST API Backup Operations

### 1. Export Archive
`POST /api/backup/export`

Generates and downloads a `.tar.gz` archive.

- **Request Body**:
```json
{
  "scope": "profile",
  "profile_id": "01JZ7YV5CQPROF00000000000"
}
```

### 2. Import and Restore Archive
`POST /api/backup/import`

Uploads an archive and applies it additively.

- **Request Payload**: Multipart form-data with `file: <archive.tar.gz>` and target `profile_id`.

## Schema Migration Scripts

Database schema evolutions are managed by automated scripts in `ros-web-ui/source/dependencies/ROS-dashboard-backend/scripts/`:

| Script Name | Purpose | Execution Command |
| --- | --- | --- |
| `migrate_unit_id_refactor.js` | Migrates legacy username/unitname paths to ULID addressing. | `node migrate_unit_id_refactor.js --apply` |
| `migrate_enrolment.js` | Creates `pending_units` and `unit_devices` tables for 32-byte nonce auth. | `node migrate_enrolment.js --apply` |
| `migrate_sync.js` | Installs `sync_state` and `sync_tombstones` tables for offline data sync. | `node migrate_sync.js --profile dev --apply` |
| `migrate_backup_scope.js` | Upgrades `profile_backups` table with `scope` column. | `node migrate_backup_scope.js --profile dev --apply` |

::: danger Migration Testing Rule
Always test migration scripts against the development database on **port 3308** before applying them to production on port 3307. Migration scripts require an explicit `--profile` argument to prevent accidental target mismatch.
:::

## Related Documentation

- [Database Schema](/id/development/database-schema): Full MySQL table definitions and foreign keys.
- [Data Sync](/id/development/data-sync): Offline data replication and conflict resolution.
- [API Reference](/id/development/api-reference): REST API endpoints for fleet management.
