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

### 2. Memperbarui dan Menyinkronkan Terjemahan (i18n)

Jika Anda menambah atau mengubah halaman dokumentasi:
1. Cukup edit atau tulis file Markdown dalam bahasa Inggris di direktori `docs/`.
2. Jalankan skrip sinkronisasi otomatis:

```bash
npm run docs:i18n
```

Perintah ini akan secara otomatis:
- Menerjemahkan konten baru ke Bahasa Indonesia (`docs/id/`) dan Bahasa Jepang (`docs/ja/`).
- Mempertahankan integritas blok kode, rujukan diagram, kontainer VitePress, dan tag Vue.
- Menyesuaikan rute tautan Markdown internal ke direktori bahasa yang sesuai.

### 3. Membangun Bundle Produksi (Build)

Untuk memvalidasi dan membuat bundle statis siap produksi:

```bash
npm run docs:build
```

Hasil build akan disimpan di direktori `docs/.vitepress/dist`.

### 4. Diagram (draw.io)

Diagram berupa file `.drawio` di folder `diagrams/` di samping halamannya, disisipkan dengan
`![judul](./diagrams/nama.drawio)`. Edit dengan draw.io (misalnya ekstensi VS Code "Draw.io Integration"),
lalu render ulang PNG-nya dan cek semua rujukan:

```bash
npm run docs:diagrams
npm run docs:check-diagrams
```

Detailnya ada di halaman *Repository Structure § Diagrams*.

---

## 📁 Struktur Direktori

```
msd700_documentation/
├── docs/
│   ├── .vitepress/           # Konfigurasi tema, navbar, sidebar, dan i18n
│   ├── getting-started/      # Panduan pengenalan, arsitektur, dan fitur
│   ├── setup/                # Prosedur penyiapan server dan robot Jetson
│   ├── development/          # Spesifikasi teknis, skema DB, dan protokol ROS
│   ├── id/                   # Terjemahan Bahasa Indonesia (dihasilkan otomatis)
│   └── ja/                   # Terjemahan Bahasa Jepang (dihasilkan otomatis)
├── scripts/
│   ├── render-diagrams.mjs   # Render diagram .drawio ke PNG statis
│   └── sync_i18n.mjs         # Mesin sinkronisasi otomatis multi-bahasa
├── package.json
└── README.md
```

---

## 📝 Aturan Penulisan Dokumentasi

1. **Sumber Kebenaran**: Semua dokumen baru atau pembaruan teknis harus ditulis terlebih dahulu pada file bahasa Inggris di folder root `docs/`.
2. **Sinkronisasi**: Selalu jalankan `npm run docs:i18n` sebelum melakukan commit agar file terjemahan di `docs/id/` dan `docs/ja/` selalu sinkron.
3. **Validasi**: Pastikan `npm run docs:build` berhasil sebelum melakukan rilis.
