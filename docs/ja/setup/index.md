---
search: false
---


# Setup and Deployment Guide

<RoleBadge role="technician" />

This section contains technical documentation for **technicians, system engineers, and field installers** configuring MSD700 hardware and software.

Every procedure includes step-by-step shell commands, expected outputs, configuration templates, and architectural explanations.

<LinkCards>
  <LinkCard icon="✅" title="Prerequisites" details="Hardware sizing, compute requirements, OS versions, and network port firewall rules." link="/ja/setup/prerequisites" />
  <LinkCard icon="🖥️" title="Server Setup" details="Step-by-step production cloud deployment: Docker Compose, Apache reverse proxy, and SSL." link="/ja/setup/server-setup" />
  <LinkCard icon="📡" title="Unit Setup" details="Install and configure the physical robot on NVIDIA Jetson SBCs, build runtime, and enrol." link="/ja/setup/unit-setup" />
  <LinkCard icon="🔗" title="System Setup" details="End-to-end integration checklist, network verification, and operator handover." link="/ja/setup/system-setup" />
  <LinkCard icon="🐳" title="Docker Reference" details="Exhaustive reference for Docker Compose profiles, environment variables, and volume mounts." link="/ja/setup/docker-reference" />
  <LinkCard icon="📶" title="WiFi Hotspot + Client" details="Configure onboard Wi-Fi hotspot, Access Point mode, and local network client bridge." link="/ja/setup/wifi-hotspot" />
  <LinkCard icon="🧰" title="Maintenance" details="Routine log rotation, JWT keyring rotation, Certbot Let's Encrypt updates, and backups." link="/ja/setup/maintenance" />
  <LinkCard icon="🛠️" title="Technician Troubleshooting" details="Diagnose and resolve hardware, container, MQTT broker, and sensor issues." link="/ja/setup/troubleshooting" />
</LinkCards>

## Recommended Deployment Progression

The MSD700 platform uses a two-machine model (Server + Physical Units). Follow this sequence for new installations:

```mermaid
flowchart LR
  P["1. Prerequisites<br/>Check hardware & ports"] --> S["2. Server Setup<br/>Bring up cloud backend & Apache"]
  S --> U["3. Unit Setup<br/>Build robot image & run enrolment"]
  U --> SYS["4. System Setup<br/>End-to-end communication test"]
```

1. [Prerequisites](/ja/setup/prerequisites): Verify compute sizing, Jetson hardware peripherals, and network firewall rules.
2. [Server Setup](/ja/setup/server-setup): Bring up the cloud server stack first so physical units have a central endpoint to enrol against.
3. [Unit Setup](/ja/setup/unit-setup): Build the robot container on the Jetson SBC and complete the automated cryptographic enrolment handshake.
4. [System Setup](/ja/setup/system-setup): Execute the 10-point end-to-end operational verification checklist.

After initial installation, refer to [Maintenance](/ja/setup/maintenance) and [Troubleshooting](/ja/setup/troubleshooting) for ongoing fleet upkeep.
