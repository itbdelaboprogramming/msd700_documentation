---
outline: deep
search: false
---

# Operation Sync

<RoleBadge role="developer" />

Run multi-waypoint dikendalikan browser (loop `Nav2D` mengirim satu goal `move_base` sekaligus).
`operation_supervisor.py` di robot menyimpan salinan run agar bisa mengambil alih dispatch saat
Autopilot aktif, tetap berjalan setelah tab ditutup, dan menyerahkan run kembali ke dashboard yang
kembali. Halaman ini adalah protokol di antara keduanya.

![Sinkronisasi Operation Supervisor](../../../development/message-contracts/diagrams/message-contracts-operation-supervisor-synchronization.drawio)

## Topik {#topics}

| Topik robot | MQTT / cloud (`/unit_<ULID>/...`) | Arah | Tipe |
| --- | --- | --- | --- |
| `/string/operation_sync` | `string/operation_sync` | browser → supervisor | `std_msgs/String`, JSON |
| `/string/operation_progress` | `string/operation_progress` | supervisor → browser | `std_msgs/String`, JSON |
| `/string/operation_snapshot` | `string/operation_snapshot` | supervisor → browser | `std_msgs/String`, JSON, latched |
| `/msd700/supervisor_status` | (hanya robot) | supervisor → `system_command.py` | `std_msgs/String`, `{ active, detail }`, latched |
| `/msd700/autopilot_state`, `/msd700/manual_state` | (hanya robot) | `system_command.py` → supervisor | `std_msgs/Bool`, latched |

Browser mempublish lewat rosbridge di `<root>/string/operation_sync`
([publikasi](/id/development/message-contracts/rosbridge#publications)) dan men-subscribe dua lainnya.

## Browser → supervisor: `operation_sync` {#sync-messages}

Setiap pesan adalah objek JSON dengan `type` dan `timestamp` milik browser (detik). Supervisor
mempublish ulang [snapshot](#snapshot)-nya setelah memproses pesan **apa pun**, dan itulah cara browser
memastikan pesannya sampai.

### `batch` {#batch}

Mencatat sebuah run. Dikirim setiap kali run dimulai atau dimulai ulang; menggantikan batch sebelumnya.

```json
{
  "type": "batch",
  "operation": "multi_pinpoint",
  "route_mode": "round-trip",
  "waypoints": [
    { "position": { "x": 1.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } },
    { "position": { "x": 4.5, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } }
  ],
  "current_index": 0,
  "direction": "forward",
  "map_name": "01JZ8QK2H0000000000000MAP",
  "coverage": null,
  "timestamp": 1786503112.913
}
```

| Field | Nilai | Arti |
| --- | --- | --- |
| `operation` | `single_pinpoint`, `multi_pinpoint`, `homebase`, `coverage`, `custom_coverage`, `playlist`, `automap` | Jenis run. Hanya jenis pinpoint yang pernah di-dispatch supervisor; lainnya **hanya dicatat** agar tab yang kembali bisa memulihkan tampilan. |
| `route_mode` | `basic`, `round-trip`, `loop` | Apa yang terjadi setelah waypoint terakhir |
| `waypoints` | pose ROS | Bentuk sama dengan `route_points` rute tersimpan |
| `current_index` | integer | Waypoint posisi run saat ini |
| `direction` | `forward`, `backward` | Hanya bermakna di Round Trip: indeks 2 dari A-B-C-D saat berangkat tidak sama dengan indeks 2 saat pulang |
| `map_name` | ULID peta | Peta milik run tersebut |
| `coverage` | objek atau `null` | Hanya dicatat: `{ use_autocover: true }`, `{ polygon }`, atau `{ areas, exclusions }` |

### `progress` {#progress}

`{ "type": "progress", "current_index": 3, "direction": "forward" }`, dikirim setiap kali browser
men-dispatch waypoint. Diabaikan selama supervisor sendiri yang mengemudi.

### `takeover` {#takeover}

`{ "type": "takeover", "current_index": 3, "direction": "backward" }`. Autopilot dinyalakan: supervisor
mulai men-dispatch dari indeks ini ke arah ini. Browser mengirim `batch` lalu `takeover`, menunggu
hingga 2,5 detik untuk snapshot yang memantulkan jumlah waypoint yang sama dan `paused: false`, dan
mencoba hingga tiga kali; bila robot tidak pernah mengonfirmasi, browser tetap mengemudi sendiri.

### `release` {#release}

`{ "type": "release" }`. Autopilot dimatikan; supervisor mundur dan loop browser melanjutkan dari
[`operation_progress`](#progress-out) terakhir.

### `pause` {#pause}

`{ "type": "pause" }`. Operator menjeda: dispatch berhenti, batch disimpan, `paused` menjadi `true`.

### `stop` dan `complete` {#stop-complete}

`{ "type": "stop" }` (operator menghentikan, atau browser menyerah pada run yang tidak bisa dilanjutkan)
dan `{ "type": "complete" }` (rute selesai) sama-sama menghapus batch.

### `resync` {#resync}

`{ "type": "resync" }`. Tidak mengubah apa pun; meminta supervisor mempublish snapshot lagi. Dikirim
oleh dashboard yang baru tersambung, karena salinan latched tidak dijamin selamat melewati hop MQTT ke
subscriber baru.

## Supervisor → browser {#supervisor-to-browser}

### `operation_progress` {#progress-out}

Dipublish selama supervisor mengemudi, dan saat selesai:

```json
{
  "type": "progress",
  "current_index": 2,
  "active": true,
  "operation": "multi_pinpoint",
  "direction": "forward",
  "timestamp": 1786503150.2
}
```

`type` bernilai `progress` atau `complete`. Browser memakai lompatan lebih dari satu indeks untuk
melaporkan pinpoint yang terlewat, dan melanjutkan loop-nya sendiri dari `current_index` dan
`direction` saat release.

### `operation_snapshot` {#snapshot}

Keadaan run lengkap, latched, dipublish ulang setelah setiap pesan sync:

```json
{
  "type": "snapshot",
  "operation": "multi_pinpoint",
  "route_mode": "loop",
  "waypoints": [ { "position": { "x": 1.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } } ],
  "current_index": 0,
  "direction": "forward",
  "map_name": "01JZ8QK2H0000000000000MAP",
  "coverage": null,
  "active": true,
  "driving": false,
  "paused": false,
  "autopilot": false,
  "manual": false,
  "timestamp": 1786503150.2
}
```

| Field | Arti |
| --- | --- |
| `active` | Ada run yang disiapkan: supervisor sedang mengemudi, atau ada batch tercatat |
| `driving` | Supervisor sendiri yang men-dispatch goal (takeover autopilot) |
| `paused` | Operator menjeda; batch disimpan, tidak ada yang di-dispatch |
| `autopilot`, `manual` | Cermin dari flag robot |

Dashboard yang dibuka di tab baru sudah kehilangan `sessionStorage`-nya, sehingga ia membangun ulang
pin, mode rute, dan overlay coverage dari pesan ini.

## Perilaku di robot {#robot-side}

| Parameter | Default | Arti |
| --- | --- | --- |
| `~goal_timeout` | 300 detik | Goal yang sudah di-dispatch dan belum selesai sampai batas ini dianggap gagal |
| `~state_max_age` | 3600 detik | Run tersimpan yang lebih tua dari ini tidak dipulihkan setelah restart |

Supervisor hanya mengemudi selama memegang batch, Autopilot aktif, manual override mati, dan run tidak
dijeda. Ia menyimpan state-nya ke disk agar node yang di-restart bisa melanjutkan.

## Dokumentasi terkait

- [Navigasi: Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot): sisi UI dari takeover dan release.
- [Perintah MQTT § autopilot](/id/development/message-contracts/mqtt-commands#autopilot): flag yang mengizinkan supervisor mengemudi.
- [rosbridge § Action client move_base](/id/development/message-contracts/rosbridge#move-base-action): cara loop browser men-dispatch goal.
