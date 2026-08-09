# System Setup

<RoleBadge role="technician" />

How to connect a configured [Server](/setup/server-setup) and one or more configured [Unit(s)](/setup/unit-setup) into a single working MSD700 system. This is normally the last step of a new deployment.

## Overview

::: info TODO
Describe the overall system topology - how many units per server, network layout, any gateways/proxies involved.
:::

## 1. Network configuration

::: info TODO
Document required network settings: firewall rules, ports to open, static IPs/DNS, VPN if applicable.
:::

## 2. Register units to the server

::: info TODO
Step-by-step: how a technician links each Unit to the Server so data flows end-to-end.
:::

## 3. End-to-end verification

Checklist to confirm the whole system is working:

- [ ] Server is running (see [Server Setup - Verify](/setup/server-setup#4-verify))
- [ ] Each unit is online (see [Unit Setup - Verify](/setup/unit-setup#4-verify))
- [ ] Data from each unit appears on the server/dashboard
- [ ] _Add any other system-level checks_

## 4. Handover

::: info TODO
What the technician should leave behind for the end user (login info, quick reference) and where to point them - see [Getting Started](/getting-started/).
:::

## Next step

- Set up a [Maintenance](/setup/maintenance) schedule for the new deployment.
- Keep [Troubleshooting](/setup/troubleshooting) handy for future issues.
