---
outline: deep
search: false
---

# Signalling WebRTC

<RoleBadge role="developer" />

Tampilan kamera langsung bernegosiasi lewat WebSocket ke `signalling_server`
(`wss://<host>/services/signalling`, `NEXT_PUBLIC_SIGNALLING_URL`), yang meneruskan negosiasi WebRTC
antara peer browser dan peer kamera di robot (`camera_client.py`). Hanya SDP dan ICE yang lewat di
sini; video mengalir peer-to-peer lewat SRTP (melalui `coturn` bila jalur langsung tidak ada).

## Pesan {#messages}

Client melakukan autentikasi dulu; setelah itu setiap pesan menyebut peer `target`, dan server
meneruskannya ke peer itu tanpa diubah.

| `type` | Arah | Payload | Fungsi |
| --- | --- | --- | --- |
| `authenticate` | client → server | `{ type, token }` | Pesan pertama. Server memverifikasi JWT dan menjawab `auth_success` (dengan `userId`) atau `auth_error`. |
| `offer` | peer → target | `{ type, target, offer }` | SDP offer |
| `answer` | peer → target | `{ type, target, answer }` | SDP answer |
| `candidate` | peer → target | `{ type, target, candidate }` | Kandidat ICE |
| `client_ready` | peer → target | `{ type, target, ... }` | Tanda siap, diteruskan ke target |
| `ping` | client → server | `{ type }` | Keepalive; server menjawab `{ type: "pong" }` |
| `error` | server → client | `{ type, message }` | Error relay atau validasi |
| `server_shutdown` | server → semua | `{ type, message }` | Pemberitahuan shutdown yang tertib |

```json
{ "type": "authenticate", "token": "eyJhbGciOiJIUzI1NiIs..." }
{ "type": "offer", "target": "<id peer kamera>", "offer": { "type": "offer", "sdp": "v=0..." } }
{ "type": "candidate", "target": "<id peer browser>", "candidate": { "candidate": "candidate:...", "sdpMid": "0", "sdpMLineIndex": 0 } }
```

Peer kamera menjawab `offer` dengan track video kamera robot. Client kamera yang kehilangan server
menyambung ulang dengan jeda yang makin panjang dan diacak, maksimum 60 detik, agar banyak unit yang
berbagi satu signalling server cloud tidak mencoba ulang bersamaan.

## Dokumentasi terkait

- [Kamera: Ikhtisar](/id/development/webui/camera/overview): halaman, perangkat, dan perilaku bitrate.
- [Kamera: Integrasi ROS](/id/development/webui/camera/ros-integration): `camera_client.py` dan setup TURN.
