---
outline: deep
---

# Panduan docker-manager.sh

<RoleBadge role="technician" />

`scripts/docker-manager.sh` adalah satu-satunya perintah untuk menjalankan unit. Skrip ini mem-build image, menjalankan dan menghentikan container robot serta stack server milik unit, meng-enrol robot, dan menyiapkan autostart saat boot. Jalankan **di unit**, dari root workspace:

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh <command> [flag]
```

- Flag boleh ditaruh sebelum atau sesudah command, urutan bebas: `up -d --dev` sama dengan `--dev up -d`.
- Tanpa argumen, skrip menampilkan help. Flag tanpa command berarti `up`.
- `build up` sama dengan `up --build`.
- Flag yang tidak dikenal skrip ini diteruskan apa adanya ke `run_msd.sh`, session runner ROS 1 di dalam container.
- `./scripts/docker-manager.sh help` menampilkan help bawaan.

File compose, image, dan volume di balik perintah ini ada di [Referensi Docker](/id/setup/docker-reference#unit-docker-manager-sh).

## Tugas umum

| Tugas | Perintah |
| --- | --- |
| Jalankan robot di cloud produksi dan dapatkan terminal kembali | `up -d` |
| Jalankan di cloud dev | `up --dev -d` |
| Jalankan robot ROS 2 (msd_system) | `up --ros2 -d` |
| Jalankan simulator Gazebo (laptop, tanpa hardware) | `up --simulator -d` |
| Hentikan semuanya | `down` |
| Pakai kode baru setelah `git pull` | `build`, lalu `down` dan `up -d` ([apa yang perlu rebuild](/id/setup/docker-reference#apa-yang-butuh-rebuild)) |
| Buka shell di container robot | `shell` (ROS 2: `shell --ros2`) |
| Ikuti output container robot | `logs` |
| Lihat apakah container jalan | `status` dan `local-status` |
| Restart stack web saja, robot tidak disentuh | `local-down`, lalu `local-up` |
| Daftarkan ulang robot ke cloud | `reenroll` |
| Lihat apa yang akan dijalankan saat reboot | `print-autostart-unit` |

## Command

### `up`

Menjalankan container robot dan stack lokal unit, lalu menjalankan session robot di dalam container (`run_msd.sh` di ROS 1, `run_ros2.sh` dengan `--ros2`).

- **Tidak mem-build apa pun** kecuali diberi `--build` atau image belum ada sama sekali, jadi bisa jalan offline. Image yang usang hanya menampilkan `[WARN] ... is OUT OF DATE` dan tetap dijalankan.
- **Meng-enrol** robot yang belum punya identitas: menampilkan claim code untuk disetujui admin ([Setup Unit Step 5](/id/setup/unit-setup#step-5-jalankan-robot-dan-enrol)).
- **Menahan terminal** tanpa `-d`: Ctrl-C, atau session yang berakhir, menghentikan semuanya seperti `down`.
- **Menyiapkan autostart boot**: memasang dan mengaktifkan `msd700.service` dengan flag mode run ini (`--dev`, `--simulator`, `--ros2`), jadi reboot menjalankan robot yang sama di cloud yang sama. `--no-autostart` melewati langkah ini.
- **Menolak** selama container robot lain jalan (`msd700`, `msd700_simulator`, atau `msd_system`). Jalankan `down` dulu.
- **Tidak pernah membuat ulang** container yang sedang jalan, bahkan setelah build. Untuk start dengan image baru: `down`, lalu `up`.

### `down` / `stop`

Menghentikan dan menghapus semua container robot (`msd700`, `msd700_simulator`, `msd_system`) serta stack lokal, dan menonaktifkan `msd700.service`. Peta, database lokal, kredensial, dan volume build ROS 2 tetap disimpan. `--no-autostart` membiarkan service tetap aktif.

### `build`

Mem-build semua yang dibutuhkan unit selagi online, supaya `up` berikutnya tidak butuh internet:

- ROS 1: image robot `msd700:latest` (atau `msd700-simulator:latest` dengan `--simulator`) beserta `catkin build`-nya, image stack lokal `ros-noetic-webui-app-local:latest` dan `ros-dashboard-next-local:latest`, serta menarik MySQL dan Mosquitto. Ketiga image di-build paralel; `BUILD_PARALLEL=false` mem-build satu per satu untuk unit yang memorinya kurang.
- ROS 2 (`--ros2`): `msd_system:pc` dari `src/msd_system/Docker/Dockerfile.pc`, layer `msd_system:robot` di atasnya, dan menarik Mosquitto.

Perubahan Python, launch, dan Node tidak perlu build: `src/` dan `ros-web-ui/source` di-mount ke container, jadi `up` langsung menjalankannya.

### `build-clean`

Sama dengan `build`, tanpa cache layer Docker. Cache unduhan apt, pip, npm, dan ccache tetap disimpan. Dengan `--ros2` juga menghapus volume build ROS 2, jadi start berikutnya meng-compile dari nol; ini hanya bisa saat container `msd_system` sudah tidak ada, jadi jalankan `down` dulu.

### `shell`

Membuka bash login shell di container robot, dan menjalankan container bila belum jalan. Beri flag mode yang sama dengan `up` untuk masuk ke container itu: `shell --simulator`, `shell --ros2`.

### `logs`

Mengikuti output container robot. Ctrl-C berhenti mengikuti; robot tetap jalan. Log session per window tmux ada di `logs/` ([window run_msd.sh](/id/setup/docker-reference#unit-run-msd-sh)).

### `status`

`docker compose ps` untuk container robot. Tambahkan flag mode (`--ros2`, `--simulator`) untuk melihat container itu. `local-status` menampilkan stack lokal.

### `reenroll`

Mendaftarkan ulang robot ke cloud saat cloud tidak lagi mengenalnya: unit dihapus di console, atau kredensialnya hilang. Bila unit masih ada di console, minta admin menekan **Unbind**; cara itu mempertahankan ULID unit dan semua peta di cloud.

Skrip menampilkan unit id dan status sync saat ini, lalu:

1. Mem-backup peta dan kredensial unit ke `unit_backups_local/`. Ini butuh stack lokal jalan (`local-up`).
2. Menghapus `device.json`, salinannya di `identities/`, dan `token.cred`.
3. Meminta Anda mengetik unit id sebagai konfirmasi.

`up` berikutnya menampilkan claim code. Opsi: `--fresh`, `--no-archive`, `-y` (di bawah).

### `print-autostart-unit`

Menampilkan `msd700.service` yang akan dipasang `up` untuk flag yang diberikan, tanpa memasangnya. Pakai di unit yang `up`-nya tidak bisa sudo, atau untuk mengecek mode sebelum diaktifkan:

```bash
./scripts/docker-manager.sh print-autostart-unit --ros2 --dev   # yang akan ditulis
grep ExecStart /etc/systemd/system/msd700.service               # yang aktif sekarang
```

### `local-up`, `local-down`, `local-build`, `local-logs`, `local-status`

Hanya bekerja pada stack server unit (database, broker MQTT, backend dan rosbridge, network agent, media, signalling, dashboard), tidak pernah robotnya. `up` sudah menjalankan stack ini; pakai perintah ini untuk restart atau rebuild sisi web saja. Dengan `--ros2`, `local-up` hanya menjalankan broker MQTT.

### `help`

Menampilkan help bawaan (juga `-h`, `--help`, atau tanpa argumen).

## Flag

### `--ros2`

Menjalankan robot ROS 2 ([msd_system](/ros2-msd-system/), Jazzy) sebagai ganti robot ROS 1 (`msd700_robot`, Noetic).

- **Dipakai dengan:** `build`, `build-clean`, `up`, `shell`, `logs`, `status`, `local-up`, `print-autostart-unit`.
- **Yang berubah:** image `msd_system:robot`, container `msd_system`, session runner `run_ros2.sh`. Stack lokal hanya menjalankan broker MQTT, jadi kendalikan robot dari dashboard cloud.
- **Start pertama** meng-compile workspace di dalam container (`colcon build`, offline); hasilnya disimpan di volume untuk start berikutnya.
- **Identitas sama:** memakai kredensial yang sama dengan ROS 1, jadi unit tetap memakai ULID-nya.
- **Tidak bisa digabung** dengan `--simulator`.

```bash
./scripts/docker-manager.sh build --ros2
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up --ros2 -d
```

Langkah lengkap: [Setup Unit § Beralih ke stack ROS 2](/id/setup/unit-setup#ros2-stack).

### `--simulator`, `-s`

Menjalankan image simulator Gazebo (`msd700-simulator:latest`, container `msd700_simulator`) sebagai ganti robot hardware. Untuk laptop tanpa robot. Build dulu dengan `build --simulator`, yang juga mengunduh world simulator. `MSD700_SIM_HEADLESS=true` di `docker/.env` menjalankan Gazebo tanpa jendela.

- **Dipakai dengan:** `build`, `build-clean`, `up`, `shell`, `logs`, `status`, `print-autostart-unit`.
- Ditanam ke `msd700.service`, jadi reboot tidak kembali sebagai robot hardware.

### `--dev`

Terhubung ke **cloud dev**, bukan produksi:

| | Produksi (tanpa flag) | Dev (`--dev`) |
| --- | --- | --- |
| Backend | `https://msd.nglobal.jp/services/rosbackend` | `http://118.22.31.252:5001` |
| Broker MQTT | `msd.nglobal.jp:8883` | `msd.nglobal.jp:8884` |
| ROS master robot sendiri (ROS 1) | `11321` | `11322` |

- Unit menyimpan identitas terpisah per cloud. `up --dev` pertama di unit yang terdaftar di produksi menampilkan claim code dan menunggu admin dev ([satu robot, dua cloud](/id/development/webui/accounts/enrolment#one-robot-two-clouds)).
- Stack lokal dan dashboard lokal tetap jalan di kedua mode.
- Ditanam ke `msd700.service`, jadi reboot kembali ke dev.
- `DEV_SERVER_HOST` dan `DEV_BACKEND_PORT` memindahkan backend dev.

### `--build`

Dengan `up`: rebuild image dulu, lalu compile workspace di dalam container (`catkin build` di ROS 1, `colcon build` di ROS 2). Butuh internet. Container yang sudah jalan tetap memakai image lama, jadi jalankan `down` dulu:

```bash
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up --build -d
```

### `-d`, `--detach`

Hanya dengan `up`. Proses start tetap di foreground, jadi output build, claim code, dan error tetap terlihat, dan Ctrl-C sebelum robot siap membatalkan dan membersihkan. Setelah semuanya jalan, terminal dikembalikan, dan menutupnya (atau sesi ssh) tidak lagi menghentikan robot.

Tanpa `-d`, terminal tetap terpasang dan Ctrl-C menghentikan semuanya. Untuk melihat session yang di-detach nanti:

```bash
docker exec -it msd700 tmux attach -t robot_services       # ROS 1 (msd700_simulator untuk simulator)
docker exec -it msd_system tmux attach -t robot_services   # ROS 2
# biarkan tetap jalan: Ctrl-b, lalu d
```

`-d` **bukan** debug: untuk itu tulis `--debug` lengkap.

### `--no-autostart`

Dengan `up` atau `down`: biarkan `msd700.service` apa adanya. `up --no-autostart` tidak mengaktifkan service, dan `down --no-autostart` tidak menonaktifkannya (service sendiri memanggil `down` dengan cara ini). Pakai untuk run uji yang tidak boleh bertahan setelah reboot. Service yang sudah aktif sebelumnya tetap aktif dengan flag lamanya.

### `--debug`

Diteruskan ke `run_msd.sh` (ROS 1): output verbose. Tulis lengkap; `-d` di sini berarti detach.

### `--dry-run`

Diteruskan ke session runner, yang menampilkan perintah yang akan dijalankan alih-alih menjalankan session. **Bukan pratinjau yang aman:** container tetap start, `msd700.service` tetap diaktifkan (tambahkan `--no-autostart`), dan di ROS 1 bisa mematikan session yang sedang jalan dan menghubungi enrolment. Di ROS 2 enrolment dilewati, workspace di-compile bila perlu, ketiga perintah window ditampilkan, lalu keluar.

### `--kill`

Diteruskan ke session runner: mematikan session tmux robot di dalam container lalu keluar. Untuk menghentikan semuanya, pakai `down`.

### `--fresh`

Hanya dengan `reenroll`. Juga menghapus cache lokal (`mysql_data_local`, `media_data_local`, `mosquitto_data_local`). Untuk robot yang berangkat dengan rental **baru**. Tanpa flag ini cache disimpan dan full sync merekonsiliasinya.

### `--no-archive`

Hanya dengan `reenroll`. Melewati backup. Aman hanya bila unit sudah sync semuanya; kalau tidak, peta yang direkam offline hilang.

### `-y`, `--yes`

Hanya dengan `reenroll`. Tidak menanyakan apa pun, termasuk konfirmasi unit id, dan tetap lanjut tanpa backup bila backup gagal.

### `--local` (deprecated)

Diterima dan diabaikan. Stack lokal tetap start; dipertahankan supaya skrip lama tidak rusak.

### `--unit_id` (ditolak)

Sengaja dihapus dan gagal dengan penjelasan. Identitas berasal dari admin console cloud: robot baru menampilkan claim code, dan admin mendaftarkannya atau meng-adopt-nya ke ULID yang sudah ada.

### Flag lain

Selain di atas, flag diteruskan apa adanya ke `run_msd.sh`, misalnya `--camera_device /dev/video2` atau `--no-build`. Daftar lengkapnya ada di [Referensi Docker § run_msd.sh](/id/setup/docker-reference#unit-run-msd-sh). Dengan `--ros2` flag ini dibuang dengan warning, karena `run_ros2.sh` hanya mengenal `--dry-run` dan `--kill`.

## Aturan

- **Satu stack robot pada satu waktu.** ROS 1, simulator, dan ROS 2 berbagi network host, `/dev`, dan identitas unit.
- **Flag mode memilih robot.** `--dev`, `--simulator`, dan `--ros2` menentukan robot mana yang jalan dan ke cloud mana. Beri flag yang sama ke `shell`, `logs`, dan `status`; `up` menanamnya ke `msd700.service`.
- **`--ros2` bersama `--simulator` ditolak.**
- **Flag yang salah tempat menampilkan warning dan diabaikan**, misalnya `-d` selain pada `up`, atau `--fresh` selain pada `reenroll`.

## Environment variable

Set langsung di baris perintah (`VAR=value ./scripts/docker-manager.sh up -d`) atau di `docker/.env`, yang dibaca skrip. Yang paling sering dipakai:

| Variabel | Default | Fungsi |
| --- | --- | --- |
| `CLOUD_BASE_URL` | backend produksi atau dev | Arahkan unit ke cloud lain |
| `DEV_SERVER_HOST`, `DEV_BACKEND_PORT` | `118.22.31.252`, `5001` | Tujuan `--dev` |
| `ROS_MASTER_PORT` | `11321`, `11322` dengan `--dev` | ROS master robot sendiri. Jangan pernah `11311`/`11312` milik cloud |
| `BUILD_PARALLEL` | `true` | `false` mem-build image satu per satu |
| `ENROLL_CODE` | tidak diset | Kode registrasi sekali pakai, melewati daftar pending |
| `MSD_ROS2_PROFILE` | `prototype` | Profil bridge ROS 2: `prototype` atau `sim` |
| `MSD_ROS2_BRINGUP_CMD` | kosong | ROS 2: perintah untuk window `bringup`, misalnya navigasi |
| `MSD_ROS2_WEBUI_ARGS` | kosong | ROS 2: argumen tambahan untuk `webui.launch.py` |

Semua variabel: [Referensi Docker § Environment variable yang diteruskan](/id/setup/docker-reference#environment-variable-yang-diteruskan) dan [referensi `.env` unit](/id/setup/docker-reference#referensi-env-unit).
