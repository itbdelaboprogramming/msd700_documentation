---
outline: deep
search: false
---

# Firmware, Microcontroller, and Hardware Bus

<RoleBadge role="developer" />

The unit's motors are driven by an **STM32H723** board (`0483:5740`, USB virtual COM port, udev symlink `/dev/stm32`) running FreeRTOS. The firmware lives in the separate `firmware-msd700` repository, project `STM32H7_MSD700_Unified_Firmware` (STM32CubeIDE). It takes commands from **two** sources, an SBUS RC receiver or the Jetson over ROS, and closes a PID speed loop on each wheel.

::: info Legacy Arduino firmware
`msd700_robot/msd700_firmware/firmware/firmware.ino` (and `firmware-msd700/firmware_msd700`) is the older Arduino Mega sketch. It is kept for reference and speaks the same `hardware_state` / `hardware_command` messages, but it is not what the current unit runs.
:::

## Embedded Control Topology

![Embedded Control Topology](./diagrams/firmware-and-hardware-embedded-control-topology.drawio)

## ROS interface

The firmware is a rosserial node with one publisher and one subscriber:

| Direction | Topic | Message | Notes |
| --- | --- | --- | --- |
| MCU → Jetson | `hardware_state` | `msd700_msgs/HardwareState` | Published every 50 ms while the host is connected. Encoder pulse deltas accumulated since the last publish, CMPS12 heading/roll/pitch, accelerometer/gyro/magnetometer, UWB follower target. The eight ultrasonic fields are always `0.0` |
| Jetson → MCU | `hardware_command` | `msd700_msgs/HardwareCommand` | `right_motor_speed` / `left_motor_speed` become the wheel RPM targets in PC mode |

On the Jetson, `serial_launch.launch` runs `rosserial_python` on `/dev/stm32` (`baud` 57600; the link is USB CDC, so the value is not a real line rate). In the default `hardware_mode 1`, `hardware_state.py` (`raw_sensor_node`) turns `hardware_state` into `/wheel/odom`, `/imu/data_raw` and `/imu/mag`, and `bridger.py` turns the muxed `/cmd_vel` into `hardware_command`. Both read the wheel geometry from `msd700_control/config/pose_config.yaml` (`wheel_radius 2.75` cm, `wheel_distance 26.0` cm, measured on the real robot). See [Sensor Fusion and Control](/development/ros/sensor-fusion-and-control).

There is no `/battery_state` topic anywhere in the stack.

## Arming and command source

Arming and source selection come from the SBUS receiver (`USART1`, 100 kbaud, inverted):

| SBUS channel | Meaning |
| --- | --- |
| Channel 3 (0-based) | Arm switch. Above 992 = **ARMED** (lamp on), otherwise DISARMED |
| Channel 2 | Below 1000 = RC mode: channels 0/1 map to ±40 RPM move/turn. Otherwise PC mode: RPM targets come from `hardware_command` |

If no SBUS frame arrives for **400 ms** (receiver unplugged or out of range), the vehicle drops to DISARMED. While disarmed both PID loops are reset and all PWM outputs are held at 0, whatever the ROS side sends. An independent hardware watchdog (IWDG) is refreshed every 50 ms and resets the MCU if the scheduler stalls.

## Closed-loop wheel speed control

The odometry task runs every 5 ms: it reads both encoders (`TIM3` right, `TIM4` left), computes wheel RPM and runs one `pidIr` loop per wheel:

$$u_k = K_p e_k + K_i T_s \sum e_j + \frac{K_d}{T_s} (e_k - e_{k-1}), \quad |u_k| \le 100$$

Gains are in `Core/Inc/configuration.h`; the shipped tuning is integral-only (`KP 0.00`, `KI 0.02`, `KD 0.00` on both wheels). The motor task applies the clamped output every 20 ms as a PWM compare value of `95 × u` on `TIM23` (right) and `TIM2` (left), direction chosen by which of the two channels is driven. The firmware's own dead-reckoned pose uses `WHEEL_RADIUS 0.0275` m and is not used by ROS.

## Other tasks

- **Attitude**: CMPS12 tilt-compensated compass read every 5 ms; its yaw is also the heading published to ROS.
- **UWB**: follower-tag positioning on `USART2`, filtered and reported in the `uwb_*` fields.
- **LIDAR**: an RPLIDAR reader left over from the prototype. The unit uses the Velodyne VLP-16 over Ethernet instead.

## Related Documentation

- [Sensor Fusion and Control](/development/ros/sensor-fusion-and-control): Odometry integration and EKF.
- [Costmaps and Planners](/development/ros/costmaps-and-planners): Velocity limit parameters.
- [State and Behavior](/development/state-and-behavior): Emergency stop state machines.
