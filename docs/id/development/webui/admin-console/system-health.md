---
outline: deep
search: false
---

# Konsol Admin: Kesehatan Sistem

<RoleBadge role="developer" />

Tab Kesehatan Sistem (`SystemHealthPanel.tsx`) menunjukkan apakah sisi server sistem berfungsi:
layanan di balik dashboard, port tempat layanan itu menjawab, dan dua sertifikat SSL yang menjaga
browser dan robot tetap terhubung. Semua admin dapat melihatnya; tab ini hanya membaca. Pemeriksaan
berjalan di `backend_node` (`scripts/system_health.js`) di balik
[`GET /admin/api/system/health`](/id/development/message-contracts/http-api#admin-api), dan panel
memintanya setiap 30 detik selama tab terbuka.

Setiap item punya status (**Working**, **Needs attention**, **Not working**, **Not used**), satu
kalimat sederhana tentang artinya bagi operator, catatan apa yang harus dilakukan bila perlu
tindakan, dan daftar **Details** berisi fakta teknis (port, versi, error, fingerprint).

## Apa yang diperiksa, dan bagaimana {#checks}

| Item | Pemeriksaan | Bila tidak berfungsi |
| --- | --- | --- |
| Database | `SELECT VERSION()` lewat pool backend sendiri, batas 3 dtk; lebih lambat dari 1 dtk = peringatan | Operator tidak bisa sign in, konsol tidak bisa menyimpan |
| Backend API | Selalu berfungsi (ia sedang menjawab); uptime, versi Node.js, memori | |
| MQTT broker | Koneksi broker milik backend: terhubung atau tidak, sejak kapan, putus terakhir, error terakhir | Robot tidak menerima perintah dan tidak melapor |
| Live link | `health()` milik [gateway](/id/development/message-contracts/rosbridge#gateway) plus koneksi TCP ke `LINK_GATEWAY_PORT`; "Not used" bila variabel itu kosong | Peta live dan posisi robot tidak tampil |
| Web UI | HTTP GET ke `WEBUI_URL`; jawaban apa pun di bawah 500 berarti hidup | Operator tidak bisa membuka dashboard |
| Public website | HTTP GET ke `PUBLIC_SITE_URL` (situs lewat Apache); dilewati bila kosong | Tidak bisa dijangkau dari internet |
| Media server | HTTP GET `/health` pada `MEDIA_PORT` | Peta tidak bisa dibuka atau disimpan |
| Camera signalling | Koneksi TCP ke `PORT_WS`, HTTP GET pada `PORT_HTTP` | Kamera robot tidak bisa dibuka |
| Sertifikat website | Handshake TLS ke `CERT_HOST` (default `NAKAYAMA_HOST`) port 443 | Browser menolak situs |
| Sertifikat MQTT broker | Sertifikat pada socket broker live milik backend | Robot menolak broker |

Tabel **Connections and ports** mencantumkan setiap port di atas beserta cara penentuannya ("Test
query", "Backend connection", "Connection test", "Web request", "Secure connection") dan waktu
responsnya.

::: warning Dua probe sengaja dihindari
- **Tanpa probe TCP ke MySQL.** MySQL menghitung koneksi yang ditutup sebelum handshake sebagai
  error untuk host itu dan memblokir host setelah `max_connect_errors` kali. Backend menjangkau
  MySQL lewat port proxy Docker, jadi host yang terblokir adalah backend itu sendiri. Database
  hanya diperiksa dengan query sungguhan.
- **Tanpa probe ke port HiveMQ.** Koneksi yang ditutup sebelum `CONNECT` MQTT dicatat HiveMQ
  sebagai `Client ID: UNKNOWN ... disconnected ungracefully`, alasan yang sama healthcheck compose
  memeriksa port 8080 (lihat
  [Referensi Docker § Healthcheck](/id/setup/docker-reference#healthcheck)). Keterjangkauan
  diambil dari koneksi backend sendiri, dan sertifikat dari socket TLS koneksi itu. Hanya saat
  koneksi putus dilakukan satu handshake untuk membaca sertifikat (bisa jadi itu penyebabnya),
  di-cache 10 menit.
:::

## Sertifikat {#certificates}

Kedua sertifikat dibaca seperti yang disajikan server, bukan dari `/etc/letsencrypt`, sehingga
sertifikat yang kedaluwarsa atau tidak cocok tetap dideskripsikan, bukan ditolak.

| Sisa hari | Status | Alasan |
| --- | --- | --- |
| 30 atau lebih | Working | Menampilkan kapan terakhir diperbarui dan kapan certbot memperbaruinya lagi (kedaluwarsa dikurangi 30 hari) |
| 7 sampai 29 | Needs attention | certbot memperbarui 30 hari sebelum kedaluwarsa, jadi pembaruan tidak terjadi |
| di bawah 7, kedaluwarsa, atau tidak dipercaya | Not working | Klien menolaknya, atau akan menolak dalam hitungan hari |

Tab ini juga membandingkan keduanya. Bila broker menyajikan sertifikat lain yang kedaluwarsa
setidaknya sehari lebih awal dari milik website, item broker menjadi **Needs attention** dengan
"the broker keystore was not rebuilt". Inilah kegagalan senyap dari
[Pemeliharaan § Sertifikat](/id/setup/maintenance#sertifikat): certbot memperbarui file PEM yang
dibaca Apache, HiveMQ tetap menyajikan keystore PKCS#12 miliknya, dan robot terputus pada tanggal
kedaluwarsa lama sementara website masih terlihat baik. Perbaikan yang disebut panel adalah
`update_ssl.sh`, lalu restart broker saat tidak ada robot yang bekerja.

## Konfigurasi {#configuration}

Dibaca `backend_node` dari environment-nya. Default-nya milik produksi, jadi hanya
`nakayama_cloud_dev` yang mengaturnya di `docker-compose.yml`.

| Variabel | Default | Dev |
| --- | --- | --- |
| `WEBUI_URL` | `http://127.0.0.1:3000/` | `http://127.0.0.1:3100/` |
| `PUBLIC_SITE_URL` | `https://<NAKAYAMA_HOST>/` | kosong (dilewati): situs publik adalah frontend produksi di balik Apache host, dan produksi mati selama dev berjalan |
| `MEDIA_PORT` | `3003` | `4003` |
| `CERT_HOST` | `NAKAYAMA_HOST` | tidak diatur |

`PORT_WS`, `PORT_HTTP`, `LINK_GATEWAY_PORT`, `PORT` dan `PORT_SQL` adalah yang sudah diatur stack.

## Beban pada server {#load}

Satu snapshot di-cache 15 detik dan dipakai bersama oleh semua admin yang membuka tab ini; request
bersamaan berbagi satu run. **Check now** meminta run baru, tetapi tidak lebih sering dari setiap
5 detik. Setiap pemeriksaan punya batas 3 detik dan berjalan paralel, jadi satu snapshot paling lama
sekitar 3 detik.

## Terkait

- [Kontrak Pesan: HTTP API § Admin API](/id/development/message-contracts/http-api#admin-api): `GET /admin/api/system/health` (`?refresh=1` untuk run baru).
- [Ikhtisar](/id/development/webui/admin-console/overview): shell konsol dan tab-tabnya.
- [Unit § Status Unit](/id/development/webui/admin-console/units#unit-status): status live per robot, yang tidak diulang di tab ini.
- [Pemeliharaan § Sertifikat](/id/setup/maintenance#sertifikat): cara memperbarui dan membangun ulang keystore broker.
- [Referensi Docker § Peta layanan dan port](/id/setup/docker-reference#service-and-port-map): port yang tercantum di tab ini.
