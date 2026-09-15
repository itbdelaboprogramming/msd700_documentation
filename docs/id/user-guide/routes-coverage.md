---
search: false
---

# Rute & Cakupan

<RoleBadge role="user" />

Setelah memiliki peta, Anda bisa menyimpan **rute** (urutan titik) dan **area** (zona untuk disapu) yang bisa dipakai ulang, lalu merangkainya menjadi **playlist** yang dijalankan robot secara otomatis.

## Menyimpan Rute

1. Di [Navigasi](/id/user-guide/navigation), taruh pin pada peta untuk setiap titik pemberhentian yang ingin dikunjungi robot, secara berurutan.
2. Klik **Simpan sebagai Rute**.
3. Beri nama rute (contoh: "Patroli Pagi") dan konfirmasi.

Rute kini muncul di bagian **Rute** dan bisa dipakai ulang kapan saja tanpa perlu klik ulang setiap titik.

## Menggambar Area Cakupan

Area cakupan memberi tahu robot untuk menyapu seluruh zona secara sistematis: misalnya sebuah lorong atau ruangan terbuka: bukan sekadar mengunjungi titik-titik tunggal.

1. Klik **Gambar Area** pada toolbar peta.
2. Klik untuk menempatkan titik-titik sudut mengelilingi zona yang ingin dicakup, mengikuti tepi ruangan atau lorong.
3. Klik dua kali (atau klik titik pertama lagi) untuk menutup bentuk.
4. Pilih apakah area tersebut **Cakup** (robot menyapu) atau **Tanpa Cakupan / Larangan** (robot menghindarinya sepenuhnya).
5. Klik **Simpan** dan beri nama area tersebut.

Robot akan merencanakan pola penyapuan bolak-balik (boustrophedon) yang efisien untuk mencakup seluruh zona sambil menghindari area larangan.

## Menjalankan Penyapuan Cakupan

1. Buka area tersimpan dari daftar.
2. Klik **Mulai Cakupan**.
3. Robot menyapu area jalur demi jalur. Progres ditampilkan sebagai persentase atau overlay yang disorot pada peta.
4. Setelah selesai, status berubah menjadi **Selesai**.

## Membangun Playlist

Playlist merangkai beberapa rute dan area cakupan menjadi satu urutan tanpa pengawasan.

1. Buka **Playlist** dan klik **Playlist Baru**.
2. Tambahkan rute dan/atau area cakupan sesuai urutan yang diinginkan.
3. Simpan playlist dengan nama yang deskriptif.
4. Dari [Navigasi](/id/user-guide/navigation), pilih playlist tersebut dan klik **Mulai Autopilot** untuk menjalankan seluruh urutan secara otomatis.

## Mengganti Nama atau Menghapus

Klik dua kali pada nama rute, area, atau playlist untuk mengganti namanya (nama duplikat ditangani otomatis). Gunakan ikon hapus untuk menghilangkan yang sudah tidak diperlukan.

## Pemecahan Masalah

**Robot melewati sebagian area**
: Zona larangan mungkin tumpang tindih dengan area cakupan. Periksa bentuk area dan zona larangan yang mungkin tumpang tindih.

**Penyapuan cakupan berhenti lebih awal / menampilkan "Selesai" tapi area terlihat belum tuntas**
: Robot mungkin menyerah setelah berulang kali terhalang rintangan. Periksa kamera langsung untuk melihat sesuatu yang menghalangi lorong, singkirkan, lalu jalankan ulang cakupan.

**Playlist tidak lanjut ke item berikutnya**
: Pastikan Autopilot masih aktif: menjeda secara manual akan menjeda seluruh playlist, bukan hanya langkah saat ini. Klik Lanjutkan untuk melanjutkan.
