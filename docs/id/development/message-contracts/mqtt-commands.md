---
outline: deep
search: false
---

# Perintah MQTT

<RoleBadge role="developer" />

Kanal perintah ([jalur A](/id/development/message-contracts/#two-control-paths)): satu topik MQTT dari
cloud ke unit, satu kembali. Setiap perubahan mode, mulai, berhenti, simpan, dan toggle dari dashboard
lewat sini, dibungkus oleh sebuah [endpoint HTTP](/id/development/message-contracts/http-api).

## Topik {#topics}

| Topik MQTT | Arah | Produsen | Konsumen | Topik ROS di robot |
| --- | --- | --- | --- | --- |
| `/unit_<ULID>/system_command` | cloud → robot | `backend_node` | `system_command.py` | `/system_command` (`std_msgs/String`) |
| `/unit_<ULID>/system_feedback` | robot → cloud | `system_command.py` | `backend_node` | `/system_feedback` (`std_msgs/String`) |

Keduanya membawa dokumen JSON sebagai payload string. Di dashboard lokal unit, browser juga
mempublish satu jenis frame langsung ke `system_command` lewat MQTT over WebSocket:
[`hardware.heartbeat`](/id/development/message-contracts/heartbeat-and-lease#heartbeat-frame).

## Amplop perintah {#command-envelope}

Dibangun oleh `createMSDSystemData()` di `backend_node`:

```json
{
  "header": "navigation",
  "command": "init",
  "config": {
    "resource": { "map_name": "01JZ8QK2H0000000000000MAP" }
  },
  "metadata": {
    "timestamp": "2026-08-12T04:11:52.913Z",
    "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10"
  }
}
```

| Field | Tipe | Wajib | Arti |
| --- | --- | --- | --- |
| `header` | string | ya | Handler mana di robot: `hardware`, `navigation`, `mapping`, `boustrophedon`, `autoalign`, `emergency_stop`, `manual`, `autopilot` |
| `command` | string | ya | Aksi di dalam handler itu. Nilai yang tidak dikenal dicatat lalu dibuang, tanpa feedback (panggilan HTTP lalu timeout). |
| `config` | object | per perintah | Parameter, biasanya di `config.resource` |
| `data` | object | hanya `hardware.ping` | Field lease |
| `metadata.request_id` | UUID v4 | ya | Dibuat per request HTTP, dikembalikan di feedback |
| `metadata.timestamp` | ISO 8601 | ya | Waktu pengirim, hanya untuk tracing |

## Amplop feedback {#feedback-envelope}

```json
{
  "header": "navigation",
  "command": "init",
  "data": { "status": true, "message": "Navigation started" },
  "metadata": { "timestamp": 1786503112.913, "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10" }
}
```

| Field | Tipe | Arti |
| --- | --- | --- |
| `data.status` | boolean | `true` selesai, `false` ditolak atau gagal. Backend juga menerima string `"true"`. |
| `data.message` | string | Alasan yang bisa dibaca manusia, ditampilkan ke operator |
| `metadata.timestamp` | float | Waktu robot, detik `rospy.get_time()` |
| `metadata.request_id` | UUID v4 | Disalin dari perintah; `"NaN"` bila perintah tidak membawanya |

Cara backend mengubahnya menjadi jawaban HTTP: [HTTP API § Amplop respons](/id/development/message-contracts/http-api#envelopes).

## Korelasi dan retry {#correlation-and-retry}

![Arsitektur Korelasi dan Retry Perintah](../../../development/message-contracts/diagrams/message-contracts-command-correlation-and-retry-architectu.drawio)

| Parameter | Default | Lokasi | Arti |
| --- | --- | --- | --- |
| `DEFAULT_TIMEOUT` | `30000` ms | `backend_node` | Berapa lama request HTTP menunggu feedback sebelum `504` |
| `COMMAND_RETRY_INTERVAL` | `1500` ms (env) | `backend_node` | Periode kirim ulang selama feedback belum datang |
| jendela dedupe | 512 `request_id` terakhir | `system_command.py` | Kiriman ulang dengan `request_id` yang sudah dikenal tidak dieksekusi lagi; feedback-nya diputar ulang dari cache |

Backend mengirim ulang amplop yang **identik** (`request_id` sama) sampai feedback datang. Robot
mengeksekusi setiap `request_id` sekali dan menjawab pengulangan dari cache, sehingga kiriman ulang
tidak pernah menjalankan ulang sebuah launch atau penyimpanan.

::: danger `hardware.*` tidak pernah di-dedupe, dan `ping` tidak pernah di-retry
Robot melewati deduplikasi untuk semua perintah `header: "hardware"`, karena ping yang hilang harus
sampai ke watchdog. Backend juga tidak pernah me-retry `hardware.ping` karena alasan yang sama.
Perintah `hardware` lainnya (`check`, `init`, `stop`, `idle`) tetap di-retry backend, sehingga jawaban
yang lambat bisa membuat robot mengeksekusinya lebih dari sekali. Perintah-perintah itu ditulis agar
aman diulang.
:::

## Katalog perintah {#catalogue}

Setiap subbagian mendaftar verb, parameter yang dibaca robot, dan efek samping ROS-nya, sehingga sebuah
perintah bisa ditelusuri sampai ke stack robot. `/switch_mode` adalah `msd700_msgs/SwitchMode` dengan
`mode, open_rviz, use_simulator, map_file, point_mode, use_autocover`; lihat
[Pergantian Mode Dinamis](/id/development/ros/mode-switching).

### `hardware` {#hardware}

| Perintah | Parameter | Sisi robot | Dikirim oleh |
| --- | --- | --- | --- |
| `ping` | blok lease `data` | Lease, watchdog, laporan status | [`POST /api/hardware/ping`](/id/development/message-contracts/http-api#hardware-ping); kontrak lengkap di [Heartbeat & Lease](/id/development/message-contracts/heartbeat-and-lease#ping-request) |
| `heartbeat` | `{ "page": "navigation" }` | Hanya me-refresh tier presence 2 detik | browser, MQTT over WebSocket, [5 Hz](/id/development/message-contracts/heartbeat-and-lease#heartbeat-frame) |
| `check` | tidak ada | `/hardware_node/check_hardware` (`Trigger`) | [`POST /api/hardware/check`](/id/development/message-contracts/http-api#hardware-commands) |
| `init` | tidak ada | `/hardware_node/init_all` (`SetBool`) | [`POST /api/hardware/init`](/id/development/message-contracts/http-api#hardware-commands) |
| `stop` | tidak ada | `/hardware_node/shutdown_all_hardware` (`SetBool`) | [`POST /api/hardware/stop`](/id/development/message-contracts/http-api#hardware-commands) |
| `idle` | tidak ada | `/switch_mode(mode=idle)`: mematikan navigasi/mapping, robot tetap menyala | [`POST /api/hardware/idle`](/id/development/message-contracts/http-api#hardware-commands) |
| `battery_update` | `config.resource.value` | Menimpa persentase baterai yang dilaporkan | tidak ada pemanggil saat ini |

### `navigation` {#navigation}

```json
// init: buka peta dan nyalakan navigasi
{
  "header": "navigation",
  "command": "init",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "default_save_path": "/home/ubuntu/ros_maps",
      "homebase_x": 1.25, "homebase_y": -0.5, "homebase_z": 0.0,
      "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
    },
    "ensure_unpaused": true
  },
  "metadata": { "timestamp": "...", "request_id": "..." }
}

// pointstamped: satu titik (jalur legacy, lihat di bawah)
{
  "header": "navigation",
  "command": "pointstamped",
  "config": { "resource": { "X": 3.1416, "Y": -1.2, "Z": 0.0 } },
  "metadata": { "timestamp": "...", "request_id": "..." }
}
```

| Perintah | Parameter | Sisi robot |
| --- | --- | --- |
| `init` | `config.resource.map_name` (ULID peta = `<ULID>.pgm/.yaml`), `homebase_*` bila peta punya, `config.ensure_unpaused` | Melepas manual override yang basi, membersihkan overlay path dan semua motion lock, memanggil `/map/retire` (lihat [pengiriman peta](/id/development/message-contracts/bridge-topics#map-delivery)), mengunduh file peta dari media server bila belum ada di disk, memanggil `/switch_mode(mode=navigation, map_file=<ULID>)`, lalu mempublish home base di `/initialpose`. Aktivitas `navigation_ready`. |
| `deactivate` | tidak ada | `/switch_mode(mode=idle)`, `/map/reset`. Aktivitas `idle`. |
| `pointstamped` | `config.resource.X/Y/Z` | Mempublish `geometry_msgs/PointStamped` (`frame_id: map`) di `/clicked_point`. Aktivitas `navigation_point_published`. |

`default_save_path` masih dikirim untuk image robot lama; image saat ini memakai `MAPS_FOLDER` miliknya
sendiri. Navigasi pinpoint di dashboard saat ini **tidak** memakai `pointstamped`; ia mengirim goal
`move_base` lewat [rosbridge](/id/development/message-contracts/rosbridge#move-base-action).

Titik masuk HTTP: [`/api/navigation/init`](/id/development/message-contracts/http-api#navigation-init),
[`/deactivate`](/id/development/message-contracts/http-api#navigation-deactivate),
[`/pointstamped`](/id/development/message-contracts/http-api#navigation-pointstamped).

### `mapping` {#mapping}

```json
// stop: simpan peta dan upload
{
  "header": "mapping",
  "command": "stop",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "display_map_name": "Production Hall Level 1",
      "map_ulid": "01JZ8QK2H0000000000000MAP",
      "created_by": "01JZ7YV5CQUSER00000000000",
      "default_save_path": "/home/ubuntu/ros_maps",
      "unit_id": "01JZ8P9WZ0UNIT00000000000",
      "homebase_x": 1.2, "homebase_y": 0.5, "homebase_z": 0.0,
      "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
    }
  },
  "metadata": { "timestamp": "...", "request_id": "..." }
}
```

| Perintah | Parameter | Sisi robot |
| --- | --- | --- |
| `start` | tidak ada | Mengecek robot bisa menyimpan peta, lalu `/switch_mode(mode=explore)`. Aktivitas `mapping_active`. |
| `pause` | tidak ada | Menahan motion lock `operator_pause` (`/emergency_pause`); sesi SLAM tetap terbuka. Aktivitas `mapping_paused`. |
| `stop` | blok di atas | `/mapsaver/full_path` menulis `<map_name>.pgm/.yaml`, mengunggahnya ke media server unit (wajib) dan cloud (best effort) lewat [`/api/media/uploadMap`](/id/development/message-contracts/http-api#media-server), beralih ke idle. Melapor lewat [`mapping_progress`](#mapping-progress), bukan feedback biasa. |
| `discard` | tidak ada | Menahan lock `mapping_teardown`, `/switch_mode(mode=idle)`, `/map/reset`. Aktivitas `idle`. |

`map_name` dan `map_ulid` adalah ULID yang sama (nama file); `display_map_name` adalah yang diketik
operator. Titik masuk HTTP: [`/api/mapping`](/id/development/message-contracts/http-api#mapping-control),
[`/api/mapping/discard`](/id/development/message-contracts/http-api#mapping-discard).

#### `mapping_progress` {#mapping-progress}

Penyimpanan melebihi timeout HTTP 30 detik, sehingga `mapping.stop` langsung menjawab panggilan HTTP
dan robot melapor di `system_feedback` dengan `header: "mapping_progress"`. Backend meneruskan setiap
blok `data` ke [stream SSE](/id/development/message-contracts/http-api#mapping-progress) dan tidak
pernah menyelesaikan request tertunda dengannya.

```json
{
  "header": "mapping_progress",
  "command": "stop",
  "data": {
    "status": true,
    "progress": 100,
    "stage": "completed",
    "message": "Saved on the robot and the server.",
    "terminal": true,
    "outcome": "completed"
  },
  "metadata": { "timestamp": 1734000000.0, "request_id": "..." }
}
```

| `progress` | `stage` | Arti |
| --- | --- | --- |
| 15 | `saving_map` | `map_saver` sedang menulis file |
| 30 | `map_saved` | File sudah di disk, menyiapkan upload |
| 50 | `uploading` | Mengunggah ke media server unit |
| 85 | `upload_complete` atau `cloud_pending` | Tersimpan di unit; salinan cloud selesai, atau diserahkan ke sync |
| 95 | `switching_mode` | Kembali ke idle |
| 100 | `completed` | Event terakhir (`terminal: true`) |
| -1 | `save_failed` | Event terakhir, tidak ada yang tersimpan |

`terminal` bernilai `true` hanya di event terakhir, dan hanya event itu yang membawa `outcome`:

| `outcome` | Arti |
| --- | --- |
| `completed` | Tersimpan di unit dan cloud |
| `cloud_pending` | Tersimpan di unit; salinan cloud menyusul lewat [sinkronisasi data](/id/development/data-sync) |
| `failed` | Tidak tersimpan di mana pun; sesi SLAM tetap terbuka untuk dicoba lagi |

Image robot lama menjawab `stop` dengan feedback `header: "mapping"` biasa; backend mengubahnya menjadi
satu event progres terminal (`100`/`completed` atau `-1`/`error`).

### `boustrophedon` {#boustrophedon}

```json
{
  "header": "boustrophedon",
  "command": "init",
  "config": {
    "use_autocover": false,
    "polygon": [],
    "areas": [
      [ { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 }, { "x": 10.0, "y": 5.0 }, { "x": 0.0, "y": 5.0 } ]
    ],
    "exclusions": [
      [ { "x": 3.0, "y": 2.0 }, { "x": 5.0, "y": 2.0 }, { "x": 5.0, "y": 4.0 }, { "x": 3.0, "y": 4.0 } ]
    ],
    "ensure_unpaused": true
  },
  "metadata": { "timestamp": "...", "request_id": "..." }
}
```

| Perintah | Parameter | Sisi robot |
| --- | --- | --- |
| `init` | `use_autocover`, dan untuk coverage custom `areas` + `exclusions` (playlist, diprioritaskan) atau `polygon` (satu area) | Melepas manual override dan motion lock, aktivitas `boustrophedon_initializing`, `/switch_mode(mode=boustrophedon, use_autocover)`. Playlist dikirim sebagai JSON `{ areas, exclusions }` di `/msd700/coverage_plan` (`std_msgs/String`, latched); satu area sebagai `geometry_msgs/Polygon` di `/msd700/coverage_polygon`. Polygon dengan kurang dari 3 titik dibuang. |
| `pause` | `config.pause` (`true` jeda, `false` lanjut) | `/path_coverage/pause` atau `/path_coverage/resume` (`Empty`); node coverage lama tanpa service itu fallback ke motion lock `operator_pause`. Aktivitas `paused` selama dijeda. |
| `deactivate` | `config.use_autocover` (harus sama dengan `init`) | Cancel goal di `/move_base/cancel`, menghapus plan dan polygon, `/path_coverage/cancel`, `/switch_mode(mode=stop_additional_feature)`. |

Path yang dihasilkan kembali sebagai overlay di
[`string/boustrophedon_path`](/id/development/message-contracts/bridge-topics#topic-map) dan di-ACK
browser; siklus hidupnya sebagai string polos (`running`, `complete`, `aborted`; run yang dibatalkan
tidak mempublish apa pun) di `string/coverage_status`.

Titik masuk HTTP: [`init`](/id/development/message-contracts/http-api#boustrophedon-init),
[`pause`](/id/development/message-contracts/http-api#boustrophedon-pause),
[`deactivate`](/id/development/message-contracts/http-api#boustrophedon-deactivate).

### `autoalign` {#autoalign}

Tanpa parameter; masing-masing menjawab dengan `data.status` dan `data.message`.

| Perintah | Sisi robot |
| --- | --- |
| `start` | `/alignment/start` (`Trigger`): mencari pose robot terhadap peta. Aktivitas `auto_aligning`. |
| `status` | `/check_alignment` (`Trigger`): hanya baca, aktivitas tidak berubah |
| `reset` | `/alignment/reset` (`Trigger`): membuang hasil dan kembali ke navigasi |

Titik masuk HTTP: [`/api/autoalign/*`](/id/development/message-contracts/http-api#autoalign).

### `emergency_stop` {#emergency-stop}

| Perintah | Sisi robot |
| --- | --- |
| `activate` | `std_msgs/Bool(true)` di `/emergency_stop` (latched), `/switch_mode(mode=idle)`, `/map/reset`. Aktivitas `emergency_stopped`. |
| `deactivate` | `std_msgs/Bool(false)` di `/emergency_stop`, cancel goal apa pun di `/move_base/cancel`. Stack gerak tidak dinyalakan ulang. Aktivitas `emergency_cleared`. |

Titik masuk HTTP: [`/api/emergency_stop`](/id/development/message-contracts/http-api#emergency-stop).

### `manual` {#manual}

Teleop adalah overlay di atas mode apa pun yang sedang berjalan: ia tidak pernah memanggil
`/switch_mode`, sehingga navigasi tetap menyala. Perintah geraknya datang di
[`string/key_vel`](/id/development/message-contracts/bridge-topics#json-twist).

| Perintah | Sisi robot |
| --- | --- |
| `enable` | Membatalkan goal aktif, menjeda coverage lewat service-nya sendiri, melepas lock emergency-pause, mengatur `/msd700/manual_state` ke `true`, membuka kanal `/mux/key_vel` (prioritas twist_mux 90). Aktivitas `manual`. |
| `disable` | Mempublish twist nol dan menutup kanal agar robot langsung berhenti, mengatur `/msd700/manual_state` ke `false`, melanjutkan coverage bila dijeda oleh override, memulihkan aktivitas sebelumnya. |

Titik masuk HTTP: [`/api/manual`](/id/development/message-contracts/http-api#manual).

### `autopilot` {#autopilot}

| Perintah | Sisi robot |
| --- | --- |
| `enable` | `/msd700/autopilot_state` `true`: `operation_supervisor` mengambil alih dispatch waypoint (lihat [Operation Sync](/id/development/message-contracts/operation-sync)). Menangguhkan watchdog ping-loss dan hanya melepas hold milik watchdog itu sendiri, tidak pernah jeda operator. |
| `disable` | `/msd700/autopilot_state` `false`: dispatch kembali ke loop browser, watchdog ping-loss dipasang lagi. |

Titik masuk HTTP: [`/api/autopilot`](/id/development/message-contracts/http-api#autopilot).

## Nilai aktivitas robot {#robot-activity}

`robot_activity` di [respons ping](/id/development/message-contracts/heartbeat-and-lease#ping-response)
diatur oleh handler di atas. Nilai yang paling sering dilihat dashboard:

| Nilai | Diatur oleh |
| --- | --- |
| `idle` | `hardware.idle`, `navigation.deactivate`, `mapping.discard` |
| `navigation_ready`, `navigation_point_published` | `navigation.init`, `navigation.pointstamped` |
| `mapping_active`, `mapping_paused` | `mapping.start`, `mapping.pause` |
| `boustrophedon_initializing`, `paused` | `boustrophedon.init`, `boustrophedon.pause` |
| `auto_aligning` | `autoalign.start` |
| `manual` | `manual.enable` |
| `emergency_stopped`, `emergency_cleared` | `emergency_stop.*` |
| `stuck` | detektor stuck, bukan perintah |
| `*_failed` (misalnya `mapping_failed`) | perintah terkait, saat gagal |

## Dokumentasi terkait

- [HTTP API](/id/development/message-contracts/http-api): endpoint yang mengirim perintah-perintah ini.
- [State dan Perilaku](/id/development/state-and-behavior): bagaimana aktivitas dan mode berpindah.
- [Pengawas Keselamatan](/id/development/ros/safety-watchdog): tier yang diberi makan `ping` dan `heartbeat`.
