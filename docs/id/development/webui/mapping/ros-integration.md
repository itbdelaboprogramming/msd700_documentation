---
outline: deep
search: false
---

# Integrasi ROS

<RoleBadge role="developer" />

Kontrak jalur (wire contract) di balik halaman [Pemetaan](/id/development/webui/mapping/overview):
panggilan REST yang memulai dan menghentikan sesi SLAM, envelope perintah/feedback MQTT yang
membawa request yang sama ke `system_command.py`, dan apa yang sebenarnya dilakukan robot di disk
serta di jaringan saat sebuah peta disimpan. Untuk perilaku halaman itu sendiri, lihat
[Ikhtisar](/id/development/webui/mapping/overview) dan
[Override Manual dan Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous).

## Memulai dan menghentikan sesi pemetaan {#starting-and-stopping-a-mapping-session}

Satu endpoint, [`POST /api/mapping`](/id/development/message-contracts/http-api#mapping-control), menggerakkan
seluruh sesi; tepat satu dari `start`, `pause`, `stop` bernilai `true` per panggilan. Discard punya endpoint sendiri.

| Tombol | HTTP | MQTT ke robot | Sisi robot |
| --- | --- | --- | --- |
| Play | `POST /api/mapping` `{ unit_id, start: true }` | [`mapping.start`](/id/development/message-contracts/mqtt-commands#mapping) | `/switch_mode(explore)`; aktivitas `mapping_active` |
| Pause | `POST /api/mapping` `{ unit_id, pause: true }` | [`mapping.pause`](/id/development/message-contracts/mqtt-commands#mapping) | motion lock `operator_pause`; aktivitas `mapping_paused` |
| Stop, lalu Simpan | `POST /api/mapping` `{ unit_id, stop: true, map_name, homebase_* }` | [`mapping.stop`](/id/development/message-contracts/mqtt-commands#mapping) | simpan dan upload, di bawah |
| Stop, lalu Buang | [`POST /api/mapping/discard`](/id/development/message-contracts/http-api#mapping-discard) `{ unit_id }` | [`mapping.discard`](/id/development/message-contracts/mqtt-commands#mapping) | `/switch_mode(idle)`, `/map/reset` |

Request simpan yang dikirim dialog `ConfirmSaving` setelah operator memberi nama peta:

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "stop": true,
  "map_name": "Warehouse Sector 4",
  "homebase_x": 0.0, "homebase_y": 0.0, "homebase_z": 0.0,
  "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
}
```

Pose `homebase_*` adalah pose yang ditangkap otomatis saat mapping dimulai (lihat
[Ikhtisar § Menyimpan peta](/id/development/webui/mapping/overview)), bukan nilai yang diisi operator.
Backend membuat ULID peta, memakai `map_name` sebagai nama tampilan, dan meneruskan pose ke robot agar
tersimpan dalam upload yang sama yang membuat baris peta.

::: info Penyimpanan bersifat asinkron
Penyimpanan butuh waktu lebih lama dari batas HTTP 30 detik yang dipakai perintah lain (lihat
[Perintah MQTT § Korelasi dan retry](/id/development/message-contracts/mqtt-commands#correlation-and-retry)).
Karena itu panggilan stop langsung menjawab:

```json
{
  "success": true,
  "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "map_ulid": "01JZ8QK2H0000000000000MAP",
  "msg": "Map save initiated. Track progress via /api/mapping/progress/:request_id"
}
```

Overlay `MapSaving` lalu membuka
[`GET /api/mapping/progress/:request_id?token=<jwt>`](/id/development/message-contracts/http-api#mapping-progress)
(Server-Sent Events) dan mengikutinya sampai event terminal.
:::

## Envelope perintah MQTT (`header: "mapping"`)

Request stop sampai di robot sebagai `mapping.stop` di `/unit_<ULID>/system_command`, dalam
[amplop perintah](/id/development/message-contracts/mqtt-commands#command-envelope) bersama. `config.resource`
membawa `map_name` dan `map_ulid` (keduanya ULID baru, yaitu nama file di disk), `display_map_name` (yang
diketik operator), `created_by`, `unit_id`, dan tujuh field `homebase_*`. Payload lengkap ada di
[Perintah MQTT § `mapping`](/id/development/message-contracts/mqtt-commands#mapping); `navigation.init`
nantinya membaca home base yang sama.

### Feedback progres pemetaan (`header: "mapping_progress"`)

Robot melaporkan penyimpanan di `system_feedback` dengan `header: "mapping_progress"` dan `request_id`
milik perintah stop; backend meneruskan setiap blok `data` ke stream SSE:

| `progress` | `stage` |
| --- | --- |
| 15 | `saving_map` |
| 30 | `map_saved` |
| 50 | `uploading` |
| 85 | `upload_complete` atau `cloud_pending` |
| 95 | `switching_mode` |
| 100 | `completed` (terminal) |
| -1 | `save_failed` (terminal) |

Event terakhir membawa `terminal: true` dan `outcome`:

| Outcome | Deskripsi |
| --- | --- |
| `completed` | Tertulis di media server unit dan cloud. |
| `cloud_pending` | Tertulis di media server unit saja; salinan cloud menyusul lewat sync. |
| `failed` | Tidak ada yang tersimpan. Sesi tetap terbuka untuk dicoba lagi (aktivitas `mapping_stop_failed`). |

Bila robot diam 90 detik, backend mengakhiri stream sendiri dengan `stage: "no_response"`. Kontrak
lengkap: [Perintah MQTT § `mapping_progress`](/id/development/message-contracts/mqtt-commands#mapping-progress).

## Penyimpanan sisi robot: `map_saver` dan pemeriksaan preflight

Saat `mapping` / `stop` sampai ke robot, ia tidak langsung mengunggah begitu saja. Pemeriksaan
kesehatan preflight memverifikasi disk lokal dan endpoint media dapat dijangkau sebelum apa pun
ditulis:

![Penyimpanan sisi robot: mapsaver dan pemeriksaan preflight](../../../../development/webui/mapping/diagrams/ros-integration-robot-side-save-mapsaver-and-preflight-c.drawio)

Jika disk lokal tidak bisa ditulis, penyimpanan ditolak langsung alih-alih dicoba, untuk
menghindari meninggalkan run yang korup atau sebagian di disk. Setelah preflight lolos,
`map_saver` menghasilkan aset occupancy grid: sebuah gambar `.pgm`, file metadata `.yaml`, dan
sebuah thumbnail.

## Unggah dua-tingkat dan replikasi cloud

Output `map_saver` kemudian diunggah ke dua target independen, dengan tingkat kewajiban berbeda:

| Target Penyimpanan | Tingkat Kewajiban | Implikasi Kegagalan |
| --- | --- | --- |
| **Media-server Lokal Unit** (`media_local`, `:3003`) | **Wajib** | Jika penyimpanan lokal gagal, robot tidak bisa bernavigasi dengan peta ini. Sesi SLAM tetap aktif (`mapping_stop_failed`) agar operator bisa mencoba menyimpan lagi. |
| **Media-server Pusat Cloud** (`media-server`, `:3003`) | **Best Effort** | Jika unggahan cloud gagal (misalnya robot sedang offline), peta ditandai `cloud_pending`. `sync_agent` di latar belakang mereplikasi file peta secara otomatis begitu konektivitas internet kembali. |

Desain dua-target ini adalah alasan mengapa sebuah peta yang direkam di gudang tanpa internet tetap
langsung bisa dipakai untuk navigasi di unit itu sendiri: hanya unggahan lokal wajib yang menjadi
gerbangnya. Ketersediaan cloud (dibutuhkan untuk melihat peta dari tempat lain, atau untuk backup
lintas unit) menyusul kemudian lewat `sync_agent` tanpa memblokir operator.

Untuk mesin state aktivitas robot dan perilaku pemulihan sesi yang berinteraksi dengan alur
penyimpanan ini (tidak diulang di sini), lihat
[Navigasi: Manual Override & Autopilot](/id/development/webui/navigation/manual-and-autopilot)
dan [Safety Watchdog](/id/development/ros/safety-watchdog).

## Terkait

- [Kontrak Pesan § Halaman Pemetaan](/id/development/message-contracts/#trace-mapping): semua pesan yang dikirim sesi mapping.
- [Ikhtisar](/id/development/webui/mapping/overview): Play/Pause/Stop, tampilan peta live, dan
  alur UI simpan-saat-stop
- [Override Manual dan Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous):
  dua mode mengemudi selama sesi pemetaan
- [Arsitektur](/id/development/architecture)
- [State & Perilaku](/id/development/state-and-behavior): mesin state aktivitas robot dan
  perilaku rekoneksi/pemulihan sesi
