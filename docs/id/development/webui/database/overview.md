---
outline: deep
search: false
---

# Ikhtisar Basis Data

<RoleBadge role="developer" />

Fitur Basis Data adalah layar Map DB di `unit/database` pada dashboard
(`pages/unit/database/index.tsx`, komponen `DatabaseComponent.tsx`): tempat operator melihat
setiap peta yang tercatat pada unit saat ini dan memilih satu untuk dimuat ke Navigasi, atau
membersihkan peta lama. Halaman ini menjelaskan cara layar ini berperilaku, untuk insinyur frontend
yang mengerjakannya, bukan sebagai tutorial pengguna akhir. Untuk alur ganti nama dan hapus, lihat
[Ganti Nama & Hapus](/id/development/webui/database/rename-and-delete). Untuk skema dan endpoint
REST di balik layar ini, lihat [Integrasi ROS](/id/development/webui/database/ros-integration).

## Cakupan

Layar ini mendaftar peta sebagai baris kelas satu saja. Rute, area cover/no-cover tersimpan, dan
playlist operasi adalah atribut yang menyertai sebuah peta alih-alih baris tersendiri di sini:
`modified_by_username` pada sebuah peta mencakup perubahan pada "peta itu sendiri, rute-rutenya,
area tersimpannya, atau playlist-nya" sebagai satu nilai, dan ketiganya cascade-delete bersama
petanya (lihat
[Ganti Nama & Hapus § Cascade delete](/id/development/webui/database/rename-and-delete#cascade-delete)),
tetapi tak satu pun dari ketiganya punya daftar, kotak pencarian, atau kontrol ganti nama sendiri
di layar ini. Profil penyewaan juga tidak disentuh di sini.

## Daftar peta

`DatabaseTable.tsx` merender satu baris per peta, dengan kolom-kolom berikut:

| Kolom | Catatan |
| --- | --- |
| Nama | `map_name` |
| Terakhir diubah | `modified_at` |
| Terakhir diubah oleh | `modified_by_username`, mencakup perubahan pada peta itu sendiri atau pada rute, area, atau playlist mana pun yang menyertainya |
| Ukuran berkas | ukuran aset tersimpan milik peta |
| Pose homebase | `homebase_x`, `homebase_y` |

Nama peta hanya unik per `(unit_id, profile_id)`, bukan secara global, sehingga dua robot pada
penyewaan yang sama masing-masing bisa memiliki peta dengan nama sama namun `id` berbeda. Tabel
wajib dicakup berdasarkan `unit_id` dan mengunci segalanya berdasarkan `id`, jangan pernah
dedupe baris berdasarkan nama. Lihat
[Integrasi ROS § Tabel](/id/development/webui/database/ros-integration#tabel) untuk batasan
skema di balik ini.

## Pencarian, urutan, dan paginasi

`DatabaseSearch.tsx` menyaring baris yang tampil. Pengurutan berdasarkan nama atau tanggal,
menaik atau menurun, hanya satu urutan yang aktif dalam satu waktu: memilih kunci urutan baru atau
membalik arah menggantikan urutan yang aktif sebelumnya, bukan menambahkan urutan sekunder.
`DatabasePagination.tsx` memaginasi apa pun yang tersisa setelah filter pencarian dan pengurutan.

## Memilih sebuah peta

Kontrol radio atau checkbox pada setiap baris menetapkan konteks "peta terpilih" yang berlaku di
seluruh aplikasi. Memilih sebuah baris tidak memuat apa pun ke Navigasi dengan sendirinya, ia hanya
menandai peta mana yang menjadi target saat ini untuk aksi ganti nama dan hapus yang dijelaskan di
[Ganti Nama & Hapus](/id/development/webui/database/rename-and-delete).

## Membuka peta ke Navigasi

Membuka sebuah peta mengarahkan ke `/unit/navigation?index=<id>`. Jika sesi pemetaan sedang
berjalan atau dijeda pada unit dan operator membuka peta yang *berbeda* dari yang sedang direkam,
layar ini tidak diam-diam membuang peta yang sedang berjalan itu. Lihat
[Ganti Nama & Hapus § Pengaman konflik sesi](/id/development/webui/database/rename-and-delete#pengaman-konflik-sesi).

## Keadaan kosong dan memuat

`LoadingOverlay` menutupi tabel selagi daftar peta sedang diambil. `NoDataOverlay` menggantikan
tabel saat unit belum memiliki peta tercatat, atau saat tidak ada baris yang lolos filter
pencarian saat ini.

## Terkait

- [Ganti Nama & Hapus](/id/development/webui/database/rename-and-delete): dua aksi pengubah pada layar ini, secara rinci
- [Integrasi ROS](/id/development/webui/database/ros-integration): skema dan endpoint REST di balik fitur ini
- [Referensi Media Server](/id/development/webui/database/media-server-reference): API aset peta (upload, thumbnail, legacy-ID mapper)
- [Arsitektur](/id/development/architecture)
- [Skema Basis Data](/id/development/database-schema): referensi skema lengkap untuk `ROS_DB`
