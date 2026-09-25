---
outline: deep
---

# WiFi Hotspot + Client

<RoleBadge role="technician" />

Part of every unit's local setup ([Unit Setup](/setup/unit-setup) Step 6): the unit runs its own WiFi hotspot for an operator to join (at `http://mymsd.jp`), and can keep a normal WiFi **client** connection to another network for internet and cloud sync, on the same radio when the hardware allows it.

At every hotspot start, a selector script picks one of two paths:

- **Primary**: virtual AP (`msd700-ap0`) on the onboard radio. Check the real driver's AP+client support first, including [MT7922](/setup/wifi-mt7922).
- **Backup**: the configured USB dongle, tried only if primary interface selection fails. Not failover after a hostapd failure; see limits below.

Provision before the first unit-stack start. Even without a hotspot, `network_local` bind-mounts `/run/msd700-hotspot-active`; starting Docker before that file exists can create a folder in its place and block later provisioning.

## Setup flow

On a fresh unit, in this order. Most units need only steps 2 and 3:

1. **Bring up the onboard radio first.** MT7922? Fix its firmware ([MT7922 Wi-Fi Setup](/setup/wifi-mt7922)): on Tegra kernels the card can stay invisible to NetworkManager, silently pushing the hotspot to the dongle path. If the onboard radio already shows in `nmcli device status`, nothing to fix.
2. [Provision the hotspot](#provisioning-the-hotspot-once-per-unit) (`./setup.sh --provision-network`). Its preflight checks the onboard radio and falls back to a dongle automatically if one is configured.
3. [Verify it works](#verifying-it-works).
4. **(Optional) [Install a backup dongle driver](#installing-the-dongle-driver).** Only if step 2's preflight says the onboard radio can't do the primary path, or for deliberate redundancy. Unneeded where the primary path works.

Only step 2 is interactive and per-unit (SSID, password). The rest is one-time hardware bring-up, redone only if the hardware changes.

## Primary radio vs. backup dongle

The primary path runs client + AP at once on the onboard radio. Check the real driver's full `iw phy <phy> info` output: interface types, limits, channel limits. One phy doesn't rule out simultaneous client+AP on a shared channel; the chip name alone proves nothing. Provisioning's check only looks for `AP` near "valid interface combinations", not the full combination.

::: warning Selection is not a readiness test
The selector creates/brings up `msd700-ap0` and writes the winner to a state file. It doesn't verify combinations or wait for hostapd to broadcast. Backup is tried only when selection fails. A later hostapd/channel failure can retry the same primary path forever, never failing over to the dongle. Both paths use 2.4 GHz channel 6; nothing syncs that with a changing client uplink. Keep wired/console recovery access.
:::

| Path | When used | Needs |
| --- | --- | --- |
| **Primary**: virtual AP on onboard radio | Tried first at every start, on the `STA_INTERFACE_LOCAL` phy | Driver/firmware with working client+AP/channel limits; link-up alone doesn't prove broadcasting |
| **Backup**: USB dongle (`AP_INTERFACE_LOCAL`) | Tried if primary interface selection fails | Working AP-capable dongle + driver. Still not failover after hostapd fails |

::: info A Windows hotspot proves nothing about your Linux driver
Windows runs AP+client through its own virtual-adapter stack, unrelated to Linux `mac80211` concurrency. It hints the *hardware* might do it, but says nothing about your driver's interface combinations. Read `iw phy <phy> info` on the real host.
:::

**Validated backup dongle**: TP-Link TL-WN722N v2/v3, Realtek **RTL8188EUS** (USB `2357:010c`). Other RTL8188EUS dongles should work with the same driver; see `KNOWN_IDS` in `scripts/install-wifi-dongle-driver.sh`. Older setups needed a DKMS driver; check your kernel's modules and AP support before assuming yours does too.

## How it fits together

![How it fits together](./diagrams/wifi-hotspot-how-it-fits-together.drawio)

The hotspot doesn't depend on Docker. `hostapd` + `dnsmasq` run as systemd services, up at boot with or without `docker-manager.sh`. `network_local` provides status/scan/client actions in the dashboard, plus hotspot rename and restart requests. The dashboard still needs the local Docker stack running.

### Why hostapd, not NetworkManager AP mode

NetworkManager's own AP mode hangs on the RTL8188EUS dongle every time (`supplicant-timeout` after ~25 s). Running `hostapd` directly brings the same interface up in under a second: the driver supports AP mode, but its completion event arrives in an order NetworkManager's AP path doesn't expect. So `hostapd` runs as its own systemd service, and NetworkManager is told to leave the AP interface alone (unmanaged drop-in). The client side still uses a normal NM profile.

### Components

| Component | What it does |
| --- | --- |
| `msd700-hotspot-select-iface.sh` | Start-up hook: brings up primary virtual AP if the onboard radio allows, else the backup dongle; writes winner (`IFACE`, `CONF`) to `/run/msd700-hotspot-active` |
| `msd700-hotspot.service` | Gives the winning interface `192.168.4.1/24`, runs `hostapd`, applies/removes firewall rules. Enabled at boot, `Restart=on-failure` |
| `msd700-hotspot-firewall.sh` | Redirects port-80 traffic aimed at the unit's own address to the dashboard (not a captive portal; other port-80 passes through) + NAT relay for internet when an uplink exists |
| `msd700-hotspot-dhcp.service` | Dedicated `dnsmasq`: DHCP (`192.168.4.10`-`192.168.4.200`) + resolves `PORTAL_HOSTNAME_LOCAL` to the unit. Tied to the AP service |
| `/etc/hostapd/hostapd-msd700-primary.conf` / `-backup.conf` | Same SSID/password rendered twice (one per interface), so clients see one identity either way. Mode `0600` |
| `/etc/NetworkManager/conf.d/msd700-unmanaged-ap.conf` | Keeps NM off `msd700-ap0` and the dongle interface |
| `/etc/polkit-1/rules.d/50-msd700-network-manager.rules` | Lets `network_local`'s `nmcli` calls run without an interactive auth prompt |
| `msd700-hotspot-restart.path` / `.service` | `network_local`'s only line to host systemd: touching a sentinel file restarts the hotspot service, nothing else |
| `/etc/tmpfiles.d/msd700-hotspot.conf` | Creates missing state file/dir at boot; doesn't repair a wrong-type path |
| NM connection profile (onboard only) | Normal client connection to the operator's WiFi, `autoconnect: yes` |

Recovery is best-effort: both services restart on failure, but DHCP won't come back by itself after an AP-only restart. Check DHCP/DNS separately after hotplug or SSID/password changes.

`network_local` is not `privileged`. It controls the host's NetworkManager over a bind-mounted D-Bus socket (`NET_ADMIN` + host network for AP-status reads, `apparmor:unconfined` because Docker's default profile blocks D-Bus calls). It also bind-mounts `/run/msd700-hotspot-active` (read-only), `/etc/hostapd` (read-write, for renames), and `/run/msd700-hotspot-restart` (read-write, for restart requests).

## Installing the dongle driver

Only for the **backup** path: onboard radio can't do client+AP, or deliberate redundancy. One-time per unit, before provisioning:

```bash
./scripts/install-wifi-dongle-driver.sh
```

- Installs `dkms`, kernel headers, toolchain if missing.
- Clones [aircrack-ng/rtl8188eus](https://github.com/aircrack-ng/rtl8188eus) to `/usr/src/`.
- Builds via **DKMS** (survives kernel rebuilds if headers + compatible source exist; check DKMS status after kernel updates).
- Loads the module, waits for the second WiFi interface.

Flags: `--check` (verify only), `--remove` (uninstall).

`setup.sh --provision-network` auto-installs only when `AP_INTERFACE_LOCAL` is empty and `lsusb` matches `2357:010c`. Other supported USB IDs need the installer run explicitly.

## Provisioning the hotspot (once per unit)

All below lives **outside Docker** on purpose: it must survive `local_dev` being down, and come up on a unit that never ran `docker-manager.sh`.

### 1. (Optional) Plug in a backup dongle

Only if the onboard radio can't do the primary path, or for redundancy: [above](#primary-radio-vs-backup-dongle). Skip entirely where the primary path works.

Nothing to set in `docker/.env` first. Plug in the validated dongle and provision below; everything is asked interactively there.

If `nmcli` is missing on the host:

```bash
sudo apt install network-manager
```

### 2. Provision

From an interactive terminal (not piped, not non-TTY):

```bash
./setup.sh --provision-network
```

Asks for interface names and SSID (with detected defaults). Password entry is hidden, shows `[keep current]` when set, never displays it. New hotspot password typed twice. Passwords are **not** written back to `docker/.env`: the client key goes to its NetworkManager profile, the AP key to the hostapd configs (`/etc/hostapd/hostapd-msd700-primary.conf` and `-backup.conf` if a dongle exists, `chmod 0600`). Same SSID/password in both, so clients see one identity either way. Other answers (interface names, SSID) are saved back to `docker/.env`.

::: info Unattended provisioning
Without a TTY (or `MSD700_NONINTERACTIVE=1`), prompts are skipped. `docker/.env` is sourced directly, so its values beat inherited environment; then an existing hostapd password beats both. Inline passwords can leak into shell history and don't reliably override. Prefer hidden interactive entry. Secure unattended password rotation is still unsolved.
:::

No need to look up interface names first. The one command:

1. **Installs udev rules** (all `scripts/udev/*.rules`, incl. STM32 + RealSense).
2. **Installs the PolicyKit rule** so `network_local`'s `nmcli` never hangs on an auth prompt.
3. **Finds the backup interface**: if USB `2357:010c` is present but `AP_INTERFACE_LOCAL` is empty, installs its driver if needed, then matches the interface by its `8188eu` kernel driver (independent of MAC/plug order).
4. **Finds the onboard interface**: the one *other* WiFi device, if exactly one exists. Both values are written back to `docker/.env`. Ambiguous cases (two onboard radios) are left for you to set.
5. **Checks primary-path readiness**: STA interface set but absent → one-time `apt-get install -y linux-firmware` + udev re-trigger, else warns and stays on dongle backup (the exact failure [MT7922 Wi-Fi Setup](/setup/wifi-mt7922) fixes by hand). Interface present but no AP in `iw phy` combinations → warns the primary path will keep falling back; a driver/hardware limit, not fixable here.
6. **Installs `hostapd`** if missing, removes any leftover pre-hostapd `msd700-hotspot` NM profile, writes the NM unmanaged drop-in for both AP interfaces (restarting NM *before* hostapd claims them).
7. **Renders and installs** both hostapd configs, the dnsmasq config, firewall + selector scripts, and both systemd units, then enables and **restarts** (not `enable --now`, a no-op on a running service) the hotspot + DHCP services.
8. **Creates the client profile** if uplink interface/SSID are set; leaves an existing same-name profile alone.

Re-provisioning rewrites hostapd configs, restarts NM/AP/DHCP, and can disconnect operators. It also re-runs the Velodyne network setup afterward. Use a local console or wired access, not the WiFi being changed. Existing client profiles are left alone; change client networks from the dashboard.

Host needs: `nmcli`, `iw`, `dnsmasq`, `iptables`, systemd, udev, polkit. This path installs hostapd if absent but **not** dnsmasq or iw; check them first.

### Why not part of `docker-manager.sh build`/`up`

Host network provisioning touches packages, `/etc/`, and systemd: disruptive, and separate from building containers. (`up` also installs boot autostart via sudo unless `--no-autostart`.)

## The dashboard redirect

**Not a captive portal, on purpose.** An earlier version hijacked every OS's connectivity-check hostname, which made each OS conclude the network had **no** internet (Android even fell back to mobile data), hiding its own working uplink. Now:

- `dnsmasq` resolves exactly one hostname, `PORTAL_HOSTNAME_LOCAL` (default `mymsd.jp`) plus subdomains, to the unit. Everything else, including each OS's own connectivity check, resolves for real, so with a working uplink most OSes show **no** "Sign in to WiFi" prompt at all. Open `http://mymsd.jp` directly (or the raw hotspot address).
- The firewall redirects only plain-HTTP traffic **addressed to the unit's own hotspot IP** to the dashboard. Other port-80 browsing and all HTTPS pass through untouched. Units provisioned before this change may still carry the old blanket rule; re-provisioning removes it.

Applied/removed automatically with hostapd up/down, independent of containers.

**Internet relay.** Only when `STA_INTERFACE_LOCAL` is set, the firewall script also adds a `MASQUERADE` rule (`192.168.4.0/24` out the onboard radio) plus `ACCEPT` rules in Docker's **`DOCKER-USER`** chain (the one chain Docker promises never to touch, so rules survive container restarts).

**Security note:** anyone on the hotspot rides the unit's internet connection. Think about who else might learn the hotspot password at a deployment site.

## The dashboard badge

No separate WiFi badge. WiFi lives as a **section inside the [Local Mode badge](/development/data-sync#the-local-mode-status-badge)** dropdown. The badge line shows only a WiFi **glyph**, colored by state, with the summary (SSID, `hotspot only`, `no network`, `wifi unreachable`) as hover tooltip, not printed text. Agent-unreachable is also spelled out at the section top.

The agent reads the *winning* interface from `/run/msd700-hotspot-active` (primary `msd700-ap0` or backup dongle, whichever won this boot), falling back to the `AP_INTERFACE_LOCAL` dongle only if that file is missing. On a primary-only unit with no dongle, this is what lets the badge see the hotspot at all.

Status polls `GET /local/wifi/status` every 30 s (faster briefly after an action), from the always-mounted badge. Scanning runs only when the dropdown opens (`nmcli` rescan isn't free).

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /local/wifi/status` | none | Hotspot state (up? SSID? client count) + client state (connected? SSID? IP? internet?) |
| `GET /local/wifi/scan` | none | Nearby SSIDs + security, for the dropdown. **Excludes this unit's own hotspot** (below) |
| `GET /local/wifi/saved` | none | Known client profiles |
| `GET /local/wifi/hotspot` | none | This unit's hotspot SSID + last-change outcome. **Never returns the password** |
| `POST /local/wifi/connect` | none | Join a chosen client network |
| `POST /local/wifi/disconnect` | none | Leave the client network |
| `POST /local/wifi/forget` | none | Delete a saved client profile |
| `POST /local/wifi/hotspot` | none | Change this unit's hotspot SSID and/or password |

::: warning No login protects these routes
The local routes carry no operator authentication. The agent binds loopback, but the backend proxies browser requests without a login check. Never expose this to untrusted networks.
:::

### Your own hotspot never appears in the scan

Scanning on the client radio while broadcasting the hotspot would list your own hotspot first (strongest). Picking it tells the unit to join itself: hotspot drops you mid-reconfigure, the page reloads onto a dead network, and the obvious move is picking it again. So `scan()` drops it and `connect()` refuses it outright (`own_hotspot`, shown as an explanatory sentence). The SSID to exclude comes from the live radio (`iw dev <ap-iface> info`) and the NM profile; both fail soft. While the AP is down mid-restart, filtering can briefly miss.

## Changing the unit's hotspot

Rename the hotspot and set a new password from the badge dropdown's WiFi section. The agent edits the `ssid=`/`wpa_passphrase=` lines in place in whichever hostapd configs exist (same values in both), then requests a restart indirectly: it touches a sentinel file watched by a host systemd path unit, which runs `systemctl restart msd700-hotspot.service`. No synchronous "restart done" signal exists, so the agent polls radio state up to 15 s instead of trusting a fixed sleep.

::: danger Saving disconnects everyone on the hotspot, including you
Unavoidable: the dashboard arrives over the very connection the change destroys. Restarting the AP under a new SSID/key drops every device, and none auto-rejoin (to their OS it's an unknown network or wrong password).

So `POST /local/wifi/hotspot` validates, answers **202 Accepted** with the SSID to reconnect to, *then* applies the change. Answering first lets the UI say "reconnect to `<new name>`" while it still has a connection. The response means *accepted*, never *succeeded*: read `GET /local/wifi/hotspot`'s `last_change` after rejoining.
:::

::: warning Best-effort rollback, not verified connectivity
On failure the agent restores the previous SSID/key and reactivates them (`last_change.rolled_back` tells a rolled-back change from a never-submitted one). "Failure" means the expected SSID never appeared within 15 s, not a command error. It doesn't verify the new password, DHCP, DNS, or reconnection; rollback itself can fail. `last_change` is in-memory, lost on agent restart.
:::

**Validation** (in the agent, not just the form): SSID 1-32 **octets** (non-Latin names hit the limit sooner than their character count), WPA-PSK password 8-63 chars. Control characters rejected, not stripped. Nothing is touched until validation passes, so a bad value can never kill a hotspot.

**The password never goes to the browser.** Anyone on the hotspot already knows it; returning it over plain HTTP would hand it to anyone reaching the dashboard from the *client-side* network. The form asks for a new password; blank means "keep the current one".

::: warning `docker/.env` is a seed, not the truth
Provisioning reads `docker/.env`, then prefers the live password from primary, backup, or legacy hostapd config, in that order. Change it via the hidden prompt or dashboard, never by env override. Unlike the password, the live SSID is *not* recovered into provisioning: a dashboard rename can be reset by a later re-provision from stale `AP_SSID_LOCAL`. Check the broadcast SSID (`iw dev <ap-interface> info`) at the prompt.
:::

Client internet reachability (`full` / `limited` / `portal` / `none`) comes straight from `nmcli networking connectivity`. Nothing here implements a second probe.

## Configuration reference (`docker/.env`)

| Variable | Meaning | Default |
| --- | --- | --- |
| `AP_INTERFACE_LOCAL` | **Backup** dongle interface | auto-detected during `--provision-network` |
| `STA_INTERFACE_LOCAL` | Onboard radio interface, also backs the **primary** hotspot | auto-detected during `--provision-network` |
| `AP_SSID_LOCAL` | Hotspot broadcast name | `MSD700-<hostname suffix>` if blank |
| `AP_PASSWORD_LOCAL` | Hotspot WPA2 password (8+ chars, required to create the AP) | blank in `.env.example` on purpose |
| `AP_CONNECTION_NAME_LOCAL` | Legacy: only cleans up a leftover pre-hostapd NM profile of this name | `msd700-hotspot` |
| `PORTAL_HOSTNAME_LOCAL` | Hostname dnsmasq resolves to the unit; the one address the firewall redirects | `mymsd.jp` |
| `NETWORK_AGENT_PORT_LOCAL` | `network_local`'s loopback API port | `5011` |
| `STA_SSID_LOCAL` / `STA_PASSWORD_LOCAL` | Optional: upstream network to auto-join at first provisioning | empty (add later from the dashboard instead) |
| `LOCAL_IP` | Printed dashboard address + frontend build fallback; hotspot's fixed address stays `192.168.4.1` | `192.168.4.1` |

## `network-agent` endpoint reference

`network_local` binds `127.0.0.1:5011` only; `backend_local` is the sole caller and adds operator auth. The proxy between them is `wifi_proxy.js` (25 s timeout, passes the hotspot body through untouched to preserve absent-vs-empty). The agent shells to `nmcli` via argv only (never a shell), 15 s per call, over a D-Bus bind-mount to host NetworkManager. Provisioning the hotspot is **not** its job (`setup.sh --provision-network` does that).

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | `{ ok: true }` |
| `GET /wifi/status` | Radio/connection state |
| `GET /wifi/scan` | Networks (own-hotspot SSIDs filtered, deduped strongest-first) |
| `GET /wifi/saved` | Saved profiles |
| `POST /wifi/connect { ssid, ... }` | Join (standard, enterprise EAP, or hidden); 400 without ssid, 502 on failure |
| `POST /wifi/disconnect` | Drop the client uplink |
| `GET /wifi/hotspot` | Current hotspot + `limits` (SSID 32 octets max, password 8–63) + `last_change` |
| `POST /wifi/hotspot` | Validate now, apply in 1.5 s: `202 { accepted, applies_in_ms: 1500, ssid, password_changed }` |
| `POST /wifi/forget { name }` | Delete a saved profile |

## Verifying it works

```bash
# Services running?
systemctl status msd700-hotspot.service msd700-hotspot-dhcp.service

# Which path won, primary (msd700-ap0) or backup (dongle)?
cat /run/msd700-hotspot-active

# Broadcasting in AP mode? (IFACE from the file above)
iw dev <IFACE> info                      # should show: type AP

# NetworkManager staying out of the way?
nmcli device status                      # msd700-ap0 / dongle should show "unmanaged"

# Dashboard hostname resolves to this unit?
dig +short @192.168.4.1 mymsd.jp                # should print 192.168.4.1

# Everything else resolves for real (only if STA_INTERFACE_LOCAL is set)?
dig +short @192.168.4.1 github.com              # a real IP, not 192.168.4.1

# NAT + relay rules present?
sudo iptables -t nat -L POSTROUTING -n | grep 192.168.4.0
sudo iptables -L DOCKER-USER -n
```

From another device: join the SSID, open `http://mymsd.jp` (or the raw hotspot address). With a working uplink most OSes show **no** "Sign in to WiFi" prompt; that was removed on purpose ([above](#the-dashboard-redirect)). Other browsing should work normally if `STA_INTERFACE_LOCAL` is set.

## Troubleshooting

**Dongle missing from `lsusb`, or no second WiFi in `nmcli device status`**
Missing `lsusb` = USB/power/connection issue, not a driver issue. USB present but no interface → check the driver (`./scripts/install-wifi-dongle-driver.sh --check`) and kernel logs.

**Installer says the module isn't loaded right after a successful build**
Retry once: known race between `dkms install`'s `depmod` and `modprobe`. The script already retries internally (5x); if still failing, `sudo dmesg | tail -40`.

**Hotspot won't broadcast / `iw dev` shows `type managed`, not `AP`**
`journalctl -u msd700-hotspot.service` starts with the selector's own decision log (which path, why it fell back). Repeated activation failures: confirm NM released the winning interface (`nmcli device status` must say `unmanaged`). A stale unmanaged-conf pointing at the wrong interface name is the usual cause after swapping dongles.

**Hotspot always uses the backup dongle though the onboard radio should do primary**
Read the full `iw phy <phy> info` for the onboard phy (managed+AP, total-interface, channel limits). Then `journalctl -u msd700-hotspot.service`: selection and broadcasting are separate stages with separate errors.

**Preflight warns the onboard radio's driver/firmware isn't ready**
Exactly what [MT7922 Wi-Fi Setup](/setup/wifi-mt7922) fixes by hand; the automatic `apt-get install -y linux-firmware` during provisioning isn't always enough on this Tegra kernel. The hotspot keeps working on the backup dongle meanwhile, if configured.

**`--provision-network` fails with "nmcli not found"**
`sudo apt install network-manager`.

**`--provision-network` fails, "AP_PASSWORD_LOCAL is not set"**
Re-run interactively and enter a new password in the hidden prompt. Never commit it to tracked `docker/.env` or put it in shell history. Use a 1-32-byte SSID and 8-63-char WPA2 password without control characters (provisioning checks length only; the agent validates the rest).

**Clients join but get no IP**
`systemctl status msd700-hotspot-dhcp.service` + `journalctl -u msd700-hotspot-dhcp.service`. dnsmasq's interface comes from `/run/msd700-hotspot-active` on the service command line; confirm the state file matches the interface actually up. Re-run `./setup.sh --provision-network` if config is stale.

**Clients reach `http://mymsd.jp` but nothing else loads**
`STA_INTERFACE_LOCAL` is probably empty in `docker/.env`: AP-only mode, dashboard-only by design. If it should be set, check `nmcli device status`, set it, re-run provisioning.

**`STA_INTERFACE_LOCAL` set but still no internet for clients**
Check NAT rules exist ([above](#verifying-it-works)). If missing after re-provision: confirm the hotspot service was actually **restarted** (not just enabled), `sysctl net.ipv4.ip_forward` is `1`, and the onboard radio itself has internet (`ping -I <STA_INTERFACE_LOCAL> 8.8.8.8`).

**Local services (backend, media, MySQL) unreachable after provisioning**
The redirect rule is mis-scoped. It must target only the winning interface from `/run/msd700-hotspot-active` and only the unit's own address (`-d`), never loopback or `0.0.0.0/0`: `sudo iptables -t nat -L PREROUTING -n`.

**Badge says "Hotspot: no hotspot radio" though the hotspot is up**
Confirm `/run/msd700-hotspot-active` is mounted into `network_local` (`docker compose exec network_local cat /run/msd700-hotspot-active` should match the host). Empty inside = bind mount not wired up. Mount fine = `--provision-network` never ran, or both interface variables genuinely empty.

**No WiFi glyph on the badge at all**
Neither radio present: no AP, no client interface, nothing to report. Expected on WiFi-less builds; else check `nmcli device` / `lsusb`.

**Hotspot up, glyph red, "WiFi service unreachable on this unit"**
`network_local` down, or `backend_local` can't reach it. `docker compose ps` for `network_local`; confirm `NETWORK_AGENT_PORT_LOCAL` matches on both services.

**Badge `nmcli device wifi connect` fails with an unhelpful reason**
nmcli's stderr passes through verbatim. Read it directly: it distinguishes wrong password / out-of-range / refused.

**Dashboard hotspot change reports `not_provisioned`**
Neither hostapd config exists yet, or `network_local` can't read them (check the `/etc/hostapd` bind mount: `docker compose exec network_local ls -l /etc/hostapd`). `--provision-network` never ran.

**Dashboard hotspot change times out / never confirms**
`setHotspot()` touches the sentinel file and waits up to 15 s for the new SSID on air ([above](#changing-the-units-hotspot)). Check `systemctl status msd700-hotspot-restart.path msd700-hotspot-restart.service`, the `/run/msd700-hotspot-restart` read-write mount into `network_local`, and `journalctl -u msd700-hotspot-restart.service`.

## Related

- [MT7922 Wi-Fi Setup](/setup/wifi-mt7922): step 1 of the [flow](#setup-flow), only for a confirmed MT7922 firmware issue on the real unit
- [Unit Setup](/setup/unit-setup): the base local-mode install this sits on
- [Docker Reference](/setup/docker-reference#network-mode-host): why some services share the host network
- [Data Sync: Local Mode badge](/development/data-sync#the-local-mode-status-badge): the badge this section lives in
- [Architecture: Trust domains](/development/architecture#multi-tier-trust-domains-and-security): trust design for `/local/*` routes (operator-session middleware on mutating WiFi routes is designed but not attached; see warning above)
