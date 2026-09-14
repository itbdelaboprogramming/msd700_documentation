---
outline: deep
search: false
---

# Konsol Admin: Penyewaan

<RoleBadge role="developer" />

Tab Penyewaan (`ProfilesPanel.tsx`) mengelola `rental_profiles`: **siapa yang menyewa sebuah
robot**, pertanyaan yang sengaja dijaga terpisah dari `users`, **siapa yang mengemudikannya**.
Akun operator dan profil penyewaan adalah tabel berbeda karena suatu alasan — lihat
[Ikhtisar § Tiga ruang identitas, tiga
tab](/id/development/webui/admin-console/overview#three-identity-spaces-three-tabs) — dan tab ini
adalah tempat keduanya, ditambah sebuah unit, sungguhan dihubungkan. Untuk sisi akun-operator,
lihat [Operator](/id/development/webui/admin-console/operators); untuk sisi unit, lihat
[Unit & Armada](/id/development/webui/admin-console/units-and-fleet).

## Tabel di balik tab ini

Dari [Skema Basis Data § Identitas dan akses](/id/development/database-schema#identity-and-access):

| Tabel | Tujuan | Kolom kunci |
| --- | --- | --- |
| `rental_profiles` | Satu baris per penyewaan | `id` (ULID, PK), `profile_name` (unik), `tenant_name`, `status` |
| `profile_members` | Akun mana yang termasuk profil mana | `UNIQUE(profile_id, user_id)`, keduanya `ON DELETE CASCADE` |
| `profile_units` | Unit mana yang dapat diakses sebuah profil | `UNIQUE(unit_id)`, **bukan** `(profile_id, unit_id)` |

## Buat / sunting / hapus profil penyewaan

Sebuah profil membawa `tenant_name` dan catatan bebas. Menghapus satu profil tidak selalu
destruktif secara seragam: sesuai [Skema Basis Data § Foreign key,
lengkap](/id/development/database-schema#foreign-keys-in-full), `rental_profiles` berhubungan
dengan turunannya dalam tiga cara berbeda, dan hanya satu di antaranya yang benar-benar
memblokir penghapusan.

- `profile_id RESTRICT` pada `maps_data` — sebuah profil yang memiliki peta apa pun **tidak dapat**
  dihapus sampai peta-peta itu ditangani (misalnya, dengan mengarsipkan profil terlebih dahulu;
  lihat [Cadangan](/id/development/webui/admin-console/backups)).
- `profile_id CASCADE` pada `profile_members` dan `profile_units` — baris keanggotaan dan
  penugasan unit hilang secara otomatis bersama profilnya.
- `profile_id SET NULL` pada `profile_backups` — arsip yang sudah ada dari profil ini tetap
  bertahan setelah profil itu sendiri dihapus, sesuai aturan "sebuah arsip harus bertahan lebih
  lama dari yang diarsipkannya" yang sama seperti dijelaskan di
  [Skema Basis Data § Backup dan sinkronisasi](/id/development/database-schema#backup-and-sync).

Menangguhkan sebuah profil, alih-alih menghapusnya, adalah tuas yang lebih lunak: sesuai
[Skema Basis Data § Identitas dan akses](/id/development/database-schema#identity-and-access),
"menangguhkannya menyembunyikan baik unit maupun datanya dari anggota, tanpa menyentuh salah
satunya." Tidak ada yang dihapus atau ditugaskan ulang, dan mengaktifkan kembali profil
memulihkan persis apa yang ada di sana. Ini adalah mekanisme yang berbeda dari menangguhkan akun
*operator* (lihat [Operator](/id/development/webui/admin-console/operators)), yang saat ini belum
ditegakkan saat login; menangguhkan sebuah profil penyewaan berlaku segera bagi setiap anggota.

## Tambah / hapus anggota

`profile_members` menghubungkan baris `users` ke baris `rental_profiles`, `UNIQUE(profile_id,
user_id)` sehingga operator yang sama tidak dapat ditambahkan dua kali ke satu profil. Kedua
foreign key mem-cascade: menghapus akun seorang operator menghapus keanggotaannya di mana pun, dan
menghapus sebuah profil menghapus setiap baris keanggotaan yang menunjuk ke situ. Menjadi anggota
sebuah profil adalah yang sungguhan memungkinkan sebuah akun operator login dan melihat unit serta
data milik profil tersebut; pembuatan akun di [Operator](/id/development/webui/admin-console/operators)
tidak memberikan apa pun dari itu dengan sendirinya.

## Tugaskan / lepaskan unit

`profile_units` menghubungkan baris `units` ke baris `rental_profiles`. Indeks unik ada pada
`unit_id` saja, bukan pada pasangan `(profile_id, unit_id)`:

::: warning Sebuah unit hanya dapat ditugaskan ke satu profil dalam satu waktu
`profile_units.unique_rented_unit (unit_id)` ada khusus agar "penugasan ganda gagal secara jelas
alih-alih diam-diam menimpa yang sudah ada" (lihat
[Skema Basis Data § Indeks yang layak diketahui alasannya](/id/development/database-schema#indexes-worth-knowing-the-reason-for)).
Menugaskan ulang sebuah unit yang sudah ditugaskan ke profil lain ditolak sepenuhnya; ia tidak
diam-diam memindahkan unit tersebut dari bawah penyewa saat ini. Melepaskan unit dari profilnya
saat ini terlebih dahulu adalah yang membuatnya dapat ditugaskan di tempat lain.
:::

## Backup satu-klik dari tab ini

Pintasan ke alur [Cadangan](/id/development/webui/admin-console/backups): membuat arsip
bercakupan-profil dari profil yang dipilih tanpa meninggalkan tab Penyewaan. Ia menghasilkan arsip
yang sama seperti dijelaskan di sana — semua yang dimiliki profil tersebut, tidak pernah akun
operator yang menjadi anggotanya.

## Terkait

- [Ikhtisar](/id/development/webui/admin-console/overview): shell lima-tab, peran admin vs superadmin, dan menu akun.
- [Operator](/id/development/webui/admin-console/operators): mendaftarkan, mencari, menangguhkan/mengaktifkan kembali, dan mereset kata sandi akun operator.
- [Unit & Armada](/id/development/webui/admin-console/units-and-fleet): mendaftarkan, mengganti nama, dan menghapus unit yang ditugaskan tab ini.
- [Cadangan](/id/development/webui/admin-console/backups): alur arsip dan restore lengkap yang dituju pintasan tab ini.
- [Integrasi ROS](/id/development/webui/admin-console/ros-integration): cara aksi admin menjangkau robot dan armada kontainer.
- [Arsitektur](/id/development/architecture): struktur sistem tingkat tinggi dan model dua-mesin.
- [Skema Basis Data](/id/development/database-schema): referensi skema lengkap untuk `rental_profiles`, `profile_members`, dan `profile_units`.
- [Siklus Hidup Kontainer Unit](/id/development/unit-container-lifecycle): referensi mandiri untuk `unit_manager.js` dan relay armada.
- [Cadangan, Pemulihan, dan Migrasi Data](/id/development/backup-and-restore): referensi mandiri untuk format arsip dan operasi REST.
