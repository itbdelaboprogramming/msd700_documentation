---
outline: deep
search: false
---

# Diagnostik dan Troubleshooting Pengembang

<RoleBadge role="developer" />

Dokumen ini menyediakan alur kerja diagnostik terstruktur, pemetaan gejala-ke-penyebab, dan prosedur pemulihan untuk mengatasi masalah engineering umum di seluruh stack MSD700.

::: info Kepemilikan
Tiga halaman troubleshooting berbagi gejala per peran: [User Guide](/id/user-guide/troubleshooting) memegang perbaikan operator, [Setup Troubleshooting](/id/setup/troubleshooting) memegang perbaikan teknisi, dan halaman ini memegang root cause. Perbaiki gejala di halaman peran yang memperbaikinya; tautkan, jangan duplikasi.
:::

## Diagram Alur Diagnostik Sistematis

![Diagram Alur Diagnostik Sistematis](../../development/diagrams/troubleshooting-guide-systematic-diagnostic-flowchart.drawio)

## Mode Kegagalan Umum dan Solusi

### 1. Unit Tampak Offline (Lapisan Broker MQTT)
- **Gejala**: Badge status unit pada dashboard menampilkan `offline`.
- **Akar Penyebab**: Robot fisik tidak dapat membangun koneksi TLS terenkripsi ke HiveMQ port 8883.
- **Langkah Diagnostik**:
  1. Periksa status kontainer HiveMQ di server: `docker ps | grep hivemq`.
  2. Verifikasi bahwa keystore sertifikat TLS (`/srv/msd/secrets/hivemq/keystore.p12`) valid dan dapat dibaca oleh UID 1001.
  3. Pada robot, periksa log bridge MQTT: `tmux attach -t robot_services` dan periksa window `aws_mqtt`.

### 2. Unit Online, Tetapi Map Canvas Tetap Kosong (rosbridge / Kontainer Relay)
- **Gejala**: Perintah berhasil, tetapi tidak ada peta, ikon robot, atau laser scan yang muncul di canvas web.
- **Akar Penyebab**: Kontainer fleet relay (`ros_web_ui_v2_unit_relays`) mati (atau, pada jalur per-unit legacy, kontainer on-demand `rosweb_unit_<u>_<unit>_nakayama` dihentikan oleh idle reaper) atau proxy WebSocket Apache terblokir.
- **Langkah Diagnostik**:
  1. Periksa fleet relay lebih dulu: `docker ps | grep unit_relays`. Pada jalur legacy, periksa kontainer per-unit sebagai gantinya: `docker ps | grep rosweb_unit`.
  2. Hanya pada jalur legacy: muat ulang halaman unit di browser untuk memicu event `touch` di `unit_manager.js`. Pada mode fleet roster berasal dari tabel `units`, sehingga tidak perlu event touch: robot yang terdaftar dapat dijangkau.
  3. Uji konektivitas WebSocket ke `/services/rosbridge` menggunakan developer tools browser.

### 3. Navigasi Membeku dengan Error TF (Basi-nya `use_sim_time`)
- **Gejala**: Robot menolak bergerak, dan log konsol menampilkan peringatan TF berulang yang menyebut "simulated time" atau `TF_OLD_DATA`.
- **Akar Penyebab**: `/use_sim_time` diset ke `true` pada ROS master oleh sebuah run simulasi, tetapi tidak ada publisher `/clock` selama operasi robot nyata.
- **Resolusi**:
  ```bash
  rosparam set /use_sim_time false
  ```
  Restart stack bringup robot. Perhatikan bahwa me-restart node saja tidak akan membersihkan parameter ini karena berada langsung pada `roscore`.

### 4. Video Stream Macet atau Gagal pada Wi-Fi Lokal (Error Kandidat mDNS)
- **Gejala**: Video WebRTC gagal terhubung pada jaringan lokal dengan `Errno 19: No such device`.
- **Akar Penyebab**: Chrome memancarkan nama kandidat mDNS `.local` yang menjaga privasi. Ketika robot tidak memiliki gateway internet, `aioice` gagal saat mencoba bergabung ke multicast DNS.
- **Resolusi**: Verifikasi bahwa `camera_client.py` berisi filter `_strip_mdns_candidates()` dan bahwa variabel konfigurasi ICE lokal (`LOCAL_STUN_URLS`, `LOCAL_TURN_URL`) diset ke `none`.

### 5. Deadlock Keep-Out Costmap
- **Gejala**: Goal diterima oleh `move_base`, tetapi robot tidak pernah maju.
- **Akar Penyebab**: `keepout_layer` diaktifkan di `costmap_common_params_field.yaml` tetapi menunggu `/msd700/keepout_grid`. Jika tidak ada keep-out grid yang dipublikasikan, costmap tidak pernah ditandai "current".
- **Resolusi**: Pastikan `path_coverage_node` atau `system_command.py` mempublikasikan keepout grid kosong saat inisialisasi.

### 6. Sinkronisasi Lokal Melaporkan "Access Denied" (Drift Kredensial Database Lokal)
- **Gejala**: Log sinkronisasi Local Mode menampilkan `Access denied for user '<MYSQL_USER>'@'127.0.0.1' (using password: YES)`, yang secara historis salah dilabeli sebagai gagal pada fase `handshake` padahal cloud dapat dijangkau.
- **Akar Penyebab**: `docker/.env` pada unit adalah git-tracked dan per-host. Jika `MYSQL_USER`/`MYSQL_PASSWORD` di sana berubah (sebuah `git pull`, atau edit manual) setelah volume `mysql_data_local` milik unit sudah diinisialisasi, MySQL tetap menyimpan password lama yang dipanggang ke dalam data directory; ia tidak secara retroaktif mengadopsi yang baru. `sync_agent.js` kemudian gagal pada pembacaan `sync_state` lokal pertamanya sendiri dengan `ER_ACCESS_DENIED_ERROR`, bukan error konektivitas cloud. Lihat [Sinkronisasi Data: Klasifikasi Kegagalan](/id/development/data-sync#klasifikasi-kegagalan) untuk bagaimana ini sekarang dibedakan dari pemadaman cloud yang sesungguhnya.
- **Langkah Diagnostik**:
  1. Pada unit: `cat docker/.env | grep MYSQL_` dan periksa apakah nilainya terlihat baru saja berubah (misalnya tepat setelah `git pull`).
  2. Konfirmasi ketidakcocokan secara langsung: `docker exec -it <local_db_container> mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD"`: `Access denied` secara manual mengonfirmasi adanya drift, bukan gangguan sesaat.
- **Resolusi**: Kembalikan `docker/.env` ke password yang menjadi dasar inisialisasi volume tersebut, atau, jika rotasi memang disengaja, jalankan `ALTER USER '<user>'@'%' IDENTIFIED BY '<new_password>';` terhadap MySQL lokal sebagai root agar database cocok dengan nilai `.env` yang baru. Jangan menghapus `mysql_data_local` untuk "memperbaiki" ini; itu adalah satu-satunya salinan lokal milik unit atas peta/rute yang belum tersinkronisasi ke cloud, dan mode kegagalan ini berarti sinkronisasi itu sendiri saat ini tidak berfungsi.

### 7. Dashboard Cloud Tidak Memiliki Topik Live (ROS Master Dibajak oleh Port yang Di-forward)
- **Gejala**: Dashboard cloud menampilkan status, aktivitas, dan peta tersimpan secara normal, tetapi tidak ada yang live: tidak ada peta saat mapping, tidak ada lidar, tidak ada pose robot. Dashboard lokal unit itu sendiri berfungsi dengan sempurna. Kontainer backend masih melaporkan `Up`.
- **Akar Penyebab**: Sebuah stack unit mendaftar pada ROS master **cloud** alih-alih miliknya sendiri, dan ROS mematikan node yang lebih lama setiap kali sebuah nama diklaim dua kali, sehingga server kehilangan `/rosbridge_websocket` (dan `/backend_node`) miliknya. Jalur masuk yang biasa adalah sesi VS Code Remote atau `ssh -L` yang mem-forward port master server ke sebuah laptop, yang membuat master jarak jauh menjawab pada `localhost`. Unit sekarang menggunakan `11321`/`11322` dan `run_msd.sh` menolak master yang bukan miliknya, tetapi sebuah override atau checkout pra-fix masih bisa sampai ke sana.
- **Langkah Diagnostik**:
  1. Jalankan `scripts/ros_doctor.sh` di kontainer backend. Ini menyebutkan pemilik master, mendaftar node yang terdaftar dari host yang tidak dapat dijangkau mesin ini, dan mengatakan apakah ada sesuatu yang listen di port rosbridge.
  2. Tandanya adalah sebuah node rosbridge yang TERDAFTAR tetapi dari hostname asing, di samping hampir tidak ada yang listen di 9090/9091.
  3. `docker ps` menampilkan kontainer backend `unhealthy` setelah healthcheck rosbridge-nya sempat diberi waktu untuk gagal.
- **Resolusi**: Perbaiki `ROS_MASTER_URI` pada mesin yang nyasar (tutup port forward tersebut), lalu `rosnode cleanup` di server dan restart kontainer backend. Me-restart lebih dulu hanya memulai perebutan nama.

## Dokumentasi Terkait

- [Arsitektur](/id/development/architecture): Model komunikasi dua kanal.
- [Kontrak Pesan](/id/development/message-contracts): Format topik dan payload yang diharapkan.
- [Setup: Troubleshooting](/id/setup/troubleshooting): Langkah troubleshooting untuk teknisi dan deployment.
