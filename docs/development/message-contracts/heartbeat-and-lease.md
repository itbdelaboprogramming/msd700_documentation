---
outline: deep
search: false
---

# Heartbeat & Lease

<RoleBadge role="developer" />

Two signals tell a unit that someone is watching it, and one of them also decides who may drive it.

| Signal | Transport | Rate | Carries authority | Feeds |
| --- | --- | --- | --- | --- |
| [`hardware.ping`](#ping-request) | HTTP → `backend_node` → MQTT, round trip | 1 s from operating pages, per unit from the unit list | yes: claim, release, takeover | the operating lease, the idle/shutdown watchdog tiers, the status the dashboard shows |
| [`hardware.heartbeat`](#heartbeat-frame) | MQTT over WebSocket, browser → unit broker, one way | 5 Hz (200 ms) | no | the 2 s presence tier only |

The heartbeat exists only on a unit's local dashboard (`NEXT_PUBLIC_MQTT_WS_URL` set). The cloud
dashboard relies on the ping alone. Watchdog behaviour:
[Safety Watchdog](/development/ros/safety-watchdog#two-presence-signals).

## Ping request {#ping-request}

The browser calls [`POST /api/hardware/ping`](/development/message-contracts/http-api#hardware-ping);
`backend_node` sends this envelope on `/unit_<ULID>/system_command`:

```json
{
  "header": "hardware",
  "command": "ping",
  "data": {
    "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
    "user_id": "01JZ7YV5CQUSER00000000000",
    "claim": true,
    "release": false,
    "page": "navigation",
    "origin": "cloud",
    "force_takeover": false
  },
  "metadata": { "timestamp": "2026-08-12T04:11:52.913Z", "request_id": "..." }
}
```

| Field | Set by | Meaning |
| --- | --- | --- |
| `session_id` | browser | One UUID per browser tab (`getOperatingSessionId()`) |
| `user_id` | backend, from the JWT | Lease identity. Never taken from the body, so a client cannot claim as someone else. The ULID, not the username, so a rename does not move a lease. |
| `claim` | browser | `true` from the operating pages (Navigation, Mapping); `false` from the unit list, which only reads status |
| `release` | browser | `true` on the way out of an operating page (sent with `page: "other"`, `keepalive`) |
| `page` | browser | `dashboard`, `navigation`, `mapping`, `other`. Decides which watchdog tiers the ping refreshes. |
| `origin` | backend, from `DEPLOYMENT_MODE` | `cloud` or `local`. Never from the body. |
| `force_takeover` | browser | `true` only after the operator confirms the takeover prompt |

Pings are never retried and never deduplicated: a lost ping is exactly what the watchdog has to see.

## Ping response {#ping-response}

`system_feedback`, and then `details.data` of the HTTP answer:

```json
{
  "status": true,
  "robot_activity": "navigation_ready",
  "active_page": "navigation",
  "battery": 87.5,
  "uptime": 42.3,
  "hw_status": "ready",
  "manual_override": false,
  "autopilot": false,
  "active_map_id": "01JZ8QK2H0000000000000MAP",
  "in_use": false,
  "in_use_by": null,
  "origin_conflict": false,
  "origin_conflict_side": null,
  "motion_locked": false
}
```

| Field | Meaning |
| --- | --- |
| `robot_activity` | Current activity after stuck detection, see [activity values](/development/message-contracts/mqtt-commands#robot-activity) |
| `active_page` | The page that last claimed the robot, before stuck detection; used for routing the dashboard back to the right tab |
| `battery` | State of charge, percent (float) |
| `uptime` | Minutes since the node started |
| `hw_status` | Hardware monitor state (`ready`, `fault`, ...) |
| `manual_override` | Manual override is engaged |
| `autopilot` | Autopilot is engaged |
| `active_map_id` | Map ULID of the running navigation session, or `null` |
| `in_use` | Another **account** holds the lease; the unit list shows *In Use* and refuses selection. `false` for a unit left on autopilot with nobody watching, so the next operator can take the run over. |
| `in_use_by` | The holder's user ULID |
| `origin_conflict` | The **same account** holds the lease from another tab or the other surface; the dashboard shows the takeover prompt |
| `origin_conflict_side` | `cloud` or `local`, the holder's surface |
| `motion_locked` | `/emergency_pause` is raised; the robot will not move whatever the UI shows |

The backend then merges `intended_mode`, `map_id`, `sync_status`, `needs_recovery`; see
[HTTP API § ping](/development/message-contracts/http-api#hardware-ping).

## Heartbeat frame {#heartbeat-frame}

Published by `src/services/heartbeatService.ts` on `/unit_<ULID>/system_command`, QoS 0, no retain,
every 200 ms, one MQTT client per tab (`clientId` `msd700-hb-<random>`, clean session, keepalive 1 s):

```json
{
  "header": "hardware",
  "command": "heartbeat",
  "metadata": { "request_id": "heartbeat" },
  "data": { "page": "navigation" }
}
```

`page` is the only field the robot reads. There is no lease, no claim or release, no `origin`, and
no feedback. It proves presence and nothing else.

## Cloud presence ping (bridge entries) {#presence-ping}

The MQTT bridge still carries a separate ping/pong pair, independent of `hardware.ping`:

| Side | ROS topic | MQTT topic |
| --- | --- | --- |
| robot, outgoing | `/msd/ping` | `/unit_<ULID>/server/ping` |
| robot, incoming | `/msd/pong` | `/unit_<ULID>/msd/pong` |
| cloud, outgoing | `/unit_<ULID>/server/ping` | `/unit_<ULID>/msd/ping` |
| cloud, incoming | `/unit_<ULID>/server/pong` | `/unit_<ULID>/server/pong` |

No node in the current source publishes `/msd/ping` or `/unit_<ULID>/server/ping`, and the names do not
pair up end to end, so nothing travels on these today. Unit liveness in the dashboard comes from the
ping response above.

## Related documentation

- [Safety Watchdog](/development/ros/safety-watchdog): the tiers these signals feed.
- [Navigation: ROS Integration](/development/webui/navigation/ros-integration): how the dashboard reacts to the lease fields.
- [MQTT Commands](/development/message-contracts/mqtt-commands): the envelope both frames use.
