---
outline: deep
search: false
---

# Topik Bridge (MQTT ↔ ROS)

<RoleBadge role="developer" />

Kanal streaming ([jalur B](/id/development/message-contracts/#two-control-paths)) antara robot dan
cloud. `topic2string` mengubah pesan ROS bertipe menjadi string JSON (atau terkompresi), `aws_mqtt`
membawa setiap string sebagai passthrough `std_msgs/String` (`primitive: true`), dan sisi seberang
mengubahnya kembali. Apa yang dilakukan browser dengan hasil bertipe ada di
[rosbridge](/id/development/message-contracts/rosbridge).

![Topik Telemetri Streaming](../../../development/message-contracts/diagrams/message-contracts-streaming-telemetry-topics.drawio)

Konfigurasi bridge: robot `aws_mqtt/launch/nakayama_msd.launch`; cloud
`aws_mqtt/scripts/gen_bridge_params.py` (unit relay, satu entri per unit di roster) atau
`nakayama_cloud.launch` (container per-unit legacy). Relay: robot `topic2string/launch/msd.launch`,
cloud `topic2string/launch/cloud_multi.launch`.

## Peta topik {#topic-map}

### Robot → cloud {#robot-to-cloud}

| Sumber di robot | Topik string robot | MQTT (`/unit_<ULID>/...`) | Topik bertipe di cloud (`/unit_<ULID>/...`) | Format |
| --- | --- | --- | --- | --- |
| `/client/robotpose` | `/string/robotpose` | `string/robotpose` | `server/robot_pose` (`geometry_msgs/Pose`, latched) | [JSON pose](#json-pose) |
| `/map` | `/string/map` | `string/map` | `server/slam/map` (`nav_msgs/OccupancyGrid`) | [grid terkompresi](#compressed-formats), lihat [pengiriman peta](#map-delivery) |
| `/scan` | `/string/laserscan` | `string/laserscan` | `server/scan` (`sensor_msgs/LaserScan`) | [scan terkompresi](#compressed-formats) |
| `/scan_holes` | `/string/laserscan_holes` | `string/laserscan_holes` | `server/scan_holes` (`sensor_msgs/LaserScan`) | scan terkompresi |
| `/msd700/hazard_cells` | `/string/hazard_cells` | `string/hazard_cells` | `server/hazard_cells` (`nav_msgs/Path`) | [path terkompresi](#compressed-formats) |
| `/move_base/NavfnROS/plan` | `/string/move_base/NavfnROS/plan` | sama | `server/move_base/NavfnROS/plan` (`nav_msgs/Path`) | path terkompresi |
| `/move_base/TebLocalPlannerROS/local_plan` | `/string/move_base/TebLocalPlannerROS/local_plan` | sama | `server/move_base/TebLocalPlannerROS/local_plan` (`nav_msgs/Path`) | path terkompresi, di-reframe `odom` → `map` di robot |
| `/msd700/boustrophedon_path` | `/string/boustrophedon_path` | `string/boustrophedon_path` | `server/boustrophedon_path` (`nav_msgs/Path`) | path terkompresi; `header.seq` adalah revisi yang di-[ACK](#acks) browser |
| `/msd700/skipped_waypoints` | `/string/skipped_waypoints` | `string/skipped_waypoints` | `server/skipped_waypoints` (`nav_msgs/Path`) | path terkompresi |
| `/msd700/coverage_debug` | (tidak ada) | `string/coverage_debug` | tetap string | JSON polos |
| `/msd700/uncovered_regions` | (tidak ada) | `string/uncovered_regions` | tetap string | JSON polos |
| `/msd700/coverage_status` | (tidak ada) | `string/coverage_status` | tetap string | `running`, `complete`, `aborted` |
| `/move_base/status` | `/string/move_base/status` | `string/move_base/status` | `server/move_base/status` (`actionlib_msgs/GoalStatusArray`) | [JSON status](#json-status) |
| `/move_base/result` | `/string/move_base/result` | `string/move_base/result` | `server/move_base/result` (`move_base_msgs/MoveBaseActionResult`) | [JSON result](#json-result), dikirim ulang sampai di-[ACK](#acks) |
| `operation_supervisor` | `/string/operation_progress` | `string/operation_progress` | tetap string | [Operation Sync](/id/development/message-contracts/operation-sync#progress-out) |
| `operation_supervisor` | `/string/operation_snapshot` | `string/operation_snapshot` | tetap string, latched di relay | [Operation Sync](/id/development/message-contracts/operation-sync#snapshot) |
| `system_command.py` | `/system_feedback` | `system_feedback` | (dibaca `backend_node` lewat MQTT) | [amplop feedback](/id/development/message-contracts/mqtt-commands#feedback-envelope) |

Relay men-latch `string/map`, overlay plan dan coverage, `hazard_cells`, dan `operation_snapshot`,
sehingga browser yang subscribe belakangan tetap mendapat nilai terakhir.

### Cloud → robot {#cloud-to-robot}

| Topik bertipe di cloud (`/unit_<ULID>/...`) | Topik string cloud | MQTT (`/unit_<ULID>/...`) | Topik robot | Format |
| --- | --- | --- | --- | --- |
| `server/move_base/goal` (`move_base_msgs/MoveBaseActionGoal`) | `string/move_base/goal` | sama | `/string/move_base/goal` → `/move_base/goal` | [JSON goal](#json-goal) |
| `server/move_base/cancel` (`actionlib_msgs/GoalID`) | `string/move_base/cancel` | sama | `/string/move_base/cancel` → `/move_base/cancel` | [JSON cancel](#json-cancel) |
| `initialpose` (`geometry_msgs/PoseWithCovarianceStamped`) | `string/initialpose` | sama | `/string/initialpose` → `/initialpose` | [JSON initialpose](#json-initialpose) |
| `server/key_vel` (`geometry_msgs/Twist`) | `string/key_vel` | sama | `/string/key_vel` → `/mux/key_vel` | [JSON twist](#json-twist) |
| (browser mempublish string-nya) | `string/move_base/result_ack` | sama | `/string/move_base/result_ack` | [ACK](#acks) |
| (browser mempublish string-nya) | `string/boustrophedon_path_ack` | sama | `/string/boustrophedon_path_ack` | [ACK](#acks) |
| (browser mempublish string-nya) | `string/operation_sync` | sama | `/string/operation_sync` | [Operation Sync](/id/development/message-contracts/operation-sync) |
| (browser mempublish string-nya) | `string/map_request` | sama | `/string/map_request` | [map request](#map-delivery) |
| (`backend_node` lewat MQTT) | | `system_command` | `/system_command` | [amplop perintah](/id/development/message-contracts/mqtt-commands#command-envelope) |

Stamp pada goal, initial pose, dan path ditulis ulang ke jam sisi penerima di batas
(`clock_boundary.BoundaryPublisher`), karena robot dan cloud menjalankan jam ROS yang berbeda. Result
dan status dicocokkan lewat `goal_id.id` dan lewat tanpa diubah.

## Format string JSON {#json-formats}

### Pose {#json-pose}

`/string/robotpose`, JSON ringkas, posisi dibulatkan ke 3 desimal dan quaternion ke 6:

```json
{"position":{"x":1.234,"y":-0.5,"z":0.0},"orientation":{"x":0.0,"y":0.0,"z":0.382683,"w":0.92388}}
```

Dikirim hingga 25 Hz, tetapi hanya bila pose bergerak melewati deadband; selama tidak ada yang
mengawasi robot yang diam, pose diulang paling sering tiap 25 detik (`max_silence.idle`).

### Goal {#json-goal}

`string/move_base/goal`, ditulis `action_server.py` di cloud dari `MoveBaseActionGoal` browser:

```json
{
  "header": { "seq": 2, "stamp": { "secs": 0, "nsecs": 0 }, "frame_id": "" },
  "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" },
  "goal": {
    "target_pose": {
      "header": { "seq": 0, "stamp": { "secs": 1758547188, "nsecs": 323692321 }, "frame_id": "map" },
      "pose": {
        "position": { "x": 6.01, "y": 0.95, "z": 0.0 },
        "orientation": { "x": 0.0, "y": 0.0, "z": -0.0157, "w": -0.9999 }
      }
    }
  }
}
```

Browser mengirim ulang goal yang sama (`goal_id` sama) tiap detik sampai status atau result apa pun
untuknya datang; `action_client.py` di robot membuang `goal_id` yang sudah pernah dilihat.

### Cancel {#json-cancel}

```json
{ "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" } }
```

Browser membatalkan goal-nya sendiri berdasarkan `id`. `id` kosong membatalkan semua goal; handler
robot sendiri (manual override, stop coverage, pelepasan emergency) mempublish itu langsung di
`/move_base/cancel`.

### Status {#json-status}

```json
{
  "header": { "seq": 51, "stamp": { "secs": 1758547190, "nsecs": 0 }, "frame_id": "" },
  "status_list": [
    { "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" }, "status": 1, "text": "" }
  ]
}
```

Dikirim saat daftar berubah (di-hash dari `id`, `status`, `text`), selain itu diulang paling sering
tiap 2 detik (`status_heartbeat`). `status` adalah kode actionlib: `1` aktif, `2` preempted,
`3` succeeded, `4` aborted, `5` rejected, `8` recalled, `9` lost.

### Result {#json-result}

```json
{
  "header": { "seq": 3, "stamp": { "secs": 1758547230, "nsecs": 0 }, "frame_id": "" },
  "status": {
    "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" },
    "status": 3,
    "text": "Goal reached."
  }
}
```

### Initial pose {#json-initialpose}

`geometry_msgs/PoseWithCovarianceStamped` sebagai JSON: `header`, lalu `pose.pose.position`,
`pose.pose.orientation`, dan 36 nilai `pose.covariance`, dengan susunan key yang sama seperti pesan ROS.

### Twist {#json-twist}

```json
{ "linear": { "x": 0.4, "y": 0.0, "z": 0.0 }, "angular": { "x": 0.0, "y": 0.0, "z": 1.0 } }
```

Robot mempublish ulang di `/mux/key_vel` (prioritas twist_mux 90). Kanal hanya terbuka selama
[`manual.enable`](/id/development/message-contracts/mqtt-commands#manual) berlaku; jeda 0,5 detik
membuat robot berhenti.

### Format terkompresi {#compressed-formats}

| Stream | Encoding |
| --- | --- |
| Path (`plan`, `local_plan`, `boustrophedon_path`, `hazard_cells`, `skipped_waypoints`) | `base64(zlib(JSON))`, JSON = `{ header, poses: [{ header, pose }] }` |
| Laser scan (`laserscan`, `laserscan_holes`) | `base64(zlib(Q1))`, scan yang dikuantisasi (`q1_encode`); bila kuantisasi mati, `LaserScan` hasil serialisasi ROS |
| Peta | `base64(zlib(M1))`, sel dikemas sebagai int8 mentah; decoder masih menerima bentuk lama `base64(zlib(JSON))` |

## ACK keandalan {#acks}

| Topik ACK | Payload (`std_msgs/String`) | Menutup loop untuk |
| --- | --- | --- |
| `string/move_base/result_ack` | `goal_id.id` dari result | `action_client.py` mempublish ulang setiap result terminal tiap 1 detik (hingga 300 detik) sampai di-ACK, sehingga result yang hilang tidak membuat run multi-waypoint macet |
| `string/boustrophedon_path_ack` | revisi path (`header.seq`) sebagai string desimal | node coverage mengirim ulang overlay path sampai revisi yang dipegangnya di-ACK |

## Pengiriman peta {#map-delivery}

Peta adalah payload terbesar di link dan satu-satunya yang mutlak dibutuhkan operator. Robot
meng-hash isi grid dan hanya mengirimnya saat berubah, ditambah heartbeat tiap 60 detik selama ada
yang mengawasi dan tiap 300 detik bila tidak ada. Di mode navigasi grid berasal dari `map_server` dan
tidak pernah berubah, sehingga praktisnya satu pesan per heartbeat. Tiga mekanisme membuat satu pesan
QoS 0 tetap selamat:

| Mekanisme | Lokasi | Menangani |
| --- | --- | --- |
| Relay men-latch `/unit_<ULID>/string/map` | `aws_mqtt/scripts/gen_bridge_params.py` | Browser yang tersambung di antara dua pengiriman; relay yang restart (setiap kali roster unit berubah) |
| Burst `burst_sends` (3) pengulangan, berjarak `burst_interval` (2 detik), setelah reset atau retire peta | compressor peta `topic2string` (nodelet `map_compression.cpp`, kembaran Python `map_compression_pipeline.py`) | Peta yang baru dibuka operator, dikirim saat robot menyalakan ulang stack navigasi; juga run mapping baru |
| Kanal pull `string/map_request` | browser → robot | Sisanya: paket yang hilang, halaman yang ter-mount di saat yang salah |

Dashboard mempublish di `/unit_<ULID>/string/map_request` begitu canvas ter-mount dan terus meminta
sampai peta tergambar:

```json
{ "reason": "map-init", "at": 1758547188322 }
```

Robot membatasi laju permintaan (`request_min_interval`, default 2 detik), sehingga beberapa tab hanya
menambah satu pengiriman, bukan satu per tab.

**Grid 0x0 bukan pesan rusak.** Robot mempublishnya untuk mengganti grid yang di-latch relay; tanpa
itu, dashboard yang baru membuka peta lain akan diberi ruangan sesi sebelumnya. Canvas
memperlakukannya sebagai "belum ada peta" dan meminta lagi.

| Service | Dipanggil dari | Efek |
| --- | --- | --- |
| `/map/reset` | stop atau discard mapping, deactivate navigasi, emergency stop | Robot melupakan petanya; yang sudah digambar dashboard dibiarkan |
| `/map/retire` | hanya `navigation.init` | Sama, ditambah sentinel 0x0, karena peta berbeda baru saja dibuka |

Keduanya memicu burst. Robot tanpa `/map/retire` fallback ke reset biasa.

::: warning
Jangan memperpanjang `change_heartbeat` di `topic2string/config/egress.yaml` tanpa memastikan ketiga
mekanisme di atas masih ada. Dengan change-gating saja, dashboard yang melewatkan pengiriman terukur
menunggu ~52 detik untuk pengiriman berikutnya.
:::

## Presence dan profil egress {#egress-profiles}

Agar robot yang tidak diawasi tidak menghabiskan bandwidth, `system_command.py` mempublish
`std_msgs/String` latched di `/msd700/viewers` lokal robot tiap detik: `idle`, `watching`, atau
`driving`. Topik ini tidak pernah keluar dari unit. `presence_gate.py` milik `topic2string` membacanya
dan menerapkan `topic2string/config/egress.yaml`:

| Stream | `idle` | `watching` | `driving` |
| --- | --- | --- | --- |
| `laserscan` | 0 Hz (mati) | 1 Hz | default node |
| pengulangan `robotpose` untuk pose yang tidak berubah | tiap 25 detik | default node | default node |
| heartbeat peta | 300 detik, perubahan ditahan | default node (60 detik) | default node |
| plan global / lokal | mati | default node | default node |
| retry result `move_base` dan status | mati | aktif (heartbeat status 2 detik) | aktif |

Viewer dianggap pergi setelah diam 15 detik. Bila sinyal tidak ada atau lebih tua dari 8 detik, semua
gate fail open ke `driving`.

## Dokumentasi terkait

- [rosbridge (WebSocket)](/id/development/message-contracts/rosbridge): ujung browser dari topik-topik ini.
- [Siklus Hidup Kontainer Unit](/id/development/unit-container-lifecycle): unit relay yang menjalankan relay cloud.
- [Navigasi: Integrasi ROS](/id/development/webui/navigation/ros-integration): bagaimana overlay digambar.
