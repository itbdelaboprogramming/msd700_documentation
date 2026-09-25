---
search: false
---

# Rute & Coverage

<RoleBadge role="user" />

Setelah memiliki peta, Anda bisa menyimpan **rute** (urutan pin) dan **area** (zona untuk disapu) yang bisa dipakai ulang. Area tersimpan juga bisa dirangkai menjadi **Operation Playlist** yang menyapu semuanya dalam satu kali jalan.

## Menyimpan Rute

1. Di [Navigasi](/id/user-guide/navigation), taruh pin pada peta untuk setiap titik pemberhentian yang ingin dikunjungi robot, secara berurutan.
2. Buka dialog **Save Route**.
3. Beri nama rute (contoh: "Patroli Pagi") dan konfirmasi.

Rute kini muncul di bagian **Routes** dan bisa dipakai ulang kapan saja tanpa perlu klik ulang setiap titik.

## Menggambar Area Coverage

Area coverage memberi tahu robot untuk menyapu seluruh zona secara sistematis: misalnya sebuah lorong atau ruangan terbuka: bukan sekadar mengunjungi titik-titik tunggal.

1. Gambar zona melalui toolbar peta dengan mengklik untuk menempatkan titik-titik sudut mengelilinginya, mengikuti tepi ruangan atau lorong.
2. Klik dua kali (atau klik titik pertama lagi) untuk menutup bentuk.
3. Pada dialog penyimpanan, pilih jenis area: **Covered Area** (robot menyapunya) atau **Avoided Area** (robot tidak memasukinya sama sekali, misalnya di sekitar partisi kaca atau area terjun).
4. Masukkan nama area lalu klik **Save**.

Robot akan merencanakan pola penyapuan bolak-balik yang efisien untuk mencakup seluruh zona sambil tetap menghindari Avoided Area.

::: tip Agar coverage penuh
Jalur sapuan yang bersebelahan saling tumpang tindih sehingga tidak ada bagian yang terlewat. Agar belokan seminimal mungkin, gambar area sedemikian rupa sehingga sisi terpanjangnya kurang lebih sejajar dengan arah penyapuan alami ruangan.
:::

## Menjalankan Sweep Coverage

1. Buka area tersimpan dari daftar.
2. Klik **Start Coverage**.
3. Robot menyapu area jalur demi jalur. Progres ditampilkan sebagai persentase atau overlay yang disorot pada peta.
4. Setelah selesai, status berubah menjadi **Complete**.

## Membangun Operation Playlist

Operation Playlist merangkai beberapa **area** tersimpan menjadi satu kali jalan: tidak termasuk rute, hanya area cover dan avoided.

1. Klik **Operation Playlist** pada toolbar Navigasi.
2. Tambahkan area cover dari daftar area tersimpan Anda, sesuai urutan penyapuan yang diinginkan (seret untuk mengubah urutan). Tambahkan juga area avoided bila perlu: area ini berlaku sebagai keep-out untuk seluruh proses, bukan sebagai langkah berurutan.
3. Ketik nama lalu klik **Save New** (atau pilih playlist yang sudah ada dan klik **Update**; ganti nama lewat ikon pensil, atau **Delete** untuk menghapus).
4. Klik **Run Playlist** untuk menyapu seluruh urutan dalam satu kali dispatch. Minimal satu area cover diperlukan: playlist yang hanya berisi area avoided akan ditolak sebelum sampai ke robot.
5. Agar tetap berjalan setelah Anda menutup dashboard, nyalakan **Autopilot** di panel Robot Control.

## Mengganti Nama atau Menghapus

Klik dua kali pada nama rute, area, atau playlist untuk mengganti namanya (nama duplikat ditangani otomatis). Gunakan ikon hapus (atau tombol **Delete** untuk playlist) untuk menghilangkan yang sudah tidak diperlukan.

## Pemecahan Masalah

**Robot melewati sebagian area**
: Sebuah Avoided Area mungkin tumpang tindih dengan zona coverage. Periksa bentuk area dan Avoided Area yang mungkin tumpang tindih.

**Sweep coverage berhenti lebih awal / menampilkan "Complete" tapi area terlihat belum tuntas**
: Robot mungkin menyerah setelah berulang kali terhalang rintangan. Periksa kamera langsung untuk melihat sesuatu yang menghalangi lorong, singkirkan, lalu jalankan ulang coverage.

**"Save New" / "Run Playlist" tidak bisa diklik**
: Playlist butuh minimal satu area cover dan sebuah nama sebelum bisa disimpan atau dijalankan; area avoided saja tidak cukup.
