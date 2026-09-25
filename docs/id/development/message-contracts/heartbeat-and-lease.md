---
outline: deep
search: false
---

# Heartbeat & Lease

<RoleBadge role="developer" />

Dua sinyal memberi tahu unit bahwa ada yang sedang mengawasinya, dan salah satunya juga menentukan
siapa yang boleh mengemudikannya.

| Sinyal | Transport | Laju | Membawa otoritas | Memberi makan |
| --- | --- | --- | --- | --- |
| [`hardware.ping`](#ping-request) | HTTP → `backend_node` → MQTT, bolak-balik | 1 detik dari halaman operasional, per unit dari daftar unit | ya: claim, release, takeover | operating lease, tier watchdog idle/shutdown, status yang ditampilkan dashboard |
| [`hardware.heartbeat`](#heartbeat-frame) | MQTT over WebSocket, browser → broker unit, satu arah | 5 Hz (200 ms) | tidak | hanya tier presence 2 detik |

Heartbeat hanya ada di dashboard lokal unit (`NEXT_PUBLIC_MQTT_WS_URL` diisi). Dashboard cloud hanya
mengandalkan ping. Perilaku watchdog:
[Pengawas Keselamatan](/id/development/ros/safety-watchdog#two-presence-signals).

## Request ping {#ping-request}

Browser memanggil [`POST /api/hardware/ping`](/id/development/message-contracts/http-api#hardware-ping);
`backend_node` mengirim amplop ini di `/unit_<ULID>/system_command`:

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

| Field | Diisi oleh | Arti |
| --- | --- | --- |
| `session_id` | browser | Satu UUID per tab browser (`getOperatingSessionId()`) |
| `user_id` | backend, dari JWT | Identitas lease. Tidak pernah diambil dari body, sehingga klien tidak bisa claim sebagai orang lain. Berupa ULID, bukan username, agar rename tidak memindahkan lease. |
| `claim` | browser | `true` dari halaman operasional (Navigation, Mapping); `false` dari daftar unit, yang hanya membaca status |
| `release` | browser | `true` saat keluar dari halaman operasional (dikirim dengan `page: "other"`, `keepalive`) |
| `page` | browser | `dashboard`, `navigation`, `mapping`, `other`. Menentukan tier watchdog mana yang di-refresh ping. |
| `origin` | backend, dari `DEPLOYMENT_MODE` | `cloud` atau `local`. Tidak pernah dari body. |
| `force_takeover` | browser | `true` hanya setelah operator mengonfirmasi prompt takeover |

Ping tidak pernah di-retry dan tidak pernah di-dedupe: ping yang hilang justru yang harus dilihat watchdog.

## Respons ping {#ping-response}

`system_feedback`, lalu `details.data` di jawaban HTTP:

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

| Field | Arti |
| --- | --- |
| `robot_activity` | Aktivitas saat ini setelah deteksi stuck, lihat [nilai aktivitas](/id/development/message-contracts/mqtt-commands#robot-activity) |
| `active_page` | Halaman yang terakhir meng-claim robot, sebelum deteksi stuck; dipakai untuk mengarahkan dashboard kembali ke tab yang benar |
| `battery` | Tingkat muatan, persen (float) |
| `uptime` | Menit sejak node dinyalakan |
| `hw_status` | Status monitor hardware (`ready`, `fault`, ...) |
| `manual_override` | Manual override sedang aktif |
| `autopilot` | Autopilot sedang aktif |
| `active_map_id` | ULID peta sesi navigasi yang berjalan, atau `null` |
| `in_use` | **Akun** lain memegang lease; daftar unit menampilkan *In Use* dan menolak pemilihan. `false` untuk unit yang ditinggal dalam autopilot tanpa yang mengawasi, agar operator berikutnya bisa mengambil alih run. |
| `in_use_by` | ULID user pemegang lease |
| `origin_conflict` | **Akun yang sama** memegang lease dari tab lain atau permukaan lain; dashboard menampilkan prompt takeover |
| `origin_conflict_side` | `cloud` atau `local`, permukaan si pemegang |
| `motion_locked` | `/emergency_pause` sedang aktif; robot tidak akan bergerak apa pun tampilan UI |

Backend lalu menggabungkan `intended_mode`, `map_id`, `sync_status`, `needs_recovery`; lihat
[HTTP API § ping](/id/development/message-contracts/http-api#hardware-ping).

## Frame heartbeat {#heartbeat-frame}

Dipublish oleh `src/services/heartbeatService.ts` di `/unit_<ULID>/system_command`, QoS 0, tanpa retain,
tiap 200 ms, satu client MQTT per tab (`clientId` `msd700-hb-<acak>`, clean session, keepalive 1 detik):

```json
{
  "header": "hardware",
  "command": "heartbeat",
  "metadata": { "request_id": "heartbeat" },
  "data": { "page": "navigation" }
}
```

`page` adalah satu-satunya field yang dibaca robot. Tidak ada lease, claim atau release, `origin`, dan
feedback. Ia hanya membuktikan kehadiran.

## Ping presence cloud (entri bridge) {#presence-ping}

Bridge MQTT masih membawa sepasang ping/pong terpisah, independen dari `hardware.ping`:

| Sisi | Topik ROS | Topik MQTT |
| --- | --- | --- |
| robot, keluar | `/msd/ping` | `/unit_<ULID>/server/ping` |
| robot, masuk | `/msd/pong` | `/unit_<ULID>/msd/pong` |
| cloud, keluar | `/unit_<ULID>/server/ping` | `/unit_<ULID>/msd/ping` |
| cloud, masuk | `/unit_<ULID>/server/pong` | `/unit_<ULID>/server/pong` |

Tidak ada node di source saat ini yang mempublish `/msd/ping` atau `/unit_<ULID>/server/ping`, dan
nama-namanya tidak berpasangan dari ujung ke ujung, jadi saat ini tidak ada yang lewat di sini.
Status hidup unit di dashboard berasal dari respons ping di atas.

## Dokumentasi terkait

- [Pengawas Keselamatan](/id/development/ros/safety-watchdog): tier yang diberi makan sinyal-sinyal ini.
- [Navigasi: Integrasi ROS](/id/development/webui/navigation/ros-integration): bagaimana dashboard bereaksi terhadap field lease.
- [Perintah MQTT](/id/development/message-contracts/mqtt-commands): amplop yang dipakai kedua frame.
