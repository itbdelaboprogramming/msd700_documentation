---
outline: deep
---

# Penyiapan Wi-Fi MediaTek MT7922 (Kernel Tegra)

<RoleBadge role="technician" />

Beberapa unit dikirim atau di-retrofit dengan kartu Wi-Fi **MediaTek MT7922** sebagai pengganti
Realtek RTL8822CE bawaan proyek ini (lihat [Hotspot Wi-Fi & Klien](/id/setup/wifi-hotspot) untuk radio
bawaan tersebut). Di kernel Tegra (Jetson), driver in-tree `mt7921e` sudah tersedia, tetapi paket
firmware yang diinstal Ubuntu terkadang hanya menyediakan bentuk terkompresi `.zst` dari file firmware,
sementara build kernel tertentu masih meminta bentuk polos tanpa kompresi. Akibatnya kartu terdeteksi
tetapi tidak pernah menyala.

## Lingkungan yang tervalidasi

| Komponen | Nilai |
| --- | --- |
| OS | Ubuntu 24.04.4 LTS |
| Arsitektur | arm64 |
| Kernel | `6.8.12-1021-tegra` |
| Kartu Wi-Fi | MediaTek MT7922 |
| PCI ID | `14c3:0616` |
| Driver | `mt7921e` |

::: warning Solusi spesifik kernel, bukan perbaikan universal
Ini spesifik untuk Ubuntu 24.04 pada kernel `6.8.12-1021-tegra`, sesuai yang ditemukan pada proyek
ini. Kernel mainline atau Ubuntu yang lebih baru mungkin sudah mendekompresi firmware `.zst` saat
dimuat, sehingga ekstraksi manual pada panduan ini tidak diperlukan. Selalu lakukan
[Langkah 1](#_1-verifikasi-hardware-dan-driver) dan [Langkah 2](#_2-cek-firmware-mt7922) terlebih
dahulu untuk memastikan gejalanya benar-benar ada sebelum menerapkan perbaikan ini.
:::

## 1. Verifikasi hardware dan driver

```bash
lspci -nnk | grep -A3 -iE 'network|wireless'
```

Yang diharapkan:

```
MEDIATEK Corp. MT7922 802.11ax PCI Express Wireless Network Adapter [14c3:0616]
Kernel driver in use: mt7921e
Kernel modules: mt7921e
```

Jika `mt7921e` sudah muncul dan berfungsi, jangan pasang driver pihak ketiga: driver in-tree sudah
benar, masalahnya (jika ada) ada di firmware, bukan drivernya.

## 2. Cek firmware MT7922

```bash
ls -l /lib/firmware/mediatek/ | grep -i MT7922
```

Pada kasus yang menjadi dasar panduan ini, direktori tersebut hanya berisi file terkompresi:

```
WIFI_RAM_CODE_MT7922_1.bin.zst
WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst
```

tetapi kernel meminta nama tanpa kompresi:

```
WIFI_RAM_CODE_MT7922_1.bin
WIFI_MT7922_patch_mcu_1_1_hdr.bin
```

Konfirmasi dengan:

```bash
sudo dmesg | grep -iE 'mt792|firmware'
```

Error yang menjadi gejalanya terlihat seperti ini:

```
Direct firmware load for mediatek/WIFI_RAM_CODE_MT7922_1.bin failed with error -2
Direct firmware load for mediatek/WIFI_MT7922_patch_mcu_1_1_hdr.bin failed with error -2
mt7921e ... hardware init failed
```

`error -2` adalah `ENOENT`: kernel tidak menemukan file dengan nama persis tersebut, dan tidak
mendekompresi `.zst` secara otomatis pada build kernel ini.

## 3. Pastikan `zstd` tersedia

```bash
which zstd
```

Jika belum ada:

```bash
sudo apt update
sudo apt install zstd
```

## 4. Ekstrak firmware `.zst` menjadi `.bin`

```bash
cd /lib/firmware/mediatek

sudo zstd -d -f WIFI_RAM_CODE_MT7922_1.bin.zst \
    -o WIFI_RAM_CODE_MT7922_1.bin

sudo zstd -d -f WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst \
    -o WIFI_MT7922_patch_mcu_1_1_hdr.bin
```

Verifikasi bahwa kedua bentuk kini ada berdampingan:

```bash
ls -lh /lib/firmware/mediatek/*MT7922*
```

Yang diharapkan:

```
WIFI_RAM_CODE_MT7922_1.bin
WIFI_RAM_CODE_MT7922_1.bin.zst
WIFI_MT7922_patch_mcu_1_1_hdr.bin
WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst
```

::: info Jangan hapus file `.zst`
Jangan hapus file aslinya. Langkah ini hanya menambahkan salinan `.bin` hasil dekompresi di
sampingnya; file `.zst` asli tetap ada di tempatnya untuk keperluan apa pun yang mengandalkan
keberadaannya (misalnya verifikasi `dpkg`, pembaruan paket di masa depan).
:::

## 5. Reload driver

Tidak perlu reboot:

```bash
sudo modprobe -r mt7921e
sudo modprobe mt7921e
```

Lalu periksa:

```bash
sudo dmesg | grep -iE 'mt792|firmware' | tail -50
```

Jika berhasil, error firmware sebelumnya hilang dan muncul baris seperti ini:

```
ASIC revision: 79220010
HW/SW Version: ...
WM Firmware Version: ...
wlP1p1s0: renamed from wlan0
```

## 6. Verifikasi NetworkManager

```bash
nmcli device
```

Yang diharapkan:

```
wlP1p1s0   wifi   connected   eduroam
```

Nama interface tidak harus `wlP1p1s0`: itu tergantung pada predictable network interface naming
sistem, dan bisa berbeda antar mesin.

## Diagnosis

```mermaid
flowchart TD
  A["Hardware MT7922"] --> B["Terdeteksi di PCIe"]
  B --> C["Driver mt7921e terpasang"]
  C --> D{"Firmware .bin<br/>ditemukan?"}
  D -->|"Tidak, hanya .zst yang ada"| E["hardware init failed"]
  E --> F["NetworkManager tidak melihat radio<br/>'Adapter not found'"]
  D -->|"Ya"| G["Firmware berhasil dimuat"]
  G --> H["wlan0 diganti nama<br/>(mis. wlP1p1s0)"]
  H --> I["NetworkManager"]
  I --> J["Wi-Fi terhubung"]
```

## Setup sekali jalan untuk pemasangan berikutnya

Untuk mesin lain dengan kondisi yang sama (MT7922, firmware `.zst` tersedia, kernel meminta `.bin`),
ini adalah keseluruhan perbaikannya:

```bash
sudo apt update
sudo apt install zstd

cd /lib/firmware/mediatek

sudo zstd -d -f WIFI_RAM_CODE_MT7922_1.bin.zst \
    -o WIFI_RAM_CODE_MT7922_1.bin

sudo zstd -d -f WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst \
    -o WIFI_MT7922_patch_mcu_1_1_hdr.bin

sudo modprobe -r mt7921e
sudo modprobe mt7921e

nmcli device
```

## Terkait

- [Hotspot Wi-Fi & Klien](/id/setup/wifi-hotspot): radio bawaan proyek ini (RTL8822CE) dan penyiapan
  hotspot berbasis dongle yang menjadi alternatif dari kartu ini.
- [Pemecahan Masalah](/id/setup/troubleshooting): diagnostik teknisi secara umum.
