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

## Memulai dan menghentikan sesi pemetaan

Dari [Referensi API § Operasi Pemetaan (SLAM)](/id/development/api-reference#operasi-mapping-slam):

### Start

`POST /api/mapping/start` memulai mode SLAM (gmapping) pada unit target.

```json
{ "unit_id": "01JZ8P9WZ0UNIT00000000000" }
```

### Stop dan simpan

`POST /api/mapping/stop` menyimpan occupancy grid yang aktif, membuat metadata thumbnail, dan
mengunggah asetnya. Ini adalah request yang dikirim dialog `ConfirmSaving` begitu operator memberi
nama peta:

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "display_map_name": "Warehouse Sector 4",
  "homebase_x": 0.0,
  "homebase_y": 0.0
}
```

`homebase_x` / `homebase_y` di sini adalah pose yang ditangkap secara otomatis saat pemetaan
dimulai (lihat
[Ikhtisar § Menyimpan peta](/id/development/webui/mapping/overview#menyimpan-peta-alur-stop)),
bukan nilai yang dimasukkan operator.

::: info Penyimpanan bersifat asinkron
Menyimpan peta SLAM memakan waktu lebih lama daripada budget timeout HTTP standar 30 detik yang
dipakai di tempat lain pada platform ini (lihat
[Kontrak Pesan § Arsitektur Korelasi dan Retry Perintah](/id/development/message-contracts#arsitektur-korelasi-dan-retry-perintah)).
`POST /api/mapping/stop` karena itu langsung mengembalikan `200 OK` beserta `request_id` dan
`map_ulid`:

```json
{
  "success": true,
  "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "map_ulid": "01JZ8QK2H0000000000000MAP"
}
```

Frontend kemudian terhubung ke stream SSE di `GET /api/mapping/progress/:request_id` untuk
mengikuti penyimpanan hingga selesai. Inilah yang kemungkinan besar menjadi dasar overlay progres
`MapSaving` yang dijelaskan di
[Ikhtisar](/id/development/webui/mapping/overview#menyimpan-peta-alur-stop); kode subscription
sisi klien yang persis tidak dibahas dalam materi sumber yang tersedia untuk halaman ini. Lihat
[Kontrak Pesan § Subsistem Pemetaan](/id/development/message-contracts#_3-subsistem-mapping-header-mapping).
:::

## Envelope perintah MQTT (`header: "mapping"`)

Request stop HTTP di atas diteruskan ke robot sebagai perintah `mapping` / `stop` pada
`/unit_<ULID>/system_command`, memakai
[envelope perintah](/id/development/message-contracts#amplop-payload-perintah) bersama:

```json
{
  "header": "mapping",
  "command": "stop",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "display_map_name": "Production Hall Level 1",
      "map_ulid": "01JZ8QK2H0000000000000MAP",
      "created_by": "01JZ7YV5CQUSER00000000000",
      "unit_id": "01JZ8P9WZ0UNIT00000000000",
      "homebase_x": 1.2,
      "homebase_y": 0.5,
      "homebase_z": 0.0,
      "homebase_ox": 0.0,
      "homebase_oy": 0.0,
      "homebase_oz": 0.0,
      "homebase_ow": 1.0
    }
  }
}
```

Perhatikan bahwa pose homebase lengkap di sini membawa quaternion orientasi (`homebase_o{x,y,z,w}`)
selain posisi `x`/`y` yang dibawa body REST dan tabel `maps_data`. Ini adalah bentuk yang sama
yang kemudian dibaca kembali oleh `navigation` / `init` saat peta dimuat (lihat
[Kontrak Pesan § Subsistem Navigasi](/id/development/message-contracts#_2-subsistem-navigasi-header-navigation)),
yang di luar cakupan halaman ini.

::: warning Hanya `stop` yang didokumentasikan di katalog perintah
Mesin state aktivitas milik [State & Perilaku](/id/development/state-and-behavior) mengisyaratkan
bahwa transisi `pause`, `resume`, dan `discard` ada untuk sebuah sesi pemetaan (`mapping_active`
↔ `mapping_paused`, dan `mapping_active` → `idle` saat discard). Entri Subsistem Pemetaan di
Katalog Referensi Perintah hanya mendokumentasikan `stop` pada tingkat detail ini; kata kerja
perintah dan payload persis untuk pause/resume/discard tidak dijabarkan di sana dan tidak ditebak
di sini.
:::

### Feedback progres pemetaan (`header: "mapping_progress"`)

Progres pada sebuah penyimpanan mengalir kembali sebagai feedback `mapping_progress`, cocok
dengan `request_id` dari perintah stop:

```json
{
  "header": "mapping_progress",
  "command": "stop",
  "data": {
    "status": true,
    "progress": 100,
    "stage": "completed",
    "message": "Saved on the robot and the server.",
    "terminal": true,
    "outcome": "completed"
  },
  "metadata": {
    "timestamp": 1734000000.0,
    "request_id": "..."
  }
}
```

| Nilai Outcome | Deskripsi |
| --- | --- |
| `completed` | Berhasil ditulis ke media-server Unit lokal maupun server cloud. |
| `cloud_pending` | Ditulis hanya ke media-server Unit lokal. Replikasi cloud selesai pada interval sync berikutnya. |
| `failed` | Penyimpanan pemetaan gagal. Sesi tetap terbuka untuk dicoba ulang (aktivitas robot melaporkan `mapping_stop_failed`). |

Lihat
[Kontrak Pesan § Feedback Progres Pemetaan](/id/development/message-contracts#feedback-progres-mapping-header-mapping-progress)
untuk sumber tabel ini.

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
lintas-fleet) menyusul kemudian lewat `sync_agent` tanpa memblokir operator.

Untuk mesin state aktivitas robot dan perilaku pemulihan sesi yang berinteraksi dengan alur
penyimpanan ini (tidak diulang di sini), lihat
[Navigasi: Manual Override & Autopilot](/id/development/webui/navigation/manual-and-autopilot)
dan [Safety Watchdog](/id/development/ros/safety-watchdog).

## Terkait

- [Ikhtisar](/id/development/webui/mapping/overview): Play/Pause/Stop, tampilan peta live, dan
  alur UI simpan-saat-stop
- [Override Manual dan Eksplorasi Otonom](/id/development/webui/mapping/manual-and-autonomous):
  dua mode mengemudi selama sesi pemetaan
- [Arsitektur](/id/development/architecture)
- [State & Perilaku](/id/development/state-and-behavior): mesin state aktivitas robot dan
  perilaku rekoneksi/pemulihan sesi
