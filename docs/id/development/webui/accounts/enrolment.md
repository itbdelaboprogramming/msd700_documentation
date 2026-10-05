---
outline: deep
search: false
---

# Akun & Akses: Pendaftaran Perangkat Keras

<RoleBadge role="developer" />

Protokol kriptografi lengkap yang dipakai robot fisik untuk mendaftarkan dirinya ke server cloud dan
menerima kredensial perangkatnya sendiri, tanpa perlu ada manusia di dekat robot yang melakukan apa
pun selain membaca kode klaim di terminal. Protokol ini menghasilkan kredensial Robot Cloud Domain yang
dijelaskan di [Keamanan & Token](/id/development/webui/accounts/security-and-tokens); untuk di mana
`device.json` dan cache token hasilnya berada di host robot, lihat
[Integrasi ROS](/id/development/webui/accounts/ros-integration).

## Pendaftaran perangkat keras kriptografis (protokol nonce)

Robot yang belum terdaftar mendaftarkan dirinya sendiri ke server cloud melalui jabat tangan
kriptografis tiga tahap.

![Pendaftaran perangkat keras kriptografis (protokol nonce)](./diagrams/enrolment-cryptographic-hardware-enrolment-the-non.drawio)

**Kontrak:** [`POST /enroll/claim`, `/enroll/status`, `/enroll/token`](/id/development/message-contracts/firmware-and-enrolment#enrolment)
(body request, kode status, dan bentuk kredensial).

### Mengapa protokol nonce 32-byte ini krusial

- **Perlindungan Terhadap Spoofing MAC / Fingerprint**: Alamat MAC dan nomor seri perangkat keras
  disiarkan di jaringan lokal dan terlihat di konsol admin. Tanpa nonce rahasia, penyerang yang
  melakukan spoofing alamat MAC bisa mengklaim kredensial saat robot fisik dalam keadaan mati.
- **Verifikasi Sekali Pakai**: Nonce plaintext dikirim melalui TLS di dalam badan POST (tidak pernah
  di query string, sehingga tidak tercatat di log akses reverse-proxy) selama proses penyerahan
  kredensial, dan sekali lagi saat pemulihan self-heal (di bawah). Server selalu memverifikasi
  `sha256(nonce)` terhadap hash yang tersimpan sebelum menerbitkan apa pun.
- **Nol Penyimpanan Rahasia Mentah**: Basis data cloud hanya menyimpan hash `bcrypt` dari
  `device_secret`. Bahkan kebocoran basis data secara menyeluruh tidak membahayakan rahasia
  perangkat robot yang aktif.

### Pemulihan self-heal: `device.json` yang hilang tanpa persetujuan baru

Robot yang kehilangan `device.json` lokalnya (disk yang dihapus, container bind-mount yang membuat
direktori kosong, bug lama) biasanya muncul kembali di kolam **pending**, dan seorang admin harus
mengadopsinya kembali ke unitnya, setiap kali. Padahal jika tidak ada apa pun pada binding yang
benar-benar berubah, itu murni menambah latensi dan sebuah antrean yang akhirnya dibiarkan begitu
saja disetujui operator.

`POST /enroll/claim` kini memotong jalur itu ketika **ketiga** syarat berikut terpenuhi:

1. Baris `pending_units` sudah berstatus `claimed` (perangkat keras ini sudah pernah menyelesaikan
   pendaftaran sebelumnya).
2. Permintaan membawa **nonce mentah**, dan `sha256(nonce)` cocok dengan `nonce_hash` yang tersimpan
   di baris tersebut. Ini adalah ambang yang sama yang harus dilewati `/enroll/status` sebelum
   penyerahan; fingerprint yang dipalsukan tidak pernah memiliki nonce-nya.
3. Sebuah baris `unit_devices` yang masih hidup masih mengikat `fingerprint` yang persis sama ini
   ke unit tempat baris tersebut disetujui (`revoked_at IS NULL`).

Server kemudian menerbitkan ulang `device_secret` di tempat dan mengembalikannya dalam respons klaim,
persis seperti jalur voucher-pendaftaran, tanpa langkah admin apa pun. Entri `unit_connection_log`
ditandai `recovery`.

Apa pun yang gagal pada pemeriksaan tersebut tetap jatuh ke kolam pending untuk ditangani manusia:
nonce yang berubah (re-image yang genuine, atau seorang penyamar), atau tidak ada binding yang hidup
(perangkat keras diadopsi ke unit lain, atau seorang admin sengaja melepas ikatannya).

### Voucher cetakan admin: mengklaim unit sebelum robotnya ada

Alur nonce dimulai di robot. Alur voucher dimulai di admin console untuk unit yang didaftarkan manual (identitas placeholder, belum ada kontak fisik): `POST /admin/api/units/:id/enrollment-code` (token admin) mencetak kode **10 karakter** dari alfabet 30-char yang sama dengan claim code, di-bcrypt-hash di database, berlaku `valid_hours` (default 72, dijepit 1–720), ditampilkan **sekali**.

Robot menebusnya di `POST /enroll/claim` dengan `enrollment_code`, melewati kolam pending: server menemukan baris yang belum dipakai dan belum kedaluwarsa, `bcrypt.compare`, menandai `used_at`, dan menjalankan `issueCredential` yang sama dengan handover normal (mengembalikan `unit_id, unit_name, topic_root, device_secret, access_token`). Kode tak valid, sudah dipakai, atau kedaluwarsa mendapat 404. Revokasi adalah `DELETE /units/:id/device` (lepas ikatan robot): tidak ada endpoint hapus-kode. Jangan tertukar ketiga secret ini: claim **nonce** 32-byte (dibuat robot, tidak pernah disimpan), **claim code** 8-char milik admin (kolam pending), **voucher** 10-char (unit pra-registrasi), dan **device secret** 32-byte (kredensialnya sendiri).

### `secret_prev_hash`: satu generasi masa tenggang

`issueCredential` menyimpan `secret_hash` yang lama sebagai `secret_prev_hash` **hanya ketika**
`fingerprint` yang sama sedang mengumpulkan ulang. Robot yang menulis `device.json` baru dan
kemudian, pada percobaan ulang atau panggilan kedua yang balapan, menyajikan salinan yang dipegangnya
sesaat sebelumnya tidak terkunci karenanya. `/enroll/token` menghapus `secret_prev_hash` begitu robot
membuktikan bahwa ia memegang rahasia yang berlaku saat ini, sehingga jendela waktunya persis
"hingga penggunaan sukses pertama". Sebuah pengambilalihan (`fingerprint` berubah) tetap langsung
dipotong, tanpa masa tenggang untuk perangkat yang sedang digantikan.

## Satu robot, dua cloud {#one-robot-two-clouds}

Production dan stack dev (`docker-manager.sh up --dev`) adalah dua registry terpisah dengan database
terpisah. Unit yang disetujui salah satunya tidak ada di yang lain, jadi robot yang dipakai di
keduanya adalah dua unit, dengan dua identitas. Robot menjaganya tetap terpisah:

- `device.json` mencatat backend yang menerbitkannya (`server`). Ini identitas yang sedang dipakai,
  yang dibaca semua pembaca di robot.
- `Certificates/robot/identities/` menyimpan satu salinan per backend. Berpindah backend menukar
  salinan yang tepat ke `device.json` dan menyisihkan yang lain. Tidak ada yang dihapus, dan tidak
  ada yang pernah diberikan ke backend yang tidak menerbitkannya.

Sebelum setiap boot, `docker-manager.sh` meminta identitas untuk backend yang akan dipakai lewat
`enroll.py --select --server <backend>` (tanpa jaringan). Bila ada, robot boot seperti biasa. Bila
tidak ada, boot itu adalah **enrolment pertama untuk backend tersebut**: kode klaim, lalu robot
menunggu admin backend itu menyetujuinya, menyimpan identitas baru, dan baru kemudian mulai, sehingga
unit langsung online di dashboard backend itu begitu menyala. Kembali ke backend lain nanti tidak
perlu persetujuan: salinannya ditukar kembali.

Pengecekan identitas saat boot (`enroll.py --revalidate`) hanya memeriksa identitas backend yang
sedang dipakai. Bila tidak ada, ia keluar dengan kode `5` alih-alih boot, dan `run_msd.sh` (atau
`run_ros2.sh`) melakukan enrolment dan menunggu. Binding yang di-drop oleh backend **ini** sendiri
(admin menghapus atau unbind unit) tetap ditangani tanpa menunggu: robot mengumumkan dirinya, boot
dengan id cache-nya, dan sebuah collector mengambil persetujuannya.

Sampai 2026-10-05 hanya ada satu `device.json` untuk keduanya. `up --dev` pada robot yang terdaftar
di production memberikan kredensial production ke dev, mendapat `401 reenroll` yang sama dengan
binding yang di-drop, mengumumkan dirinya, lalu boot dengan id production yang tidak dikenal dev.
Persetujuan datang di latar belakang dan baru berlaku setelah restart, serta menimpa identitas
production, sehingga kembali ke production mengulang semuanya. Ditambah lagi, pengecekan saat boot
dan collector melakukan claim dengan machine-id milik container, bukan fingerprint host, sehingga
self-heal di atas tidak pernah mengenali laptop yang sama. `docker-manager.sh` kini mengirim
fingerprint host di setiap `up`.

Identitas yang ditulis sebelum perubahan ini tidak punya `server`. Backend pertama yang menerimanya
mencatatnya sebagai miliknya. Identitas yang ditolak sebuah backend disimpan sebagai
`identities/unstamped-<ULID>.json` dan dicoba sekali ke backend berikutnya yang belum punya identitas
sendiri, sebelum backend itu diminta menyetujui robot.

## Terkait

- [Kontrak Pesan: Firmware & Enrolment](/id/development/message-contracts/firmware-and-enrolment#enrolment): bentuk request dan respons `/enroll`.
- [Ikhtisar](/id/development/webui/accounts/overview): keempat halaman Akun & Akses dan bagaimana
  hubungannya.
- [Keamanan & Token](/id/development/webui/accounts/security-and-tokens): keyring JWT, domain
  kepercayaan, dan terminasi TLS.
- [Integrasi ROS](/id/development/webui/accounts/ros-integration): bagaimana token dan lease operasi
  sampai ke robot.
- [Arsitektur](/id/development/architecture): topologi platform penuh dan domain kepercayaan.
- [State & Behavior](/id/development/state-and-behavior): mesin state di sisi robot, termasuk
  penegakan lease.
