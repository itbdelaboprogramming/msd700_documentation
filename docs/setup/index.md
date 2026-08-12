# Setup

<RoleBadge role="technician" />

This section is technical documentation for **technicians** installing and configuring MSD700
hardware and software. It's written to be followable even if this is your first time: every step
says what to type, what you should see, and *why* that step exists, not just the command.

It assumes physical access to the MSD700 Unit(s) and/or Server, plus the credentials needed to
configure them (admin console access, server SSH access, etc. as relevant to the step).

If you're a day-to-day user, see [Getting Started](/getting-started/) instead. If you're building or extending MSD700's software, see [Documentation](/development/).

<LinkCards>
  <LinkCard icon="✅" title="Prerequisites" details="Hardware, software, and access needed before you begin." link="/setup/prerequisites" />
  <LinkCard icon="🖥️" title="Server Setup" details="Install and configure the MSD700 Server." link="/setup/server-setup" />
  <LinkCard icon="📡" title="Unit Setup" details="Install and configure the MSD700 Unit hardware." link="/setup/unit-setup" />
  <LinkCard icon="🔗" title="System Setup" details="Connect Server and Unit(s) into one working system." link="/setup/system-setup" />
  <LinkCard icon="🧰" title="Maintenance" details="Routine maintenance, backups, and updates." link="/setup/maintenance" />
  <LinkCard icon="🛠️" title="Troubleshooting" details="Diagnose and fix installation/deployment issues." link="/setup/troubleshooting" />
</LinkCards>

## Recommended order

There is one thing worth understanding up front: **the Server and a Unit are two separate machines**,
each with its own setup. You (or someone else) can do them in either order, but a Unit isn't fully
useful until it's been *enrolled* against a running Server, so most deployments go:

1. [Prerequisites](/setup/prerequisites): confirm both machines are ready
2. [Server Setup](/setup/server-setup): bring the cloud/dashboard side up first, so there's something for a unit to enrol against
3. [Unit Setup](/setup/unit-setup): bring the robot online and let it enrol itself
4. [System Setup](/setup/system-setup): confirm the two are actually talking, end to end

After that, keep [Maintenance](/setup/maintenance) and [Troubleshooting](/setup/troubleshooting) bookmarked: you'll come back to them, not just read them once.

::: info Already have a running Server?
If you're only adding a new Unit to an existing MSD700 deployment (the common case: one Server,
many robots), skip straight to [Unit Setup](/setup/unit-setup) after [Prerequisites](/setup/prerequisites).
:::
