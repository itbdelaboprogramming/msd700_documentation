# Setup Sistem

<RoleBadge role="technician" />

Cara memastikan [Server](/id/setup/server-setup) dan [Unit](/id/setup/unit-setup) yang sudah jadi benar-benar bekerja sebagai satu sistem. Bila kedua halaman sudah diikuti dan unit berhasil enrol, halaman ini mostly verifikasi, bukan setup baru.

## Gambaran umum

Unit dan server berkomunikasi lewat jalur yang rusaknya **sendiri-sendiri**. Membedakannya adalah kunci di sini.

![Gambaran umum](./diagrams/system-setup-overview.drawio)

| # | Jalur | Membawa | Kalau rusak |
| --- | --- | --- | --- |
| 1 | MQTT | Perintah, feedback, semua stream | Unit tampil **offline**. Semua mati |
| 2 | rosbridge | Langganan browser ke topik cloud | Unit **online**, perintah jalan, peta kosong |
| 3 | signalling | Negosiasi WebRTC | Video tidak ada, sisanya normal |
| 4 | Media WebRTC | Gambar kamera | Video jalan di LAN, tidak pernah di luar: relay TURN |

Satu kerusakan lagi mirip #2: unit online, rosbridge tersambung, tapi relay bersama (`unit_relays`) mati sehingga topik cloud yang dibaca rosbridge tidak ada. Peta kosong yang sama, penyebab beda. Cek `docker ps --filter name=unit_relays`. (Container per-unit `rosweb_unit_*` hanya ada di mode legacy dengan `UNIT_CONTAINERS_ENABLED=true`.)

## 1. Cek jalur jaringan

| Dari | Ke | Port | Untuk |
| --- | --- | --- | --- |
| Unit | Server | `8883` TCP (prod) atau `8884` (dev) | Semuanya. Satu-satunya yang wajib |
| Browser | Server | `443` TCP | Dashboard, API, rosbridge, signalling |
| Browser | Server | `3478` UDP+TCP + range relay | Video WebRTC tanpa jalur langsung |

```bash
# Dari unit: bisa mencapai broker?
nc -zv msd.nglobal.jp 8883

# Apakah sertifikat broker valid?
openssl s_client -connect msd.nglobal.jp:8883 -servername msd.nglobal.jp </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -dates
```

::: warning Sertifikat kedaluwarsa gagal secara diam-diam
Koneksi WebSocket dashboard tidak pernah terbuka, dan browser hanya menampilkan network error generik. Cek sertifikat sebelum debug hal lain. Sertifikat MQTT adalah file **terpisah** dari milik Apache, dibuat dari file PEM yang sama: lihat [Maintenance](/id/setup/maintenance#sertifikat).
:::

::: info Produksi atau dev?
`./scripts/docker-manager.sh up --dev` di unit mengarahkan enrolment dan MQTT ke stack `server_dev`, bukan `server_prod`: port beda, database beda, armada beda. Pakai saat testing; lepas flag-nya untuk deployment sungguhan. Unit yang enrol di dev **tidak** terdaftar di prod, begitu pula sebaliknya.
:::

## 2. Cek unit terdaftar dengan benar

Di admin console, bawah **Registered Units**, cari unit yang disetujui di [Setup Unit](/id/setup/unit-setup). Catat ULID-nya.

```bash
# Di server. Relay bersama harus RUNNING agar topik ini ada.
docker ps --filter "name=unit_relays"
docker exec -it ros_web_ui_v2_nakayama_ros bash -lc \
  'source /home/itbdelabo/ros-web-ui-ws/devel/setup.bash && rostopic list | grep unit_<ULID>'
```

Harusnya muncul topik seperti `/unit_<ULID>/system_command`, `/unit_<ULID>/system_feedback`, `/unit_<ULID>/server/robot_pose`. Tidak muncul apa-apa di sini, tanpa error di tempat lain, adalah gejala diam-diam paling umum di sistem ini.

Bisa juga mengawasi broker langsung. Ini membedakan "robot tidak publish" dari "relay cloud tidak jalan":

```bash
mosquitto_sub -h msd.nglobal.jp -p 8883 --capath /etc/ssl/certs \
  -t '/unit_<ULID>/#' -v | head -20
```

## 3. Checklist end-to-end

Kerjakan dari atas ke bawah. Setiap item menggugurkan satu jalur dari diagram di atas.

- [ ] Server sehat: `docker compose --profile server_prod ps` menampilkan semua service `Up` atau `healthy`
- [ ] ROS graph unit sehat: `rosnode list` di dalam container unit menampilkan node bringup
- [ ] Unit tampil **online** di Registered Units (jalur 1, MQTT)
- [ ] Relay bersama jalan: `docker ps --filter name=unit_relays`
- [ ] Membuka unit menampilkan posisi terkini dan peta live (jalur 2, rosbridge)
- [ ] Feed kamera terlihat **dari luar LAN unit** (jalur 3 dan 4)
- [ ] Menyetir W-A-S-D menggerakkan robot, dan posisi dashboard mengikuti
- [ ] Goal klik-navigasi diterima dan robot melaju ke sana
- [ ] Emergency Stop, dites sekali, menghentikan robot seketika
- [ ] Menutup browser di tengah operasi menghentikan robot dalam ~2 detik (dashboard cloud) atau seketika (dashboard lokal, yang heartbeat 5 Hz-nya berhenti bersama tab)

::: warning Jangan lewati empat terakhir
Unit bisa terlihat tersambung penuh (online, video oke) padahal satu arah perintah rusak. Itu baru ketahuan saat robot disuruh bergerak. Tes disconnect adalah perilaku keselamatan: picu sekali dengan sengaja, dengan ruang kosong di sekitar robot.
:::

## 4. Serah terima

Bila semua cek lolos, dua hal tersisa sebelum unit diserahkan ke operator:

1. **Beri akses dashboard.** Di admin console, tambahkan akun operator ke rental profile yang berisi unit ini. Unit yang ter-enrol saja tidak terlihat oleh user mana pun: akses dikontrol lewat profile, bukan lewat unit.
2. **Arahkan ke [User Guide](/id/user-guide/).** Panduan itu mengasumsikan kondisi ini persis: sudah terinstal, tersambung, akses diberikan.

## Langkah berikutnya

- Buat jadwal [Maintenance](/id/setup/maintenance) untuk deployment baru.
- Siapkan [Troubleshooting](/id/setup/troubleshooting).
