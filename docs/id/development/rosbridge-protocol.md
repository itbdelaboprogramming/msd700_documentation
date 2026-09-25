---
outline: deep
search: false
---

# Protokol WebSocket dan rosbridge

<RoleBadge role="developer" />

Dokumen ini merinci antarmuka WebSocket yang disediakan oleh `rosbridge_suite`, menjelaskan spesifikasi protokol JSON, format subscription pesan, skema pemanggilan service, teknik kompresi, dan integrasi rendering canvas web.

## Ikhtisar Arsitektur rosbridge

Dashboard web berinteraksi dengan topik dan service ROS live melalui `rosbridge_server` lewat koneksi WebSocket yang persisten.

![Ikhtisar Arsitektur rosbridge](../../development/diagrams/rosbridge-protocol-rosbridge-architecture-overview.drawio)

## Endpoint Koneksi

| Lingkungan | Protokol & Path | Port Tujuan |
| --- | --- | --- |
| **Server Produksi** | `wss://msd.nglobal.jp/services/rosbridge` | Di-proxy ke `localhost:9090` internal |
| **Server Pengembangan** | `ws://<server-ip>:9091` | WebSocket langsung ke kontainer rosbridge dev |
| **Server Lokal Unit** | `ws://<unit-ip>:9090` | WebSocket langsung ke `rosbridge_suite` onboard |

## Operasi Protokol rosbridge

Protokol rosbridge v2 menggunakan operasi JSON terstandardisasi (`op`):

### 1. Subscription Topik (`op: "subscribe"`)
Memulai streaming sebuah topik ROS ke browser:

```json
{
  "op": "subscribe",
  "id": "sub_robot_pose_1",
  "topic": "/unit_01JZ8P9WZ0UNIT00000000000/server/robot_pose",
  "type": "geometry_msgs/PoseStamped",
  "throttle_rate": 40,
  "queue_length": 1,
  "compression": "none"
}
```

- `topic`: Nama topik ROS yang sepenuhnya berkualifikasi termasuk namespace ULID unit.
- `throttle_rate`: Waktu minimum dalam milidetik antar pesan (misalnya 40 ms = 25 Hz).
- `compression`: Mendukung `none` atau `png` (untuk occupancy grid berbandwidth tinggi).

### 2. Publikasi Topik (`op: "publish"`)
Mempublikasikan pesan ROS bertipe dari browser ke ROS master:

```json
{
  "op": "publish",
  "id": "pub_cmd_vel_1",
  "topic": "/unit_01JZ8P9WZ0UNIT00000000000/server/key_vel",
  "type": "geometry_msgs/Twist",
  "msg": {
    "linear": { "x": 0.35, "y": 0.0, "z": 0.0 },
    "angular": { "x": 0.0, "y": 0.0, "z": 0.50 }
  }
}
```

### 3. Pemanggilan Service (`op: "call_service"`)
Memanggil sebuah service ROS secara sinkron:

```json
{
  "op": "call_service",
  "id": "srv_call_102",
  "service": "/unit_01JZ8P9WZ0UNIT00000000000/server/global_localization",
  "args": {}
}
```

- **Amplop Response Service**:
```json
{
  "op": "service_response",
  "id": "srv_call_102",
  "service": "/unit_01JZ8P9WZ0UNIT00000000000/server/global_localization",
  "values": {},
  "result": true
}
```

## Subscription Canvas Web Utama

Dashboard web (`ROS-dashboard-next-ts`) melakukan subscribe ke topik visual utama berikut:

| Identifier Topik | Tipe Pesan ROS | Tujuan pada Canvas |
| --- | --- | --- |
| `/server/robot_pose` | `geometry_msgs/PoseStamped` | Memperbarui posisi ikon robot 2D dan panah arah hadap (25 Hz). |
| `/server/slam/map` | `nav_msgs/OccupancyGrid` | Merender bitmap denah SLAM live pada canvas EaselJS. |
| `/server/scan` | `sensor_msgs/LaserScan` | Merender titik-titik sinar laser merah di sekitar robot. |
| `/server/move_base/NavfnROS/plan` | `nav_msgs/Path` | Merender trajektori navigasi global yang direncanakan berwarna biru. |
| `/server/move_base/TebLocalPlannerROS/local_plan` | `nav_msgs/Path` | Merender garis trajektori lokal yang dinamis. |
| `/server/boustrophedon_path` | `nav_msgs/Path` | Merender jalur sweep coverage area boustrophedon berwarna oranye. |

## Resiliensi dan Self-Healing Frontend

1. **Patch Prototype Stage `ROS2D.js`**: Untuk mencegah crash di mana objek stage EaselJS kehilangan fungsi transformasi koordinat ROS selama remount komponen yang cepat, frontend secara dinamis menyuntikkan method `globalToRos` dan `rosToGlobal` ke dalam `createjs.Stage.prototype` sebelum instantiasi viewer.
2. **Debounce Reconnection**: Jika WebSocket terputus, klien menunggu tiga percobaan reconnection berturut-turut sebelum menampilkan peringatan terputus, mencegah UI berkedip-kedip selama gangguan jaringan sesaat.

## Dokumentasi Terkait

- [Kontrak Pesan](/id/development/message-contracts): Kontrak MQTT dan topik terserialisasi.
- [Arsitektur](/id/development/architecture): Model dua mesin dan routing rosbridge.
- [Referensi API](/id/development/api-reference): Endpoint REST API HTTP.
