---
outline: deep
search: false
---

# Firmware, Mikrokontroler, dan Bus Hardware

<RoleBadge role="developer" />

Motor unit digerakkan oleh board **STM32H723** (`0483:5740`, USB virtual COM port, symlink udev `/dev/stm32`) yang menjalankan FreeRTOS. Firmware-nya ada di repository terpisah `firmware-msd700`, project `STM32H7_MSD700_Unified_Firmware` (STM32CubeIDE). Firmware menerima perintah dari **dua** sumber, receiver RC SBUS atau Jetson lewat ROS, dan menjalankan loop PID kecepatan di tiap roda.

::: info Firmware Arduino legacy
`msd700_robot/msd700_firmware/firmware/firmware.ino` (dan `firmware-msd700/firmware_msd700`) adalah sketch Arduino Mega versi lama. File ini disimpan sebagai referensi dan memakai message `hardware_state` / `hardware_command` yang sama, tetapi bukan firmware yang dijalankan unit saat ini.
:::

## Topologi Kontrol Embedded

![Topologi Kontrol Embedded](../../../development/ros/diagrams/firmware-and-hardware-embedded-control-topology.drawio)

## Interface ROS

Firmware adalah node rosserial dengan satu publisher dan satu subscriber:

| Arah | Topic | Message | Catatan |
| --- | --- | --- | --- |
| MCU → Jetson | `hardware_state` | `msd700_msgs/HardwareState` | Dikirim setiap 50 ms selama host terhubung. Berisi delta pulse encoder sejak publish terakhir, heading/roll/pitch CMPS12, accelerometer/gyro/magnetometer, dan target follower UWB. Kedelapan field ultrasonic selalu `0.0` |
| Jetson → MCU | `hardware_command` | `msd700_msgs/HardwareCommand` | `right_motor_speed` / `left_motor_speed` menjadi target RPM roda di mode PC |

Di Jetson, `serial_launch.launch` menjalankan `rosserial_python` pada `/dev/stm32` (`baud` 57600; link-nya USB CDC, jadi nilai ini bukan kecepatan jalur sebenarnya). Pada `hardware_mode 1` (default), `hardware_state.py` (`raw_sensor_node`) mengubah `hardware_state` menjadi `/wheel/odom`, `/imu/data_raw`, dan `/imu/mag`, sedangkan `bridger.py` mengubah `/cmd_vel` hasil mux menjadi `hardware_command`. Keduanya membaca geometri roda dari `msd700_control/config/pose_config.yaml` (`wheel_radius 2.75` cm, `wheel_distance 26.0` cm, hasil ukur di robot sungguhan). Lihat [Sensor Fusion & Kontrol](/id/development/ros/sensor-fusion-and-control).

Tidak ada topic `/battery_state` di mana pun dalam stack.

## Arming dan sumber perintah

Arming dan pemilihan sumber berasal dari receiver SBUS (`USART1`, 100 kbaud, inverted):

| Channel SBUS | Arti |
| --- | --- |
| Channel 3 (mulai dari 0) | Saklar arm. Di atas 992 = **ARMED** (lampu menyala), selain itu DISARMED |
| Channel 2 | Di bawah 1000 = mode RC: channel 0/1 dipetakan ke ±40 RPM maju/belok. Selain itu mode PC: target RPM berasal dari `hardware_command` |

Jika tidak ada frame SBUS selama **400 ms** (receiver dicabut atau di luar jangkauan), kendaraan turun ke DISARMED. Selama disarmed, kedua loop PID di-reset dan semua output PWM ditahan di 0, apa pun yang dikirim dari sisi ROS. Watchdog hardware terpisah (IWDG) di-refresh setiap 50 ms dan me-reset MCU jika scheduler macet.

## Kontrol kecepatan roda closed-loop

Task odometri berjalan setiap 5 ms: membaca kedua encoder (`TIM3` kanan, `TIM4` kiri), menghitung RPM roda, dan menjalankan satu loop `pidIr` per roda:

$$u_k = K_p e_k + K_i T_s \sum e_j + \frac{K_d}{T_s} (e_k - e_{k-1}), \quad |u_k| \le 100$$

Gain ada di `Core/Inc/configuration.h`; tuning bawaan hanya integral (`KP 0.00`, `KI 0.02`, `KD 0.00` di kedua roda). Task motor menerapkan output yang sudah di-clamp setiap 20 ms sebagai nilai compare PWM `95 × u` pada `TIM23` (kanan) dan `TIM2` (kiri); arah ditentukan oleh channel mana yang diberi sinyal. Pose dead-reckoning milik firmware sendiri memakai `WHEEL_RADIUS 0.0275` m dan tidak dipakai oleh ROS.

## Task lainnya

- **Attitude**: kompas CMPS12 (tilt-compensated) dibaca setiap 5 ms; yaw-nya juga menjadi heading yang dikirim ke ROS.
- **UWB**: posisi tag follower lewat `USART2`, difilter dan dilaporkan di field `uwb_*`.
- **LIDAR**: pembaca RPLIDAR sisa dari prototipe. Unit memakai Velodyne VLP-16 lewat Ethernet.

## Dokumentasi Terkait

- [Sensor Fusion & Kontrol](/id/development/ros/sensor-fusion-and-control): Integrasi odometri dan EKF.
- [Costmap & Planner](/id/development/ros/costmaps-and-planners): Parameter batas kecepatan.
- [State dan Perilaku](/id/development/state-and-behavior): State machine emergency stop.
