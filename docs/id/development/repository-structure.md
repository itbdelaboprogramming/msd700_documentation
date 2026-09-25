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
├── Certificates/                # Cache kredensial robot (token.cred selalu; device.json ditulis di sini oleh scripts/enroll.py saat enrolment), sertifikat MQTT/SQL
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
│       ├── ssl_update/             # Certbot renewal + HiveMQ keystore rebuild
│       ├── network-agent/          # Unit network helper
│       └── shared/                 # Shared JS (jwt_keyring.js et al.)
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
├── msd700_bringup/           # Launch files for primitive robot tasks
├── msd700_control/           # Sensor fusion (robot_localization), twist_mux
├── msd700_coverage/          # Boustrophedon sweep planner (path_coverage_node)
├── msd700_description/       # URDF, including msd700_field.urdf.xacro (real size)
├── msd700_firmware/          # Legacy Arduino firmware (reference only; the unit runs the STM32 firmware from firmware-msd700)
├── msd700_hardware/          # Hardware drivers (serial, Velodyne, odometry)
├── msd700_movement/          # Vendored third_party only
├── msd700_msgs/              # Robot-level messages
├── msd700_navigation/        # move_base, TEB, SLAM, costmaps
├── msd700_perception/        # Velodyne pipelines (scan, hazard)
├── msd700_simulation/        # Gazebo worlds and sim launches
│   ├── worlds/               #   small, TurtleBot-scale worlds, committed
│   ├── scripts/              #   fetch_sim_worlds.sh: pulls the AWS warehouse
│   └── vendor/               #   fetched third-party worlds, gitignored
└── third_party/              # ira_laser_tools et al.
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
│   ├── Dockerfile.webui-local # Unit local-stack image (COPYs ros-web-ui source in)
│   ├── docker-compose.yml     # The single `msd700` robot container
│   ├── entrypoint.sh          # Container entrypoint
│   ├── .env.example           # Copied to .env on first run
│   ├── mosquitto/             # This unit's own local MQTT broker config
│   └── networkmanager/        # Unit NetworkManager dispatcher scripts
└── src/                       # Populated via git submodules:
    ├── msd700_robot/
    ├── ros-web-ui/
    └── ROS-dashboard-next-ts/
    # NOTE: on a Server checkout (like this one) the submodules are NOT
    # initialized: src/ holds only CMakeLists.txt. The robot code lives in
    # the sibling directories /msd700_robot and /ros-web-ui instead.
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
│   │       └── components/       # LinkCard(s), RoleBadge
│   ├── index.md                 # homepage
│   ├── user-guide/              # end-user docs
│   ├── setup/                   # technician / deployment docs
│   ├── development/             # developer docs (this section)
│   └── */diagrams/*.drawio      # diagram sources, next to the pages that use them
├── scripts/
│   ├── deploy.sh                 # builds the site and swaps it into docs/.vitepress/dist
│   ├── webhook-listener.mjs      # GitHub webhook receiver that triggers deploy.sh on push to main
│   ├── drawio-viewer.mjs         # pinned draw.io viewer (version/URL/hash) shipped to the browser
│   ├── diagram-hash.mjs          # .drawio content hash shared by the plugin and config.mts
│   ├── apache-snippet.conf       # ProxyPass rules for the Apache front end
│   └── systemd/                  # systemd unit for the webhook listener
├── package.json
└── package-lock.json
```

### Diagram

Diagram berupa file draw.io (`.drawio`) yang disimpan di folder `diagrams/` di samping halaman yang
memakainya, misalnya `docs/setup/diagrams/wifi-hotspot-how-it-fits-together.drawio`. Pembaca melihat
gambarnya, bukan editor.

Halaman menggambar `.drawio` itu sendiri dengan viewer resmi draw.io, view-only. Tidak ada gambar
yang perlu dibuat dan tidak ada salinan kedua yang bisa tidak sinkron: `.drawio` adalah satu-satunya
sumber, dan drawio-assets.mjs menyajikan/meng-emit-nya dengan hash dari isinya sendiri.

**Mengedit diagram:** buka file `.drawio` di draw.io: ekstensi
[Draw.io Integration](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio)
di VS Code (langsung mengedit file-nya), aplikasi desktop, atau
[app.diagrams.net](https://app.diagrams.net). Kotak, grup, dan garis adalah shape draw.io biasa:
geser, atur jalur garis dengan menarik titik beloknya, lalu simpan. Pertahankan gaya yang sama (kotak
putih, garis hitam tipis, Helvetica, konektor siku, judul grup di tab pojok kiri atas grupnya) dengan
menyalin shape yang sudah ada, bukan memakai default palet.

**Menyisipkan diagram:** pakai sintaks gambar dengan path relatif terhadap halaman. Alt text adalah
yang dibacakan screen reader dan yang tampil jika gambar tidak ada:

```md
![Cara kerja keseluruhannya](./diagrams/wifi-hotspot-how-it-fits-together.drawio)
```

Halaman terjemahan boleh menunjuk file bahasa Inggris jika diagramnya tidak punya teks yang perlu
diterjemahkan (misalnya `../../development/diagrams/architecture-system-topology-and-data-flow.drawio`
dari `docs/id/development/`), atau salinannya sendiri di `docs/id/.../diagrams/` atau
`docs/ja/.../diagrams/` jika labelnya diterjemahkan.

| Bagian | Tugas |
| --- | --- |
| `scripts/diagram-hash.mjs` | Hash isi file `.drawio`. Dipakai bersama oleh plugin Vite dan markdown hook, sehingga keduanya menunjuk file yang sama |
| `scripts/drawio-viewer.mjs` | Viewer draw.io versi terkunci (versi, URL, SHA-256) dan pengunduhnya; drawio-assets.mjs mengirim byte yang sama ke browser |
| `docs/.vitepress/drawio-assets.mjs` | Plugin Vite: menyajikan setiap `.drawio` berdasarkan hash-nya di dev dan meng-emit-nya (plus viewer) ke hasil build, sehingga `.drawio` tetap jadi satu-satunya sumber dan tidak ada salinan ke `docs/public` |
| `docs/.vitepress/theme/components/DrawioDiagram.vue` | Menggambar satu `.drawio` view-only di halaman (viewer diambil sekali per halaman) dan membuka viewer zoom saat diklik. Terkunci ke light mode; tidak ada jalur edit |
| `docs/.vitepress/theme/zoom-viewer.ts` | Pop-up zoom/pan view-only layar penuh yang dipakai bersama (roda/tombol zoom ke kursor, geser untuk pan, Esc menutup) |
| `docs/.vitepress/config.mts`, `markdown.config` | Mengubah setiap `![...](....drawio)` menjadi `<DrawioDiagram>`. Jika sumbernya hilang, build mencetak peringatan `[diagrams]` dan halaman menampilkan placeholder |

Tidak ada yang perlu dibuat: edit `.drawio` dan halaman langsung membacanya. Commit `.drawio` bersama
perubahan markdown. Jika halaman dev masih menampilkan gambar lama, restart `npm run docs:dev`
(`vitepress dev` meng-cache markdown berdasarkan isi `.md`, yang tidak berubah saat `.drawio` diedit).

::: warning Diagram hilang
Path `![...](....drawio)` di halaman diselesaikan saat build. Jika filenya tidak ada, build mencetak
peringatan `[diagrams]` dan halaman menampilkan placeholder `Missing diagram`; perbaiki path atau
tambahkan filenya.
:::

::: info Kenapa draw.io, bukan Mermaid
Dulu diagram ditulis sebagai fence Mermaid yang di-layout otomatis. Layout otomatis menentukan posisi
setiap kotak dan garis, jadi garis yang mepet judul atau kotak yang posisinya janggal hanya bisa diakali
secara tidak langsung. Di draw.io setiap posisi eksplisit dan bisa dirapikan langsung.
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
