---
outline: deep
search: false
---

# Konsol Admin: Unit & Armada

<RoleBadge role="developer" />

Tab Unit (`UnitsPanel.tsx`) adalah tempat admin mengelola `units`: tabel satu-baris-per-robot-fisik
yang dijelaskan di
[Skema Basis Data § Identitas dan akses](/id/development/database-schema#identitas-dan-akses). Ia
punya dua sub-tampilan, **Armada** dan **Tertunda**, ditambah badge jumlah robot tertunda yang
hidup. Halaman ini mencakup apa yang dilakukan setiap tampilan dan, di mana pun materi sumber
mendukungnya, persis mekanisme backend mana di
[Siklus Hidup Kontainer Unit](/id/development/unit-container-lifecycle) atau
[Skema Basis Data](/id/development/database-schema) yang sebenarnya diubah oleh sebuah aksi. Untuk
cara sebuah unit terdaftar menjadi dapat dikemudikan oleh siapa saja, lihat
[Penyewaan](/id/development/webui/admin-console/rentals); untuk protokol enrolmen dan orkestrasi
kontainer di balik aksi-aksi ini secara lebih mendalam, lihat
[Integrasi ROS](/id/development/webui/admin-console/ros-integration).

::: info Mendaftarkan sebuah unit tidak memberikan akses mengemudi
Sebuah baris di `units` hanya berarti robot tersebut ada di armada. Apakah siapa pun dapat
mengemudikannya diputuskan sepenuhnya di tab [Penyewaan](/id/development/webui/admin-console/rentals),
oleh profil penyewaan mana (jika ada) yang ditugaskan ke unit tersebut — lihat `profile_units` di
[Skema Basis Data § Identitas dan akses](/id/development/database-schema#identitas-dan-akses).
:::

## Tampilan Armada

### Mendaftarkan unit secara manual

Membuat baris `units` langsung (ULID baru dan `unit_name`), lebih dulu dari robot fisik mana pun
yang menghubungi cloud. Ini adalah rekan sisi-admin dari tabel `unit_enrollment_codes` yang
dijelaskan di [Skema Basis Data § Enrolmen](/id/development/database-schema#pendaftaran): "voucher
sekali-pakai untuk mengklaim unit tertentu sebelum robotnya ada." Unit yang didaftarkan secara
manual persis jenis unit itu — identitas placeholder yang akan diklaim robot nanti, alih-alih yang
sudah mengumumkan dirinya di tampilan Tertunda di bawah.

### Ganti nama unit

Menyunting `unit_name` saja. Sesuai
[Skema Basis Data § Identitas dan akses](/id/development/database-schema#identitas-dan-akses),
`unit_name` "adalah label tampilan yang dapat diganti nama, bukan identitas": `id` (ULID) baris
tersebut adalah alamat sungguhan robot (`/unit_<id>/...`) pada setiap topik ROS dan subscription
MQTT. Mengganti nama unit tidak mengubah apa pun tentang routing, roster relay armada, atau topik
apa pun yang dipublikasikan robot.

### Hapus unit

Menghapus baris `units`, dijaga oleh konfirmasi yang secara eksplisit sadar bahwa perubahan
tersebut mungkin belum sampai ke sistem yang sedang berjalan. Kebasian data itu nyata, bukan salinan
UI defensif: relay armada menyimpan rosternya di memori dan hanya membaca ulang tabel `units` saat
polling, `FLEET_ROSTER_POLL_MS` (default 60 dtk) — lihat
[Siklus Hidup Kontainer Unit § Roster berasal dari basis
data](/id/development/unit-container-lifecycle#roster-berasal-dari-database). Penghapusan
secara eksplisit disebut di sana sebagai salah satu cara roster berubah tanpa melalui endpoint
enrolmen yang awalnya dibangun untuk ditangkap rekonsiliator:

> Polling alih-alih mengaitkan endpoint enrolmen, karena enrolmen bukan satu-satunya cara tabel
> tersebut berubah: penghapusan, pemulihan profil, atau admin memperbaiki baris secara manual
> semuanya terhitung.

Jadi subscription relay milik unit yang dihapus tidak langsung hilang pada saat diklik; mereka
kedaluwarsa dalam satu interval polling, itulah yang diperingatkan oleh kerangka kebasian pada
dialog konfirmasi. Sesuai foreign key pada `units`
([Skema Basis Data § Foreign key, lengkap](/id/development/database-schema#foreign-key-secara-lengkap)),
menghapus baris tersebut juga mem-cascade ke penugasan penyewaannya (`profile_units`) dan ikatan
perangkatnya (`unit_devices`), serta ke peta tercatatnya — lihat
[Basis Data](/id/development/webui/database/ros-integration) untuk apa yang terjadi pada peta milik
sebuah unit secara khusus, yang di luar cakupan di sini.

### Cadangkan data bercakupan-penyewaan unit ini

Membuat arsip **bercakupan-unit** (`scope: 'unit'`), sumbu kedua dari arsitektur backup dua-cakupan
di [Cadangan dan Pemulihan](/id/development/backup-and-restore#arsitektur-backup-dua-lingkup):
"Menangkap: Seluruh riwayat operasional yang tercatat oleh robot fisik tertentu." Karena
`maps_data` terkunci ke profil penyewaan mana pun yang merekamnya alih-alih ke unitnya (lihat
[Skema Basis Data § Data operasional (per peta)](/id/development/database-schema#data-operasional-per-peta)),
"data unit ini" dalam praktiknya berarti data milik penyewaan yang sedang ditugaskan ke unit
tersebut. Kegunaan khas cakupan ini, menurut sumber yang sama, adalah "Mengarsipkan sebuah robot
sebelum servis atau pembaruan perangkat keras pabrikan."

### Tukar data antara dua unit

Menukar dataset bercakupan-unit — "seluruh riwayat operasional yang tercatat oleh robot fisik
tertentu" yang sama seperti didefinisikan di atas — antara dua unit yang sudah ada, alih-alih
mengangkatnya keluar ke sebuah arsip. Ini adalah rekan dua-arah dari operasi backup dan restore
yang dijelaskan di [Cadangan](/id/development/webui/admin-console/backups): riwayat milik sebuah
robot berpindah ke identitas unit lain alih-alih meninggalkan sistem yang hidup.

### Bersihkan semua data untuk sebuah unit/penyewaan

Menghapus peta, rute, area, dan playlist yang dipegang pada salah satu dari dua cakupan: semua
yang pernah direkam sebuah unit tertentu, atau semua yang dimiliki sebuah penyewaan tertentu pada
unit itu. Ini mencerminkan pemisahan cakupan profil vs. unit yang dipakai untuk cadangan (lihat
[Cadangan dan Pemulihan § Arsitektur Backup Dua-Cakupan](/id/development/backup-and-restore#arsitektur-backup-dua-lingkup)),
diterapkan sebagai penghapusan alih-alih arsip.

### Pindahkan data unit ke robot terdaftar lain

Ini adalah kasus penggunaan kanonis backup bercakupan-profil, dijabarkan langsung pada tabel
dua-cakupan: "Memigrasikan peta dan rute milik pelanggan ke robot pengganti." Karena restore
bercakupan-**profil** bersifat aditif dan memungkinkan robot yang hilang dipetakan ulang (lihat
[Cadangan](/id/development/webui/admin-console/backups)), memindahkan data seorang penyewa ke unit
fisik yang berbeda adalah mekanisme yang sama persis dengan backup dan restore profil, ditampilkan
di sini sebagai aksi langsung alih-alih ekspor/impor dua langkah.

### Lepas ikatan perangkat terdaftar milik sebuah unit

Menghapus ikatan `unit_devices` yang hidup milik unit tersebut, memaksa pendaftaran ulang. Lihat
[Integrasi ROS § Enrolmen dan pelepasan ikatan
unit](/id/development/webui/admin-console/ros-integration#enrolmen-dan-pelepasan-ikatan-unit) untuk apa
persisnya yang rusak di sisi robot dan mengapa robot tidak dapat diam-diam memulihkan identitas
lamanya setelah itu.

## Tampilan Tertunda

Robot yang telah menyelesaikan tahap "hello" dari protokol nonce — `POST /enroll/claim` — tetapi
belum diklaim ke baris `units` berada di `pending_units`
([Skema Basis Data § Enrolmen](/id/development/database-schema#pendaftaran)), dengan `status` salah
satu dari `pending`, `approved`, `claimed`, atau `rejected`. Badge jumlah di sebelah tab Tertunda
adalah jumlah baris yang sedang berada di `pending`. Jabat tangan tiga tahap lengkap yang dilalui
sebuah robot untuk sampai di tabel ini didokumentasikan di
[Enrolmen Perangkat Keras § Enrolmen perangkat keras kriptografis (protokol
nonce)](/id/development/webui/accounts/enrolment#pendaftaran-perangkat-keras-kriptografis-protokol-nonce);
halaman ini hanya mencakup apa yang dilakukan admin terhadap sebuah baris setelah baris itu ada.

- **Daftarkan sebagai unit baru**: menyetujui robot tertunda dengan membuat baris `units` baru
  untuknya — tahap otorisasi-administrator dari protokol nonce, menuntaskan jabat tangan untuk
  perangkat keras yang belum pernah dilihat siapa pun.
- **Adopsi ke catatan unit yang sudah ada**: menyetujui robot tertunda ke baris `units` yang
  *sudah ada* alih-alih membuat yang baru — bahasa "diadopsi... ke unit yang berbeda" yang sama
  seperti dipakai di
  [Enrolmen Perangkat Keras § Pemulihan self-heal](/id/development/webui/accounts/enrolment#pemulihan-self-heal-device-json-yang-hilang-tanpa-persetujuan-baru)
  untuk menjelaskan sebuah unit yang perangkat kerasnya berubah di bawahnya. Ini adalah cara
  perangkat keras pengganti mempertahankan riwayat, penugasan penyewaan, dan peta milik unit
  tersebut alih-alih mulai dari awal sebagai robot baru.
- **Tolak**: menetapkan `status` menjadi `rejected` dan tidak berlanjut lebih jauh.

## Terkait

- [Ikhtisar](/id/development/webui/admin-console/overview): shell lima-tab, peran admin vs superadmin, dan menu akun.
- [Operator](/id/development/webui/admin-console/operators): mendaftarkan, mencari, menangguhkan/mengaktifkan kembali, dan mereset kata sandi akun operator.
- [Penyewaan](/id/development/webui/admin-console/rentals): sungguhan disewa kepada siapa sebuah unit terdaftar, dan siapa yang dapat mengemudikannya.
- [Cadangan](/id/development/webui/admin-console/backups): mengarsipkan dan memulihkan profil penyewaan secara utuh.
- [Integrasi ROS](/id/development/webui/admin-console/ros-integration): mekanisme enrolmen dan orkestrasi kontainer di balik tab ini.
- [Arsitektur](/id/development/architecture): struktur sistem tingkat tinggi dan model dua-mesin.
- [Skema Basis Data](/id/development/database-schema): referensi skema lengkap, termasuk `units`, `profile_units`, dan `unit_devices`.
- [Siklus Hidup Kontainer Unit](/id/development/unit-container-lifecycle): referensi mandiri untuk `unit_manager.js`, roster, dan relay armada.
- [Cadangan, Pemulihan, dan Migrasi Data](/id/development/backup-and-restore): referensi mandiri untuk format arsip dan operasi REST.
