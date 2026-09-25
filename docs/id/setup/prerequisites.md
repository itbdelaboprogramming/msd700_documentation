---
outline: deep
---

# Prasyarat

<RoleBadge role="technician" />

Hardware, OS, port jaringan, dan software yang wajib siap **sebelum** menginstal Server MSD700 atau robot Unit.

## Hardware

### 1. Cloud server

| Komponen | Minimum | Disarankan |
| --- | --- | --- |
| **CPU** | 2 vCPU (x86_64) | 4 hingga 8 vCPU |
| **RAM** | 4 GB | 8 hingga 16 GB |
| **Disk** | SSD 30 GB | NVMe 100 GB (arsip peta, log media) |
| **Jaringan** | IPv4 publik statis, port 443 + 8883 di-forward | 100 Mbps+ full duplex |

### 2. Robot unit (Jetson)

| Komponen | Yang dibutuhkan |
| --- | --- |
| **Komputer** | NVIDIA Jetson (ARM64) dengan BSP/kernel yang cocok untuk model tersebut |
| **LiDAR** | Velodyne VLP-16 via Ethernet. Host `192.168.103.100/24`, sensor `192.168.103.231`, UDP `2368` |
| **IMU** | IMU unit untuk filter orientasi dan fusi odometri |
| **Motor** | Kontroler STM32, muncul sebagai `/dev/stm32` (butuh udev rules, lihat bawah) |
| **Daya** | Baterai, proteksi, dan E-Stop: cocokkan dengan BOM unit |

---

## Port firewall

Buka port **publik** di bawah ini. Sisanya harus tertutup, hanya bisa diakses dari jaringan tepercaya.

| Port | Protokol | Cakupan | Layanan |
| --- | --- | --- | --- |
| **`443`** | TCP | Publik | Apache reverse proxy (dashboard, API, rosbridge, signalling) |
| **`8883`** | TCP | Publik | Broker HiveMQ (robot terhubung ke sini) |
| **`3478`** | UDP + TCP | Publik | Server TURN coturn (video kamera menembus NAT) |
| **`49152-65535`** | UDP | Publik | Range relay media coturn (bisa dipersempit di `.env`) |
| **`3307`** | TCP | Internal | Database MySQL produksi |
| **`5000`** | TCP | Internal | Backend API |
| **`9090`** | TCP | Internal | rosbridge WebSocket |
| **`3003`** | TCP | Internal | Media server |
| **`3001` / `3002`** | TCP | Internal | Server signalling (WS / HTTP) |

::: warning MySQL dan backend tidak otomatis loopback-only
Compose mem-publish MySQL tanpa bind loopback, dan backend listen di semua interface. Firewall-lah yang membuatnya tetap internal. Verifikasi di host.
:::

Port dev digeser: MySQL `3308`, backend `5001`, rosbridge `9091`, MQTT `8884`, signalling `4001`/`4002`, media `4003`. TURN hanya ada di produksi.

Di **unit**, laptop operator di LAN butuh dashboard `3000`, backend `5002`, rosbridge `9090`, media `3003`, signalling `3001`, dan MQTT WebSocket `9001`. Roscore robot adalah `11321` (atau `11322` dengan `--dev`), bukan `11311`/`11312` milik cloud.

---

## Sistem operasi dan dependensi

### Cloud server

1. **OS**: Ubuntu 22.04 atau 24.04 LTS (x86_64).
2. **Docker**: Docker CE 20.10+ dengan plugin Compose (`docker compose` v2).
3. **Apache**: 2.4+ dengan modul `ssl proxy proxy_http proxy_wstunnel headers rewrite alias`.
4. **Certbot**: untuk sertifikat Let's Encrypt.

### Unit Jetson

1. **OS**: Ubuntu ARM64 dengan BSP untuk model Jetson tersebut.
2. **Docker**: Docker CE + Compose v2.
3. **udev rules**: untuk kontroler motor `/dev/stm32` dan USB RealSense (dipasang oleh `setup.sh`, lihat [Setup Unit](/id/setup/unit-setup)).
4. **Link LiDAR**: Ethernet khusus, umumnya host `192.168.103.100/24` dan sensor `192.168.103.231`. Nama interface terdeteksi otomatis; override dengan `VELODYNE_IFACE` bila perlu.
5. **Tool hotspot**: NetworkManager, `iw`, `dnsmasq`, `iptables`, systemd, udev, polkit. Instal sebelum start pertama; lihat [WiFi Hotspot](/id/setup/wifi-hotspot).
6. **Display X11** (opsional): hanya untuk RViz atau Gazebo. `DISPLAY` yang tidak ada saat setup hanya berupa warning.

---

## Instal Docker di Ubuntu

Pakai repo apt resmi Docker di server maupun Jetson. Paket `docker.io` bawaan Ubuntu sudah tua dan sering tidak menyertakan plugin Compose.

```bash
# 1. Hapus paket yang bentrok
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  sudo apt-get remove -y $pkg
done

# 2. Tambahkan key resmi Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 3. Tambahkan repo apt Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

# 4. Instal Docker + plugin Compose
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Tes
sudo docker run hello-world
```

Berfungsi di `amd64` maupun `arm64` (baris repo memilih arsitektur otomatis).

### Jalankan Docker tanpa `sudo`

```bash
sudo usermod -aG docker $USER
newgrp docker
docker run hello-world
```

::: warning Logout dan login ulang bila masih meminta `sudo`
`newgrp docker` hanya memperbaiki shell saat ini. Shell lain dan sesi SSH butuh logout/login penuh.
:::

### Jalankan Docker saat boot

```bash
sudo systemctl enable docker.service
sudo systemctl enable containerd.service
```

---

## Checklist keselamatan

::: danger Keselamatan dulu
1. **E-Stop harus dekat.** Sebelum tes motor apa pun, pastikan tombol merah dalam jangkauan tangan.
2. **Angkat chasis saat power-up pertama.** Letakkan robot di atas balok agar roda berputar bebas saat tes arah motor.
3. **Laser LiDAR.** Velodyne VLP-16 adalah laser Class 1 yang aman untuk mata. Namun jangan letakkan optik pembesar di depannya saat menyala.
:::

## Langkah berikutnya

- [Setup Server](/id/setup/server-setup): deploy backend cloud.
- [Setup Unit](/id/setup/unit-setup): siapkan robot (bila server sudah jalan).
