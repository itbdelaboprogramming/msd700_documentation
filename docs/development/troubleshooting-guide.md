---
outline: deep
search: false
---

# Developer Diagnostics and Troubleshooting

<RoleBadge role="developer" />

This document provides structured diagnostic workflows, symptom-to-cause mappings, and recovery procedures for resolving common engineering issues across the MSD700 stack.

::: info Ownership
Three troubleshooting pages share symptoms by role: the [User Guide](/user-guide/troubleshooting) owns operator fixes, [Setup Troubleshooting](/setup/troubleshooting) owns technician fixes, and this page owns root causes. Fix a symptom in the page of the role that fixes it; link, don't duplicate.
:::

## Systematic Diagnostic Flowchart

![Systematic Diagnostic Flowchart](./diagrams/troubleshooting-guide-systematic-diagnostic-flowchart.drawio)

## Common Failure Modes and Solutions

### 1. Unit Appears Offline (MQTT Broker Layer)
- **Symptom**: The unit status badge in the dashboard displays `offline`.
- **Root Cause**: The physical robot cannot establish an encrypted TLS connection to HiveMQ port 8883.
- **Diagnostic Steps**:
  1. Check HiveMQ container status on the server: `docker ps | grep hivemq`.
  2. Verify that the TLS certificate keystore (`/srv/msd/secrets/hivemq/keystore.p12`) is valid and readable by UID 1001.
  3. On the robot, inspect MQTT bridge logs: `tmux attach -t robot_services` and check the `aws_mqtt` window.

### 2. Unit Online, But Map Canvas Remains Blank (rosbridge / Relay Container)
- **Symptom**: Commands succeed, but no map, robot icon, or laser scan appears on the web canvas.
- **Root Cause**: The fleet relay container (`ros_web_ui_v2_unit_relays`) is down: or, on the legacy per-unit path, the on-demand container `rosweb_unit_<u>_<unit>_nakayama` was stopped by the idle reaper: or Apache WebSocket proxying is blocked.
- **Diagnostic Steps**:
  1. Check the fleet relay first: `docker ps | grep unit_relays`. On the legacy path, check the per-unit container instead: `docker ps | grep rosweb_unit`.
  2. On the legacy path only: reload the unit page in the browser to trigger a `touch` event in `unit_manager.js`. In fleet mode the roster comes from the `units` table, so no touch event is needed: an enrolled robot is reachable.
  3. Test WebSocket connectivity to `/services/rosbridge` using browser developer tools.

### 3. Navigation Freezes with TF Errors (`use_sim_time` Staleness)
- **Symptom**: The robot refuses to move, and console logs display repeated TF warnings mentioning "simulated time" or `TF_OLD_DATA`.
- **Root Cause**: `/use_sim_time` was set to `true` on the ROS master by a simulation run, but no `/clock` publisher exists during real robot operation.
- **Resolution**:
  ```bash
  rosparam set /use_sim_time false
  ```
  Restart the robot bringup stack. Note that restarting nodes alone will not clear the parameter because it resides directly on `roscore`.

### 4. Video Stream Stalls or Fails on Local Wi-Fi (mDNS Candidate Error)
- **Symptom**: WebRTC video fails to connect on a local network with `Errno 19: No such device`.
- **Root Cause**: Chrome emits privacy-preserving `.local` mDNS candidate names. When the robot has no internet gateway, `aioice` fails attempting to join multicast DNS.
- **Resolution**: Verify that `camera_client.py` contains the `_strip_mdns_candidates()` filter and that local ICE configuration variables (`LOCAL_STUN_URLS`, `LOCAL_TURN_URL`) are set to `none`.

### 5. Keep-Out Costmap Deadlock
- **Symptom**: Goals are accepted by `move_base`, but the robot never drives forward.
- **Root Cause**: `keepout_layer` is enabled in `costmap_common_params_field.yaml` but waiting for `/msd700/keepout_grid`. If no keep-out grid is published, costmaps are never marked "current".
- **Resolution**: Ensure `path_coverage_node` or `system_command.py` publishes an empty keepout grid on initialization.

### 6. Local Sync Reports "Access Denied" (Local Database Credential Drift)
- **Symptom**: The Local Mode sync log shows `Access denied for user '<MYSQL_USER>'@'127.0.0.1' (using password: YES)`, historically mislabeled as failing during the `handshake` phase even though the cloud is reachable.
- **Root Cause**: `docker/.env` on the unit is git-tracked and per-host. If `MYSQL_USER`/`MYSQL_PASSWORD` changes there (a `git pull`, or a manual edit) after the unit's `mysql_data_local` volume has already been initialized, MySQL keeps the old password baked into the data directory: it does not retroactively adopt the new one. `sync_agent.js` then fails its own first local `sync_state` read with `ER_ACCESS_DENIED_ERROR`, not a cloud connectivity error. See [Data Sync: Failure Classification](/development/data-sync#failure-classification) for how this is now distinguished from a real cloud outage.
- **Diagnostic Steps**:
  1. On the unit: `cat docker/.env | grep MYSQL_` and check whether the values look recently changed (e.g. right after a `git pull`).
  2. Confirm the mismatch directly: `docker exec -it <local_db_container> mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD"`: a manual `Access denied` confirms drift rather than a transient blip.
- **Resolution**: Either revert `docker/.env` to the password the volume was initialized with, or, if the rotation was intentional, run `ALTER USER '<user>'@'%' IDENTIFIED BY '<new_password>';` against the local MySQL as root so the database matches the new `.env` value. Do not wipe `mysql_data_local` to "fix" this: it is the unit's only local copy of maps/routes not yet synced to the cloud, and this failure mode means sync itself is not currently working.

### 7. Cloud Dashboard Has No Live Topics (ROS Master Hijacked by a Forwarded Port)
- **Symptom**: The cloud dashboard shows status, activity and saved maps normally, but nothing live: no map while mapping, no lidar, no robot pose. The unit's own local dashboard works perfectly. The backend container still reports `Up`.
- **Root Cause**: A unit stack registered on the **cloud** ROS master instead of its own, and ROS shuts down the older node whenever a name is claimed twice, so the server lost its `/rosbridge_websocket` (and `/backend_node`). The usual route in is a VS Code Remote or `ssh -L` session forwarding the server's master port to a laptop, which makes a remote master answer on `localhost`. Units now use `11321`/`11322` and `run_msd.sh` refuses a master it does not own, but an override or a pre-fix checkout can still get there.
- **Diagnostic Steps**:
  1. Run `scripts/ros_doctor.sh` in the backend container. It names the master's owner, lists nodes registered from hosts this machine cannot reach, and says whether anything is listening on the rosbridge port.
  2. The signature is a rosbridge node that IS registered but from a foreign hostname, next to nothing listening on 9090/9091.
  3. `docker ps` shows the backend container `unhealthy` once its rosbridge healthcheck has had time to fail.
- **Resolution**: Fix `ROS_MASTER_URI` on the machine that wandered in (close the port forward), then `rosnode cleanup` on the server and restart the backend container. Restarting first only starts a fight over the name.

## Related Documentation

- [Architecture](/development/architecture): Two-channel communication models.
- [Message Contracts](/development/message-contracts): Expected topic formats and payloads.
- [Setup: Troubleshooting](/setup/troubleshooting): Technician and deployment troubleshooting steps.
