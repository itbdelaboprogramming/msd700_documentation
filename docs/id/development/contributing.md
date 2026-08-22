---
search: false
---
# Panduan Berkontribusi

<RoleBadge role="developer" />

Panduan ini mencakup alur kerja pengembang untuk berkontribusi pada **Produk Inti MSD700** (`ros-web-ui`, `msd700_robot`, `msd700_noetic`, `ROS-dashboard-next-ts`) dan **situs dokumentasi** ini.

## Alur Kerja Pengembangan Produk

Untuk menguji modifikasi sisi server dengan aman tanpa memengaruhi operator produksi, gunakan profil `server_dev` Docker Compose yang terisolasi:

```bash
cd ~/ros-web-ui
docker compose --profile server_dev up -d --build
```

### Offset Port Stack Pengembang:
Tumpukan pengembangan menggunakan offset port khusus untuk memungkinkan operasi bersamaan bersamaan dengan produksi:

| Layanan | Pelabuhan Produksi | Pelabuhan Pengembangan | Protokol |
| --- | --- | --- | --- |
| **Master ROS** | `11311` | `11312` | TCP (XML-RPC) |
| **jembatan ros** | `9090` | `9091` | Soket Web |
| **HiveMQ MQTT** | `8883` | `8884` | MQTTS Terenkripsi TLS |
| **Basis Data MySQL** | `3307` | `3308` | TCP |
| **API REST Backend** | `5000` | `5001` | HTTP |
| **Dasbor Next.js**| `3000` | `3100` | HTTP |

Robot fisik atau simulasi terhubung ke rekan cloud dev dengan meneruskan `--dev`:
```bash
./scripts/docker-manager.sh up --dev -d
```

### Alur Kerja Pengembangan Sisi Robot:
Di `msd700_noetic`, direktori `src/` dipasang secara langsung ke dalam container runtime robot. Perubahan pada file peluncuran, node Python, atau model URDF akan berlaku pada peluncuran berikutnya tanpa memerlukan pembuatan ulang gambar. Pembuatan ulang gambar (`docker-manager.sh build`) hanya diperlukan ketika paket C++ catkin atau dependensi sistem dasar dimodifikasi.

---

## Sedang mengerjakan Situs Dokumentasi ini

### Server Pengembangan Lokal:

```bash
cd ~/msd700_documentation
npm install
npm run docs:dev       # Starts local dev server at http://localhost:5700/itbdelabo/docs/
npm run docs:build     # Validates production build -> docs/.vitepress/dist
npm run docs:preview   # Serves production build preview
```

### Skrip Validasi Otomatis:
Sebelum melakukan perubahan dokumentasi, jalankan:

```bash
# 1. Validate all Mermaid diagrams syntax
node scripts/check_parse.mjs

# 2. Build VitePress bundle and test broken links
npm run docs:build

# 3. Verify zero forbidden punctuation characters
grep -rn $'\xe2\x80\x94' docs/ scripts/
```

### Komponen Global Khusus:
Tema dokumentasi ini memperluas VitePress dengan komponen global khusus:
- `<RoleBadge role="user | technician | developer" />`: Menampilkan lencana target audiens di bagian atas halaman.
- `<LinkCards>` / `<LinkCard title="..." details="..." link="..." icon="..." />`: Kisi kartu interaktif yang digunakan pada laman landas bagian.
- `<Mermaid code="..." />`: Penyaji SVG sisi klien untuk diagram alur arsitektur responsif dan diagram urutan.

### Konvensi Permintaan Komit dan Tarik:
Komit mengikuti format komit konvensional standar (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).

## Dokumentasi Terkait

- [Struktur Repositori](/id/development/repository-structure): Tata letak multi-repositori penuh.
- [Arsitektur](/id/development/architecture): Topologi sistem dua mesin.
- [Changelog](/id/development/changelog): Riwayat rilis platform.