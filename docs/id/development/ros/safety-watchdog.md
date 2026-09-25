---
outline: deep
search: false
---

# Pengawas Keselamatan dan Supervisi Heartbeat

<RoleBadge role="developer" />

Software onboard memantau kehadiran operator dengan watchdog yang berjalan di dalam `system_command.py`. Ini adalah mekanisme keselamatan internal robot tanpa UI dashboard sendiri; untuk bagaimana operator melihat efeknya (field `in_use`/lease, activity state yang dapat dipaksakan), lihat [Arsitektur § Matriks Kepemilikan dan Persistensi State](/id/development/architecture#matriks-kepemilikan-dan-persistensi-state) dan [Navigasi: Manual Override & Autopilot](/id/development/webui/navigation/manual-and-autopilot).

![Pengawas Keselamatan dan Supervisi Heartbeat](../../../development/ros/diagrams/safety-watchdog-safety-watchdog-and-heartbeat-supervisio.drawio)


## Dua sinyal kehadiran

Watchdog menerima salah satu dari dua sinyal sebagai bukti bahwa halaman operator sedang mengawasi:

| Sinyal | Jalur | Rate | Isinya |
| --- | --- | --- | --- |
| `ping` | Browser → `POST /api/hardware/ping` → backend → MQTT → `/system_command` | 1 Hz, timeout request 1.5 s | Kehadiran **dan** otoritas: lease operasi, claim/release/takeover, `origin` yang dicap backend, feedback status |
| `heartbeat` | Browser → MQTT over WebSocket langsung ke Mosquitto unit (`NEXT_PUBLIC_MQTT_WS_URL`, port `9001`) → `/system_command` | 5 Hz, QoS 0, tanpa retain | Kehadiran saja (`data.page`). Tidak memberi apa pun: tanpa claim, release, origin, atau feedback |

Heartbeat ada karena ping HTTP adalah round trip lewat cloud: di link yang lossy, dua ping hilang berturut-turut sudah memicu tingkat 2 detik. Heartbeat butuh sepuluh kehilangan berturut-turut. Heartbeat hanya berjalan jika dashboard di-build dengan `NEXT_PUBLIC_MQTT_WS_URL`, seperti dashboard lokal unit (`ws://<LOCAL_IP>:9001`); dashboard cloud tidak mengaturnya, jadi sesi cloud hanya diawasi oleh ping HTTP. Pengirimnya `heartbeatService.ts`; penerimanya `_operator_heartbeat` di `system_command.py`.

## Tingkatan Waktu Watchdog Heartbeat

Nilai diambil dari `msd700_webui_control/config/system_command.yaml`.

1. **2 detik (motion pause)**: Tanpa kehadiran selama 2 detik (`ping_pause_timeout: 2.0`, dicek setiap `ping_monitor_interval: 0.2`), `system_command.py` me-latch `/emergency_pause` (`std_msgs/Bool`) dan `emergency_stop_node` membanjiri zero-twist pada `/mux/emergency_vel` dengan prioritas 255. Goal `move_base` yang aktif tidak dibatalkan. Ping atau heartbeat berikutnya yang diterima melepas pause dan gerakan berlanjut.
2. **10 menit (session teardown)**: Tanpa kehadiran selama 10 menit (`ping_timeout: 600.0`), sesi navigasi atau mapping aktif dibongkar dan robot menjadi idle.
3. **30 menit (hardware shutdown)**: Setelah 30 menit (`ping_shutdown_timeout: 1800.0`) lease operasi dilepas, state operation supervisor dan manual override dibersihkan, dan semua hardware dimatikan dengan motion lock tetap aktif. Tingkat ini **tidak** pulih saat tersambung kembali: hardware harus diinisialisasi ulang secara eksplisit.

Hanya halaman yang memiliki operasi berjalan yang menahan tingkatan ini. Daftar unit dan halaman login bersifat read-only dan tidak pernah dihitung sebagai mengawasi.

::: warning Pengecualian Mode Autopilot
Selama Autopilot aktif, **ketiga** tingkatan ditangguhkan: pause 2 detik, peralihan idle 10 menit, dan shutdown 30 menit. Robot menyelesaikan rute otonomnya bahkan jika operator menutup laptop atau melewati zona mati Wi-Fi. Lihat [Navigasi: Manual Override & Autopilot](/id/development/webui/navigation/manual-and-autopilot) dan [Mapping: Manual Override & Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous) untuk apa yang memicu pengecualian ini dari masing-masing halaman.
:::

## Terkait

- [Arsitektur § Matriks Kepemilikan dan Persistensi State](/id/development/architecture#matriks-kepemilikan-dan-persistensi-state)
- [Navigasi: Manual Override & Autopilot](/id/development/webui/navigation/manual-and-autopilot)
- [Mapping: Manual Override & Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous)
- [Daftar Paket ROS](/id/development/ros/ros-packages)
