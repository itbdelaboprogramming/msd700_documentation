---
search: false
---

# Struktur Repositori

<RoleBadge role="developer" />

MSD700 terdiri dari empat repositori. Repositori ini (`msd700_documentation`) hanya berisi situs dokumentasi; produk
itu sendiri berada di tiga repositori lainnya, yang merupakan sibling pada checkout Server dan submodule dari
`msd700_noetic` pada checkout Unit: kode yang sama, dua cara berbeda untuk merakitnya.

## `ros-web-ui`: paket web-facing, backend, dan konteks build frontend

```
ros-web-ui/
├── docker-compose.yml          # Server-side services (see Architecture)
├── docker-compose.robot.yml    # Robot-side container (used when this repo runs the robot half alone)
├── Docker/                     # Dockerfile, HiveMQ config, coturn config, patches
├── Certificates/                # Robot credential cache (device.json, token.cred), MQTT/SQL certs
├── run_msd.sh                  # Launches roscore + ROS bringup + camera client + switch_mode in tmux
├── scripts/
│   ├── docker-manager.sh        # Runs the robot half in a container (Ubuntu 24/ARM64 hosts)
│   ├── enroll.py                 # Talks to /enroll on the backend; prints the claim code
│   ├── secrets.sh                # JWT keyring management (see Setup > Maintenance)
│   └── ros_log_janitor.sh        # Caps ~/.ros/log growth
├── source/                      # Catkin workspace source, this is what actually builds
│   ├── msd700_webui_bringup/     # Top-level launch files (bringup_msd.launch, bringup_cloud.launch)
│   ├── msd700_webui_control/     # switch_mode and related control nodes
│   ├── msd700_webui_msg/         # Custom messages for the web-facing layer
│   ├── msd700_webui_utils/
│   ├── msd700_robot/              # msd700_robot, present here too (see below)
│   └── dependencies/
│       ├── ROS-dashboard-backend/  # backend_node, see API Reference
│       ├── ROS-dashboard-next-ts/  # frontend build context (own git repo, gitignored here)
│       ├── media-server/
│       ├── signalling_server/
│       ├── camera_client/
│       ├── aws_mqtt/               # MQTT bridge launch files (local + cloud)
│       ├── topic2string/           # Geometric topics ↔ MQTT string bridge
│       ├── robot_pose_publisher/
│       └── ssl_update/             # Certbot renewal + HiveMQ keystore rebuild
└── logs/
```

`ros-web-ui` adalah satu-satunya repositori yang digunakan dalam **tiga konteks berbeda**: dibangun sebagai
backend/rosbridge Server (`docker-compose.yml`), diambil sebagai source ke workspace Unit untuk node web-facing
robot (`msd700_noetic/src/ros-web-ui`), dan dijalankan mandiri sebagai bagian robot lewat
`docker-compose.robot.yml` pada host non-Jetson (laptop dev, atau server dokumentasi ini, saat menguji
simulator). Yang mana yang Anda dapatkan sepenuhnya bergantung pada compose file / script mana yang
memanggilnya, bukan pada sesuatu di dalam repositori itu sendiri.

## `msd700_robot`: paket ROS yang membuat robot bergerak

```
msd700_robot/
├── msd700_movement/
│   ├── msd700_bringup/       # Launch files for primitive robot tasks
│   ├── msd700_control/       # Sensor fusion (robot_localization)
│   ├── msd700_firmware/      # Arduino firmware for the motor controller
│   ├── msd700_msg/           # Robot-level messages
│   └── msd700_navigations/   # SLAM, autonomous mapping, autonomous navigation, coverage
├── msd700_simulation/        # Gazebo worlds and sim launches
│   ├── worlds/               #   small, TurtleBot-scale worlds, committed
│   ├── scripts/               #   fetch_sim_worlds.sh: pulls the AWS warehouse
│   └── vendor/                #   fetched third-party worlds, gitignored
├── msd700_visual/            # RViz/Gazebo robot visuals
├── msd700_hardware/          # Hardware drivers
├── msd700_description/       # URDF, including msd700_field.urdf.xacro (real size)
└── ros_msd700_msgs/
```

Hanya `msd700_field.urdf.xacro` yang merupakan robot berukuran nyata 0,90 x 0,70 m; setiap model lain di sini
adalah turunan TurtleBot3 Waffle berukuran 0,266 m, dan world yang di-commit berukuran sesuai itu. Lihat
[Simulasi](/id/development/ros/simulation) untuk kombinasi mana yang dapat memvalidasi geometri coverage.

Diambil sebagai source oleh `msd700_noetic` (sebagai submodule, `src/msd700_robot`) dan juga disalin ke
`source/msd700_robot` milik `ros-web-ui`. Bagian robot dari sebuah build membutuhkan baik stack navigasi
repositori ini maupun paket web-facing `ros-web-ui` dalam satu catkin workspace yang sama.

## `msd700_noetic`: orkestrasi Jetson/robot

```
msd700_noetic/
├── setup.sh                  # One-time host setup (Docker, xhost, script permissions)
├── scripts/docker-manager.sh # build / up / down / shell / logs / local-* commands
├── docker/
│   ├── Dockerfile             # osrf/ros:noetic-desktop-full based image
│   ├── docker-compose.yml     # The single `msd700` robot container
│   ├── .env.example           # Copied to .env on first run
│   └── mosquitto/             # This unit's own local MQTT broker config
└── src/                       # Populated via git submodules:
    ├── msd700_robot/
    ├── ros-web-ui/
    └── ROS-dashboard-next-ts/
```

Inilah yang sebenarnya dijalankan oleh sebuah Unit. `src/` di-bind-mount ke dalam kontainer (bukan dipanggang ke
dalam image), sehingga mengedit launch file atau node Python di host langsung berlaku pada launch berikutnya
tanpa perlu rebuild; hanya perubahan dependensi atau base image yang membutuhkan `docker-manager.sh build`. Pada
mesin Server (seperti host situs dokumentasi ini sendiri), `src/` secara sah kosong atau tidak ada kecuali Anda
secara spesifik sedang menguji bagian robot di sini. Server sebagai gantinya menjalankan `docker-compose.yml`
milik `ros-web-ui` sendiri, yang tidak membutuhkan semua ini.

## `ROS-dashboard-next-ts`: dashboard operator

Aplikasi Next.js miliknya sendiri, dibangun dua kali dari source yang sama dengan URL berbeda yang dipanggang ke
dalamnya:

- **Build Server** (`frontend_prod`/`frontend_dev` di `ros-web-ui/docker-compose.yml`): berkomunikasi dengan
  backend/rosbridge/media/signalling milik Server sendiri, lewat jalur HTTPS/WSS publik yang di-proxy Apache.
- **Build Unit** (di dalam kontainer `msd700_noetic`, atau `docker-compose.yml` milik `ros-web-ui` saat
  menjalankan bagian robot secara mandiri): berkomunikasi dengan layanan lokal milik unit itu sendiri, dipanggang
  masuk lewat build arg `NEXT_PUBLIC_*` yang mengarah ke IP unit itu sendiri.

Karena URL-URL tersebut dikompilasi **ke dalam** bundle JS alih-alih dibaca saat runtime, mengubah server mana
yang dituju sebuah build selalu membutuhkan rebuild image, tidak pernah cukup restart saja.

## Repositori ini (`msd700_documentation`)

Hanya situs dokumentasi VitePress, tanpa kode produk.

```
msd700_documentation/
├── docs/                        # VitePress site source
│   ├── .vitepress/
│   │   ├── config.mts           # site config: nav, sidebar, search, markdown hooks
│   │   └── theme/                # custom theme (extends the default theme)
│   │       ├── index.ts          # registers global components
│   │       ├── custom.css        # site-wide style overrides
│   │       └── components/       # LinkCard(s), RoleBadge, Mermaid
│   ├── index.md                 # homepage
│   ├── user-guide/              # end-user docs
│   ├── setup/                   # technician / deployment docs
│   └── development/             # developer docs (this section)
├── scripts/
│   ├── deploy.sh                 # builds the site and swaps it into docs/.vitepress/dist
│   ├── webhook-listener.mjs      # GitHub webhook receiver that triggers deploy.sh on push to main
│   ├── check-mermaid.mjs         # syntax-checks every diagram in the tree
│   ├── apache-snippet.conf       # ProxyPass rules for the Apache front end
│   └── systemd/                  # systemd unit for the webhook listener
├── package.json
└── package-lock.json
```

### Diagram

Diagram ditulis sebagai fence ```` ```mermaid ```` di markdown dan dirender sebagai SVG asli di browser. Dua
bagian yang membuat itu bekerja:

| Bagian | Tugas |
| --- | --- |
| `docs/.vitepress/config.mts`, `markdown.config` | Menulis ulang setiap fence `mermaid` menjadi `<Mermaid code="<base64>" />`. Base64 karena sumber diagram penuh dengan tanda kutip, baris baru, dan tanda kurung siku yang akan diparse Vue sebagai sintaks template begitu fence tersebut menjadi atribut elemen |
| `docs/.vitepress/theme/components/Mermaid.vue` | Mendekode dan merender saat mount. Hanya di sisi klien: mermaid membutuhkan DOM untuk mengukur teks sebelum bisa menata graf, dan `import('mermaid')` yang dinamis menjaga engine layout tersebut tetap di luar setiap halaman yang tidak memiliki diagram |

Komponen ini mengikuti tema terang atau gelap pembaca dan merender ulang saat tema berpindah, karena mermaid
memanggang palet warnanya ke dalam SVG saat waktu render. Jika sebuah diagram gagal diparse, sumber mentahnya
ditampilkan alih-alih ruang kosong.

```bash
npm run docs:check-diagrams    # parse every diagram; exits non-zero on a syntax error
```

::: warning Diagram yang rusak tidak menggagalkan build
VitePress tidak pernah mem-parse sumber diagram; ia hanya meneruskannya. Kesalahan sintaks muncul sebagai blok
merah berisi sumber pada halaman yang dipublikasikan. Jalankan checker setelah mengedit diagram.
:::

::: info Jauhkan `<br/>` dari label transisi state-diagram
Tag ini berfungsi di label node `flowchart` dan di catatan sequence-diagram, yang merupakan tempat situs ini
menggunakannya. Label edge pada state-diagram adalah teks polos, sehingga `<br/>` di sana dirender secara
harfiah.
:::

### Bagaimana situs dokumentasi ini di-deploy

::: details Pipeline deployment (klik untuk memperluas)
1. Push ke `main` memicu webhook GitHub.
2. `scripts/webhook-listener.mjs` memverifikasi signature webhook (HMAC SHA-256) dan, pada event `push` ke
   `refs/heads/main`, menjalankan `scripts/deploy.sh`.
3. `deploy.sh`:
   - menolak berjalan jika working tree memiliki perubahan lokal, atau jika deploy sudah berjalan (via `flock`)
   - fetch dan hard-reset ke `origin/main`
   - menjalankan `npm ci`
   - membangun situs ke direktori `docs/.vitepress/dist_new` yang baru
   - menukarnya secara atomik ke `docs/.vitepress/dist` (`mv` biasa)
4. Di produksi, Apache menyajikan `docs/.vitepress/dist` **langsung dari disk** lewat `Alias` (lihat vhost
   `000-default-le-ssl.conf`); tidak ada proses `vitepress preview` yang berjalan di jalur permintaan, dan tidak
   ada unit systemd untuk itu. `npm run docs:preview` hanya untuk pengecekan lokal sesaat.
5. `webhook-listener.mjs` sendiri berjalan di bawah unit systemd `msd700-docs-webhook` pada `127.0.0.1:4701`.
:::

::: danger Jangan pernah menaruh `vitepress preview` di belakang Apache di produksi
Ini dulu adalah cara situs ini disajikan (`ProxyPass` ke proses `vitepress preview` berumur panjang pada
port 4700), dan secara diam-diam rusak setiap kali setelah deploy: server statis milik `preview` (`sirv`, dalam
mode produksi) memindai direktori output sekali saat startup dan menyimpan cache nama dan ukuran setiap file.
Rebuild yang mengubah nama file aset yang di-hash membuat cache tersebut menunjuk ke file yang sudah tidak ada
lagi sehingga setiap CSS/JS mengembalikan 404, dan `index.html` disajikan terpotong sesuai `Content-Length`
basi-nya. Menyajikan `dist/` langsung lewat `Alias` milik Apache sendiri (setup saat ini, lihat di bawah) tidak
memiliki cache semacam itu: Apache men-stat setiap file per permintaan, sehingga pertukaran `dist/` langsung
terdeteksi tanpa restart.
:::

## Terkait

- [Kontribusi](/id/development/contributing) - alur kerja dev lokal
- [Arsitektur](/id/development/architecture)
