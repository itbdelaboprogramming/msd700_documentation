---
outline: deep
search: false
---

# Kontrak Pesan

<RoleBadge role="developer" />

Dokumen ini menyediakan spesifikasi lengkap dan otoritatif untuk semua payload data machine-to-machine di sistem MSD700. Mencakup kanal perintah dan feedback MQTT, topik streaming ROS terserialisasi, protokol sinkronisasi operation supervisor, signalling WebRTC, dan pertukaran pendaftaran hardware.

Untuk permukaan HTTP, lihat [Referensi API](/id/development/api-reference). Untuk finite state machine, lihat [State and Behavior](/id/development/state-and-behavior). Untuk desain sistem keseluruhan, lihat [Arsitektur](/id/development/architecture).

::: info Pemberitahuan Verifikasi Kontrak
Bentuk payload diturunkan langsung dari kode sumber aktif (`backend_node`, `system_command.py`, `operation_supervisor.py`, `topic2string`, `enroll_api.js`). Setiap perubahan field di codebase harus diperbarui di sini pada commit yang sama.
:::

## Skema Pengalamatan Fleet

Setiap robot fisik dialamati dengan sebuah prefix unik: `/unit_<ULID>/...`. ULID (Universally Unique Lexicographically Sortable Identifier) adalah primary key yang ditetapkan untuk robot tersebut di tabel database `units` pusat saat pendaftaran.

![Skema Pengalamatan Fleet](../../development/diagrams/message-contracts-fleet-addressing-scheme.drawio)

| Lokasi Hop | Format Topik | Tujuan Engineering |
| --- | --- | --- |
| **ROS Master Lokal Robot** | `/string/robotpose` | Namespace lokal tanpa lingkup (satu robot per roscore onboard). |
| **Broker MQTT Pusat** | `/unit_<ULID>/string/robotpose` | Namespace topik berlingkup fleet yang memultipleks semua robot lewat HiveMQ. |
| **ROS Master Cloud** | `/unit_<ULID>/string/robotpose` | Topik bernamespace yang dikonsumsi oleh relay cloud per-unit dan rosbridge. |

::: warning Aturan Prefix `unit_` Wajib
Nama resource graf ROS harus dimulai dengan karakter alfabet, tilde, atau garis miring depan. Karena ULID dimulai dengan angka (misalnya `01JZ...`), `/01JZ.../string/map` adalah sintaks tidak valid dan ditolak oleh ROS. Prefix `unit_` memastikan kepatuhan ROS yang ketat sambil mempertahankan pemetaan 1:1 dengan topik MQTT.
:::

## Kanal Command and Control

Dua topik MQTT khusus menangani semua interaksi permintaan dan respons dua arah antara server cloud dan sebuah unit fisik:

| Topik MQTT | Arah | Node Produsen | Node Konsumen | Deskripsi |
| --- | --- | --- | --- | --- |
| `/unit_<ULID>/system_command` | Cloud ke Robot | `backend_node` (Express) | `system_command.py` (ROS) | Mengirim perintah kontrol, goal navigasi, dan perubahan mode. |
| `/unit_<ULID>/system_feedback` | Robot ke Cloud | `system_command.py` (ROS) | `backend_node` (Express) | Mengembalikan status eksekusi, pesan error, dan ping telemetri. |

### Amplop Payload Perintah

```json
{
  "header": "navigation",
  "command": "pointstamped",
  "config": {
    "resource": {
      "X": 3.1416,
      "Y": -1.2,
      "Z": 0.0
    }
  },
  "metadata": {
    "timestamp": "2026-08-12T04:11:52.913Z",
    "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10"
  }
}
```

| Nama Field | Tipe | Wajib | Deskripsi |
| --- | --- | --- | --- |
| `header` | string | Ya | Handler subsistem target: `hardware`, `navigation`, `mapping`, `boustrophedon`, `manual`, `autopilot`, `emergency_stop`, `autoalign`. |
| `command` | string | Ya | Kata kerja aksi spesifik dalam handler tersebut. Kata kerja yang tidak dikenali dicatat dan dibuang. |
| `config` | object | Kondisional | Parameter perintah (biasanya di dalam `config.resource`). |
| `data` | object | Kondisional | Blok parameter alternatif yang digunakan oleh `hardware.ping`. |
| `metadata.request_id` | UUID v4 | Ya | Token korelasi unik yang dihasilkan per permintaan HTTP oleh `backend_node`. |
| `metadata.timestamp` | ISO 8601 | Ya | String timestamp pengirim untuk penelusuran diagnostik. |

### Amplop Payload Feedback

```json
{
  "header": "navigation",
  "command": "pointstamped",
  "data": {
    "status": true,
    "message": "Goal published to move_base"
  },
  "metadata": {
    "timestamp": 1786503112.913,
    "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10"
  }
}
```

| Nama Field | Tipe | Deskripsi |
| --- | --- | --- |
| `data.status` | boolean | `true` menandakan perintah diterima/dieksekusi; `false` menandakan penolakan eksekusi. |
| `data.message` | string | Deskripsi diagnostik yang dapat dibaca manusia dari robot. |
| `metadata.timestamp` | float | Detik epoch wall-clock (`rospy.get_time()`) dari robot. |
| `metadata.request_id` | UUID v4 | Cocok dengan `request_id` asli dari amplop perintah. |

### Arsitektur Korelasi dan Retry Perintah

![Arsitektur Korelasi dan Retry Perintah](../../development/diagrams/message-contracts-command-correlation-and-retry-architectu.drawio)

| Parameter | Nilai Default | Lokasi Konfigurasi | Tujuan |
| --- | --- | --- | --- |
| `DEFAULT_TIMEOUT` | `30000` ms (30 dtk) | `backend_node` | Durasi maksimum sebuah permintaan HTTP menunggu feedback sebelum merespons dengan `504 Gateway Timeout`. |
| `COMMAND_RETRY_INTERVAL` | `1500` ms (1,5 dtk) | `backend_node` | Periode kirim ulang selama sebuah perintah yang mengubah state belum diakui. |

::: danger Pengecualian Heartbeat Ping
`header: "hardware", command: "ping"` dikirim secara ketat **sekali** per interval dan tidak pernah di-retry. Hilangnya heartbeat adalah pemicu utama safety watchdog robot. Me-retry ping yang hilang akan menyamarkan network dropout dan mengalahkan mekanisme emergency stop otomatis.
:::

## Katalog Referensi Perintah

### 1. Subsistem Hardware (`header: "hardware"`)

```json
// Command: "check"
{ "header": "hardware", "command": "check", "metadata": { ... } }

// Command: "idle"
{ "header": "hardware", "command": "idle", "metadata": { ... } }
```

| Kata Kerja Perintah | Konten Payload | Tujuan |
| --- | --- | --- |
| `ping` | Lihat [Bagian Ping Heartbeat](#kontrak-ping-heartbeat-dan-lease) | Heartbeat, akuisisi lease, pengambilan telemetri, dan penyegaran watchdog. |
| `heartbeat` | Hanya `{ "page": "navigation" }`. Dikirim browser pada 5 Hz, QoS 0, lewat MQTT-over-WebSocket langsung ke Mosquitto unit (hanya dashboard lokal) | Bukti kehadiran untuk tingkat watchdog 2 detik. Tidak memberi apa pun: tanpa lease, claim/release, `origin`, atau feedback. Lihat [Safety Watchdog](/id/development/ros/safety-watchdog#dua-sinyal-kehadiran). |
| `check` | Tidak ada | Meng-query status driver motor dan mikrokontroler level rendah. |
| `init` | Tidak ada | Menginisialisasi antarmuka hardware dan jalur daya. |
| `stop` | Tidak ada | Mematikan periferal hardware dan tahap daya. |
| `idle` | Tidak ada | Merobohkan node navigasi/mapping yang berjalan sambil mempertahankan robot tetap bertenaga. |
| `battery_update` | `{ "config": { ... } }` | Memperbarui level telemetri daya secara manual. |

### 2. Subsistem Navigasi (`header: "navigation"`)

```json
// Command: "init"
{
  "header": "navigation",
  "command": "init",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "default_save_path": "/home/ubuntu/ros_maps",
      "homebase_x": 1.25,
      "homebase_y": -0.5,
      "homebase_z": 0.0,
      "homebase_ox": 0.0,
      "homebase_oy": 0.0,
      "homebase_oz": 0.0,
      "homebase_ow": 1.0
    }
  },
  "ensure_unpaused": true
}

// Command: "pointstamped" (Single Goal)
{
  "header": "navigation",
  "command": "pointstamped",
  "config": {
    "resource": { "X": 3.1416, "Y": -1.2, "Z": 0.0 }
  }
}
```

- `map_name`: Identifier ULID peta yang berkorespondensi dengan `<ULID>.pgm` dan `<ULID>.yaml` di disk.
- `ensure_unpaused: true`: Menginstruksikan robot untuk secara otomatis membersihkan kunci `/emergency_pause` yang masih berdiri saat memulai navigasi.
- `command: "deactivate"`: Menghentikan stack navigasi yang aktif (tidak menerima payload).

### 3. Subsistem Mapping (`header: "mapping"`)

```json
// Command: "stop" (Save and Upload Map)
{
  "header": "mapping",
  "command": "stop",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "display_map_name": "Production Hall Level 1",
      "map_ulid": "01JZ8QK2H0000000000000MAP",
      "created_by": "01JZ7YV5CQUSER00000000000",
      "unit_id": "01JZ8P9WZ0UNIT00000000000",
      "homebase_x": 1.2,
      "homebase_y": 0.5,
      "homebase_z": 0.0,
      "homebase_ox": 0.0,
      "homebase_oy": 0.0,
      "homebase_oz": 0.0,
      "homebase_ow": 1.0
    }
  }
}
```

Menyimpan sebuah peta SLAM memakan waktu lebih lama dari timeout HTTP standar 30 detik. Oleh karena itu, `mapping stop` segera mengembalikan HTTP 200 dengan `{ request_id, map_ulid }`. Frontend terhubung ke sebuah stream SSE pada `GET /api/mapping/progress/:request_id` untuk memantau progres.

#### Feedback Progres Mapping (`header: "mapping_progress"`)

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
  "metadata": {
    "timestamp": 1734000000.0,
    "request_id": "..."
  }
}
```

| Nilai Outcome | Deskripsi |
| --- | --- |
| `completed` | Berhasil ditulis baik ke media-server Unit lokal maupun server cloud. |
| `cloud_pending` | Ditulis hanya ke media-server Unit lokal. Replikasi cloud akan selesai pada interval sinkronisasi berikutnya. |
| `failed` | Penyimpanan mapping gagal. Sesi tetap terbuka untuk dicoba ulang. |

### 4. Coverage Area Boustrophedon (`header: "boustrophedon"`)

```json
// Command: "init"
{
  "header": "boustrophedon",
  "command": "init",
  "config": {
    "use_autocover": false,
    "polygon": [
      { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 },
      { "x": 10.0, "y": 5.0 }, { "x": 0.0, "y": 5.0 }
    ],
    "areas": [
      [ { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 }, { "x": 10.0, "y": 5.0 }, { "x": 0.0, "y": 5.0 } ]
    ],
    "exclusions": [
      [ { "x": 3.0, "y": 2.0 }, { "x": 5.0, "y": 2.0 }, { "x": 5.0, "y": 4.0 }, { "x": 3.0, "y": 4.0 } ]
    ],
    "ensure_unpaused": true
  }
}
```

- `areas`: Array poligon terurut yang membentuk playlist operasi target.
- `exclusions`: Zona obstacle keep-out yang dikurangkan dari sweep coverage.
- `command: "pause"`: Menerima `{ "pause": true }` atau `{ "pause": false }`.
- `command: "deactivate"`: Menghentikan perencanaan coverage.

## Kontrak Ping Heartbeat dan Lease

Pesan heartbeat ping mengelola operating lease robot, timer safety watchdog, dan telemetri status.

### Payload Permintaan (blok `data`)

```json
{
  "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
  "user_id": "01JZ7YV5CQUSER00000000000",
  "claim": true,
  "release": false,
  "page": "navigation",
  "origin": "cloud",
  "force_takeover": false
}
```

| Parameter | Sumber | Deskripsi |
| --- | --- | --- |
| `session_id` | Tab browser | UUID unik per tab browser. |
| `user_id` | Backend JWT | Diekstrak secara ketat dari token JWT terautentikasi oleh backend server. |
| `claim` | Browser | `true` dari halaman operasional (Navigation, Mapping); `false` saat menjelajahi daftar fleet read-only. |
| `release` | Browser | Secara eksplisit melepaskan operating lease saat keluar halaman. |
| `page` | Browser | Halaman asal: `dashboard`, `login`, `navigation`, `mapping`. |
| `origin` | Env backend | `cloud` atau `local`, ditentukan oleh konfigurasi server. |
| `force_takeover` | Browser | `true` ketika operator mengonfirmasi mengambil alih lease yang sudah ada. |

### Payload Respons (blok `data`)

```json
{
  "status": true,
  "robot_activity": "navigation_point_published",
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
  "origin_conflict_side": null
}
```

| Field Respons | Deskripsi |
| --- | --- |
| `robot_activity` | State aktivitas terfilter (misalnya `idle`, `navigating`, `mapping`, `stuck`). |
| `active_page` | Halaman aktif mentah sebelum evaluasi stuck-detector, memastikan routing yang benar. |
| `battery` | Persentase state of charge baterai (float). |
| `uptime` | Uptime sistem dalam menit. |
| `hw_status` | Status yang dilaporkan oleh subsistem monitoring hardware (`ready`, `fault`). |
| `manual_override` | `true` ketika mode teleop manual diaktifkan. |
| `autopilot` | `true` ketika sequencer autopilot otonom aktif. |
| `in_use` | Kunci level akun: menandakan akun pengguna lain memegang lease. |
| `origin_conflict` | Konflik level sesi: menandakan tab lain dari akun yang sama sedang aktif. |

## Topik Telemetri Streaming

Telemetri streaming diserialisasi menjadi string JSON pada unit lewat `topic2string`, dirutekan lewat MQTT, dan dikonversi kembali menjadi pesan ROS bertipe pada server untuk `rosbridge`.

![Topik Telemetri Streaming](../../development/diagrams/message-contracts-streaming-telemetry-topics.drawio)

### Definisi Stream Telemetri

| Topik Robot | Topik Server Cloud | Laju Update | Deskripsi Konten |
| --- | --- | --- | --- |
| `/string/robotpose` | `/unit_<ULID>/server/robot_pose` | 25 Hz | Posisi dan orientasi robot dalam frame `map` (`geometry_msgs/PoseStamped`). |
| `/string/map` | `/unit_<ULID>/server/slam/map` | Saat berubah, plus heartbeat | Occupancy grid terkompresi, `base64(zlib(M1))` dengan sel dikemas sebagai int8 mentah. Format lama `base64(zlib(JSON))` masih diterima decoder. Lihat [Pengiriman map](#map-delivery). |
| `/string/laserscan` | `/unit_<ULID>/server/scan` | 2 Hz | Data laser scan 2D terkompresi (`sensor_msgs/LaserScan`). |
| `/string/move_base/NavfnROS/plan` | `/unit_<ULID>/server/move_base/NavfnROS/plan` | Saat plan | Koordinat path global (`nav_msgs/Path`). |
| `/string/move_base/TebLocalPlannerROS/local_plan` | `/unit_<ULID>/server/move_base/TebLocalPlannerROS/local_plan` | Kontinu | Trajektori lokal (`nav_msgs/Path`). |
| `/string/boustrophedon_path` | `/unit_<ULID>/server/boustrophedon_path` | Saat plan | Koordinat garis sweep coverage (`nav_msgs/Path`). |
| `/string/operation_snapshot` | `/unit_<ULID>/string/operation_snapshot` | Latched | Snapshot misi aktif lengkap untuk pemulihan reconnect. |

### Pengiriman map {#map-delivery}

Map adalah payload terbesar di link ini dan satu-satunya yang membuat operator tidak bisa bekerja
kalau tidak ada. Karena itu map adalah satu-satunya stream yang tidak sekadar mengulang dirinya.
Robot meng-hash isi grid dan mengirimnya hanya saat grid benar-benar berubah, ditambah heartbeat
tiap 60 detik selama ada yang menonton dan tiap 300 detik selama tidak ada. Di mode navigasi grid
berasal dari `map_server` dan tidak pernah berubah sama sekali, jadi praktisnya satu pesan per
heartbeat.

Artinya satu pesan tunggal membawa sesuatu yang mutlak dibutuhkan browser, lewat hop QoS 0 tanpa
retain di broker. Ada tiga mekanisme yang membuatnya selamat, dan tidak satu pun opsional:

| Mekanisme | Lokasi | Yang dilindungi |
| --- | --- | --- |
| Relay cloud men-latch `/unit_<ULID>/string/map` | `aws_mqtt/scripts/gen_bridge_params.py` | Browser yang connect di antara dua pengiriman, dan relay yang restart (terjadi tiap kali roster fleet berubah). |
| Burst `burst_sends` pengulangan berjarak `burst_interval` setelah reset atau retire map | `topic2string/src/nodelets/map_compression.cpp` (Python twin: `scripts/map_compression_pipeline.py`) | Map yang baru saja dibuka operator, yang dikirim tepat saat robot sedang me-restart seluruh stack navigasinya. Memulai run mapping baru ikut tercakup. |
| Kanal tarik `/string/map_request` | Browser ke robot, jalur yang sama dengan topik ACK | Sisanya: paket yang drop, dashboard yang halamannya mount di saat yang salah, relay mode lokal yang menelan pesan pertama saat masih belajar tipe topiknya. |

Dashboard mem-publish `std_msgs/String` ke `/unit_<ULID>/string/map_request` begitu kanvas
Navigation mount, dan terus meminta sampai ada map yang tergambar. Robot membatasi laju permintaan
(`request_min_interval`, default 2 detik), jadi beberapa tab pada satu unit hanya menambah satu
pengiriman, bukan satu per tab.

**Grid 0x0 bukan pesan rusak.** Robot mem-publish-nya untuk memensiunkan grid yang sedang di-latch
relay: tanpa itu, dashboard yang baru saja membuka map *berbeda* akan disodori ruangan dari sesi
sebelumnya dan menggambarnya dengan penuh percaya diri. Kanvas memperlakukannya sebagai "belum ada
map", menampilkan status memuat, lalu meminta map yang baru.

Compressor meng-advertise dua service, dan bedanya adalah situasi mana yang sedang terjadi:

| Service | Dipanggil dari | Efek |
| --- | --- | --- |
| `/map/reset` | Mapping berhenti atau dibuang, navigasi dinonaktifkan, emergency stop | Robot melupakan map-nya. Apa pun yang sudah digambar dashboard dibiarkan. Operator sedang dalam perjalanan keluar dari halaman itu, jadi mengosongkan kanvasnya tidak memberi keuntungan apa pun. |
| `/map/retire` | Hanya `navigation.init` | Sama, plus sentinel 0x0. Ini satu-satunya kasus di mana salinan yang di-latch benar-benar salah: map yang berbeda baru saja dibuka. |

Keduanya meng-arm burst. Robot yang belum punya `/map/retire` jatuh ke reset biasa, jadi yang hilang
saat rolling deploy adalah perbaikan map basi, bukan reset-nya.

::: warning
Jangan memperpanjang `change_heartbeat` di `topic2string/config/egress.yaml` tanpa memastikan
ketiga mekanisme di atas masih terpasang. Dengan change-gating saja dan tanpa ketiganya, dashboard
yang melewatkan satu pengiriman menunggu ~52 detik terukur untuk pengiriman berikutnya.
:::

## Sinkronisasi Operation Supervisor

`operation_supervisor.py` mengelola eksekusi misi otonom pada robot sehingga misi berlanjut tanpa gangguan jika tab browser ditutup.

![Sinkronisasi Operation Supervisor](../../development/diagrams/message-contracts-operation-supervisor-synchronization.drawio)

### Payload Operation Sync (`/string/operation_sync`)

```json
{
  "type": "batch",
  "operation": "multi_pinpoint",
  "route_mode": "round-trip",
  "waypoints": [
    {
      "position": { "x": 1.0, "y": 2.0, "z": 0.0 },
      "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
    },
    {
      "position": { "x": 4.5, "y": 2.0, "z": 0.0 },
      "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
    }
  ],
  "current_index": 0,
  "map_name": "01JZ8QK2H0000000000000MAP",
  "coverage": null,
  "timestamp": 1786503112.913
}
```

| Tipe Aksi (`type`) | Tujuan |
| --- | --- |
| `batch` | Mengunggah urutan waypoint lengkap saat misi dimulai. |
| `progress` | Memperbarui indeks waypoint saat ini selama run yang dipandu operator. |
| `takeover` | Mengaktifkan mode Autopilot, menyerahkan sequencing waypoint ke supervisor. |
| `release` | Menonaktifkan mode Autopilot, mengembalikan kontrol ke loop browser. |
| `pause` | Menjeda eksekusi sambil mempertahankan antrean waypoint. |
| `stop` | Menghentikan misi dan membersihkan batch waypoint. |
| `resync` | Meminta re-broadcast segera dari snapshot misi. |

## Handshake Pendaftaran Robot

Robot yang belum terdaftar mendaftarkan diri mereka sendiri ke server cloud lewat handshake kriptografis tiga tahap yang aman.

![Handshake Pendaftaran Robot](../../development/diagrams/message-contracts-robot-enrolment-handshake.drawio)

::: tip Tujuan Keamanan Nonce
Nonce secret 32-byte menjamin bahwa spoofing alamat MAC tidak bisa membajak sebuah pendaftaran robot yang sudah disetujui selagi robot fisik dalam keadaan mati. Device secret hanya dikirimkan ketika robot asli mengungkapkan nonce plaintext asli yang cocok dengan hash yang telah terdaftar sebelumnya.
:::

## Dokumentasi Terkait

- [Referensi API](/id/development/api-reference): Endpoint REST API dan skema data.
- [State and Behavior](/id/development/state-and-behavior): State machine terperinci dan transisi kegagalan.
- [Arsitektur](/id/development/architecture): Topologi sistem level tinggi dan batas trust.
