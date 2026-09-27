# MSD700 System Documentation

Dokumentasi teknis resmi dan manual operasional untuk robot otonom pembersih panel surya **MSD700**.

Situs dokumentasi dibangun menggunakan **VitePress** dengan dukungan multi-bahasa bawaan (i18n) untuk:
- **English** (Sumber Utama di `/docs/`)
- **Bahasa Indonesia** (`/docs/id/`)
- **日本語 (Japanese)** (`/docs/ja/`)

---

## 🚀 Perintah Cepat (Quick Start)

### 1. Menjalankan Server Pengembangan Lokal

Jalankan perintah berikut untuk melihat pratinjau dokumentasi secara lokal:

```bash
npm run docs:dev
```

Secara default, VitePress akan membuka dokumentasi di `http://localhost:5173/itbdelabo/docs/` (atau port custom yang ditentukan).

### 2. Terjemahan (i18n)

Terjemahan ditulis dan dirawat manual, tidak ada skrip terjemahan mesin. Setiap perubahan pada
halaman bahasa Inggris di `docs/` harus diikuti perubahan yang sama di `docs/id/` dan `docs/ja/`
dalam commit yang sama. Rujukan diagram di halaman terjemahan menunjuk ke `.drawio` milik halaman
bahasa Inggris (`../../../development/.../diagrams/...`), tidak diduplikasi.

### 3. Membangun Bundle Produksi (Build)

Untuk memvalidasi dan membuat bundle statis siap produksi:

```bash
npm run docs:build
```

Hasil build akan disimpan di direktori `docs/.vitepress/dist`.

### 4. Diagram (draw.io)

Diagram berupa file `.drawio` di folder `diagrams/` di samping halamannya, disisipkan dengan
`![judul](./diagrams/nama.drawio)`. Halaman menggambar `.drawio` itu sendiri dengan viewer resmi
draw.io (view-only, tanpa PNG), jadi tidak ada langkah render: cukup edit file `.drawio`-nya dan
commit bersama markdown-nya. Detailnya ada di halaman *Repository Structure § Diagrams*.

---

## 📁 Struktur Direktori

```
msd700_documentation/
├── docs/
│   ├── .vitepress/           # Konfigurasi tema, navbar, sidebar, dan i18n
│   ├── getting-started/      # Panduan pengenalan, arsitektur, dan fitur
│   ├── setup/                # Prosedur penyiapan server dan robot Jetson
│   ├── development/          # Spesifikasi teknis, skema DB, dan protokol ROS
│   ├── id/                   # Terjemahan Bahasa Indonesia (dirawat manual)
│   └── ja/                   # Terjemahan Bahasa Jepang (dirawat manual)
├── scripts/
│   └── drawio-viewer.mjs     # Viewer draw.io terkunci yang dikirim ke browser
├── package.json
└── README.md
```

---

## 📝 Aturan Penulisan Dokumentasi

1. **Sumber Kebenaran**: Semua dokumen baru atau pembaruan teknis harus ditulis terlebih dahulu pada file bahasa Inggris di folder root `docs/`.
2. **Sinkronisasi**: Perbarui `docs/id/` dan `docs/ja/` secara manual dalam commit yang sama dengan perubahan bahasa Inggris.
3. **Validasi**: Pastikan `npm run docs:build` berhasil sebelum melakukan rilis.
