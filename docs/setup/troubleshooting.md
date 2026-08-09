# Troubleshooting

<RoleBadge role="technician" />

Technical diagnostics for installation and deployment issues. For user-facing issues, see [Getting Started &gt; Troubleshooting](/getting-started/troubleshooting) instead.

## Diagnostic checklist

1. Is the server process running? (see [Server Setup - Verify](/setup/server-setup#4-verify))
2. Is the unit powered and connected? (see [Unit Setup - Verify](/setup/unit-setup#4-verify))
3. Is the network path between them open? (see [System Setup](/setup/system-setup))
4. Check the relevant logs (location: _TODO_).

## Common issues

| Symptom | Possible cause | Fix |
| --- | --- | --- |
| _e.g. Server won't start_ | _e.g. Port already in use_ | _e.g. Check `logs/...`, free the port, restart the service_ |
| _e.g. Unit not reporting_ | _e.g. Network/power issue_ | _e.g. Check physical connection, re-provision the unit_ |

::: info TODO
Replace the placeholder rows with real, commonly seen deployment issues and their fixes.
:::

## Escalation

::: info TODO
Where to escalate an issue that can't be resolved here (developer team, vendor support, GitHub issue tracker).
:::

If the issue turns out to be a software/logic bug rather than a deployment issue, see the [Documentation](/development/) section for developers.
