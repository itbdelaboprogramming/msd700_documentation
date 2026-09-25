---
outline: deep
search: false
---

# Firmware & Enrolment

<RoleBadge role="developer" />

Dua kontrak di tepi sistem: link serial antara firmware STM32 dan Jetson, dan handshake HTTPS yang
dipakai robot baru untuk menjadi unit.

## Link firmware (rosserial) {#firmware-link}

Firmware STM32H7 (`firmware-msd700`) berbicara dengan Jetson lewat rosserial di link serial USB
(`/dev/stm32` di robot prototype). Dua topik, keduanya didefinisikan di `msd700_msgs`:

| Topik | Arah | Tipe | Isi |
| --- | --- | --- | --- |
| `/hardware_state` | STM32 → Jetson | `msd700_msgs/HardwareState` | Delapan jarak ultrasonik, delta pulsa motor kiri/kanan, heading/pitch/roll, triple accelerometer, gyro, dan magnetometer, UWB distance/deviation/rho/theta |
| `/hardware_command` | Jetson → STM32 | `msd700_msgs/HardwareCommand` | `movement_command`, `cam_angle_command`, `right_motor_speed`, `left_motor_speed` |

Ini adalah ujung bawah handler perintah [`hardware`](/id/development/message-contracts/mqtt-commands#hardware):
`hardware.check`, `init`, dan `stop` bekerja pada link ini lewat `hardware_node`, dan `/hardware_state`
memberi makan odometri dan sensor fusion. Detail:
[Firmware & Perangkat Keras](/id/development/ros/firmware-and-hardware).

## Enrolment {#enrolment}

Robot tanpa kredensial mendaftarkan dirinya lewat router `/enroll` di `backend_node`. Tidak perlu
token; buktinya adalah nonce 32-byte yang hanya diketahui robot.

![Handshake Pendaftaran Robot](../../../development/message-contracts/diagrams/message-contracts-robot-enrolment-handshake.drawio)

### `POST /enroll/claim` {#enroll-claim}

```json
{
  "fingerprint": "<hex sha256 identitas hardware>",
  "nonce_hash": "<hex sha256 nonce 32-byte>",
  "nonce": "<nonce-nya, hanya saat pemulihan self-heal>",
  "hostname": "msd700-jetson",
  "mac": "aa:bb:cc:dd:ee:ff",
  "agent_version": "2.4.0",
  "bootstrap_key": "<opsional>",
  "enrollment_code": "<voucher 10 karakter, opsional>"
}
```

`fingerprint` dan `nonce_hash` harus hex huruf kecil 64 karakter (`400` bila tidak).

| Hasil | Status | `data` |
| --- | --- | --- |
| Hardware baru atau dikenal, menunggu administrator | `202` | `{ claim_code: "K7M2QP4R", status: "pending" }` |
| Voucher valid (`enrollment_code`) | `200` | [kredensial](#credential) |
| Self-heal: sudah di-claim, nonce mentah cocok, ikatan masih hidup | `200` | [kredensial](#credential) |
| Voucher tidak valid, sudah dipakai, atau kedaluwarsa | `404` | |

### `POST /enroll/status` {#enroll-status}

Body `{ fingerprint, nonce, agent_version }`, di-poll robot sampai administrator mendaftarkan atau
meng-adopt-nya di [Konsol Admin](/id/development/webui/admin-console/units). `202` dengan
`{ claim_code, status }` selama menunggu; setelah disetujui, kredensial hanya diserahkan bila
`sha256(nonce)` cocok dengan `nonce_hash` yang tersimpan.

### Kredensial {#credential}

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "unit_name": "Unit 01",
  "topic_root": "/unit_01JZ8P9WZ0UNIT00000000000",
  "device_secret": "<32 byte acak, ditampilkan sekali>",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": "12h",
  "key_id": "k2026-09"
}
```

Robot menyimpannya sebagai `device.json`. Cloud hanya menyimpan hash bcrypt dari `device_secret`.

### `POST /enroll/token` {#enroll-token}

Body `{ unit_id, device_secret, agent_version, reason }`, dengan `reason` bernilai `boot`, `refresh`,
atau `recovery`. Menjawab `{ unit_id, unit_name, topic_root, access_token, expires_in, key_id }`. Access
token ini ber-`role: "robot"` dan dipakai robot untuk `/sync` dan media server. Menunjukkan secret yang
berlaku juga mempensiunkan secret sebelumnya (`secret_prev_hash`).

::: tip Kenapa nonce
Alamat MAC dan serial terlihat di jaringan dan di konsol admin. Nonce membuktikan pemanggil adalah
mesin yang meminta, sehingga MAC palsu tidak bisa mengambil kredensial yang sudah disetujui saat robot
asli mati. Protokol lengkap, voucher, dan self-heal:
[Enrolment Perangkat Keras](/id/development/webui/accounts/enrolment).
:::

## Dokumentasi terkait

- [Enrolment Perangkat Keras](/id/development/webui/accounts/enrolment): protokol secara mendalam.
- [Konsol Admin: Unit](/id/development/webui/admin-console/units): tampilan Tertunda yang menyetujui claim.
- [Keamanan dan Autentikasi](/id/development/security-and-auth): jenis token dan keyring.
