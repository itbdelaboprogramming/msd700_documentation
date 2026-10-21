---
outline: deep
search: false
---

# Bridge ROS Web UI untuk ROS 2 (msd_system)

<RoleBadge role="developer" />

Bagaimana robot ROS 2 Jazzy dari `msd_system` tampil di dashboard sebagai **unit** dan dikendalikan darinya. Semuanya ada di `src/msd_webui/` pada workspace tersebut (branch `web-ui-bridge`) dan memakai kontrak MQTT yang sama dengan unit ROS 1, sehingga dashboard, backend, dan relay cloud tidak perlu diubah. Halaman ini membahas sisi robot; payload yang dipakai bersama ada di [Kontrak Pesan](/id/development/message-contracts/), dan pemakaiannya di dashboard ada di [ROS Web UI](/id/development/webui/). Cara menjalankannya di unit: [Setup Unit § Beralih ke stack ROS 2](/id/setup/unit-setup#ros2-stack).

Bringup robot memiliki robotnya, dan `webui.launch.py` berjalan di sampingnya. Bridge menyalakan dan mematikan dua bagiannya atas command dashboard: hardware saat **Initialize** dan **Stop** (`hardware_prototype.launch.py`), dan stack navigasi untuk setiap mode (jalan bebas, navigasi di peta tersimpan, mapping) lewat `msd_bringup.launch.xml` milik bringup sendiri. Dua paket fitur web UI, `msd_map_manager` dan `msd_coverage` di `src/msd_feature/`, dirouting ke bringup itu dengan argumen yang bawaannya mati. Tidak ada file lain di luar `src/msd_webui/` yang diubah, dan bringup hanya bertambah baris (`tools/check_additive.sh` gagal kalau tidak).

## Paket

| Paket | Node dan file launch | Peran |
| --- | --- | --- |
| `msd_webui_bridge` | `webui_bridge` | Agen unit: MQTT ke broker lokal dan cloud, penanganan command, lease operasi, watchdog kehadiran, emergency stop, manual drive, pose robot, encoder untuk stream peta, scan, dan lubang, serta bridging GPS, follower, dan return to home |
| | `motion_guard` | Titik terakhir sebelum base: satu-satunya node yang menulis `cmd_vel` |
| | `webui.launch.py` | Menyalakan `webui_bridge`, `motion_guard`, dan view |
| | `hardware_prototype.launch.py`, `follower.launch.py`, `rth.launch.py` | Layer launch yang dinyalakan dan dimatikan bridge: hardware robot, follower, return to home (msd_rth) |
| `msd_webui_views` | `scan_flattener`, `hole_trail`, `grid_mapper` | Apa yang digambar dashboard, dibuat dari peta terrain CMU |
| | `livox_to_cloud` | `CustomMsg` dari Livox Mid-360 sebagai `PointCloud2` berbentuk Velodyne (hanya unit Livox, dinyalakan oleh `hardware_prototype.launch.py`) |
| | `image_to_v4l2` | Gambar RealSense ditulis ke kamera v4l2loopback untuk `camera_client`, sehingga kamera dashboard dan vision follower memakai RealSense bersama (hanya bila `camera_device` diset) |
| `msd_map_manager` | `map_server` | Peta pgm/yaml tersimpan sebagai `/map` (latched) |
| | `map_recorder` | Menyimpan peta 2D dan scan 3D terdaftar dari run mapping; `~/save` menulis `<nama>.pgm/.yaml/.pcd` |
| | `scan_aligner` | Auto Align: mencocokkan lidar dengan peta tersimpan dan mengirim hasilnya sebagai `/initialpose` |
| | `grid_to_pcd`, `explore.launch.py` | Peta 3D dari peta 2D (dinding diekstrusi); eksplorasi TARE dengan topic goal sebagai argumen |
| `msd_coverage` | `coverage_node` | Coverage boustrophedon di peta tersimpan: merencanakan lajur dan menjalankannya satu goal pada satu waktu |

Argumen `webui.launch.py`: `profile` (`sim` atau `prototype`), `use_sim_time`, `unit_id` atau `cred_dir`, `dev` (broker cloud dev), `enable_cloud`, `enable_local`, `guard_input`, `guard_output`, `enable_views`, `terrain_topic` (default `/terrain_map_ext`), dan `camera_device` (default kosong).

### Mode stack navigasi {#stack-modes}

Bridge menjalankan satu `ros2 launch msd_bringup msd_bringup.launch.xml run_robot:=none ...` pada satu waktu:

| Mode | Dinyalakan oleh | Argumen bringup |
| --- | --- | --- |
| `free` | `follower.start`, `rth.go_home` saat belum ada navigasi | `navigation_mode:=kiss_icp` |
| `navigation` | `navigation.init` | `navigation_mode:=lidar_map_localization map_path:=<peta>.pcd`, `run_map_manager:=true map_yaml:=<peta>.yaml run_aligner:=true`, `run_coverage:=true coverage_goal_topic:=webui/coverage/way_point` |
| `mapping` | `mapping.start` | `navigation_mode:=kiss_icp`, `run_map_manager:=true record_map:=true`; dengan `mapping_explore` juga `run_exploration:=true exploration_goal_topic:=webui/explore/way_point` |

Peta tersimpan adalah pasangan dari satu run mapping, dalam satu frame `map`: `<peta>.pgm/.yaml` untuk dashboard dan media server, dan `<peta>.pcd`, yang dipakai `lidar_map_localization` untuk lokalisasi dan tetap di robot (`$MAPS_FOLDER`). Peta yang hanya ada sebagai pgm/yaml (dibuat di unit ROS 1) mendapat pcd yang dibuat dari dindingnya. Stack navigasi yang tidak dinyalakan bridge dibiarkan; bridge lalu hanya menyalakan alat peta dan coverage. Unit didaftarkan sekali dengan `scripts/enroll.py` dari ros-web-ui; lihat [Firmware & Enrolment](/id/development/message-contracts/firmware-and-enrolment).

## Alur topic {#topic-flow}

Dari robot ke dashboard: stack navigasi CMU dan hardware menerbitkan data; `msd_webui_views` mengubah peta terrain 3D menjadi gambar datar; `webui_bridge` meng-encode, menyaring, dan meneruskan semuanya ke MQTT.

![Alur topic dari robot ke dashboard](../../../development/ros/diagrams/ros2-web-ui-bridge-topic-flow-robot-to-dashboard.drawio)

Dari dashboard ke robot: setiap command datang lewat `system_command`, lalu bridge mengubahnya menjadi topic ROS (manual drive, motion lock, goal, command msd_rth) atau menyalakan dan mematikan layer launch. `motion_guard` selalu berada di antara `twist_mux` dan base.

![Alur topic dari dashboard ke robot](../../../development/ros/diagrams/ros2-web-ui-bridge-topic-flow-dashboard-to-robot.drawio)

## Daftar topic {#topic-list}

Kolom **Minimum** merujuk ke level di [Operasional minimum](#minimum): **Core** (unit online), **Drive** (Initialize dan manual drive), **Halaman peta** (pose, scan, dan peta di dashboard), nama fitur (hanya dibutuhkan fitur itu), atau **Opsional** (aman ditinggalkan).

### Dibaca dari robot {#ros-inputs}

Topic yang disediakan bringup dan dibaca node web UI.

| Topic | Tipe | Publisher | Dibaca oleh | Dipakai untuk | Minimum |
| --- | --- | --- | --- | --- | --- |
| `/msd_hardware/imu/data` | `sensor_msgs/Imu` | msd_hardware (Xsens) | `webui_bridge` | Liveness hardware; arah kompas di `string/gps` | Drive |
| `/msd_hardware/wheel/left_vel`, `right_vel` | `std_msgs/Float64` | `hardware_interface_node` | `webui_bridge` | Liveness hardware (profil prototype) | Drive |
| `/msd_hardware/scan_3d/points` | `PointCloud2`, atau `livox_ros_driver2/CustomMsg` (tipe diambil dari graph) | driver lidar, atau `livox_to_cloud` | `webui_bridge` | Liveness hardware | Drive |
| `mux/cmd_vel` | `geometry_msgs/TwistStamped` | `twist_mux` | `motion_guard` | Perintah yang diteruskan atau dinolkan `motion_guard` | Drive |
| TF `map` → `base_link`, `base_footprint` | tf2 | stack navigasi (state estimation; `map` → `odom` statis) | `webui_bridge`, view | `string/robotpose`; frame scan dan tinggi tanah lokal | Halaman peta |
| `/terrain_map_ext` | `PointCloud2` di `map`, `intensity` = tinggi di atas tanah lokal | `terrain_analysis_ext` CMU | `scan_flattener`, `hole_trail`, `grid_mapper` | Scan, tanda lubang, jejak lubang, peta 2D | Halaman peta |
| `/state_estimation` | `nav_msgs/Odometry` | stack navigasi | `webui_bridge` | "Navigasi sedang jalan", frame goal follower, pose untuk parkir | Follower, RTH |
| `/msd_hardware/gps/fix` | `sensor_msgs/NavSatFix` | msd_hardware | `webui_bridge` | `string/gps`; `go_home` RTH butuh fix | GPS, RTH |
| `/gps/hdop` | `std_msgs/Float32` | driver GPS | `webui_bridge` | `hdop` di `string/gps` | Opsional |
| `/gps/satcount` | `std_msgs/Int32` | driver GPS | `webui_bridge` | `sats` di `string/gps` | Opsional |
| `/vision/target_point`, `/uwb/target_point` | `geometry_msgs/PointStamped` | sumber target follower | `webui_bridge` | `source` di `string/follower_status` | Opsional |
| `/msd_hardware/uwb` | `msd_interfaces/UWBStamped` | `hardware_interface_node` | `webui_bridge` | `uwb_range_m` (dilewati bila `msd_interfaces` tidak terpasang) | Opsional |
| `/path` | `nav_msgs/Path` di `vehicle` | `localPlanner` CMU | `webui_bridge` | Overlay plan lokal, dipindah ke `map` | Opsional |
| `/map` | `nav_msgs/OccupancyGrid`, latched | `map_server` `msd_map_manager` | `webui_bridge`, `scan_aligner`, `coverage_node` | Peta tersimpan: `string/map` selama peta terbuka, Auto Align, coverage | Navigasi |
| `/registered_scan` | `PointCloud2` | stack navigasi | `map_recorder` | Peta 3D dari run mapping | Mapping |
| `/exploration_finish` | `std_msgs/Bool` | TARE | `webui_bridge` | `mapping_completed` | Opsional |

Setiap nama adalah parameter `webui_bridge` (`config/bridge.yaml`, `config/profile_<profile>.yaml`). Daftar liveness ada di `liveness_topics`; sebuah topic dianggap hidup bila ada pesan dalam 2 detik terakhir (`liveness_max_age`).

### Antar node web UI {#ros-internal}

| Topic | Tipe dan QoS | Publisher | Dibaca oleh | Isi | Minimum |
| --- | --- | --- | --- | --- | --- |
| `webui/motion_lock` | `std_msgs/Bool`, reliable, transient local, diulang tiap 1 detik | `webui_bridge` | `motion_guard`, `twist_mux` (lock 255) | `true` = tahan robot (pause kehadiran, emergency stop, shutdown hardware) | Drive |
| `webui/guard_heartbeat` | `std_msgs/Empty`, tiap 0,2 detik | `webui_bridge` | `motion_guard` | Bukti watchdog bridge berjalan | Drive |
| `webui/scan` | `sensor_msgs/LaserScan`, best effort, 720 beam di `base_link` | `scan_flattener` | `webui_bridge` | Rintangan di atas `obstacle_height`, terdekat per arah | Halaman peta |
| `webui/scan_holes` | `sensor_msgs/LaserScan`, best effort | `scan_flattener` | `webui_bridge` | Tanda lubang | Opsional |
| `webui/hazard_cells` | `nav_msgs/Path` di `map`, reliable, transient local | `hole_trail` | `webui_bridge` | Setiap sel lubang pada run ini, 0,10 m | Opsional |
| `webui/map` | `nav_msgs/OccupancyGrid` di `map`, reliable, transient local | `grid_mapper` | `webui_bridge` | Grid log-odds 2D, 0,1 m | Halaman peta |
| `webui/follower/way_point` | `geometry_msgs/PointStamped` | follower (`follower.launch.py`) | `webui_bridge` | Goal follower, diteruskan ke `/way_point` selama follower memegang gerbang goal | Follower |
| `webui/rth/command` | `std_msgs/String` (JSON) | `webui_bridge` | msd_rth | `start_session`, `go_home`, `cancel` | RTH |
| `webui/rth/status` | `std_msgs/String` (JSON), 5 Hz | msd_rth | `webui_bridge` | State RTH; kedatangannya membuktikan msd_rth hidup | RTH |
| `webui/rth/way_point` | `geometry_msgs/PointStamped` | msd_rth | `webui_bridge` | Goal rute pulang, diteruskan ke `/way_point` selama RTH memegang gerbang goal | RTH |
| `webui/coverage/way_point`, `webui/explore/way_point` | `geometry_msgs/PointStamped` | `coverage_node`, TARE | `webui_bridge` | Goal coverage dan eksplorasi, diteruskan ke `/way_point` selama sumber itu memegang gerbang goal | Coverage, Mapping |
| `coverage/plan` | `std_msgs/String` (JSON), latched | `webui_bridge` | `coverage_node` | `{"plan_id", "areas", "exclusions"}`; kosong untuk menghapus | Coverage |
| `coverage/status`, `coverage/path`, `coverage/skipped`, `coverage/uncovered`, `coverage/debug` | String / `nav_msgs/Path`, latched | `coverage_node` | `webui_bridge` | State dan overlay run, diteruskan ke stream `string/` | Coverage |
| `webui/system_command` | `std_msgs/String` | alat uji bangku | `webui_bridge` | Envelope yang sama dengan MQTT, untuk uji tanpa broker | Opsional |

### Ditulis ke robot {#ros-outputs}

| Topic | Tipe dan QoS | Publisher | Dibaca oleh | Isi | Minimum |
| --- | --- | --- | --- | --- | --- |
| `webui/manual_vel` | `geometry_msgs/TwistStamped` di `base_link` | `webui_bridge` | `twist_mux` (prioritas 90, timeout 0,5 detik) | `string/key_vel`, hanya selama `manual.enable` berlaku | Drive |
| `cmd_vel` | `geometry_msgs/TwistStamped`, 20 Hz, selalu | `motion_guard` | `hardware_interface_node` | `mux/cmd_vel`, atau nol | Drive |
| `/way_point` | `geometry_msgs/PointStamped` | `webui_bridge` | `cmu_nav_executor` | Goal dari satu sumber pada satu waktu: dashboard dan supervisor autopilot, coverage, eksplorasi, follower, RTH; goal di pose robot sendiri untuk parkir | Navigasi |
| `/initialpose` | `geometry_msgs/PoseWithCovarianceStamped` di `map` | `webui_bridge`, `scan_aligner` | `lidar_map_localization` | Home base saat `navigation.init`, pose estimate dari dashboard, hasil Auto Align | Navigasi |
| `/clicked_point` | `geometry_msgs/PointStamped` | `webui_bridge` | tidak ada di msd_system | `navigation.pointstamped`, seperti ROS 1 | Opsional |
| `webui/guard_state` | `std_msgs/String` (JSON), latched, saat berubah | `motion_guard` | untuk debugging | Alasan `cmd_vel` nol | Opsional |
| `webui/watchdog_status` | `std_msgs/String` (JSON), latched, 5 Hz | `webui_bridge` | untuk debugging | Tingkat watchdog, pemegang lock, profil penonton | Opsional |
| `webui/system_feedback` | `std_msgs/String` | `webui_bridge` | untuk debugging | Salinan ROS dari setiap feedback yang dikirim ke MQTT | Opsional |
| `msd_hardware/cmd_arm` | `std_msgs/Bool` | `motion_guard` | MCU | Hanya dengan `use_cmd_arm: true` (mati: perilaku ARM firmware ros2/dev belum dicek) | Opsional |

### Service {#ros-services}

| Service | Tipe | Efek |
| --- | --- | --- |
| `grid_mapper/reset` | `std_srvs/Trigger` | Mengosongkan peta 2D |
| `hole_trail/clear` | `std_srvs/Trigger` | Mengosongkan jejak lubang |
| `map_recorder/save`, `map_recorder/reset` | `std_srvs/Trigger` | Menulis pasangan peta run (balasannya menyebut berkasnya); melupakan peta 3D |
| `alignment/start`, `alignment/reset`, `check_alignment` | `std_srvs/Trigger` | Auto Align, seperti ROS 1 |
| `coverage/pause`, `coverage/resume`, `coverage/cancel` | `std_srvs/Trigger` | Run coverage |

### MQTT {#mqtt-topics}

Semua topic ada di bawah `/unit_<ULID>/`. Bridge terhubung ke broker cloud (`msd.nglobal.jp:8883`, atau `8884` dengan `dev:=true`) dan Mosquitto lokal unit (`localhost:1883`) sekaligus dan melayani keduanya sama, kecuali tiga stream fitur, yang tetap di broker lokal sampai relay cloud membawanya (`feature_streams_cloud: false`).

Robot ke dashboard:

| MQTT | Dari | Format | Rate | Broker | Minimum |
| --- | --- | --- | --- | --- | --- |
| `system_feedback` | setiap command | [JSON feedback](#payload-system-feedback) | per command; satu jawaban per ping | keduanya | Core |
| `string/robotpose` | TF `map` → `base_link` | [JSON pose](#payload-robotpose) | sampai 25 Hz melewati deadband 5 mm / 0,5°; diulang paling lambat tiap 5 detik (25 detik saat tidak ada yang menonton) | keduanya | Halaman peta |
| `string/laserscan` | `webui/scan` | [base64(zlib(Q1))](#payload-laserscan) | 2 Hz; 1 Hz saat ditonton; mati saat idle | keduanya | Halaman peta |
| `string/laserscan_holes` | `webui/scan_holes` | base64(zlib(Q1)) | sama dengan `string/laserscan` | keduanya | Opsional |
| `string/hazard_cells` | `webui/hazard_cells` | [base64(zlib(JSON Path))](#payload-hazard-cells) | dicek 0,5 Hz, dikirim saat berubah dan tiap 15 detik; mati saat idle | keduanya | Opsional |
| `string/map` | `webui/map` | [base64(zlib(M1))](#payload-map) | paling sering tiap 5 detik bila berubah; heartbeat 60 detik (300 detik saat idle); 3 kali kirim setelah reset | keduanya | Halaman peta |
| `string/gps` | fix GPS, HDOP, satelit, yaw IMU | [JSON](#payload-gps) | 1 Hz; mati saat idle | lokal | GPS |
| `string/follower_status` | goal dan sumber follower | [JSON](#payload-follower-status) | 2 Hz selama mengikuti, dan setiap perubahan | lokal | Follower |
| `string/rth_status` | `webui/rth/status` | [JSON](#payload-rth-status) | setiap perubahan state, 1 Hz selama pulang | lokal | RTH |
| `string/rth_path` | berkas lintasan msd_rth, dipindah ke `map` | [base64(zlib(JSON Path))](#payload-rth-path) | saat rekaman bertambah (dicek tiap 2 detik) | lokal | RTH |
| `string/move_base/status`, `string/move_base/result` | pelacak goal bridge | JSON [status](/id/development/message-contracts/bridge-topics#json-status), [result](/id/development/message-contracts/bridge-topics#json-result) | status saat berubah dan tiap 2 detik; result tiap 1 detik sampai di-ACK (tidak saat tidak ada yang menonton) | keduanya | Navigasi |
| `string/move_base/NavfnROS/plan`, `string/move_base/TebLocalPlannerROS/local_plan` | garis lurus robot ke goal; `/path` | base64(zlib(JSON Path)) | sama dengan `string/hazard_cells` | keduanya | Opsional |
| `string/boustrophedon_path`, `string/skipped_waypoints` | `coverage/path`, `coverage/skipped` | base64(zlib(JSON Path)); rute membawa revisinya di `header.seq` | rute setiap berubah dan tiap 2 detik sampai di-ACK | keduanya | Coverage |
| `string/coverage_status`, `string/uncovered_regions`, `string/coverage_debug` | `coverage_node` | teks / JSON | saat berubah | keduanya | Coverage |
| `string/operation_progress`, `string/operation_snapshot` | supervisor operasi | [JSON](/id/development/message-contracts/operation-sync#supervisor-to-browser) | setiap langkah; snapshot setiap berubah | keduanya | Autopilot |

Dashboard ke robot:

| MQTT | Dari | Format | Dibaca sebagai | Minimum |
| --- | --- | --- | --- | --- |
| `system_command` | `backend_node` (command, ping), browser (frame heartbeat tiap 0,2 detik) | [envelope command](#payload-system-command) | diarahkan menurut `header` | Core |
| `string/key_vel` | browser, 10 Hz selama Manual Override menyala | [JSON twist](#payload-key-vel) | `webui/manual_vel` | Drive |
| `string/map_request` | browser, selama kanvas petanya belum punya peta | [JSON](#payload-map-request) | `string/map` berikutnya langsung dikirim | Halaman peta |
| `string/move_base/goal`, `string/move_base/cancel`, `string/move_base/result_ack` | browser | [goal](/id/development/message-contracts/bridge-topics#json-goal), [cancel](/id/development/message-contracts/bridge-topics#json-cancel), [ACK](/id/development/message-contracts/bridge-topics#acks) | goal `/way_point`; preempt; berhenti mengirim ulang result | Navigasi |
| `string/initialpose` | browser (pose estimate) | [JSON initial pose](/id/development/message-contracts/bridge-topics#json-initialpose) | `/initialpose` | Navigasi |
| `string/boustrophedon_path_ack` | browser | revisi rute | berhenti mengirim ulang rute coverage | Coverage |
| `string/operation_sync` | browser | [JSON operation sync](/id/development/message-contracts/operation-sync#sync-messages) | supervisor operasi | Autopilot |

## Operasional minimum {#minimum}

Setiap level membutuhkan semua yang ada di level di atasnya.

| Level | Yang jalan | Butuh di sisi ROS | Butuh di MQTT |
| --- | --- | --- | --- |
| **Core** | Unit tampil online, ping dan lease dijawab, command yang tidak didukung langsung dijawab | `webui_bridge` jalan dengan identitas unit (`unit_id`, `$UNIT_ID`, atau `device.json`) dan broker yang bisa dijangkau. Tidak ada topic lain | `system_command`, `system_feedback` |
| **Drive** | Initialize dan Stop, manual drive, emergency stop, pause kehadiran 2 detik | `motion_guard` di antara `twist_mux` dan base; `twist_mux` menulis `mux/cmd_vel` dengan input `webui/manual_vel` dan lock `webui/motion_lock`; tidak ada publisher lain di `cmd_vel`; topic liveness muncul dalam 20 detik setelah Initialize | + `string/key_vel` dan frame heartbeat |
| **Halaman peta** | Posisi robot, scan, peta 2D | Stack navigasi: TF `map` → `base_link` dan `base_footprint`, `/terrain_map_ext`; `msd_webui_views` (`enable_views`) | + `string/robotpose`, `string/laserscan`, `string/map`, `string/map_request` |
| **GPS** | Badge fix dan posisi | `/msd_hardware/gps/fix` | + `string/gps` (broker lokal) |
| **Follower** | Mengikuti orang atau tag | `/state_estimation`, `cmu_nav_executor` yang membaca `/way_point`, paket follower | + command `follower`, `string/follower_status` |
| **RTH** | Tandai home, pulang lewat jalur yang terekam | `/state_estimation`, fix GPS, msd_rth, `cmu_nav_executor` | + command `rth`, `string/rth_status`, `string/rth_path` |
| **Navigasi** | Buka peta tersimpan, pinpoint, pose estimate, Auto Align | stack CMU dan `lidar_map_localization` lewat `msd_bringup.launch.xml`, `msd_map_manager`; `.pcd` peta (atau yang dibuat dari dindingnya) | + command `navigation`, `autoalign`, `string/move_base/*`, `string/initialpose` |
| **Mapping** | Membuat dan menyimpan peta | stack CMU dengan KISS-ICP, `msd_map_manager`, media server dan kredensialnya; TARE untuk eksplorasi otomatis | + command `mapping` dan event progresnya |
| **Coverage** | Auto coverage, area custom, playlist dengan keep-out | peta terbuka untuk navigasi, `msd_coverage` | + command `boustrophedon`, stream coverage |
| **Autopilot** | Run multi pinpoint tetap berjalan saat dashboard ditutup | peta terbuka untuk navigasi | + command `autopilot`, `string/operation_*` |

Meninggalkan satu level itu aman: yang seharusnya digambar tetap kosong dan command-nya dijawab `status: false` beserta alasannya. Tanpa level **Halaman peta**, stream pose diam, dan halaman operasi dashboard menyambung ulang setelah sekitar 30 detik tanpa pose. Tambahan opsional yang tidak berpengaruh bila tidak ada: `string/laserscan_holes`, `string/hazard_cells`, `/gps/hdop`, `/gps/satcount`, jarak UWB, target vision, dan topic debugging.

`hw_status` di jawaban ping bernilai `true` hanya selama semua topic liveness segar, jadi bernilai `false` sebelum Initialize.

## Contoh payload {#payloads}

Payload yang sama dengan unit ROS 1 didefinisikan di [Kontrak Pesan](/id/development/message-contracts/); setiap contoh di bawah menautkan ke definisinya. GPS, follower, dan return to home hanya ada di unit msd_system: payload-nya masih draf di sini sampai backend, relay, dan dashboard memakainya, lalu pindah ke Kontrak Pesan.

### MQTT, dashboard ke robot

#### `system_command` {#payload-system-command}

[Envelope command](/id/development/message-contracts/mqtt-commands#command-envelope). Ping, seperti dikirim `backend_node` ([permintaan ping](/id/development/message-contracts/heartbeat-and-lease#ping-request)):

```json
{
  "header": "hardware",
  "command": "ping",
  "data": {
    "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
    "user_id": "01JZ7YV5CQUSER00000000000",
    "claim": true, "release": false, "page": "navigation",
    "origin": "cloud", "force_takeover": false
  },
  "metadata": { "timestamp": "2026-10-21T04:11:52.913Z", "request_id": "6f0c2d7e-1b44-4c55-9f0e-5d2b1a9e8c31" }
}
```

[Frame heartbeat](/id/development/message-contracts/heartbeat-and-lease#heartbeat-frame) dari browser, tiap 0,2 detik:

```json
{ "header": "hardware", "command": "heartbeat", "metadata": { "request_id": "heartbeat" }, "data": { "page": "navigation" } }
```

Command yang dilayani bridge, semuanya dalam envelope yang sama:

| `header` | `command` | `config` atau `data` |
| --- | --- | --- |
| `hardware` | `ping`, `heartbeat`, `check`, `init`, `stop`, `idle` | tidak ada, kecuali `ping` dan `heartbeat` di atas |
| `hardware` | `battery_update` | `"config": { "resource": { "value": 87 } }` |
| `emergency_stop` | `activate`, `deactivate` | tidak ada |
| `manual` | `enable`, `disable` | tidak ada |
| `follower` | `start` | opsional `"data": { "sources": ["uwb"] }`, salah satu dari `vision`, `uwb` sesuai urutan prioritas |
| `follower` | `stop` | tidak ada |
| `rth` | `mark_home`, `go_home`, `cancel` | tidak ada |
| `navigation` | `init`, `deactivate`, `pointstamped` | seperti ROS 1 ([Command MQTT](/id/development/message-contracts/mqtt-commands)) |
| `mapping` | `start`, `pause`, `stop`, `discard` | seperti ROS 1, dengan event `mapping_progress` yang sama |
| `boustrophedon` | `init`, `pause`, `deactivate` | seperti ROS 1: `use_autocover`, `polygon`, `areas`, `exclusions`, `pause` |
| `autoalign` | `start`, `reset`, `status` | tidak ada |
| `autopilot` | `enable`, `disable` | tidak ada |

```json
{ "header": "follower", "command": "start", "data": { "sources": ["uwb"] },
  "metadata": { "timestamp": "2026-10-21T04:12:03.120Z", "request_id": "c3a1e0b2-7d9f-4e1a-8b6c-2f4d5e6a7b8c" } }
```

#### `string/key_vel` {#payload-key-vel}

[JSON twist](/id/development/message-contracts/bridge-topics#json-twist). Bridge hanya membaca `linear.x` dan `angular.z`:

```json
{ "linear": { "x": 0.4, "y": 0.0, "z": 0.0 }, "angular": { "x": 0.0, "y": 0.0, "z": 1.0 } }
```

#### `string/map_request` {#payload-map-request}

Payload apa pun dihitung; dashboard mengirim ([pengiriman peta](/id/development/message-contracts/bridge-topics#map-delivery)):

```json
{ "reason": "map-init", "at": 1792555923120 }
```

### MQTT, robot ke dashboard

#### `system_feedback` {#payload-system-feedback}

[Envelope feedback](/id/development/message-contracts/mqtt-commands#feedback-envelope). Jawaban biasa:

```json
{ "header": "follower", "command": "start",
  "data": { "status": true, "message": "Following (sources: uwb, goals in odom)" },
  "metadata": { "timestamp": 1792555923.42, "request_id": "c3a1e0b2-7d9f-4e1a-8b6c-2f4d5e6a7b8c" } }
```

Jawaban ping ([respons ping](/id/development/message-contracts/heartbeat-and-lease#ping-response)) membawa satu field yang tidak dikirim unit ROS 1, `capabilities`:

```json
{
  "header": "hardware", "command": "ping",
  "data": {
    "status": true, "robot_activity": "hardware_ready", "active_page": "navigation",
    "battery": 0.0, "uptime": 42, "hw_status": true,
    "manual_override": false, "autopilot": false, "active_map_id": null,
    "in_use": false, "in_use_by": null, "origin_conflict": false, "origin_conflict_side": null,
    "motion_locked": false,
    "capabilities": ["autopilot", "coverage", "autoalign", "gps", "follower", "rth"]
  },
  "metadata": { "timestamp": 1792555912.95, "request_id": "6f0c2d7e-1b44-4c55-9f0e-5d2b1a9e8c31" }
}
```

`capabilities` berisi fitur opsional yang dilayani unit ini; unit ROS 1 tidak mengirimnya, yang dibaca sebagai `["autopilot", "coverage", "autoalign"]`. `battery` tetap `0.0` sampai ada yang mengirim `battery_update`. Nilai `robot_activity` baru: `following`, `follower_target_lost`, `returning_home`, `returned_home`. `stuck` dilaporkan seperti di ROS 1: dalam aktivitas yang mengharapkan gerak, robot yang tidak bergerak 0,15 m dalam 20 detik (60 detik sebelum gerak pertamanya) terbaca `stuck`, sementara `active_page` tetap mengikuti aktivitas sebenarnya.

#### `string/robotpose` {#payload-robotpose}

[JSON pose](/id/development/message-contracts/bridge-topics#json-pose), dari TF `map` → `base_link`:

```json
{"position":{"x":1.234,"y":-0.5,"z":0.0},"orientation":{"x":0.0,"y":0.0,"z":0.382683,"w":0.92388}}
```

#### `string/laserscan` dan `string/laserscan_holes` {#payload-laserscan}

`base64(zlib(Q1))` ([format terkompresi](/id/development/message-contracts/bridge-topics#compressed-formats)). Scan 8 beam, dibuat dengan encoder bridge sendiri:

```text
eJwLNLzN73ngyWkxByBtzwAB9mfPnLFlYFjgyAHkcDIkJRanxudk5mXXMvz/H8JoByQPMp0AkgBgUhX9
```

Hasil decode: magic `Q1`, `angle_min` -3,1416, `angle_max` 2,3562, `angle_increment` 0,7854, `time_increment` 0, `scan_time` 0,5, `range_min` 0,1, `range_max` 20,0, 8 beam, frame `base_link`, lalu satu uint16 little-endian per beam dalam sentimeter: `125, 65535, 340, 62, 65535, 705, 200, 65535` (65535 = tidak ada pantulan). Scan sungguhan berisi 720 beam.

#### `string/hazard_cells` {#payload-hazard-cells}

`base64(zlib(JSON))` dari `nav_msgs/Path` di `map`, satu pose per sel lubang:

```text
eJy9TssOAiEQ+5XNnJUMu64af8UYQ9wxcuAhbOKD8O8OBA/e1QvTlrZpggupiQLsugSRrnxx0UGclfFNO0UGcrNdjzhI2fOvbSJmJuegDB31xByM8lA07yIVwz79rL6mGehZO1vJnd9eDCMbHgyXUmDBz9IkapcLmuysPhLY7Pi28r2VRTlz5P/7V1/cf8gvYOmDeA==
```

Hasil decode:

```json
{"header": {"seq": 0, "stamp": {"secs": 1786503112, "nsecs": 0}, "frame_id": "map"},
 "poses": [
  {"header": {"seq": 0, "stamp": {"secs": 1786503112, "nsecs": 0}, "frame_id": "map"},
   "pose": {"position": {"x": 2.35, "y": -1.05, "z": 0.0}, "orientation": {"x": 0, "y": 0, "z": 0, "w": 1}}},
  {"header": {"seq": 0, "stamp": {"secs": 1786503112, "nsecs": 0}, "frame_id": "map"},
   "pose": {"position": {"x": 2.45, "y": -1.05, "z": 0.0}, "orientation": {"x": 0, "y": 0, "z": 0, "w": 1}}}]}
```

#### `string/map` {#payload-map}

`base64(zlib(M1))`. Grid 4 kali 3:

```text
eJzzNTx75owtCwMDAzMQnz3js2/WTMl9DBigwR6Zd+J+dRYDWE9uYsF/BoYUIDvlP5ABAJU+ECY=
```

Hasil decode: magic `M1`, resolusi 0,1, lebar 4, tinggi 3, origin (-0,2, -0,15, 0,0) dengan orientasi identitas, frame `map`, lalu 12 sel int8 baris demi baris dari origin: `-1 0 0 100 / 0 0 0 100 / -1 -1 0 0` (-1 tidak diketahui, 0 kosong, 100 terisi). Grid 0x0 `eJzzNWSgADAz5CYWAAAjlAHA` adalah sinyal retire, bukan peta rusak ([pengiriman peta](/id/development/message-contracts/bridge-topics#map-delivery)).

#### `string/gps` {#payload-gps}

Draf, hanya msd_system.

```json
{"status":0,"lat":-6.89123,"lon":107.61045,"alt":760.12,"hdop":0.84,"sats":14,"heading_deg":12.5,"age_s":0.3}
```

| Field | Arti |
| --- | --- |
| `status` | `sensor_msgs/NavSatStatus`: -1 tanpa fix, 0 fix, 1 SBAS, 2 GBAS. Fix yang lebih tua dari 3 detik dibaca -1 |
| `lat`, `lon`, `alt` | derajat, derajat, meter; `null` bila `status` -1 |
| `hdop`, `sats` | `null` tanpa `/gps/hdop` atau `/gps/satcount` (simulator) |
| `heading_deg` | arah kompas dari `/msd_hardware/imu/data`, 0 = utara, searah jarum jam; `null` tanpa itu |
| `age_s` | detik sejak pesan fix terakhir |

Tidak ada yang dikirim sebelum pesan fix pertama.

#### `string/follower_status` {#payload-follower-status}

Draf, hanya msd_system.

```json
{"state":"following","source":"uwb","target":{"x":3.2,"y":-0.4,"frame":"odom"},"uwb_range_m":2.85}
```

| Field | Arti |
| --- | --- |
| `state` | `following`, `target_lost`, `stopped` |
| `source` | sumber yang sedang segar: `vision`, `uwb`, atau kosong |
| `target` | goal yang dituju robot, di frame `/state_estimation`; `null` kecuali sedang mengikuti |
| `uwb_range_m` | jarak ke tag UWB; `null` tanpa pembacaan dalam 2 detik terakhir |

#### `string/rth_status` {#payload-rth-status}

Draf, hanya msd_system. Status msd_rth dengan session id dari bridge:

```json
{"state":"RETURNING_HOME","session_id":"01M5C39HBDDTJ45SHG79AGX383","waypoint_index":3,"total_waypoints":12,"distance_to_next_m":1.7}
```

`state` adalah `IDLE`, `RETURNING_HOME`, atau `HOME`. Tiga field rute hanya ada selama pulang.

#### `string/rth_path` {#payload-rth-path}

Draf, hanya msd_system. Sesi yang terekam, yaitu rute yang ditelusuri balik saat pulang: `base64(zlib(JSON))` dari `nav_msgs/Path` di `map`, format yang sama dengan [`string/hazard_cells`](#payload-hazard-cells). Bridge membaca berkas lintasan msd_rth (frame GNSS `gps_map`), menyisakan titik yang berjarak minimal 0,25 m (paling banyak 1000), dan memindahkannya ke `map` lewat TF; path kosong saat sesi berakhir.

### Topic ROS 2

Ditampilkan seperti keluaran `ros2 topic echo`, diringkas.

#### `webui/motion_lock` dan `webui/guard_heartbeat` {#payload-motion-lock}

```yaml
# webui/motion_lock (std_msgs/Bool): true menahan robot
data: true
---
# webui/guard_heartbeat (std_msgs/Empty): pesannya sendiri adalah sinyalnya
{}
```

#### `webui/manual_vel`, `mux/cmd_vel`, dan `cmd_vel` {#payload-cmd-vel}

Ketiganya `geometry_msgs/TwistStamped`; hanya `linear.x` dan `angular.z` yang dipakai.

```yaml
header:
  stamp: {sec: 1792555923, nanosec: 120000000}
  frame_id: base_link
twist:
  linear: {x: 0.4, y: 0.0, z: 0.0}
  angular: {x: 0.0, y: 0.0, z: 1.0}
```

#### `webui/guard_state` {#payload-guard-state}

```json
{"state": "bridge_heartbeat_lost"}
```

`state` bernilai `pass`, atau alasan `cmd_vel` nol: `motion_lock`, `another_cmd_vel_publisher`, `bridge_heartbeat_lost`, `no_fresh_command`.

#### `webui/watchdog_status` {#payload-watchdog-status}

```json
{"alive": 5120, "interval": 0.2, "presence_age": 0.18, "operation_age": 0.18,
 "operation_page": "navigation", "activity": "manual", "autopilot": false, "manual_override": true,
 "state": "manual_override", "lock_holders": [],
 "tiers": {"pause": {"threshold": 2.0, "fired": false},
           "idle": {"threshold": 600.0, "fired": false},
           "shutdown": {"threshold": 1800.0, "fired": false}},
 "errors": 0, "last_error": null, "viewers": "driving"}
```

`state` salah satu dari `starting`, `disabled`, `autopilot_suspended`, `operator_paused`, `no_operation`, `manual_override`, `paused_ping_loss`, `supervised`. `lock_holders` menyebut siapa yang memegang motion lock (`emergency_stop`, `ping_watchdog`, `hardware_shutdown`). `viewers` adalah profil egress: `idle`, `watching`, atau `driving`.

#### `webui/scan`, `webui/map`, dan `webui/hazard_cells` {#payload-view-topics}

```yaml
# webui/scan (sensor_msgs/LaserScan); webui/scan_holes berbentuk sama
header: {frame_id: base_link}
angle_min: -3.14159
angle_max: 3.13286
angle_increment: 0.00873   # 720 beam
range_min: 0.1
range_max: 20.0
ranges: [.inf, .inf, 3.42, 3.40, ...]
---
# webui/map (nav_msgs/OccupancyGrid), latched
header: {frame_id: map}
info:
  resolution: 0.1
  width: 812
  height: 640
  origin: {position: {x: -40.6, y: -32.0, z: 0.0}, orientation: {w: 1.0}}
data: [-1, -1, 0, 0, 100, ...]
---
# webui/hazard_cells (nav_msgs/Path), latched: satu pose per sel lubang, pusat sel 0,10 m
header: {frame_id: map}
poses:
- pose: {position: {x: 2.35, y: -1.05, z: 0.0}, orientation: {w: 1.0}}
```

#### `/way_point`, `webui/follower/way_point`, dan `webui/rth/way_point` {#payload-way-point}

`geometry_msgs/PointStamped`, di frame `/state_estimation`:

```yaml
header:
  stamp: {sec: 1792555930, nanosec: 0}
  frame_id: odom
point: {x: 3.2, y: -0.4, z: 0.0}
```

Goal parkir adalah pesan yang sama di posisi `/state_estimation` terakhir robot.

#### `webui/rth/command` dan `webui/rth/status` {#payload-rth-topics}

`std_msgs/String` dengan JSON di `data`:

```json
{"command": "start_session", "session_id": "01M5C39HBDDTJ45SHG79AGX383"}
{"command": "go_home", "session_id": "01M5C39HBDDTJ45SHG79AGX383"}
{"command": "cancel"}
```

`webui/rth/status` adalah status msd_rth sendiri pada 5 Hz, sumber dari [`string/rth_status`](#payload-rth-status).

## Command

`webui_bridge` berlangganan `/unit_<ULID>/system_command` di kedua broker dan menjawab di `system_feedback`, dengan envelope, dedupe request-id, dan aturan lease yang sama seperti `system_command.py` (lihat [Command MQTT](/id/development/message-contracts/mqtt-commands) dan [Heartbeat & Lease](/id/development/message-contracts/heartbeat-and-lease)).

| Header | Status | Catatan |
| --- | --- | --- |
| `hardware` (`ping`, `heartbeat`, `check`, `init`, `stop`, `idle`, `battery_update`) | selesai | `init` dan `stop` menyalakan dan mematikan `hardware_prototype.launch.py` bila `hardware_managed` diset (profil prototype); hardware yang dinyalakan manual dibiarkan. Profil sim hanya melaporkan liveness |
| `emergency_stop`, `manual` | selesai | Lihat [Rantai keselamatan](#safety-chain) |
| `follower` (`start`, `stop`), `rth` (`mark_home`, `go_home`, `cancel`) | selesai | Hanya bila tercantum di `capabilities`. Satu sumber goal pada satu waktu; `follower.start` juga memulai rekaman RTH bila belum ada sesi |
| `navigation` (`init`, `deactivate`, `pointstamped`) | selesai | `init` mengunduh peta bila belum ada, menyalakan mode `navigation`, dan mengirim home base sebagai `/initialpose`. Goal datang lewat `string/move_base/goal`: ACTIVE, SUCCEEDED dalam 0,6 m, ABORTED setelah 20 detik tanpa kemajuan 0,2 m, PREEMPTED, REJECTED tanpa navigasi, saat emergency stop, atau selama coverage berjalan |
| `mapping` (`start`, `pause`, `stop`, `discard`) | selesai | `start` ditolak bila peta tidak bisa disimpan. `stop` menulis `<peta>.pgm/.yaml` (diunggah) dan `<peta>.pcd` (tetap di robot); simpan yang gagal membiarkan run tetap terbuka |
| `boustrophedon` (`init`, `pause`, `deactivate`) | selesai | Butuh peta yang terbuka di halaman Navigation. Manual override menjeda run dan melanjutkannya saat dilepas |
| `autoalign` (`start`, `reset`, `status`) | selesai | `scan_aligner`; tidak menggerakkan roda |
| `autopilot` (`enable`, `disable`) | selesai | Menangguhkan tingkat kehadiran; supervisor operasi menjalankan run multi pinpoint saat dashboard ditutup |

`boustrophedon`, `autoalign`, dan `autopilot` hanya dilayani bila tercantum di `capabilities` (kedua profil mencantumkannya); kalau tidak, unit langsung menjawabnya dengan alasan, supaya dashboard tidak menunggu 30 detik sampai 504. Command yang hanya membongkar sesuatu (`deactivate`, `discard`, `reset`) berhasil sebagai no-op, sehingga alur logout tidak menampilkan error. Follower dan RTH menolak selama emergency stop atau Manual Override menyala, dan tanpa `/state_estimation`; `go_home` juga butuh fix GPS dan sesi yang terekam.

## Rantai keselamatan {#safety-chain}

![Rantai penggerak dan motion guard](../../../development/ros/diagrams/ros2-web-ui-bridge-drive-chain-and-motion-guard.drawio)

`hardware_interface_node` meneruskan setiap `cmd_vel` ke MCU tanpa timeout, dan firmware menyimpan kecepatan roda terakhir selamanya, sehingga node yang macet akan membiarkan robot tetap melaju. `motion_guard` mencegahnya. Ia menerbitkan pada 20 Hz, selalu, dan mengirim nol kecuali keempat syarat ini terpenuhi:

- motion lock (`webui/motion_lock`) dilepas;
- heartbeat bridge (`webui/guard_heartbeat`, 5 Hz) berumur kurang dari 0,6 detik;
- `mux/cmd_vel` berumur kurang dari 0,3 detik;
- ia satu-satunya publisher `cmd_vel`.

Karena itu `twist_mux` menerbitkan ke `mux/cmd_vel`, bukan `cmd_vel`, dan membawa dua entri web UI di samping entri navigasi dan teleop: input `webui/manual_vel` (prioritas 90, timeout 0,5) dan lock `webui/motion_lock` (prioritas 255). `msd_webui_bridge/config/twist_mux_webui.yaml` adalah file acuan; di robot, `hardware_prototype.launch.py` menyetel keduanya tanpa mengubah bringup.

| Tingkat | Pemicu | Efek |
| --- | --- | --- |
| Pause | Tanpa kehadiran selama 2 detik (`ping_pause_timeout`, dicek setiap 0,2 detik) | Menahan motion lock. Ping atau heartbeat berikutnya melepasnya |
| Idle | Tanpa kehadiran selama 10 menit (`ping_timeout`) | Lease dilepas; mode, follower, dan perjalanan pulang dihentikan |
| Shutdown | Tanpa kehadiran selama 30 menit (`ping_shutdown_timeout`) | Lease dilepas, hardware dihentikan dengan lock tetap menyala. Tidak pulih saat koneksi kembali |

Nilainya sama dengan watchdog ROS 1 di [Pengawas Keselamatan](/id/development/ros/safety-watchdog). Emergency stop adalah satu key pada motion lock yang sama, disimpan di `~/.msd_webui/estop.json`, sehingga restart bridge tidak dapat melepasnya dan manual override tidak dapat mengemudi keluar darinya. `manual.enable` membuka `webui/manual_vel`; `string/key_vel` dari dashboard tiba pada 10 Hz dan jeda 0,5 detik menghentikan robot.

## Stream peta, scan, dan lubang {#streams}

![Stream peta, scan, dan lubang](../../../development/ros/diagrams/ros2-web-ui-bridge-map-scan-and-hole-streams.drawio)

Pekerjaan 3D tidak dilakukan bridge. Stack CMU sudah mereduksi lidar menjadi `/terrain_map_ext`, sebuah `PointCloud2` di `map` yang `intensity`-nya adalah tinggi di atas tanah lokal. Node view meratakannya menjadi apa yang digambar dashboard, dan bridge hanya meng-encode dan meneruskannya.

| Node | Keluaran | Yang digambar |
| --- | --- | --- |
| `scan_flattener` | `webui/scan`, `webui/scan_holes` (`LaserScan`, 720 beam, `base_link`) | Titik terrain yang lebih tinggi dari `obstacle_height` di atas tanah lokal, terdekat per arah. Tanjakan tetap dianggap lantai. Tanda lubang masuk ke scan kedua |
| `hole_trail` | `webui/hazard_cells` (`nav_msgs/Path`, `map`, latched) | Setiap sel yang ditandai lubang pada run ini, sel 0,10 m, maksimum 1000 seperti ROS 1. Sel disimpan setelah ditandai pada `min_hits` (2) update |
| `grid_mapper` | `webui/map` (`OccupancyGrid`, `map`, latched) | Grid log-odds 0,1 m, tumbuh per chunk hingga 400 m per sisi. Dinding mengeras setelah satu kali terlihat, orang yang lewat memudar kembali menjadi lantai, lubang tidak dimasukkan |

Encoder-nya identik byte per byte dengan `topic2string` di ROS 1, dikunci terhadap keluaran emas dari kode ROS 1 di `test/test_codec.py`. Gerbang egress, heartbeat perubahan, permintaan peta, dan burst tiga pengulangan setelah reset berperilaku seperti dijelaskan di [Topik Bridge](/id/development/message-contracts/bridge-topics#map-delivery) dan [profil egress](/id/development/message-contracts/bridge-topics#egress-profiles): scan berhenti selama tidak ada yang menonton (`idle`), dan bridge yang baru menyala dihitung sebagai menonton selama 15 detik (`viewer_idle_after`). Stream berjalan di callback group sendiri pada `MultiThreadedExecutor`, sehingga kompresi peta besar tidak menunda heartbeat guard.

### Perbedaan dengan ROS 1

Lubang dan rintangan berbagai ketinggian dideteksi oleh `terrain_analysis` CMU, bukan oleh port `hazard_scan` dari [Persepsi & Hazard Scan](/id/development/ros/perception-and-hazard-scan). Web UI hanya menampilkan tanda yang dibuat node itu, yang juga tanda yang dihindari planner. Tiga angka di `msd_webui_views/config/views.yaml` harus sama dengan `terrain_analysis.yaml` robot:

| `views.yaml` | `terrain_analysis.yaml` |
| --- | --- |
| `obstacle_height` | `obstacleHeightThre` |
| `forced_intensity` | `vehicleHeight` |
| `hole_depth` | \|`negObstacleRelZThre`\| |

Dua konsekuensi yang perlu diketahui:

- `negObstacle` bernilai `-1` (mati) di setiap branch yang berisi stack CMU saat ini, sehingga overlay lubang dan jejak lubang tetap kosong sampai tim navigasi menyalakannya.
- `terrain_analysis` menandai lubang per frame. `hazard_scan_node` di ROS 1 mengonfirmasi lubang sebelum melaporkannya. `min_hits` adalah penggantinya, dan perlu ditinjau ulang setelah parameter terrain final.

Peta 2D langsung adalah gambar untuk dashboard, bukan untuk lokalisasi. Peta tersimpan dilokalisasi lewat kembaran 3D-nya (`<peta>.pcd`, [Mode stack navigasi](#stack-modes)); selama peta itu terbuka, `string/map` menampilkan peta tersimpan, bukan grid langsung.

## Yang harus dilakukan bringup

1. Arahkan keluaran `twist_mux` ke `mux/cmd_vel` dan beri dua entri web UI di atas (`hardware_prototype.launch.py` melakukannya di robot).
2. Sertakan `webui.launch.py` (`profile:=sim use_sim_time:=true` di Gazebo).
3. Pastikan tidak ada publisher lain di `cmd_vel`.
4. Serahkan navigasi ke bridge (`run_navigation:=false` di Gazebo): bridge menyalakan stack CMU per mode lewat `msd_bringup.launch.xml`. Stack navigasi yang dinyalakan dengan cara lain dipakai apa adanya, tetapi peta tersimpan lalu tidak dilokalisasi.

Menjalankan `webui.launch.py` di samping bringup yang `twist_mux`-nya masih menulis `cmd_vel` membuat `motion_guard` menahan nol melawannya, sehingga robot tersendat atau berhenti.

## Status

| Bagian | Status |
| --- | --- |
| MQTT, lease, watchdog kehadiran, emergency stop, manual drive, pose robot | selesai, diuji di bangku; belum dijalankan terhadap dashboard asli |
| Stream peta, scan, lubang, dan jejak lubang | selesai, dicek dengan peta terrain sintetis; belum dijalankan di stack CMU, Gazebo, atau robot |
| Layer hardware robot (`hardware_prototype.launch.py`), lidar ke `scan_3d/points` | selesai, dicek di Jazzy dengan driver pengganti; belum dijalankan di robot |
| GPS, follower, dan return to home | selesai, dicek di Jazzy dengan proses follower dan RTH pengganti; stream fitur hanya di broker lokal |
| Navigasi dengan peta tersimpan (M3), mapping (M4), autopilot (M5), eksplorasi (M6), coverage, Auto Align, `stuck` | selesai (2026-10-21), dicek ujung ke ujung di Jazzy dengan `tools/ops_harness/ops_check.py`: bridge, `msd_bringup.launch.xml`, `msd_map_manager`, dan `msd_coverage` asli lewat MQTT, dengan pengganti stack CMU dan robot serta media server tiruan; belum dijalankan di stack CMU, Gazebo, robot, atau dashboard asli |
| `string/rth_path`, kamera bersama (`image_to_v4l2`) | selesai, diuji unit; belum dijalankan dengan msd_rth atau perangkat v4l2loopback |
| Level baterai | tidak tersedia; dilaporkan 0,0 |

Hasil uji bangku di container Jazzy tanpa hardware: input manual berhenti 0,30 detik setelah aliran key berakhir, publisher `cmd_vel` kedua memaksa nol dalam 0,17 sampai 0,52 detik, mematikan `webui_bridge` menghentikan robot dalam 0,53 detik dan mematikan `twist_mux` dalam 0,28 detik. Dengan peta 3072 kali 3072, jeda terpanjang heartbeat guard tetap 0,21 detik.

## Terkait

- [Kontrak Pesan: Topik Bridge](/id/development/message-contracts/bridge-topics)
- [Kontrak Pesan: Command MQTT](/id/development/message-contracts/mqtt-commands)
- [Pengawas Keselamatan](/id/development/ros/safety-watchdog)
- [Persepsi & Hazard Scan](/id/development/ros/perception-and-hazard-scan)
- [Transformasi Koordinat (TF)](/id/development/ros/tf-transforms)
- [Setup Unit § Beralih ke stack ROS 2](/id/setup/unit-setup#ros2-stack)
