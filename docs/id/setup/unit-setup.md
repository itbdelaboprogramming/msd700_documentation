---
outline: deep
---

# Penyiapan Unit

<RoleBadge role="technician" />

Panduan ini memberikan instruksi langkah demi langkah untuk memasang dan mengonfigurasi **Unit MSD700** (robot fisik yang berjalan pada single-board computer NVIDIA Jetson).

Pastikan sudah ada [Server MSD700](/id/setup/server-setup) yang berjalan sebelum melanjutkan.

::: info Arsitektur Mengutamakan Produksi
Panduan ini secara default melakukan deployment robot perangkat keras sungguhan yang terhubung ke **Cloud Produksi**. Opsi simulasi (`--simulator`) dan routing cloud pengembangan (`--dev`) ada di bagian [Konfigurasi Lanjutan](#advanced-configurations).
:::

## Topologi Sistem

![Arsitektur Sistem MSD700](/images/MSD700-System-Diagram.jpg)



## Ikhtisar Struktur Direktori

Workspace Jetson mengelola paket robot, jembatan (bridge) web, dan web UI onboard sebagai submodule:

```
~/msd700_noetic/                              # Main Jetson Orchestration Workspace
├── setup.sh                                  # Host Dependency Installer (Docker, xhost)
├── scripts/
│   └── docker-manager.sh                     # Core Lifecycle CLI (build, up, down, logs)
├── docker/
│   ├── Dockerfile                            # ROS 1 Noetic Desktop Full Container
│   ├── docker-compose.yml                    # Robot Container Definition
│   └── .env                                  # Local Environment Variables
└── src/                                      # Catkin Workspace Submodules
    ├── msd700_robot/                         # Navigation, EKF Control, Hardware Drivers
    ├── ros-web-ui/                           # Web Bridges, MQTT nodes, System Command
    └── ROS-dashboard-next-ts/                # Local Operator Web Dashboard
```

---

## Langkah Inti Penyiapan Bertahap

Ikuti 6 langkah berikut secara berurutan untuk menyiapkan robot fisik, termasuk menyediakan hotspot WiFi-nya sendiri.

### Langkah 1: Clone Workspace dan Repositori Sumber

Clone workspace orkestrasi `msd700_noetic`, lalu clone tiga repositori yang diperlukan ke dalam direktori `src/`:

```bash
# 1. Clone orchestration workspace
git clone git@github.com:itbdelaboprogramming/msd700_noetic.git ~/msd700_noetic
cd ~/msd700_noetic

# 2. Clone source packages into src/ on branch v2
git clone -b v2 git@github.com:itbdelaboprogramming/msd700_robot.git src/msd700_robot
git clone -b v2 git@github.com:itbdelaboprogramming/ros-web-ui.git src/ros-web-ui
git clone -b v2 git@github.com:itbdelaboprogramming/ROS-dashboard-next-ts.git src/ROS-dashboard-next-ts
```

::: tip Mengapa harus di-clone secara manual ke dalam `src/`?
`msd700_noetic` mengabaikan `src/*/` di dalam `.gitignore`-nya untuk menghindari konflik Git-in-Git dan memungkinkan setiap sub-repositori dikelola pada branch independennya masing-masing.
:::

---

### Langkah 2: Penyiapan Host Satu Kali

Jalankan skrip penyiapan host untuk mengonfigurasi izin grup Docker dan graphics forwarding:

```bash
cd ~/msd700_noetic
./setup.sh
```

::: warning Terapkan Izin Grup
Jika skrip menambahkan pengguna Anda ke grup `docker`, log out lalu login kembali, atau jalankan:
```bash
newgrp docker
```
:::

---

### Langkah 3: Tinjau Konfigurasi Environment (`docker/.env`)

Pada peluncuran pertama, `./scripts/docker-manager.sh` secara otomatis membuat `docker/.env` dari `docker/.env.example` dan menghasilkan password MySQL lokal yang aman dan hanya-loopback (`ensure_local_secrets`).

Jika Anda ingin mengonfigurasi atau meninjau pengaturan secara manual sebelum peluncuran:

```bash
cd ~/msd700_noetic
cp docker/.env.example docker/.env
nano docker/.env
```

Pengaturan penting di `docker/.env`:

```ini
# Storage path for map occupancy grids on the Jetson
MAPS_FOLDER_LOCAL=/home/ubuntu/ros_maps

# Local User UID/GID (leave blank to auto-detect from host `id -u` / `id -g`: Jetson=2002, dev=1000)
USER_UID=
USER_GID=

# Gazebo simulator support (set to true only for machines without MSD700 hardware)
WITH_SIMULATOR=false

# Leave UNIT_ID empty; assigned and cached automatically during cloud enrolment
UNIT_ID=

# Local Ports (Default settings for on-board local stack)
MYSQL_PORT_LOCAL=3306
MOSQUITTO_PORT_LOCAL=1883
BACKEND_PORT_LOCAL=5002
ROSBRIDGE_PORT_LOCAL=9090
FRONTEND_PORT_LOCAL=3000
MEDIA_SERVER_PORT_LOCAL=3003
SIGNALLING_PORT_WS_LOCAL=3001
SIGNALLING_PORT_HTTP_LOCAL=3002
NETWORK_AGENT_PORT_LOCAL=5011

# Optional: static IP hint (the dashboard dynamically adapts to operator browser address)
#LOCAL_IP=192.168.4.1
```

::: info Routing Koneksi Cloud
Parameter koneksi cloud (Cloud Produksi `https://msd.nglobal.jp/services` atau Cloud Dev melalui `--dev`) dikelola secara otomatis oleh `docker-manager.sh` selama peluncuran dan enrolment, dan tidak dikonfigurasi di `docker/.env`.
:::

---

### Langkah 4: Build Image Docker Robot

Build container runtime robot ROS Noetic:

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh build
```

Ini membangun image `msd700:latest` yang berisi ROS Noetic, stack navigasi, driver sensor, dan jembatan web.

---

### Langkah 5: Jalankan Robot dan Selesaikan Enrolment

Jalankan stack robot dalam mode detached:

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh up -d
```

#### Alur Enrolment Otomatis:
1. Pada peluncuran pertamanya, robot menghubungi server cloud dan menampilkan **Claim Code** 6 karakter (misalnya `K7M2QP`).
2. Seorang administrator membuka `https://msd.nglobal.jp/admin` dan login.
3. Di bawah **Pending Units**, temukan claim code yang sesuai, tetapkan unit ke **Rental Profile** yang aktif, lalu klik **Approve**.
4. Robot menerima kredensial yang ditandatangani secara kriptografis (`Certificates/robot/device.json`), terhubung ke HiveMQ melalui port TLS 8883, dan muncul secara langsung di peta armada.

---

### Langkah 6: Sediakan Hotspot WiFi

Setiap unit menyiarkan hotspot WiFi-nya sendiri agar operator dapat terhubung langsung (selain radio onboard yang tetap berfungsi sebagai klien WiFi biasa). Pasang dongle USB WiFi yang telah tervalidasi dan jalankan dua perintah berikut dari terminal interaktif:

```bash
cd ~/msd700_noetic

# 1. Install the dongle's driver (one-time, builds via DKMS so it survives kernel upgrades)
./scripts/install-wifi-dongle-driver.sh

# 2. Provision the hotspot
./setup.sh --provision-network
```

Dijalankan langsung di keyboard (bukan lewat pipe atau sesi non-TTY), `--provision-network` menuntun Anda
melalui setiap pengaturan dengan gaya create-next-app: nama interface, SSID, dan password ditampilkan
sebagai `[default]` hasil deteksi otomatis, tekan Enter untuk menerima masing-masing, atau ketik nilai baru.
Password hotspot diketik dua kali untuk konfirmasi dan tidak pernah dituliskan ke `docker/.env` atau file
apa pun lainnya di disk. Hotspot akan menyala dengan sendirinya pada setiap boot berikutnya, lepas dari
Docker atau `docker-manager.sh`.

::: info Provisioning tanpa pengawasan / via skrip
Tanpa TTY (atau dengan `MSD700_NONINTERACTIVE=1`), prompt akan dilewati dan `--provision-network`
menggunakan `docker/.env` beserta environment apa adanya, sehingga `AP_PASSWORD_LOCAL='your-hotspot-password'
./setup.sh --provision-network` tetap berfungsi untuk otomasi. Lihat
[Hotspot Wi-Fi + Klien](/id/setup/wifi-hotspot#provisioning-hotspot-satu-kali-per-unit) untuk panduan
provisioning lengkap, perangkat keras dongle yang tervalidasi, dan pemecahan masalah.
:::

---

## Mengoperasikan Unit Secara Lokal (Mode Offline)

Ketika robot beroperasi di lokasi tanpa konektivitas internet, hubungkan laptop atau tablet Anda langsung ke jaringan lokal robot, atau ke [hotspot WiFi robot](/id/setup/wifi-hotspot) yang telah disediakan pada Langkah 6:

1. Buka browser Anda dan navigasikan ke: `http://<jetson-ip>:3000`.
2. Dashboard lokal memungkinkan teleoperasi penuh, pemetaan SLAM, pembuatan rute, dan sapuan cakupan area.
3. Ketika konektivitas internet pulih, semua peta yang direkam secara lokal akan otomatis tersinkronisasi kembali ke server cloud pusat.

---

## Konfigurasi Lanjutan

<details>
<summary><b>Mode Simulasi (Gazebo Warehouse)</b></summary>

Untuk menguji algoritma pada laptop tanpa perangkat keras robot fisik:

1. Build image dengan simulator diaktifkan:
   ```bash
   ./scripts/docker-manager.sh build --simulator
   ```

2. Jalankan stack simulasi:
   ```bash
   ./scripts/docker-manager.sh up --simulator -d
   ```

</details>

<details>
<summary><b>Routing Cloud Pengembangan (`--dev`)</b></summary>

Untuk mengarahkan unit ke server cloud pengembangan alih-alih produksi:

```bash
./scripts/docker-manager.sh up --dev -d
```

Ini menghubungkan MQTT ke port dev `8884` dan mensinkronkan dengan database pengembangan.

**Hostname broker tetap `msd.nglobal.jp` juga pada cloud dev.** Dev dan produksi adalah mesin yang
sama, dibedakan hanya oleh port yang dipublikasikan, dan sertifikat TLS broker diterbitkan untuk nama
tersebut, sehingga mengarahkan MQTT ke IP polos akan gagal verifikasi. Baris log yang berbunyi
`mqtts://msd.nglobal.jp:8884` karena itu adalah broker **dev**. Baca portnya, bukan hostname-nya:

| Peer | Broker | Backend | ROS master |
| --- | --- | --- | --- |
| Produksi (tanpa flag) | `msd.nglobal.jp:8883` | `https://msd.nglobal.jp/services/rosbackend` | `11321` |
| Dev (`--dev`) | `msd.nglobal.jp:8884` | `http://118.22.31.252:5001` | `11322` |

::: danger Jangan pernah biarkan unit ini menjangkau ROS master milik cloud
`roscore` robot ini berada di `11321`/`11322`, sengaja dipisahkan dari `11311`/`11312` milik server
cloud. Dulu keduanya berbagi nomor yang sama, sehingga `localhost:11312` berarti master yang berbeda
tergantung mesinnya. Sesi VS Code Remote atau `ssh -L` yang meneruskan port server saja sudah cukup:
`roscore` gagal bind dan keluar, probe readiness tetap lolos karena tunnel tetap menjawab, dan seluruh
stack unit terdaftar pada master **cloud**. ROS mematikan node yang lebih lama setiap kali sebuah nama
diklaim dua kali, sehingga ia menggusur `/rosbridge_websocket` dan `/backend_node` milik server sendiri;
topic live menghilang dari dashboard cloud (peta pemetaan lebih dulu) sementara dashboard lokal tampak
baik-baik saja. Itu terjadi pada 2026-09-10.

Sekarang ada dua pengaman. Port tidak lagi saling tumpang tindih, dan `run_msd.sh` menolak untuk
dimulai kecuali ada `rosmaster` miliknya sendiri yang berjalan pada port tersebut dan
`/msd700/stack_role` milik master itu bukan `cloud` (setiap roscore mencap parameter tersebut;
`run_msd.sh` menambahkan `/msd700/stack_host`). Nama node cloud membawa akhiran `_cloud` sebagai
pengaman terakhir, sehingga stack yang tetap berakhir di master yang salah tidak lagi menggusur apa pun.

```bash
ss -ltnp | grep :11322                     # who owns the port
rosparam get /msd700/stack_role            # whose master answers
src/ros-web-ui/scripts/ros_doctor.sh       # owner, foreign nodes, rosbridge, in one verdict
```

Tutup forward tersebut (VS Code: panel PORTS), atau pindahkan robot ini dengan
`ROS_MASTER_PORT=11323 ./scripts/docker-manager.sh up --dev -d`.
:::

**Mode ini diingat lintas reboot.** `up` mengaktifkan `msd700.service`, dan sejak perbaikan September
2026 flag `--dev` dan `--simulator` dari `up` tersebut dituliskan ke `ExecStart` milik unit. Sebelumnya,
unit boot menjalankan ulang `up` polos, sehingga robot yang dijalankan dengan `up --simulator --dev`
kembali setelah reboot sebagai **perangkat keras, melawan produksi**. Konfirmasi apa yang diaktifkan
dengan:

```bash
./scripts/docker-manager.sh print-autostart-unit --simulator --dev   # what would be written
grep ExecStart /etc/systemd/system/msd700.service                    # what is armed now
```

`up` juga mencetaknya: `Boot autostart armed (DEV cloud, simulator)`. Menjalankan ulang `up` dengan flag
berbeda menuliskan ulang unit tersebut; `down` menonaktifkannya sepenuhnya.

</details>

<details>
<summary><b>Perbaikan Networking Host untuk Laptop Non-Ubuntu/Arch</b></summary>

Jika berjalan pada Arch Linux atau distribusi non-standar:

1. **Resolusi Hostname**:
   ```bash
   grep "$(hostname)" /etc/hosts || echo "127.0.0.1 $(hostname)" | sudo tee -a /etc/hosts
   ```

2. **Nonaktifkan Pemetaan IPv6 Loopback**:
   ```bash
   sudo sed -i 's/^::1[[:space:]].*/::1 ip6-localhost ip6-loopback/' /etc/hosts
   ```

3. **Buat Direktori Maps Bersama**:
   ```bash
   sudo mkdir -p /home/ubuntu/ros_maps
   sudo chown -R $(id -u):$(id -g) /home/ubuntu/ros_maps
   ```

</details>

---

## Verifikasi & Diagnostik

Gunakan perintah diagnostik berikut untuk memverifikasi kesehatan robot:

```bash
# 1. View overall container and service status
./scripts/docker-manager.sh status

# 2. Attach to the ROS tmux session inside the container
./scripts/docker-manager.sh shell
tmux attach -t robot_services

# 3. View real-time container logs
./scripts/docker-manager.sh logs -f
```

## Dokumentasi Terkait

- [Penyiapan Server](/id/setup/server-setup): Instalasi backend cloud.
- [Penyiapan Sistem](/id/setup/system-setup): Kalibrasi dan verifikasi sensor.
- [Referensi Docker](/id/setup/docker-reference): Referensi sintaks CLI yang komprehensif.
- [Hotspot Wi-Fi + Klien](/id/setup/wifi-hotspot): Arsitektur hotspot lengkap, perangkat keras dongle, dan pemecahan masalah.
