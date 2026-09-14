---
outline: deep
search: false
---

# Sinkronisasi & Penyelarasan Peta

<RoleBadge role="developer" />

Jawaban halaman Navigasi untuk "titik robot di peta tidak berada di tempat robot sebenarnya
berada." Map Sync adalah entri Mode List (`initial-pose` di `ModeListPanel.tsx`) yang membawa
canvas ke mode koreksi pose sementara robot tetap diam; Auto Align adalah sub-fitur yang hanya
ditawarkan di dalam mode tersebut, yang melakukan koreksi yang sama tanpa perlu tebakan dari
operator. Untuk sisa Mode List lainnya, lihat [Ikhtisar](/id/development/webui/navigation/overview);
untuk kontrak jalur (wire contract) yang hanya diringkas di halaman ini, lihat
[Integrasi ROS](/id/development/webui/navigation/ros-integration).

::: info Cakupan
Halaman ini hanya membahas koreksi pose: Map Sync dan Auto Align. Pembersihan cakupan, mengemudi
pinpoint/rute, dan kontrol manual/autopilot dibahas di halaman masing-masing di bawah
[Terkait](#related). Algoritma sapuan cakupan itu sendiri (geometri, dekomposisi selular,
penanganan obstacle) berada di
[Cakupan Boustrophedon](/id/development/ros/boustrophedon-and-alignment), bukan di sini.
:::

## Apa yang diselesaikan oleh koreksi pose

AMCL melokalisasi robot terhadap peta yang telah direkam sebelumnya, tetapi estimasi tersebut bisa
melenceng dari posisi fisik robot sebenarnya: setelah didorong secara manual, naik lift, siklus
daya yang menghilangkan pose dalam memori, atau robot yang diangkat sepenuhnya. Secara tradisional
inilah fungsi langkah AMCL sendiri "berputar 360 derajat di tempat untuk mengumpulkan dispersi
partikel", tetapi
[guard rotasi di tempat](/id/development/ros/boustrophedon-and-alignment#rotasi-di-tempat-ditolak-secara-default)
menolak putaran tanpa pengawasan secara default, sehingga platform memerlukan cara yang dihadapkan
ke operator untuk mengoreksi pose tanpa bergantung pada gerakan tersebut.

Mode Map Sync adalah permukaan itu. Memilihnya (`Map Sync` di Mode List, yang berganti label
menjadi `Finish Map Sync` saat aktif) mengalihkan canvas peta yang mendasarinya ke state koreksi
pose interaktif; meninggalkannya mengembalikan canvas Navigasi normal.

## Auto Align

Auto Align adalah tombol yang hanya ditampilkan saat mode Map Sync aktif. Ia menggantikan cara
"operator menyeret ikon robot secara manual ke posisi dan orientasi yang tepat" dengan satu klik:
scan LiDAR live milik robot dicocokkan terhadap peta yang dimuat oleh pencocok scan yang diam
(stationary scan matcher), dan pose hasilnya ditulis langsung ke AMCL, tanpa rotasi dan tanpa
translasi. Ini adalah algoritma Correlative Scan Matching (CSM) zero-spin yang sama yang
didokumentasikan secara lengkap di
[Arsitektur Cakupan Boustrophedon & Penyelarasan Zero-Spin](/id/development/ros/boustrophedon-and-alignment#alignment-orientasi-zero-spin-correlative-scan-matching):
halaman tersebut adalah sumber kebenaran untuk fungsi skoring, ambang keyakinan (confidence
threshold), dan fallback micro-jog. Halaman ini hanya membahas kontrak tombol itu sendiri dengan
backend.

### `/api/autoalign/start`

`POST /api/autoalign/start` (didokumentasikan lengkap di
[Referensi API § Sistem Auto Align](/id/development/api-reference#sistem-auto-align)) memulai
pencocokan scan. Frontend (`autoAlignApi.ts`, `postAutoAlign('start', { unit_id })`)
menonaktifkan tombol tersebut segera dan melakukan polling status alih-alih menunggu panggilan ini
melaporkan konvergensi, karena konvergensi bersifat asinkron di sisi robot.

### `/api/autoalign/status`

Di-poll pada interval tetap selama sebuah run sedang berjalan untuk menanyakan apakah pencocok
scan telah konvergen. Frontend menganggap run tersebut selaras (aligned) hanya ketika flag
konvergensi pada respons bernilai `true`, dan menyerah setelah batas waktu tunggu atas jika tidak
pernah konvergen, menampilkannya sebagai "failed" alih-alih toast error: tidak ada yang bergerak,
jadi tidak ada yang perlu dipulihkan, dan operator bisa langsung memicu ulang. Pemicuan ulang
sengaja diblokir hanya selama sebuah run benar-benar sedang berjalan, bukan setelah selesai atau
timeout.

### `/api/autoalign/reset`

Membersihkan run penyelarasan sisi robot: mereset flag internal aktif milik aligner dan
mengembalikan aktivitas robot yang dilaporkan kembali ke idle. Frontend memanggil ini pada
**kedua** jalur keluar, baik run yang konvergen maupun run yang timeout, karena state align sisi
robot jika tidak akan tetap ter-latch sebagai "active"/"auto_aligning" hingga dibersihkan secara
eksplisit, yang jika dibiarkan akan salah dibaca di tempat lain sebagai robot yang macet (stuck).
Ini juga dipanggil jika operator meninggalkan mode Map Sync di tengah run, untuk memberi tahu
robot agar berhenti (stand down).

::: info Tidak didokumentasikan di sumber
`api-reference.md` hanya mendokumentasikan `/api/autoalign/start`; endpoint `status` dan `reset`
dikonfirmasi dari lapisan transport frontend (`autoAlignApi.ts`) dan titik pemanggilannya, bukan
dari referensi REST. Bentuk respons persisnya di luar field yang dibaca frontend (boolean
konvergensi di bawah `details`/`error_details`, dan envelope `success`/`msg`) tidak dibahas oleh
materi sumber yang tersedia saat ini dan tidak ditebak di sini.
:::

## Consent: Auto Align adalah sumber kepercayaan guard rotasi

Auto Align sendiri tidak memerintahkan rotasi apa pun: itulah inti dari penggunaan pencocok scan
alih-alih putaran. Namun ia tetap menjadi penopang penting bagi
[guard rotasi di tempat](/id/development/ros/boustrophedon-and-alignment#rotasi-di-tempat-ditolak-secara-default)
milik platform, yang menolak setiap rotasi di tempat kecuali disertai perintah live pada salah
satu dari dua topic consent, dan pemeriksa internal Auto Align sendiri (`align_checker`) adalah
salah satu dari keduanya (yang lain adalah WASD manual). Secara konkret, ini berarti:

- Jika bagian lain dari stack pernah mencoba memutar robot di tempat untuk membantu lokalisasi
  (alih-alih memanggil Auto Align), guard rotasi akan menolnya, karena perintah tersebut tidak
  datang lewat `/mux/allign`.
- Menekan tombol Auto Align adalah, dari sudut pandang guard rotasi, satu-satunya cara yang
  diinisiasi operator untuk mengotorisasi rotasi di tempat demi keperluan lokalisasi, dan dalam
  desain saat ini hal itu tidak pernah dibutuhkan, karena penyelarasan CSM secara konstruksi
  bersifat zero-motion.

Halaman ini menyatakan tautan tersebut karena ini adalah titik integrasi UI-ke-ROS yang nyata:
tombol yang ditekan operator di mode Map Sync dinamai, oleh guard tersebut, sebagai sumber consent
yang tepercaya. Logika gating lengkap guard tersebut (gerbang geometri, jendela toleransi, apa
yang dimatikan) didokumentasikan di
[Arsitektur Cakupan Boustrophedon & Penyelarasan Zero-Spin](/id/development/ros/boustrophedon-and-alignment#rotasi-di-tempat-ditolak-secara-default)
dan tidak diulang di sini.

## Terkait

- [Ikhtisar](/id/development/webui/navigation/overview): halaman Navigasi dan Mode List
  lengkapnya.
- [Pembersihan Cakupan](/id/development/webui/navigation/coverage-cleaning): fitur lain yang
  dimulai dalam keadaan diam (stationary-start) dan berjalan otonom di halaman ini.
- [Pinpoint & Rute](/id/development/webui/navigation/pinpoint-and-routes): mengemudi
  single/multi pinpoint dan rute tersimpan.
- [Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot): teleop dan
  sequencer autopilot.
- [Integrasi ROS](/id/development/webui/navigation/ros-integration): kontrak jalur Navigasi
  lengkap, termasuk panggilan REST Auto Align dalam konteks fitur selebihnya.
- [Arsitektur Cakupan Boustrophedon & Penyelarasan Zero-Spin](/id/development/ros/boustrophedon-and-alignment):
  algoritma CSM dan guard rotasi di tempat.
- [Kontrak Pesan](/id/development/message-contracts): referensi lengkap perintah/feedback MQTT.
- [Referensi API](/id/development/api-reference): referensi lengkap REST API.
- [Protokol WebSocket dan rosbridge](/id/development/rosbridge-protocol): protokol jalur
  rosbridge lengkap.
