---
search: false
---

# Setup and Deployment Guide

<RoleBadge role="technician" />

How to install and configure MSD700 hardware and software. For technicians, system engineers, and field installers.

Every page has the exact shell commands, expected outputs, and config templates you need.

<LinkCards>
  <LinkCard icon="✅" title="Prerequisites" details="Hardware, OS versions, and firewall ports to prepare first." link="/setup/prerequisites" />
  <LinkCard icon="🖥️" title="Server Setup" details="Deploy the production cloud: Docker Compose, Apache reverse proxy, and SSL." link="/setup/server-setup" />
  <LinkCard icon="📡" title="Unit Setup" details="Install the physical robot on the NVIDIA Jetson, build, and enrol it." link="/setup/unit-setup" />
  <LinkCard icon="🔗" title="System Setup" details="Check that server and unit work together, then hand over to operators." link="/setup/system-setup" />
  <LinkCard icon="📋" title="Commissioning Checklist" details="Acceptance sheet for one new unit: unboxing to signed-off." link="/setup/commissioning-checklist" />
  <LinkCard icon="🐳" title="Docker Reference" details="All Docker Compose profiles, commands, environment variables, and volumes." link="/setup/docker-reference" />
  <LinkCard icon="📶" title="WiFi Hotspot + Client" details="Run the unit's own Wi-Fi hotspot plus a client connection for internet." link="/setup/wifi-hotspot" />
  <LinkCard icon="📡" title="MT7922 Wi-Fi Setup" details="Fix the onboard MediaTek MT7922 firmware on the Tegra kernel." link="/setup/wifi-mt7922" />
  <LinkCard icon="🧰" title="Maintenance" details="Log rotation, key rotation, certificate renewal, and backups." link="/setup/maintenance" />
  <LinkCard icon="🛠️" title="Technician Troubleshooting" details="Fix hardware, container, MQTT broker, and sensor problems." link="/setup/troubleshooting" />
</LinkCards>

## Install order

MSD700 always has two machines: one Server plus one or more Units. Install in this order:

![Install order](./diagrams/setup-install-order.drawio)

1. [Prerequisites](/setup/prerequisites): check hardware and open firewall ports.
2. [Server Setup](/setup/server-setup): start the cloud server first, so units have somewhere to enrol.
3. [Unit Setup](/setup/unit-setup): build the robot container on the Jetson and enrol it to the server.
4. [System Setup](/setup/system-setup): run the end-to-end checklist (10 items).
5. [Commissioning Checklist](/setup/commissioning-checklist): accept one new unit, box by box.

After that, see [Maintenance](/setup/maintenance) and [Troubleshooting](/setup/troubleshooting) for day-to-day care of the units.
