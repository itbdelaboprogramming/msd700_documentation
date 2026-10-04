---
search: false
---

# Panduan Kontribusi

<RoleBadge role="developer" />

Panduan ini mencakup alur kerja pengembang untuk berkontribusi pada **Produk Inti MSD700** (`ros-web-ui`, `msd700_robot`, `msd700_noetic`, `ROS-dashboard-next-ts`) dan **situs dokumentasi** ini.

## Alur Kerja Pengembangan Produk

Untuk menguji modifikasi sisi server dengan aman tanpa mengganggu operator produksi, gunakan profil Docker Compose `server_dev` yang terisolasi:

```bash
cd ~/ros-web-ui
docker compose --profile server_dev up -d --build
```

### Offset Port Dev Stack:
Stack pengembangan menggunakan offset port khusus untuk memungkinkan operasi bersamaan dengan produksi:

| Layanan | Port Produksi | Port Pengembangan | Protokol |
| --- | --- | --- | --- |
| **ROS Master Cloud** | `11311` | `11312` | TCP (XML-RPC) |
| **ROS Master Unit** | `11321` | `11322` | TCP (XML-RPC, `--dev` di unit) |
| **rosbridge** | `9090` | `9091` | WebSocket |
| **HiveMQ MQTT** | `8883` | `8884` | TLS Encrypted MQTTS |
| **Database MySQL** | `3307` | `3308` | TCP |
| **Backend REST API** | `5000` | `5001` | HTTP |
| **Dashboard Next.js**| `3000` | `3100` | HTTP |
| **Signalling (WS / HTTP)** | `3001` / `3002` | `4001` / `4002` | WebSocket / HTTP |
| **Media Server** | `3003` | `4003` | HTTP |

Robot fisik atau simulasi terhubung ke peer cloud dev dengan meneruskan `--dev`:
```bash
./scripts/docker-manager.sh up --dev -d
```

### Alur Kerja Pengembangan Sisi Robot:
Di `msd700_noetic`, direktori `src/` di-bind-mount langsung ke dalam kontainer runtime robot. Perubahan pada launch file, node Python, atau model URDF berlaku pada launch berikutnya tanpa memerlukan rebuild image. Rebuild image (`docker-manager.sh build`) hanya diperlukan ketika paket catkin C++ atau dependensi sistem dasar dimodifikasi.


### Continuous Integration (develop):
Setiap repo produk menjalankan build dan test GitHub Actions pada **setiap push ke `develop` dan setiap pull request ke `develop`**, dan tidak di tempat lain (`main` dan branch lain tidak menjalankan apa pun). Push yang lebih baru membatalkan run yang sedang berjalan, dan setiap workflow juga bisa dijalankan manual (**Run workflow**).

| Repo | Workflow | Pengecekan |
| --- | --- | --- |
| `ros-web-ui` | `ci-develop.yml` | `catkin_make` untuk `source/` di `ros:noetic`, 12 skrip test Python (`*/scripts/test/test_*.py`), `npm ci` dan `node --check` untuk empat service Node |
| `msd700_robot` | `ci-develop.yml` | dependency image robot (`noetic_dep.sh`, rosdep), `catkin build`, test Python di `*/test/test_*.py` |
| `ROS-dashboard-next-ts` | `CI-CD.yml` | `next build`, ESLint dan Prettier (commit auto-fix), `tsc --noEmit`, `vitest` (Node 20) |
| `msd700_noetic` | `ci-develop.yml` | `bash -n`, `docker compose config`, cek Dockerfile, lalu build dan smoke test image robot dan webui-local terhadap `ros-web-ui` dan `msd700_robot` di `develop` |

`msd700_noetic` meng-clone dua repo private, jadi butuh secret repository `CI_REPO_TOKEN`: token fine-grained dengan akses baca **Contents** ke `ros-web-ui` dan `msd700_robot`. Tanpa secret itu, job build gagal dengan pesan yang menyebutkannya.

Pengecekan ROS ada di `.github/ci/build_and_test.sh`, jadi run bisa direproduksi lokal sebelum push:

```bash
docker run --rm -v "$PWD":/repo:ro ros:noetic bash /repo/.github/ci/build_and_test.sh
```

---

## Mengerjakan Situs Dokumentasi Ini

### Server Pengembangan Lokal:

```bash
cd ~/msd700_documentation
npm install
npm run docs:dev       # Starts local dev server at http://localhost:5700/itbdelabo/docs/
npm run docs:build     # Validates production build -> docs/.vitepress/dist
npm run docs:preview   # Serves production build preview
```

### Skrip Validasi Otomatis:
Sebelum melakukan commit perubahan dokumentasi, jalankan:

```bash
# 1. Build VitePress bundle and test broken links
npm run docs:build

# 2. Verify zero forbidden punctuation characters
grep -rn $'\xe2\x80\x94' docs/ scripts/
```

Diagram tidak butuh langkah render: halaman membaca file `.drawio`-nya langsung. Cukup edit,
simpan, dan commit bersama markdown yang merujuknya.

### Komponen Global Kustom:
Tema dokumentasi ini memperluas VitePress dengan komponen global kustom:
- `<RoleBadge role="user | technician | developer" />`: Menampilkan badge audiens target di bagian atas halaman.
- `<LinkCards>` / `<LinkCard title="..." details="..." link="..." icon="..." />`: Grid kartu interaktif yang digunakan pada halaman landing bagian.

### Konvensi Commit dan Pull Request:
Commit mengikuti format conventional commit standar (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).

## Dokumentasi Terkait

- [Struktur Repositori](/id/development/repository-structure): Tata letak multi-repositori lengkap.
- [Arsitektur](/id/development/architecture): Topologi sistem dua mesin.
- [Changelog](/id/development/changelog): Riwayat rilis platform.
