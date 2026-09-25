---
outline: deep
search: false
---

# Konsol Admin: Integrasi ROS

<RoleBadge role="developer" />

Meski namanya demikian, dipertahankan demi konsistensi dengan grup fitur ROS Web UI lainnya,
sebagian besar yang dilakukan konsol admin adalah urusan MySQL-dan-REST tanpa node ROS di kedua
ujungnya. Dua hal di konsol ini memang menjangkau sampai ke robot atau ke kontainer unit yang
berjalan di bawahnya: enrolmen dan pelepasan ikatan unit, dan orkestrasi `unit_manager.js` atas
kontainer relay tempat data sebuah unit sungguhan mengalir. Halaman ini mencakup keduanya,
ditambah batas soket Docker yang membatasi apa yang dapat dilakukan backend terhadap host dalam
prosesnya. Untuk layarnya sendiri, lihat
[Unit](/id/development/webui/admin-console/units); untuk jabat tangan nonce
lengkap yang dijalankan robot di sisinya sendiri, lihat
[Enrolmen Perangkat Keras](/id/development/webui/accounts/enrolment).

## Enrolmen dan pelepasan ikatan unit

Menyetujui robot tertunda (Daftarkan sebagai baru / Adopsi ke unit yang sudah ada, lihat
[Unit § Tampilan Tertunda](/id/development/webui/admin-console/units#tampilan-tertunda))
adalah tahap otorisasi-administrator dari protokol nonce tiga-tahap yang dijelaskan lengkap di
[Enrolmen Perangkat Keras § Enrolmen perangkat keras kriptografis (protokol
nonce)](/id/development/webui/accounts/enrolment#pendaftaran-perangkat-keras-kriptografis-protokol-nonce).
Halaman ini tidak mengulang jabat tangan itu; peran konsol admin di dalamnya adalah satu langkah
di tengah: mengubah baris `pending_units` dengan `status: pending` menjadi `approved`, terikat ke
baris `units` tertentu.

**Melepas ikatan** perangkat milik sebuah unit (lihat
[Unit § Lepas ikatan perangkat terdaftar milik sebuah
unit](/id/development/webui/admin-console/units#lepas-ikatan-perangkat-terdaftar-milik-sebuah-unit))
menghapus baris `unit_devices` hidup yang mengikat sebuah `fingerprint` ke unit tersebut.
Konsekuensinya spesifik dan terdokumentasi langsung dalam jalur self-heal yang seharusnya diambil
robot yang kembali:

> Apa pun yang gagal pada pemeriksaan itu tetap jatuh ke kolam tertunda untuk seorang manusia:
> nonce yang berubah (re-image sungguhan, atau penipu), atau tidak ada ikatan hidup (perangkat
> keras diadopsi ke unit yang berbeda, **atau seorang admin melepas ikatannya dengan sengaja**).
>
>: [Enrolmen Perangkat Keras § Pemulihan
> self-heal](/id/development/webui/accounts/enrolment#pemulihan-self-heal-device-json-yang-hilang-tanpa-persetujuan-baru)

Dengan kata lain, melepas ikatan tidak sekadar menghapus baris basis data: ia dengan sengaja
mematahkan kondisi ketiga dari tiga kondisi yang diperiksa pemulihan self-heal ("baris
`unit_devices` hidup masih mengikat `fingerprint` persis ini ke unit tersebut"), sehingga lain
kali `enroll.py` robot tersebut memanggil `POST /enroll/claim`, ia tidak dapat diam-diam
memulihkan identitas lamanya. Ia jatuh ke kolam tertunda persis seolah-olah ia perangkat keras
baru, dan membutuhkan persetujuan administrator yang segar (Daftarkan atau Adopsi lagi) sebelum
dapat terdaftar kembali sebagai unit. Itulah keseluruhan inti dari menawarkan "memaksa
pendaftaran-ulang" sebagai aksi terpisah dari menghapus unit sepenuhnya: identitas, riwayat, dan
penugasan penyewaan unit tersebut semuanya bertahan; hanya kredensial perangkatnya yang diputus.

## `unit_manager.js` dan kontainer unit

Tidak ada satu pun aksi tab Unit yang memulai atau menghentikan kontainer relay milik sebuah
robot. Siklus hidup kontainer: mesin status `Absent → Starting → Running → Retained → Stopped`
di [Siklus Hidup Kontainer Unit § Mesin Status Siklus Hidup
Kontainer](/id/development/unit-container-lifecycle#state-machine-siklus-hidup-kontainer):
sepenuhnya didorong oleh aktivitas operator (membuka dashboard sebuah unit, detak jantung ping,
status Autopilot), bukan oleh apa pun yang diklik admin di sini. Yang *memang* diubah oleh aksi
admin adalah data yang dijembatani satu kontainer unit relay bersama, dan koneksi itu
nyata:

- **Daftarkan / Hapus sebuah unit** mengubah tabel `units`, yang juga menjadi sumber roster relay
  semua unit. `fleet_roster.js` "membaca setiap baris tabel `units` dan mendekode setiap id
  `BINARY(16)` menjadi ULID-nya," sesuai
  [Siklus Hidup Kontainer Unit § Roster berasal dari basis
  data](/id/development/unit-container-lifecycle#roster-berasal-dari-database); mendaftarkan
  atau menghapus sebuah unit adalah keseluruhan mekanismenya, tanpa langkah terpisah untuk
  "menyalakan bridging" untuknya.
- **`startRosterReconciler()`** membaca ulang roster itu setiap `FLEET_ROSTER_POLL_MS` (default
  60 dtk) dan me-restart kontainer relay jika berubah: lihat
  [Siklus Hidup Kontainer Unit § Enrolmen me-restart relay secara
  otomatis](/id/development/unit-container-lifecycle#pendaftaran-me-restart-relay-secara-otomatis).
  Sebuah unit yang didaftarkan atau dihapus dari konsol ini mencapai relay hidup dalam satu
  interval polling, bukan seketika, itulah yang mendasari konfirmasi hapus yang sadar-kebasian di
  [Unit](/id/development/webui/admin-console/units#hapus-unit).
- Roster tersebut dengan sengaja adalah **setiap** unit di tabel, tidak disaring berdasarkan
  status penyewaan: "sebuah robot yang penyewaannya kedaluwarsa tetap robot yang dapat menyala
  dan mempublikasikan." Menangguhkan atau menugaskan ulang sebuah profil penyewaan di
  [Penyewaan](/id/development/webui/admin-console/rentals) karenanya tidak menghapus sebuah unit
  dari bridge; hanya menghapus baris `units` itu sendiri yang melakukannya.

::: info Unit relay adalah default; jalur legacy per-unit masih ada
`UNIT_CONTAINERS_ENABLED=false` (default) berarti satu kontainer bersama,
`rosweb_unit_relays`, menjembatani setiap unit. Menetapkannya `true` mengembalikan ke kontainer
`rosweb_unit_<ULID>` khusus per robot, arsitektur di
[Siklus Hidup Kontainer Unit § Ikhtisar Arsitektur Kontainer
(Legacy)](/id/development/unit-container-lifecycle#ikhtisar-arsitektur-kontainer-legacy). Tidak
ada apa pun di konsol admin yang berbeda antara kedua mode tersebut: tabel `units` yang sama
mendorong keduanya, baik sebagai roster unit relay maupun sebagai kumpulan kontainer yang
diinstansiasi `unit_manager.js` sesuai permintaan. Lihat
[Siklus Hidup Kontainer Unit § Kembali ke satu kontainer per
robot](/id/development/unit-container-lifecycle#kembali-ke-satu-kontainer-per-robot) untuk
bahaya menjalankan keduanya sekaligus.
:::

## Keamanan Soket Docker

`backend_node` (proses tempat seluruh konsol ini berjalan) berkomunikasi dengan mesin Docker
host lewat bind mount `/var/run/docker.sock`. Sesuai
[Siklus Hidup Kontainer Unit § Keamanan Soket
Docker](/id/development/unit-container-lifecycle#keamanan-docker-socket), eksekusi kontainer lewat
soket itu dibatasi hanya untuk mengelola kontainer yang cocok dengan namespace `rosweb_unit_*`,
mencegah manipulasi kontainer sembarangan pada host. Setiap aksi admin yang pada akhirnya
menyentuh sebuah kontainer (memulai, menghentikan, atau me-restart sebuah relay sebagai efek
samping perubahan roster di atas) melewati permukaan terbatas yang sama itu, tidak pernah
perintah Docker serba-guna.

## Terkait

- [Ikhtisar](/id/development/webui/admin-console/overview): shell lima-tab, peran admin vs superadmin, dan menu akun.
- [Operator](/id/development/webui/admin-console/operators): mendaftarkan, mencari, menangguhkan/mengaktifkan kembali, dan mereset kata sandi akun operator.
- [Unit](/id/development/webui/admin-console/units): sub-tampilan Unit Terdaftar dan Tertunda yang menjadi dasar mekanisme ini.
- [Penyewaan](/id/development/webui/admin-console/rentals): CRUD profil penyewaan, keanggotaan, dan penugasan unit.
- [Cadangan](/id/development/webui/admin-console/backups): mengarsipkan dan memulihkan profil penyewaan secara utuh.
- [Arsitektur](/id/development/architecture): struktur sistem tingkat tinggi dan model dua-mesin.
- [Skema Basis Data](/id/development/database-schema): referensi skema lengkap untuk `units`, `unit_devices`, dan `pending_units`.
- [Siklus Hidup Kontainer Unit](/id/development/unit-container-lifecycle): referensi lengkap untuk `unit_manager.js`, roster, dan unit relay.
- [Cadangan, Pemulihan, dan Migrasi Data](/id/development/backup-and-restore): referensi mandiri untuk format arsip dan operasi REST.
