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
| **ROS Master** | `11311` | `11312` | TCP (XML-RPC) |
| **rosbridge** | `9090` | `9091` | WebSocket |
| **HiveMQ MQTT** | `8883` | `8884` | TLS Encrypted MQTTS |
| **Database MySQL** | `3307` | `3308` | TCP |
| **Backend REST API** | `5000` | `5001` | HTTP |
| **Dashboard Next.js**| `3000` | `3100` | HTTP |

Robot fisik atau simulasi terhubung ke peer cloud dev dengan meneruskan `--dev`:
```bash
./scripts/docker-manager.sh up --dev -d
```

### Alur Kerja Pengembangan Sisi Robot:
Di `msd700_noetic`, direktori `src/` di-bind-mount langsung ke dalam kontainer runtime robot. Perubahan pada launch file, node Python, atau model URDF berlaku pada launch berikutnya tanpa memerlukan rebuild image. Rebuild image (`docker-manager.sh build`) hanya diperlukan ketika paket catkin C++ atau dependensi sistem dasar dimodifikasi.

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
# 1. Validate all Mermaid diagrams syntax
node scripts/check_parse.mjs

# 2. Build VitePress bundle and test broken links
npm run docs:build

# 3. Verify zero forbidden punctuation characters
grep -rn $'\xe2\x80\x94' docs/ scripts/
```

### Komponen Global Kustom:
Tema dokumentasi ini memperluas VitePress dengan komponen global kustom:
- `<RoleBadge role="user | technician | developer" />`: Menampilkan badge audiens target di bagian atas halaman.
- `<LinkCards>` / `<LinkCard title="..." details="..." link="..." icon="..." />`: Grid kartu interaktif yang digunakan pada halaman landing bagian.
- `<Mermaid code="..." />`: Perender SVG sisi klien untuk flowchart dan sequence diagram arsitektur yang responsif.

### Konvensi Commit dan Pull Request:
Commit mengikuti format conventional commit standar (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).

## Dokumentasi Terkait

- [Struktur Repositori](/id/development/repository-structure): Tata letak multi-repositori lengkap.
- [Arsitektur](/id/development/architecture): Topologi sistem dua mesin.
- [Changelog](/id/development/changelog): Riwayat rilis platform.
