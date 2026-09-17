---
outline: deep
search: false
---

# Camera & Live View: ROS Integration

<RoleBadge role="developer" />

The robot-hosted half of the live-view handshake described in
[Overview](/development/webui/camera/overview): `camera_client.py`'s ICE configuration, the mDNS
candidate bug that broke it on a unit with no internet, and the reconnect logic that keeps a camera
alive across a flaky connection.

::: warning `camera_client.py` is not a ROS node
Despite running on the robot host, `camera_client.py` is a plain Python process (an `aiortc`-based
WebRTC client) started in the `camera_client` tmux window by `run_msd.sh`, not a ROS node: no topic,
service, or node registration. This page is titled "ROS Integration" for consistency with the rest
of this section, but there is no `.launch` file to point to here.
:::

## One camera, two peer connections

A single physical camera is shared by **two** independent `CameraClient` objects in that one process
(one peered with the cloud, one peered with whatever dashboard is open on the unit's own LAN), each
with its own WebSocket connection and its own `RTCPeerConnection`.

| Target | Signalling WebSocket | Media / backend | STUN/TURN |
| --- | --- | --- | --- |
| Cloud production | `wss://msd.nglobal.jp/services/signalling` (Apache proxies to `:3001`) | media `:3003`, backend `:5000` | Google STUN + the production `coturn` relay |
| Cloud dev | `ws://<server-ip>:4001` | media `:4003`, backend `:5001` | same as production (one relay, shared) |
| Unit-local | `ws://<unit-ip>:3001` | media `:3003`, backend `:5002` | **none by default** |

## Why the unit-local path has no STUN/TURN by default

A unit with no internet route fails `getaddrinfo` resolving `stun.l.google.com`, and `aiortc` raises
that failure straight out of `setLocalDescription`: not a degraded connection, a dead
`start_stream()` and no video at all, even though the camera, the signalling server and the
dashboard are all healthy. Since the operator's browser and the robot share the same LAN in this
case, a host candidate is already reachable; there is nothing for a relay to solve.

`camera_client.py` and the dashboard's `VideoStreamComponent` both read the same convention for
their ICE server list: unset falls back to the cloud defaults (Google STUN plus the production TURN
credentials), and the literal string `none` clears the list entirely rather than leaving it unset.
`LOCAL_STUN_URLS` / `LOCAL_TURN_URL` / `LOCAL_TURN_USERNAME` / `LOCAL_TURN_CREDENTIAL`
default to the literal string `none` in code (`camera_client.py`) for exactly this reason — in
`msd700_noetic/docker/.env` they are commented out, so the code default is what applies. They are
only worth setting on a unit whose LAN genuinely needs a relay (a segmented network, a captive
Wi-Fi bridge between robot and operator).

## The mDNS candidate bug (2026-08-14)

Modern Chrome does not put a host's real LAN address in an ICE candidate. It mints a random
`<uuid>.local` name instead and relies on multicast DNS to resolve it, a privacy feature that
assumes the receiving side can join mDNS. On a unit with no default route, it cannot:

```
OSError: [Errno 19] No such device
  at aioice/mdns.py, joining 224.0.0.251 with INADDR_ANY
  raised out of add_remote_candidate()
```

The critical detail is where this is raised: not per-candidate, but out of `add_remote_candidate`
itself, which aborts the entire `setRemoteDescription` call. One unresolvable candidate in the
answer was enough to fail the whole negotiation, even though the browser's answer also carried a
usable public IP: a symptom that reads exactly like a DNS problem, which is what made it easy to
conflate with the unrelated STUN-resolution failure described above.

### The fix

`_strip_mdns_candidates()` removes any `a=candidate:` line whose address ends in `.local` from the
answer before handing it to `aiortc`, and does the same for trickled candidates in
`handle_ice_candidate`. The candidate most likely to matter for connectivity is gone either way, so
this only works because of what happens next:

- **`a=end-of-candidates` is stripped too, whenever anything else was.** Leaving it in place would
  tell `aioice` "no more candidates are coming," and an agent with zero remote candidates and nothing
  left to wait for declares the connection failed before the browser's own connectivity check has a
  chance to arrive.
- **The recovery mechanism is peer-reflexive discovery (RFC 8445 §7.2.1.3), not name resolution.**
  The robot still advertises its own host candidates. Once the browser's STUN connectivity check
  reaches one of them, `aioice` learns the browser's real address from the source of that packet. No
  `.local` name ever needs resolving. This is why stripping the candidate is *removing dead weight*,
  not removing the only path to connectivity.
- **A bounded wait replaces `aioice`'s own (non-existent) timeout.** With no remote candidates and no
  end-of-candidates marker, `aioice` will wait indefinitely: correct behaviour if peer-reflexive
  discovery is still coming, wrong behaviour if the browser tab closed mid-handshake.
  `_watch_prflx_handshake()` sleeps `MDNS_PRFLX_WAIT_S` (default 20s, generous for a LAN where the
  real connectivity check typically lands in under a second) and calls `restart_ice()` if the
  connection still is not `connected`/`completed` by then.

```mermaid
flowchart LR
  A["answer SDP arrives"] --> B{"any a=candidate:*.local ?"}
  B -->|no| E["setRemoteDescription unchanged"]
  B -->|yes| C["drop those lines,<br/>drop a=end-of-candidates too"]
  C --> D["setRemoteDescription"]
  D --> F["watch_prflx_handshake:<br/>wait up to 20s"]
  F -->|connected in time| G["normal"]
  F -->|still not connected| H["restart_ice()"]
```

::: warning Stripping applies to both targets, not just unit-local
An mDNS candidate is equally useless to the cloud target: it names an address unreachable across the
internet regardless of DNS. The fix is unconditional rather than gated on which `CameraClient`
instance is handling the answer.
:::

## Reconnect and retry

`camera_client.py`'s connection loop never gives up permanently. An earlier version stopped after a
fixed attempt budget and left the camera dead until someone manually restarted `run_msd.sh`. Retry
delay is exponential backoff with jitter: a 2-second base, doubled per failed attempt, capped at 60
seconds, and randomised so that a fleet of units sharing one cloud signalling server does not retry
in lockstep after a shared outage.

A transport-level ICE failure (`iceConnectionState` reaching `failed`) triggers `restart_ice()`
directly: the old peer connection is torn down, a new one built with the same ICE configuration, the
track and data channel re-attached, and a fresh offer sent with an `isRestart` flag. This is separate
from restarting the physical camera, which is rate-limited to once per 15 seconds and mutually
exclusive with an in-progress reboot, since both power-cycle the same `/dev/videoN` shared by both
`CameraClient` instances.

## Deploying a change here

`camera_client.py` is always bind-mounted, on both the cloud-only path and the `local_dev` path. An
edit on the host takes effect the next time `run_msd.sh` (re)starts the tmux window, no image build
involved. The signalling server, by contrast, ships inside the unit's local-stack image:
`Dockerfile.webui-local` `COPY`s the whole `./src/ros-web-ui/source` tree (with a conditional
dependency install); a change there needs the same rebuild
`docker-manager.sh` already checks for staleness on the dashboard and backend images (see
[Docker Reference § What `up` does, in order](/setup/docker-reference#what-up-does-in-order)).
Forgetting this looks exactly like the staleness failure documented there: the stack comes up
cleanly and serves signalling logic from before the edit.

## Related

- [Overview](/development/webui/camera/overview): the browser side of the same handshake,
  `VideoStreamComponent`, and browser-side stall detection
- [Architecture](/development/architecture): where `signalling_server` and `coturn` sit in the wider
  system, and trust domains for the tokens used here
- [Server Setup § The TURN relay](/setup/server-setup#_6-the-turn-relay-production-only): the
  production TURN relay's own configuration
- [Docker Reference § Unit: run_msd.sh](/setup/docker-reference#unit-run-msd-sh): where the
  `camera_client` tmux window is started
