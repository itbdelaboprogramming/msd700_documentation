---
outline: deep
search: false
---

# Commissioning Checklist (New Unit)

<RoleBadge role="technician" />

End-to-end acceptance for one new robot, unboxing to signed-off. Follow the linked pages for the how; check each box only on the pass criterion given. A unit is **not** commissioned until every box passes.

## 1. Host prep

- [ ] `setup.sh` run (Docker, groups, xhost). Pass: `--check` clean.
- [ ] Velodyne link (`--configure-lidar`, `192.168.103.231` reachable). Pass: ping answers.
- [ ] `setup.sh --provision-network` from a wired console, hotspot + client saved to `/etc/hostapd/*.conf` (0600), hidden password typed twice. Pass: SSID broadcasts.

See [Unit Setup](/setup/unit-setup).

## 2. Build and start

- [ ] `docker/.env` reviewed ( Velodyne IPs match the launch file, `AP_SSID`, 8+ char `AP_PASSWORD`). Pass: no `change_me` left where it matters.
- [ ] `docker-manager.sh build` then `up`. Pass: `status` shows the container up; no build errors.
- [ ] First boot prints a CLAIM CODE; adopt/register it in Pending. Pass: unit appears under its ULID, no second pending row.

See [Unit Setup](/setup/unit-setup), [Docker Reference § Unit `docker-manager.sh`](/setup/docker-reference#unit-docker-manager-sh).

## 3. Identity and network

- [ ] `Certificates/robot/device.json` + `token.cred` exist, mode 0600. Pass: `token_refresh` log shows 6-hour renewals, no re-enrol loop.
- [ ] Hotspot serving operators; client uplink joined. Pass: operator laptop sees the SSID and reaches the unit dashboard; unit reaches the cloud backend.
- [ ] `msd700.service` installed with the right flags (`--dev`/`--simulator` preserved). Pass: `print-autostart-unit` shows the expected `ExecStart`.

See [WiFi Hotspot](/setup/wifi-hotspot), [Hardware Enrolment](/development/webui/accounts/enrolment).

## 4. Robot stack

- [ ] `tmux attach -t robot_services`: `roscore`, `ros_webui`, `camera_client`, `switch_mode`, `log_janitor`, `token_refresh` all alive. Pass: no window dead at 5 minutes.
- [ ] `ros_doctor.sh` clean. Pass: `OK master answers`, stack stamp present, rosbridge listening, no foreign nodes.
- [ ] `curl http://localhost:5002/local/status` answers. Pass: HTTP 200 with the unit's status.

See [Docker Reference § Unit `run_msd.sh`](/setup/docker-reference#unit-run-msd-sh).

## 5. Capabilities

- [ ] Drive manually (teleop) 5 m out and back. Pass: returns, no watchdog pause on a live link.
- [ ] Map a room, stop, save. Pass: map appears in the cloud Database under this unit's ULID.
- [ ] Navigate to a pin on that map. Pass: goal accepted and reached.
- [ ] Camera live on cloud dashboard and on unit-local dashboard. Pass: video in both, no 15 s stall loop.
- [ ] Autopilot coverage of one polygon. Pass: sweep completes, snapshot survives a tab reopen.

See the [User Guide](/user-guide/) for the operator flows.

## 6. Sign-off

- [ ] `docker/.env` backed up off-unit (it is per-host and git-tracked only as `.env.example`).
- [ ] Unit row, name, and rental assignment verified in the admin console.
- [ ] Date, technician, unit ULID, and software versions recorded.

Failures go to [Setup Troubleshooting](/setup/troubleshooting) with the tmux window and log file attached.
