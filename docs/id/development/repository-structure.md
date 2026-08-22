---
search: false
---
# Struktur Repositori

<RoleBadge role="developer" />

MSD700 mencakup empat repositori. Yang ini (`msd700_documentation`) hanyalah situs dokumen; produk
sendiri tinggal di tiga lainnya, yang merupakan saudara kandung di checkout Server dan submodul dari
`msd700_noetic` pada checkout Unit: kode yang sama, dua cara perakitan yang berbeda.

## `ros-web-ui`: paket yang terhubung ke web, backend, dan konteks pembangunan frontend

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

`ros-web-ui` adalah satu repositori yang digunakan dalam **tiga konteks berbeda**: dibuat sebagai Server
backend/rosbridge (`docker-compose.yml`), bersumber ke ruang kerja Unit untuk robot yang menghadap ke web
node (`msd700_noetic/src/ros-web-ui`), dan dijalankan secara mandiri sebagai robot setengah jalan
`docker-compose.robot.yml` pada host non-Jetson (laptop dev, atau server dokumentasi ini, pengujian
simulatornya). Yang mana yang Anda dapatkan bergantung sepenuhnya pada file penulisan/skrip mana yang memintanya, bukan pada
apa pun di repo itu sendiri.

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
│   ├── scripts/              #   fetch_sim_worlds.sh: pulls the AWS warehouse
│   └── vendor/               #   fetched third-party worlds, gitignored
├── msd700_visual/            # RViz/Gazebo robot visuals
├── msd700_hardware/          # Hardware drivers
├── msd700_description/       # URDF, including msd700_field.urdf.xacro (real size)
└── ros_msd700_msgs/
```

Hanya `msd700_field.urdf.xacro` yang merupakan robot asli berukuran 0,90 x 0,70 m; setiap model lain di sini adalah a
Turunan TurtleBot3 Waffle pada ketinggian 0,266 m, dan ukuran dunia yang berkomitmen disesuaikan. Lihat
[Simulasi](/id/development/simulation) yang kombinasinya dapat memvalidasi geometri cakupan.

Bersumber dari `msd700_noetic` (sebagai submodul, `src/msd700_robot`) dan disalin ke `ros-web-ui`
milik `source/msd700_robot`. Robot setengah dari sebuah build membutuhkan tumpukan navigasi repo ini dan
`ros-web-ui` paket yang terhubung ke web di ruang kerja catkin yang sama.

## `msd700_noetic`: Orkestrasi Jetson/robot

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

Inilah yang sebenarnya dijalankan oleh Unit. `src/` diikat ke dalam wadah (tidak dipanggang), jadi
mengedit file peluncuran atau node Python di host akan berlaku pada peluncuran berikutnya tanpa membangun kembali;
hanya ketergantungan atau perubahan gambar dasar yang memerlukan `docker-manager.sh build`. Pada mesin Server (seperti ini
host situs dokumentasi sendiri), `src/` secara sah tidak ada atau kosong kecuali Anda secara spesifik
menguji setengah robot di sini. Server menjalankan `ros-web-ui` milik `docker-compose.yml` sebagai gantinya, yang mana
tidak membutuhkan semua ini.

## `ROS-dashboard-next-ts`: dasbor operator

Aplikasi Next.js miliknya sendiri, dibuat dua kali dari sumber yang sama dengan URL bawaan yang berbeda:

- **Pembangunan server** (`frontend_prod`/`frontend_dev` di `ros-web-ui/docker-compose.yml`): pembicaraan dengan
  Backend/rosbridge/media/sinyal milik server sendiri, melalui jalur HTTPS/WSS publik proksi Apache.
- **Pembuatan unit** (di dalam wadah `msd700_noetic`, atau `docker-compose.yml` saat
  menjalankan robot setengah mandiri): berbicara dengan layanan lokal unit yang sama, yang dimasukkan melalui
  `NEXT_PUBLIC_*` argumen build menunjuk ke IP unit itu sendiri.

Karena URL tersebut dikompilasi **ke dalam** bundel JS, bukan dibaca saat runtime, sehingga mengubah URL mana
server tempat build point selalu memerlukan pembangunan kembali image, tidak hanya sekedar restart.

## Repositori ini (`msd700_documentation`)

Hanya situs dokumen VitePress, tanpa kode produk.

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
│   ├── getting-started/         # end-user docs
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

Diagram ditulis sebagai ```` ```mermaid ```` fences in markdown and rendered as real SVG in the
browser. Two pieces make that work:

| Piece | Job |
| --- | --- |
| `docs/.vitepress/config.mts`, `markdown.config` | Rewrites every `mermaid` fence into `<Mermaid code="<base64>" />`. Base64 because the diagram source is full of quotes, newlines and angle brackets that Vue would parse as template syntax once the fence became an element attribute |
| `docs/.vitepress/theme/components/Mermaid.vue` | Decodes it and renders on mount. Client-side only: mermaid needs a DOM to measure text before it can lay a graph out, and the dynamic `import('mermaid')` keeps the layout engine out of every page with no diagram on it |

The component follows the reader's light or dark theme and re-renders on a theme flip, because
mermaid bakes its palette into the SVG at render time. If a diagram fails to parse, the raw source is
shown instead of an empty gap.

```bash
npm jalankan docs:check-diagrams # parsing setiap diagram; keluar bukan nol karena kesalahan sintaksis
```

::: warning A broken diagram does not fail the build
VitePress tidak pernah mem-parsing sumber diagram; itu hanya melewatinya. Kesalahan sintaksis muncul sebagai a
blok sumber merah pada halaman yang diterbitkan. Jalankan pemeriksa setelah mengedit diagram.
:::

::: info Keep `<br/>` out of state-diagram transition labels
Ia bekerja di label node `flowchart` dan dalam catatan diagram urutan, di mana situs ini menggunakannya.
Label tepi diagram keadaan adalah teks biasa, jadi `<br/>` di sana ditampilkan secara harfiah.
:::

### Bagaimana situs dokumen disebarkan

::: details Deployment pipeline (click to expand)
1. Dorongan ke `main` memicu webhook GitHub.
2. `scripts/webhook-listener.mjs` memverifikasi tanda tangan webhook (HMAC SHA-256) dan, pada acara `push` ke `refs/heads/main`, memunculkan `scripts/deploy.sh`.
3.`deploy.sh`:
   - menolak untuk dijalankan jika pohon kerja mempunyai perubahan lokal, atau jika penerapan sudah berlangsung (melalui `flock`)
   - mengambil dan melakukan hard-reset ke `origin/main`
   - menjalankan `npm ci`
   - membangun situs menjadi direktori `docs/.vitepress/dist_new` yang baru
   - menukarnya secara atom ke `docs/.vitepress/dist` (polos `mv`)
4. Dalam produksi, Apache melayani `docs/.vitepress/dist` **langsung dari disk** melalui `Alias` (lihat
   `000-default-le-ssl.conf` vhost); tidak ada proses `vitepress preview` yang berjalan dalam permintaan
   jalur, dan tidak ada unit systemd untuk satu. `npm run docs:preview` hanya untuk pemeriksaan lokal saja.
5. `webhook-listener.mjs` sendiri berjalan di bawah unit `msd700-docs-webhook` systemd di `127.0.0.1:4701`.
:::

::: danger Never put `vitepress preview` behind Apache in production
Ini dulunya adalah cara situs disajikan (`ProxyPass` ke proses `vitepress preview` yang berumur panjang di
port 4700), dan diam-diam rusak setelah setiap penerapan: server statis `preview` (`sirv`, di
mode produksi) memindai direktori keluaran satu kali saat startup dan menyimpan setiap nama dan ukuran file dalam cache. SEBUAH
membangun kembali perubahan nama file aset yang di-hash meninggalkan cache yang menunjuk ke file yang tidak ada lagi
jadi setiap CSS/JS 404, dan `index.html` disajikan terpotong hingga basi `Content-Length`. Melayani
`dist/` langsung melalui `Alias` milik Apache (penyiapan saat ini, lihat di bawah) tidak memiliki cache seperti itu: Statistik Apache
setiap file per permintaan, sehingga swap `dist/` diambil segera tanpa restart.
:::

## Terkait

- [Berkontribusi](/id/development/contributing) - alur kerja pengembang lokal
- [Arsitektur](/id/development/architecture)