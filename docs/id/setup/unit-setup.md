---
outline: deep
---

# Setup Unit

<RoleBadge role="technician" />

Cara menginstal dan mengonfigurasi **Unit MSD700**: robot fisik di NVIDIA Jetson.

Server yang jalan wajib ada dulu ([Setup Server](/id/setup/server-setup)). Jalankan semua perintah di bawah **di unit**, bukan di cloud server.

::: info Produksi dulu
Halaman ini menghubungkan robot asli ke cloud **produksi**. Simulator (`--simulator`) dan cloud dev (`--dev`) ada di [Advanced Configurations](#advanced-configurations).
:::

## Topologi sistem

![Diagram Sistem MSD700](../../development/diagrams/msd700-system-diagram.drawio)

## Struktur folder

Workspace Jetson menyimpan paket robot, bridge web, dan web UI onboard sebagai clone biasa di bawah `src/` (bukan submodule):

```
~/msd700_noetic/
├── setup.sh
├── scripts/
│   └── docker-manager.sh
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env
└── src/
    ├── msd700_robot/
    ├── ros-web-ui/
    └── ROS-dashboard-next-ts/
```

---

## Langkah setup

Kerjakan Step 1-4, lalu Step 6 (provisioning hotspot), lalu Step 5 (start). File hotspot harus ada sebelum start pertama.

### Step 1: Clone workspace dan source

```bash
# 1. Workspace orkestrasi
git clone git@github.com:itbdelaboprogramming/msd700_noetic.git ~/msd700_noetic
cd ~/msd700_noetic

# 2. Repo source ke src/, branch v2
git clone --recurse-submodules -b v2 git@github.com:itbdelaboprogramming/msd700_robot.git src/msd700_robot
git clone -b v2 git@github.com:itbdelaboprogramming/ros-web-ui.git src/ros-web-ui
git clone -b v2 git@github.com:itbdelaboprogramming/ROS-dashboard-next-ts.git src/ROS-dashboard-next-ts
```

::: tip Kenapa clone manual ke `src/`?
`msd700_noetic` meng-ignore `src/*/` agar tiap repo memegang branch sendiri tanpa konflik Git-in-Git.
:::

---

### Step 2: Setup host sekali saja

```bash
cd ~/msd700_noetic
./setup.sh
```

Ini menginstal Docker bila belum ada, mengatur akses grup dan `xhost`, membuat script executable, mengonfigurasi link kabel Velodyne, memasang udev rules STM32/RealSense dan service recovery RealSense, serta mengunduh world simulator. Ini mengubah host; bukan cek read-only.

::: warning Grup docker
Bila script menambahkan user ke grup `docker`, logout dan login ulang, atau jalankan `newgrp docker` (hanya shell saat ini).
:::

Tidak adanya `DISPLAY` (sesi SSH headless) di sini hanya berupa warning. X11 hanya dibutuhkan untuk RViz atau Gazebo.

::: details Link kabel Velodyne VLP-16 (hanya untuk unit dengan VLP-16)
VLP-16 mengirim UDP ke IP host tetap di port 2368 tanpa DHCP. Tanpa IP host statis di subnet-nya,
driver ROS timeout tanpa pesan dan point cloud tidak muncul.

`./setup.sh` (atau `./setup.sh --configure-lidar` saja) membuat profile NetworkManager
`msd700-velodyne`: statis `192.168.103.100/24`, IPv6 mati, prioritas autoconnect 100, tidak pernah menjadi
default route. Interface kabel dideteksi otomatis (yang punya carrier, belum punya IP, dan bukan default
route). Jika kandidatnya 0 atau lebih dari 1, langkah ini dilewati dengan warning, tidak pernah ditebak.

| Variabel (`docker/.env`) | Default | Fungsi |
| --- | --- | --- |
| `VELODYNE_IFACE` | deteksi otomatis | NIC kabel yang menghadap sensor (mis. `end0`) |
| `VELODYNE_HOST_CIDR` | `192.168.103.100/24` | IP statis host |
| `VELODYNE_SENSOR_IP` | `192.168.103.231` | IP sensor, dipakai untuk validasi |
| `VELODYNE_CONNECTION_NAME` | `msd700-velodyne` | Nama profile NetworkManager |

`VELODYNE_SENSOR_IP` harus berada di dalam `VELODYNE_HOST_CIDR` dan sama dengan `device_ip` di
`src/msd700_robot/msd700_hardware/launch/velodyne_scanner.launch`.

Verifikasi: `ping 192.168.103.231` dijawab, dan di dalam container `rostopic list | grep velodyne`
menampilkan topic point cloud.
:::

---

### Step 3: Cek `docker/.env`

Script startup membuat `docker/.env` dari `docker/.env.example` **hanya bila belum ada**. Password MySQL placeholder diganti hanya saat database lokal belum diinisialisasi; ini tidak merotasi password yang sudah ada.

::: warning Kredensial di file ini
`docker/.env` tracked di git. Cek nilai per-unit sendiri sebelum pemakaian pertama. Jangan print, commit, atau copy ke unit lain. Mengubah password database yang sudah ada butuh rotasi SQL yang cocok, bukan sekadar edit file.
:::

Untuk review manual sebelum launch:

```bash
cd ~/msd700_noetic
test -e docker/.env || cp docker/.env.example docker/.env
nano docker/.env
```

Setting utama:

```ini
# Penyimpanan peta di Jetson
MAPS_FOLDER_LOCAL=/home/ubuntu/ros_maps

# UID/GID user lokal (kosong = deteksi otomatis: Jetson 2002, laptop dev 1000)
USER_UID=
USER_GID=

# Simulator Gazebo (true hanya di mesin tanpa hardware robot)
WITH_SIMULATOR=false

# Biarkan kosong; terisi otomatis saat enrolment cloud
UNIT_ID=

# Port lokal (default stack onboard)
MYSQL_PORT_LOCAL=3306
MOSQUITTO_PORT_LOCAL=1883
BACKEND_PORT_LOCAL=5002
ROSBRIDGE_PORT_LOCAL=9090
FRONTEND_PORT_LOCAL=3000
MEDIA_SERVER_PORT_LOCAL=3003
SIGNALLING_PORT_WS_LOCAL=3001
SIGNALLING_PORT_HTTP_LOCAL=3002
NETWORK_AGENT_PORT_LOCAL=5011

# Optional: hint IP statis (dashboard mengikuti alamat browser)
#LOCAL_IP=192.168.4.1
```

::: info Terhubung ke cloud mana?
Default `https://msd.nglobal.jp/services/rosbackend`, atau backend dev dengan `--dev`. `CLOUD_BASE_URL` meng-override default. Jaga enrolment dan sync menunjuk cloud yang sama; setting ini tidak memindahkan broker MQTT sendiri.
:::

---

### Step 4: Build image robot

Build selagi ada internet. Basis robot adalah `ros:noetic-robot`; Dockerfile meng-copy `src/` lalu menjalankan `catkin build`.

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh build
```

Ini mem-build `msd700:latest`, `ros-noetic-webui-app-local:latest`, dan `ros-dashboard-next-local:latest`, serta me-pull MySQL dan Mosquitto. Gagal pull hanya warning; pastikan image upstream terjangkau sebelum offline. `up` biasa memakai ulang image dan hanya warning soal image basi; rebuild dengan sengaja setelah ubah source.

Buat folder peta dulu, milik UID/GID sendiri. Docker membuat folder bind yang hilang sebagai root:

```bash
sudo install -d -o "$(id -u)" -g "$(id -g)" /home/ubuntu/ros_maps
```

**Bila unit memakai hotspot, kerjakan Step 6 sebelum Step 5.** Stack me-mount `/run/msd700-hotspot-active`; start Docker sebelum file itu ada bisa membuat folder pengganti.

---

### Step 5: Jalankan robot dan enrol

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh up -d
```

Ini menyalakan container robot plus stack `local_dev` yang selalu on (database, MQTT, backend/rosbridge, network agent, media, signalling, dashboard). Namanya saja `local_dev`; jalan untuk cloud mana pun. `-d` kembali setelah startup dan enrolment selesai. `up` juga memasang `msd700.service` untuk autostart boot; tambah `--no-autostart` untuk melewatinya.

**Enrolment, hanya di launch pertama:**

1. Robot menghubungi cloud dan mencetak **kode klaim** 8 karakter (mis. `K7M2QP4R`). Ini label tampilan, bukan secret.
2. Admin membuka admin console cloud (`https://msd.nglobal.jp/admin`, atau backend dev port 5001 dengan `--dev`) dan login.
3. Di bawah **Pending Units**, cari kode itu, lalu daftarkan sebagai unit baru di **Rental Profile** aktif, atau **Adopt** ke ULID unit yang ada (jalur ganti hardware; peta di cloud tetap).
4. Unit menyimpan identitas ke `src/ros-web-ui/Certificates/robot/device.json` plus token di `token.cred`. Perlakukan keduanya sebagai secret. Launch berikutnya memakai ulang.
5. Bridge produksi menargetkan HiveMQ TLS port `8883`. Approval saja tidak membuktikan konektivitas; cek dashboard cloud dan lokal masing-masing.

---

### Step 6: Provisioning hotspot WiFi

Unit yang di-provision menawarkan hotspot dan bisa mempertahankan koneksi client WiFi di radio onboard yang sama, bila driver mendukung keduanya sekaligus. Cek driver aslinya dulu, bukan sekadar nama chip. Lakukan provisioning ini **sebelum `up` pertama**, dari konsol lokal atau koneksi kabel: NetworkManager restart dan WiFi bisa putus.

```bash
cd ~/msd700_noetic

# Optional: driver dongle cadangan (sekali saja, DKMS). Lewati bila radio onboard menangani hotspot sendiri.
./scripts/install-wifi-dongle-driver.sh

# Provision hotspot (udev rules, rule PolicyKit, service hostapd/dnsmasq)
./setup.sh --provision-network
```

`--provision-network` jalan di terminal dan menanyakan nama interface dan SSID (dengan default terdeteksi). Ketik password tersembunyi; password lama tampil sebagai `[keep current]`, tidak pernah ditampilkan. Password baru diketik dua kali. Password disimpan ke config hostapd di `/etc/hostapd/` (mode 0600), **bukan** kembali ke `docker/.env`. Jaringan client upstream masuk ke profile NetworkManager-nya. Setelah ini hotspot naik sendiri tiap boot, tanpa Docker.

::: info Provisioning scripted
Tanpa TTY (atau dengan `MSD700_NONINTERACTIVE=1`), prompt dilewati. Password hostapd yang ada menang atas nilai env. Mengetik password inline bisa bocor ke shell history. Pilih prompt interaktif tersembunyi. Rotasi password unattended yang aman masih belum solved. Walkthrough lengkap: [WiFi Hotspot](/id/setup/wifi-hotspot#provisioning-hotspot-sekali-per-unit).
:::

---

## Operasi lokal (offline)

Tanpa internet, gabung ke jaringan lokal robot atau [hotspot](/id/setup/wifi-hotspot)-nya dari Step 6:

1. Buka `http://<jetson-ip>:3000`.
2. Setelah enrolment cloud dan satu sync sukses (rental assignment + akun operator), dashboard lokal bisa menyetir, memetakan, dan menjalankan rute secara offline. Unit yang belum pernah enrol tidak bisa start offline.
3. Saat internet kembali, sync mempertukarkan peta, rute, area, dan baris database dengan cloud yang dikonfigurasi, terbatas pada unit ini dan rental profile-nya. Cek status sync; jangan anggap semua ter-upload.

---

## Advanced configurations

<details>
<summary><b>Mode simulasi (Gazebo warehouse)</b></summary>

Untuk testing di laptop tanpa hardware robot. `build --simulator` menyetel `WITH_SIMULATOR=true` dan memilih `msd700-simulator:latest`; `fetch_sim_worlds.sh` mengunduh world warehouse selagi online. Pakai pose spawn dari world yang dipilih.

```bash
./scripts/docker-manager.sh build --simulator
./scripts/docker-manager.sh up --simulator -d
```

Dengan `MSD700_SIM_HEADLESS=true` di `docker/.env`, Gazebo jalan tanpa window.

</details>

<details>
<summary><b>Cloud dev (`--dev`)</b></summary>

Arahkan unit ke cloud dev, bukan produksi:

```bash
./scripts/docker-manager.sh up --dev -d
```

Ini memindahkan bridge cloud ke backend dev (port 5001), MQTT ke `8884`, dan roscore robot ini ke `11322`.

**Hostname broker tetap `msd.nglobal.jp` di dev juga.** Dev dan produksi satu mesin yang sama, dipisah hanya oleh port, dan sertifikat TLS bernama host itu. IP polos akan gagal verifikasi. Baca port-nya, bukan hostname:

| Peer | Broker | Backend | ROS master |
| --- | --- | --- | --- |
| Produksi (tanpa flag) | `msd.nglobal.jp:8883` | `https://msd.nglobal.jp/services/rosbackend` | `11321` |
| Dev (`--dev`) | `msd.nglobal.jp:8884` | `http://118.22.31.252:5001` | `11322` |

::: danger Jauhkan unit ini dari ROS master cloud
Roscore robot ini `11321`/`11322`, sengaja beda dari cloud `11311`/`11312`. Jangan forward port ROS server ke unit (tanpa `ssh -L`, tanpa port forward VS Code 11311/11312): stack unit akan terdaftar di master **cloud** dan menendang node milik server. Gejala: dashboard cloud kosong (peta mapping duluan) padahal dashboard lokal normal.

```bash
ss -ltnp | grep :11322
docker exec -e ROS_MASTER_URI=http://localhost:11322 msd700 bash -lc 'source /opt/ros/noetic/setup.bash; bash /workspace/src/ros-web-ui/scripts/ros_doctor.sh'
```

Tutup forward (VS Code: panel PORTS), atau pindahkan robot ini dengan `ROS_MASTER_PORT=11323 ./scripts/docker-manager.sh up --dev -d`.
:::

**Mode menempel lintas reboot.** `up` menulis flag `--dev` / `--simulator` ke `msd700.service`, sehingga unit reboot ke mode yang sama. Cek yang terpasang:

```bash
./scripts/docker-manager.sh print-autostart-unit --simulator --dev   # yang akan ditulis
grep ExecStart /etc/systemd/system/msd700.service                    # yang terpasang sekarang
```

Menjalankan `up` ulang dengan flag beda menulis ulang unit; `down` menghapus autostart.

</details>

<details>
<summary><b>Laptop non-Ubuntu (hanya sim/dev)</b></summary>

Setel `MAPS_FOLDER_LOCAL` di `docker/.env` ke folder writable yang nyata, bukan path gaya Jetson `/home/ubuntu`. Samakan UID/GID image. `backend_local` mem-bind-mount folder ini di path yang sama (`docker/docker-compose.yml`), dan `run_msd.sh` memeriksa apakah folder bisa ditulisi sebelum launch, jadi path yang salah gagal saat start, bukan saat map disimpan.

</details>

---

## Cek kesehatan robot

```bash
# 1. Status robot + stack lokal
./scripts/docker-manager.sh status

# 2. Sesi ROS di dalam container
./scripts/docker-manager.sh shell
tmux attach -t robot_services

# 3. Log robot (follow); stack lokal: local-logs
./scripts/docker-manager.sh logs -f

# 4. Kesehatan stack (master, foreign nodes, rosbridge)
docker exec -e ROS_MASTER_URI=http://localhost:11321 msd700 bash -lc 'source /opt/ros/noetic/setup.bash; bash /workspace/src/ros-web-ui/scripts/ros_doctor.sh'

# 5. Status sync di unit
curl -s http://localhost:5002/local/status
```

## Terkait

- [Setup Server](/id/setup/server-setup): backend cloud.
- [Setup Sistem](/id/setup/system-setup): cek server + unit bersama.
- [Referensi Docker](/id/setup/docker-reference): referensi CLI lengkap.
- [WiFi Hotspot](/id/setup/wifi-hotspot): setup dan troubleshooting hotspot.
- [Wi-Fi MT7922](/id/setup/wifi-mt7922): fix firmware radio onboard.
- [Troubleshooting](/id/setup/troubleshooting): diagnostik lebih luas.
