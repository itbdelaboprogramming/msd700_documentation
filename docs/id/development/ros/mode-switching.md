---
outline: deep
search: false
---

# Arsitektur Pergantian Node dan Mode Dinamis

<RoleBadge role="developer" />

Dokumen ini merinci bagaimana robot MSD700 secara dinamis berpindah antara mode operasional (`navigation`, `slam`, `explore`, `boustrophedon` — idle hanyalah "tidak ada launch stack") saat runtime menggunakan `switch_mode.py`, `system_command.py`, dan `operation_supervisor.py` tanpa me-restart ROS core utama. Nama mode berasal dari `switch_mode.yaml` dan harus cocok dengan string yang dikirim lewat service `/switch_mode`.

## Topologi Orkestrasi Mode

```mermaid
flowchart TD
  MQTT["MQTT /system_command"] --> SYS_CMD["system_command.py<br/>(Master Command Dispatcher)"]

  SYS_CMD -->|"Calls ROS Service: /switch_mode"| SWITCH["switch_mode.py<br/>(Dynamic Process Lifecycle Manager)"]

  SWITCH -->|Spawn / Terminate via subprocess + killall| LAUNCH_STACKS

  subgraph LAUNCH_STACKS["Dynamic Launch Subsystems"]
    NAV_STACK["Navigation Stack (msd700_navigation.launch)<br/>map_server, amcl, move_base, TEB planner"]
    SLAM_STACK["SLAM Mapping Stack (msd700_slam.launch)<br/>slam_gmapping (teleop is a separate robot_teleop.launch)"]
    COV_STACK["Area Coverage Stack (msd700_coverage/msd700_boustrophedon.launch)<br/>path_coverage_node, coverage_geometry"]
    EXP_STACK["Exploration Stack (msd700_explore.launch)<br/>explore_lite, frontier exploration"]
  end

  SYS_CMD -->|"Dispatches Goals"| OP_SUP["operation_supervisor.py<br/>(Autopilot Mission Sequencer)"]
  OP_SUP --> NAV_STACK
```

---

## Mode Operasi dan Stack Node Aktif

| Mode (`switch_mode.yaml`) | Launch file | Catatan |
| --- | --- | --- |
| (idle — tanpa stack) | — | Node dasar tetap berjalan (`serial_node`, `imu_filter`, `robot_state_publisher`, `aws_mqtt`, `camera_client`). |
| **`navigation`** | `msd700_navigation.launch` | `map_server`, `amcl`, `move_base`, costmap. |
| **`slam`** | `msd700_slam.launch` | Pemetaan live; teleop adalah launch terpisah, bukan bagian dari stack. |
| **`explore`** | `msd700_explore.launch` | Pencarian frontier `explore_lite`. |
| **`boustrophedon`** | `msd700_coverage/msd700_boustrophedon.launch` | `path_coverage_node`; `use_autocover` mati secara default. |

---

## Siklus Hidup Proses Dinamis via `subprocess`

`switch_mode.py` men-spawn setiap stack dengan `subprocess.Popen(cmd_list, ...)` dan menghentikannya dengan timeout dari `switch_mode.yaml`:

```yaml
timeouts:
  graceful_shutdown: 3   # seconds before escalation
  force_kill: 1          # seconds before SIGKILL
```

### Graceful Teardown dan Pencegahan Zombie:
1. **Terminate**: process group dari stack aktif diminta shutdown secara graceful.
2. **Grace Window 3 Detik**: Node diberi waktu hingga 3 detik untuk flush state (misalnya `map_saver` menulis `.pgm`/`.yaml`).
3. **Eskalasi**: melewati grace window, switcher eskalasi ke force-kill (`1 s`), dan sisa simulator di-reap dengan `killall`, memastikan tidak ada node zombie yang tersisa di graph ROS master.

---

## Sequencing Misi Autopilot (`operation_supervisor.py`)

`operation_supervisor.py` mengelola eksekusi otonom dari rute waypoint multi-langkah dan playlist cakupan area:

```mermaid
stateDiagram-v2
  [*] --> SupervisorIdle

  SupervisorIdle --> StepActive: Goal dispatched from Playlist
  StepActive --> DwellWaiting: move_base reports Goal Succeeded
  DwellWaiting --> StepActive: Dwell timer expired, advance next waypoint
  StepActive --> Paused: Safety watchdog triggers or operator pauses
  Paused --> StepActive: Operator clicks Resume
  StepActive --> Completed: All waypoints in playlist reached
  Completed --> SupervisorIdle: Return to Homebase and latch final snapshot
```

### Kemampuan Kunci Supervisor:
- **Latched Operation Snapshot**: Mempublikasikan `/string/operation_snapshot` dengan QoS latched. Ketika operator mana pun membuka tab browser, state lengkap dari misi aktif (indeks waypoint aktif, sisa pin rute, dwell timer) dipulihkan dalam hitungan milidetik.
- **Pengecualian Keselamatan Autopilot**: Ketika Autopilot diaktifkan (ON), supervisor menekan pause disconnect operator 10 detik, memungkinkan misi sapuan jangka panjang berlanjut tanpa pengawasan.

## Dokumentasi Terkait

- [Daftar Paket ROS](/id/development/ros/ros-packages): Struktur paket dan definisi launch file.
- [State dan Perilaku](/id/development/state-and-behavior): Finite state machine detail dan tier watchdog.
- [Kontrak Pesan](/id/development/message-contracts): Payload pesan MQTT dan operation sync.
