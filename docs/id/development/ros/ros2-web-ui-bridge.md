---
outline: deep
search: false
---

# Bridge ROS Web UI untuk ROS 2 (msd_system)

<RoleBadge role="developer" />

Bagaimana robot ROS 2 Jazzy dari `msd_system` tampil di dashboard sebagai **unit** dan dikendalikan darinya. Semuanya ada di `src/msd_webui/` pada workspace tersebut dan memakai kontrak MQTT yang sama dengan unit ROS 1, sehingga dashboard, backend, dan relay cloud tidak perlu diubah. Halaman ini membahas sisi robot; payload-nya ada di [Kontrak Pesan](/id/development/message-contracts/), dan pemakaiannya di dashboard ada di [ROS Web UI](/id/development/webui/).

Folder ini tidak menyalakan robot. Base controller, `twist_mux`, sensor, dan stack navigasi milik bringup robot, dan `webui.launch.py` berjalan di sampingnya. Tidak ada file di luar `src/msd_webui/` yang diubah (`tools/check_additive.sh` gagal kalau ada).

## Paket

| Paket | Node | Peran |
| --- | --- | --- |
| `msd_webui_bridge` | `webui_bridge` | Agen unit: MQTT ke broker lokal dan cloud, penanganan command, lease operasi, watchdog kehadiran, emergency stop, manual drive, pose robot, dan encoder untuk stream peta, scan, dan lubang |
| | `motion_guard` | Titik terakhir sebelum base: satu-satunya node yang menulis `cmd_vel` |
| `msd_webui_views` | `scan_flattener`, `hole_trail`, `grid_mapper` | Apa yang digambar dashboard, dibuat dari peta terrain CMU |

`webui.launch.py` menyalakan semuanya. Argumen: `profile` (`sim` atau `prototype`), `use_sim_time`, `unit_id` atau `cred_dir`, `enable_cloud`, `enable_local`, `guard_input`, `guard_output`, `enable_views`, dan `terrain_topic` (default `/terrain_map_ext`). Unit didaftarkan sekali dengan `scripts/enroll.py` dari ros-web-ui; lihat [Firmware & Enrolment](/id/development/message-contracts/firmware-and-enrolment).

## Command

`webui_bridge` berlangganan `/unit_<ULID>/system_command` di kedua broker dan menjawab di `system_feedback`, dengan envelope, dedupe request-id, dan aturan lease yang sama seperti `system_command.py` (lihat [Command MQTT](/id/development/message-contracts/mqtt-commands) dan [Heartbeat & Lease](/id/development/message-contracts/heartbeat-and-lease)).

| Header | Status | Catatan |
| --- | --- | --- |
| `hardware` (`ping`, `heartbeat`, `check`, `init`, `stop`) | selesai | `init` dan `stop` hanya menyalakan dan mematikan launch bringup kalau `hardware_managed` diset di profil; kalau tidak, bridge hanya melaporkan liveness |
| `emergency_stop`, `manual` | selesai | Lihat [Rantai keselamatan](#safety-chain) |
| `navigation`, `mapping`, `autopilot` | dijawab `status:false` | Milestone M3, M4, dan M5 |
| `boustrophedon`, `autoalign` | dijawab `status:false` | Tidak tersedia di unit msd_system |

Header yang tidak dilayani unit dijawab langsung dengan alasannya, supaya dashboard tidak menunggu 30 detik sampai 504. Command yang hanya membongkar sesuatu (`deactivate`, `discard`, `reset`) berhasil sebagai no-op, sehingga alur logout tidak menampilkan error.

## Rantai keselamatan {#safety-chain}

![Rantai penggerak dan motion guard](../../../development/ros/diagrams/ros2-web-ui-bridge-drive-chain-and-motion-guard.drawio)

`base_controller_node` menyimpan `cmd_vel` terakhir selamanya, dan firmware menyimpan kecepatan roda terakhir selamanya, sehingga node yang macet akan membiarkan robot tetap melaju. `motion_guard` mencegahnya. Ia menerbitkan pada 20 Hz, selalu, dan mengirim nol kecuali keempat syarat ini terpenuhi:

- motion lock (`webui/motion_lock`) dilepas;
- heartbeat bridge (`webui/guard_heartbeat`, 5 Hz) berumur kurang dari 0,6 detik;
- `mux/cmd_vel` berumur kurang dari 0,3 detik;
- ia satu-satunya publisher `cmd_vel`.

Karena itu `twist_mux` menerbitkan ke `mux/cmd_vel`, bukan `cmd_vel`, dan membawa dua entri web UI di samping entri navigasi dan teleop: input `webui/manual_vel` (prioritas 90, timeout 0,5) dan lock `webui/motion_lock` (prioritas 255). `msd_webui_bridge/config/twist_mux_webui.yaml` adalah file acuan.

| Tingkat | Pemicu | Efek |
| --- | --- | --- |
| Pause | Tanpa kehadiran selama 2 detik (`ping_pause_timeout`, dicek setiap 0,2 detik) | Menahan motion lock. Ping atau heartbeat berikutnya melepasnya |
| Idle | Tanpa kehadiran selama 10 menit (`ping_timeout`) | Lease dilepas dan mode dihentikan |
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

`grid_mapper/reset` dan `hole_trail/clear` (`std_srvs/Trigger`) mengosongkan kedua layer.

| Topic ROS 2 | MQTT (`/unit_<ULID>/...`) | Format | Rate default |
| --- | --- | --- | --- |
| `webui/scan` | `string/laserscan` | [Q1](/id/development/message-contracts/bridge-topics#compressed-formats) | 2 Hz |
| `webui/scan_holes` | `string/laserscan_holes` | Q1 | 2 Hz |
| `webui/hazard_cells` | `string/hazard_cells` | path terkompresi | 0,5 Hz, saat berubah |
| `webui/map` | `string/map` | M1 | tiap 5 detik jika berubah, heartbeat 60 detik |
| (MQTT masuk) `string/map_request` | | | dijawab dalam `request_min_interval` |

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

Peta 2D adalah gambar untuk dashboard, bukan untuk lokalisasi. Di msd_system `map` adalah transformasi identitas statis ke `odom`, sehingga peta tersimpan hanya cocok kalau sesi berikutnya dimulai dari pose yang sama. Lokalisasi terhadap peta tersimpan masih terbuka.

## Yang harus dilakukan bringup

1. Arahkan keluaran `twist_mux` ke `mux/cmd_vel` dan beri dua entri web UI di atas.
2. Sertakan `webui.launch.py` (`profile:=sim use_sim_time:=true` di Gazebo).
3. Pastikan tidak ada publisher lain di `cmd_vel`.
4. Jalankan stack CMU di setiap mode yang dipakai web UI: tanpa `/terrain_map_ext` dan TF `map` ke `base_link` dan `base_footprint`, dashboard tidak menampilkan scan maupun peta.

Menjalankan `webui.launch.py` di samping bringup yang `twist_mux`-nya masih menulis `cmd_vel` membuat `motion_guard` menahan nol melawannya, sehingga robot tersendat atau berhenti.

## Status

| Bagian | Status |
| --- | --- |
| MQTT, lease, watchdog kehadiran, emergency stop, manual drive, pose robot | selesai, diuji di bangku; belum dijalankan terhadap dashboard asli |
| Stream peta, scan, lubang, dan jejak lubang | selesai, dicek dengan peta terrain sintetis; belum dijalankan di stack CMU, Gazebo, atau robot |
| Navigasi dengan peta tersimpan (M3), mapping (M4), autopilot (M5) | belum dimulai; dijawab `status:false` |
| Level baterai, aktivitas `stuck` | tidak tersedia; baterai dilaporkan 0,0 |

Hasil uji bangku di container Jazzy tanpa hardware: input manual berhenti 0,30 detik setelah aliran key berakhir, publisher `cmd_vel` kedua memaksa nol dalam 0,17 sampai 0,52 detik, mematikan `webui_bridge` menghentikan robot dalam 0,53 detik dan mematikan `twist_mux` dalam 0,28 detik. Dengan peta 3072 kali 3072, jeda terpanjang heartbeat guard tetap 0,21 detik.

## Terkait

- [Kontrak Pesan: Topik Bridge](/id/development/message-contracts/bridge-topics)
- [Kontrak Pesan: Command MQTT](/id/development/message-contracts/mqtt-commands)
- [Pengawas Keselamatan](/id/development/ros/safety-watchdog)
- [Persepsi & Hazard Scan](/id/development/ros/perception-and-hazard-scan)
- [Transformasi Koordinat (TF)](/id/development/ros/tf-transforms)
