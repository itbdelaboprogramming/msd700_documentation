# Architecture

<RoleBadge role="developer" />

High-level overview of how MSD700 is put together.

::: info TODO
This page is a template. Replace it with the real architecture of the MSD700 system.
:::

## Components

| Component | Responsibility | Repository |
| --- | --- | --- |
| MSD700 Server | _e.g. collects, stores, and serves data_ | _TODO: link to repo_ |
| MSD700 Unit | _e.g. field hardware that reports data_ | _TODO: link to repo/firmware_ |
| Documentation site (this repo) | Hosts these docs, built with VitePress | [itbdelaboprogramming/msd700_documentation](https://github.com/itbdelaboprogramming/msd700_documentation) |

## Data flow

::: info TODO
Describe (with a diagram if possible) how data moves: Unit → Server → wherever it's consumed. Note protocols used (HTTP, MQTT, etc.), and any queues/databases involved.
:::

## Related

- [Repository Structure](/development/repository-structure)
- [API Reference](/development/api-reference)
- [System Setup](/setup/system-setup) - the deployment-time view of these same components
