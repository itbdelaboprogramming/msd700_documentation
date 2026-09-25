---
outline: deep
search: false
---

# WebRTC Signalling

<RoleBadge role="developer" />

The live camera view negotiates over a WebSocket to `signalling_server`
(`wss://<host>/services/signalling`, `NEXT_PUBLIC_SIGNALLING_URL`), which relays WebRTC negotiation
between a browser peer and the camera peer on the robot (`camera_client.py`). Only SDP and ICE travel
through it; video goes peer to peer over SRTP (through `coturn` when a direct path is not possible).

## Messages {#messages}

A client authenticates first; after that every message names a `target` peer id, and the server
forwards it to that peer unchanged.

| `type` | Direction | Payload | Purpose |
| --- | --- | --- | --- |
| `authenticate` | client → server | `{ type, token }` | First message. The server verifies the JWT and answers `auth_success` (with `userId`) or `auth_error`. |
| `offer` | peer → target | `{ type, target, offer }` | SDP offer |
| `answer` | peer → target | `{ type, target, answer }` | SDP answer |
| `candidate` | peer → target | `{ type, target, candidate }` | ICE candidate |
| `client_ready` | peer → target | `{ type, target, ... }` | Readiness beacon, forwarded to the target |
| `ping` | client → server | `{ type }` | Keepalive; the server replies `{ type: "pong" }` |
| `error` | server → client | `{ type, message }` | Relay or validation error |
| `server_shutdown` | server → all | `{ type, message }` | Graceful shutdown notice |

```json
{ "type": "authenticate", "token": "eyJhbGciOiJIUzI1NiIs..." }
{ "type": "offer", "target": "<camera peer id>", "offer": { "type": "offer", "sdp": "v=0..." } }
{ "type": "candidate", "target": "<browser peer id>", "candidate": { "candidate": "candidate:...", "sdpMid": "0", "sdpMLineIndex": 0 } }
```

The camera peer answers an `offer` with the robot camera's video track. A camera client that loses the
server reconnects with a growing, randomised delay capped at 60 s, so many units sharing one cloud
signalling server do not retry in lockstep.

## Related documentation

- [Camera: Overview](/development/webui/camera/overview): the page, devices and bitrate behaviour.
- [Camera: ROS Integration](/development/webui/camera/ros-integration): `camera_client.py` and the TURN setup.
