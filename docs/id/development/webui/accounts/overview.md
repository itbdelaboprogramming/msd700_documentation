---
outline: deep
search: false
---

# Akun & Akses

<RoleBadge role="developer" />

Halaman-halaman yang berada di antara seseorang dan robot: login operator beserta pemilih unitnya, formulir
signup operator, login konsol admin yang terpisah, dan halaman ganti password admin. Dokumen ini
memperkenalkan tiap halaman dan bagaimana hubungan antar halaman tersebut. Mekanisme kriptografi di balik
token yang mereka terbitkan ada di [Keamanan & Token](/id/development/webui/accounts/security-and-tokens);
bagaimana robot fisik memperoleh kredensialnya sendiri ada di
[Pendaftaran Perangkat Keras](/id/development/webui/accounts/enrolment); bagaimana token dan lease
operasi tersebut benar-benar sampai ke robot ada di [Integrasi ROS](/id/development/webui/accounts/ros-integration).

## Login operator (`/`)

Halaman root adalah titik masuk operator: formulir login yang mengirim ke `POST /user/login`, dan
pemilih unit untuk memilih robot mana yang akan dikendalikan setelah masuk. Halaman ini juga membawa
titik masuk ke signup, dijelaskan di bawah, tetapi tautan tersebut disembunyikan sepenuhnya pada build
unit atau build lokal: unit tidak punya akun sendiri, jadi tidak ada yang perlu didaftarkan di sana.
Selain satu tautan itu, halaman ini murni tentang login sebagai operator.

## Signup operator (`/signup`)

Formulir pendaftaran mandiri untuk akun operator baru: pemeriksaan keunikan username dan email, bidang
password dan konfirmasinya, serta dialog sukses `ConfirmRegister` setelah akun dibuat. Seperti tautan
signup di halaman login, halaman ini sama sekali tidak ada di build lokal atau build unit.

::: warning Signup tidak memberikan akses ke robot mana pun
Membuat akun di sini hanya membuat identitas operator polos. Ini sendiri tidak memberikan akses untuk
mengendalikan unit mana pun: seorang admin masih harus secara terpisah menetapkan operator baru tersebut
ke sebuah profil penyewaan sebelum ia bisa melihat atau mengoperasikan robot. Signup adalah pembuatan
identitas, bukan otorisasi.
:::

## Login admin (`/admin`)

Halaman login kedua yang tidak dicantumkan di navigasi, hanya bisa dijangkau dengan menuju `/admin`
secara langsung, yang memanggil `adminLogin()` yang berbeda, bukan `/user/login` operator yang dipakai
di halaman root. Ini adalah pintu back-office untuk staf manajemen armada dan tenant, terpisah dari
apa pun yang dilihat operator.

## Ganti password admin (`/admin/change-password`)

Halaman ini punya dua mode yang berbeda:

- **Wajib (Forced)**: akun admin yang di-seed atau baru saja direset diarahkan ke sini sebelum bisa
  mencapai dashboard admin sama sekali, tanpa jalan kembali sampai password diganti.
- **Sukarela (Voluntary)**: dapat dijangkau kapan saja dari menu akun, dengan opsi `Back` untuk keluar
  tanpa mengubah apa pun.

## Akun operator dan akun admin adalah sistem yang terpisah

Login operator di atas dan login admin bukanlah dua tampilan atas satu ruang identitas: keduanya adalah
sistem kredensial yang sepenuhnya terpisah. Model keamanan platform ini, dirinci di
[Keamanan & Token](/id/development/webui/accounts/security-and-tokens), mengorganisasi autentikasi ke
dalam domain kepercayaan yang independen alih-alih satu login bersama; **Operator Domain** yang
diterbitkan oleh backend cloud adalah yang menjadi acuan autentikasi halaman login operator, dan domain
ini secara eksplisit dibatasi untuk operator manusia yang mengakses dashboard web. Login admin mengambil
dari penyimpanan akun dan jalur login sendiri yang terpisah (`adminLogin()`, bukan `/user/login`
operator): kedua halaman ini tidak berbagi formulir login, sesi, maupun jalur pengalihan satu sama lain.

## Terkait

- [Keamanan & Token](/id/development/webui/accounts/security-and-tokens): keyring JWT, domain
  kepercayaan, dan terminasi TLS.
- [Pendaftaran Perangkat Keras](/id/development/webui/accounts/enrolment): protokol nonce yang dipakai
  robot untuk mendaftarkan dirinya sendiri.
- [Integrasi ROS](/id/development/webui/accounts/ros-integration): bagaimana token dan lease operasi
  sampai ke robot.
- [Arsitektur](/id/development/architecture): topologi platform penuh dan domain kepercayaan.
- [State & Behavior](/id/development/state-and-behavior): mesin state di sisi robot, termasuk
  penegakan lease.
