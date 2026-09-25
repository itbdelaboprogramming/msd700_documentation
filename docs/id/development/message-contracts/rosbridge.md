---
outline: deep
search: false
---

# rosbridge (WebSocket)

<RoleBadge role="developer" />

Ujung browser dari kanal streaming ([jalur B](/id/development/message-contracts/#two-control-paths)).
Dashboard memegang satu WebSocket rosbridge v2 ke ROS master cloud (atau milik unit sendiri, di
dashboard lokal) dan memakai roslibjs di atasnya. Dashboard **tidak** memakai panggilan service
rosbridge: semua yang butuh jawaban lewat [HTTP API](/id/development/message-contracts/http-api).

![Ikhtisar Arsitektur rosbridge](../../../development/message-contracts/diagrams/rosbridge-protocol-rosbridge-architecture-overview.drawio)

## Endpoint {#endpoints}

| Environment | URL | Backend |
| --- | --- | --- |
| Cloud produksi | `wss://msd.nglobal.jp/services/rosbridge` | Apache → `localhost:9090` |
| Cloud development | `ws://<server-ip>:9091` | rosbridge dev |
| Dashboard lokal unit | `ws://<unit-ip>:9090` | `rosbridge_suite` milik unit |

Dikonfigurasi saat build sebagai `NEXT_PUBLIC_WS_ROSBRIDGE_URL`. Semua nama topik di bawah diawali
`topic_root` unit dari [`GET /unit/all`](/id/development/message-contracts/http-api#unit-list); di sini
ditulis sebagai `<root>`.

## Operasi wire {#operations}

roslibjs memakai operasi JSON standar rosbridge v2:

```json
{ "op": "subscribe", "id": "subscribe:/unit_01JZ.../server/robot_pose:1",
  "topic": "/unit_01JZ.../server/robot_pose", "type": "geometry_msgs/Pose", "throttle_rate": 40 }

{ "op": "advertise", "id": "advertise:/unit_01JZ.../server/key_vel:2",
  "topic": "/unit_01JZ.../server/key_vel", "type": "geometry_msgs/Twist" }

{ "op": "publish", "id": "publish:/unit_01JZ.../server/key_vel:3",
  "topic": "/unit_01JZ.../server/key_vel",
  "msg": { "linear": { "x": 0.4, "y": 0, "z": 0 }, "angular": { "x": 0, "y": 0, "z": 0 } } }

{ "op": "publish", "topic": "/unit_01JZ.../server/slam/map", "msg": { "...": "..." } }
```

`throttle_rate` adalah jeda minimum dalam ms (40 = 25 Hz). Subscription peta meminta
`compression: "png"`, sehingga rosbridge mengirim grid sebagai payload ber-encode PNG.

::: tip Advertise sekali, publish berkali-kali
Topik yang di-advertise dan dipublish pada saat yang sama bisa kehilangan pesan pertamanya: publisher
ROS yang baru belum tersambung ke relay yang men-subscribe-nya. Karena itu dashboard menyimpan satu
`ROSLIB.Topic` yang sudah di-advertise per nama selama sesi (`operation_sync`,
`boustrophedon_path_ack`, `result_ack`) dan meng-advertise `operation_sync` begitu socket terbuka.
:::

## Subscription {#subscriptions}

| Topik | Tipe | Digambar sebagai / dipakai untuk | Kontrak sumber |
| --- | --- | --- | --- |
| `<root>/server/robot_pose` | `geometry_msgs/Pose` | marker dan arah robot, 25 Hz | [pose](/id/development/message-contracts/bridge-topics#json-pose) |
| `<root>/server/slam/map` | `nav_msgs/OccupancyGrid` | peta; grid 0x0 berarti "belum ada peta" | [pengiriman peta](/id/development/message-contracts/bridge-topics#map-delivery) |
| `<root>/server/scan` | `sensor_msgs/LaserScan` | titik lidar | [scan terkompresi](/id/development/message-contracts/bridge-topics#compressed-formats) |
| `<root>/server/scan_holes` | `sensor_msgs/LaserScan` | tanda lubang / drop-off live | sama |
| `<root>/server/hazard_cells` | `nav_msgs/Path` | jejak lubang kumulatif dalam run | [path terkompresi](/id/development/message-contracts/bridge-topics#compressed-formats) |
| `<root>/server/move_base/NavfnROS/plan` | `nav_msgs/Path` | garis plan global | sama |
| `<root>/server/move_base/TebLocalPlannerROS/local_plan` | `nav_msgs/Path` | plan lokal jangka pendek | sama |
| `<root>/server/boustrophedon_path` | `nav_msgs/Path` | lajur coverage; `header.seq` di-ACK | sama |
| `<root>/server/skipped_waypoints` | `nav_msgs/Path` | waypoint yang tidak tercapai run coverage | sama |
| `<root>/string/uncovered_regions` | `std_msgs/String` | region yang belum tersapu (JSON polos) | [peta topik](/id/development/message-contracts/bridge-topics#robot-to-cloud) |
| `<root>/string/operation_progress` | `std_msgs/String` | progres supervisor saat autopilot mengemudi | [Operation Sync](/id/development/message-contracts/operation-sync#progress-out) |
| `<root>/string/operation_snapshot` | `std_msgs/String` | pemulihan run setelah reload atau di tab baru | [Operation Sync](/id/development/message-contracts/operation-sync#snapshot) |
| `<root>/server/move_base/status`, `/result`, `/feedback` | actionlib | lewat action client di bawah | [status](/id/development/message-contracts/bridge-topics#json-status), [result](/id/development/message-contracts/bridge-topics#json-result) |

## Publikasi {#publications}

| Topik | Tipe | Dikirim saat | Diterima robot |
| --- | --- | --- | --- |
| `<root>/server/key_vel` | `geometry_msgs/Twist` | Selama manual override aktif: terus-menerus 10 Hz (twist nol bila tidak ada tombol ditekan), ditambah twist nol saat window blur dan saat manual dimatikan. `linear.x` ±0,4 m/s dan `angular.z` ±1,0 rad/s (Shift: 0,2 dan 0,5). | [`/mux/key_vel`](/id/development/message-contracts/bridge-topics#json-twist) |
| `<root>/initialpose` | `geometry_msgs/PoseWithCovarianceStamped` | estimasi pose, seed pose home base | [`/initialpose`](/id/development/message-contracts/bridge-topics#json-initialpose) |
| `<root>/string/move_base/result_ack` | `std_msgs/String` | setiap result `move_base` yang terlihat, data = `goal_id.id` | [ACK](/id/development/message-contracts/bridge-topics#acks) |
| `<root>/string/boustrophedon_path_ack` | `std_msgs/String` | setiap revisi path coverage yang tergambar, data = revisi | [ACK](/id/development/message-contracts/bridge-topics#acks) |
| `<root>/string/map_request` | `std_msgs/String` | sejak canvas ter-mount sampai peta tergambar, data = `{"reason","at"}` | [pengiriman peta](/id/development/message-contracts/bridge-topics#map-delivery) |
| `<root>/string/operation_sync` | `std_msgs/String` | setiap mulai run, waypoint, jeda, stop, perubahan autopilot | [Operation Sync](/id/development/message-contracts/operation-sync) |

Topik `initialpose` adalah saudara dari `server/`, bukan anaknya: relay cloud men-subscribe
`<root>/initialpose`.

## Action client `move_base` {#move-base-action}

Pinpoint, rute, dan perjalanan ke home base adalah goal `move_base` yang dikirim lewat `ActionClient`
roslibjs (`serverName: <root>/server/move_base`, `actionName: move_base_msgs/MoveBaseAction`) di
`public/script/Nav2D.js`. Di baliknya ada lima topik:

| Topik | Arah | Tipe |
| --- | --- | --- |
| `<root>/server/move_base/goal` | browser → cloud | `move_base_msgs/MoveBaseActionGoal` |
| `<root>/server/move_base/cancel` | browser → cloud | `actionlib_msgs/GoalID` |
| `<root>/server/move_base/status` | cloud → browser | `actionlib_msgs/GoalStatusArray` |
| `<root>/server/move_base/result` | cloud → browser | `move_base_msgs/MoveBaseActionResult` |
| `<root>/server/move_base/feedback` | cloud → browser | `move_base_msgs/MoveBaseActionFeedback` (tidak dihasilkan relay) |

Pesan goal yang dibangun browser:

```json
{
  "target_pose": {
    "header": { "frame_id": "map" },
    "pose": {
      "position": { "x": 4.5, "y": 2.0, "z": 0.0 },
      "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
    }
  }
}
```

| Perilaku | Aturan |
| --- | --- |
| Pengiriman | Goal yang sama (`goal_id` sama) dikirim ulang tiap 1 detik, hingga 60 kali, sampai status atau result apa pun untuknya datang. |
| Penyelesaian | Kode terminal pertama menang, dari `/result` maupun `/status`: `3` → Arrived, `4`/`5`/`9` → Failed, `2`/`8` → Cancelled. Poll 2 detik menangani pesan terminal yang datang sebelum listener terpasang. |
| ACK result | Setiap result di-ACK di `string/move_base/result_ack`, termasuk result yang datang setelah reconnect. |
| Multi-waypoint | Browser mengirim satu goal sekaligus dan maju saat selesai; Round Trip berbalik di waypoint terakhir, Loop mulai lagi dari yang pertama. Setiap dispatch dicerminkan dengan [`operation_sync` `progress`](/id/development/message-contracts/operation-sync#progress). |
| Pause / Stop | `goal.cancel()` pada goal saat ini; hasilnya `PREEMPTED` (2) dan tidak dilaporkan sebagai Arrived. |

Di robot, goal dan cancel menjadi [`string/move_base/goal`](/id/development/message-contracts/bridge-topics#json-goal)
dan [`/cancel`](/id/development/message-contracts/bridge-topics#json-cancel), lalu `/move_base/goal` dan
`/move_base/cancel`.

## Perilaku koneksi {#connection}

- Satu koneksi bersama per halaman (`window.__msdRos`); komponen peta, operation sync, dan overlay
  coverage semuanya memakainya. Panel teleop memakainya bila ada dan membuka koneksinya sendiri bila tidak.
- Socket yang putus disambung ulang secara halus; indikator reconnect baru muncul setelah masa tenggang
  singkat, sehingga gangguan jaringan sesaat tidak membuat UI berkedip.
- Setelah reconnect, dashboard subscribe ulang, memulai lagi loop `map_request`, dan mengirim
  [`operation_sync` `resync`](/id/development/message-contracts/operation-sync#resync) untuk memulihkan run.

Penggambaran canvas di atas topik-topik ini: [Frontend Canvas](/id/development/frontend-canvas) dan
[Ikhtisar Navigasi](/id/development/webui/navigation/overview).

## Dokumentasi terkait

- [Topik Bridge](/id/development/message-contracts/bridge-topics): apa yang dibawa tiap topik antara cloud dan robot.
- [Operation Sync](/id/development/message-contracts/operation-sync): topik `operation_*`.
- [Navigasi: Integrasi ROS](/id/development/webui/navigation/ros-integration): gambaran topik-topik ini dari sisi halaman.
