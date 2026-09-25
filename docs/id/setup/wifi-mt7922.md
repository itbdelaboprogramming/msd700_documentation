---
outline: deep
---

# Setup Wi-Fi MT7922 (Kernel Tegra)

<RoleBadge role="technician" />

**Step 1** dari alur [WiFi Hotspot](/id/setup/wifi-hotspot#alur-setup): perbaiki firmware radio onboard di sini dulu, lalu kembali untuk provisioning hotspot.

MT7922 adalah radio onboard yang diharapkan, bukan syarat mutlak. Hotspot mencoba virtual AP di radio onboard dulu; cek dukungan AP+client driver aslinya sebelum melewatkan dongle USB. Sama untuk unit RTL8822CE lama: satu phy saja tidak membuktikan apa-apa. Lihat [Primary radio vs. backup dongle](/id/setup/wifi-hotspot#radio-primary-vs-dongle-cadangan).

Di kernel Jetson (Tegra), driver `mt7921e` ada, tetapi paket firmware Ubuntu bisa hanya membawa file firmware terkompresi `.zst` sementara build kernel itu meminta file `.bin` polos. Kartu terdeteksi tapi tidak pernah naik, dan hotspot diam-diam fallback ke dongle cadangan.

## Environment yang dilaporkan

Diambil dari panduan sebelumnya, tidak dites ulang di Jetson dalam audit ini. Preflight repo menginstal `linux-firmware` dan memicu udev; tidak mendekompresi firmware atau me-reload driver. Konfirmasi kernel, modul, dan packaging firmware di mesin sendiri.

| Komponen | Nilai |
| --- | --- |
| OS | Ubuntu 24.04.4 LTS |
| Arsitektur | arm64 |
| Kernel | `6.8.12-1021-tegra` |
| Kartu Wi-Fi | MediaTek MT7922 |
| PCI ID | `14c3:0616` |
| Driver | `mt7921e` |

::: warning Fix spesifik kernel, bukan universal
Ini cocok untuk Ubuntu 24.04 di kernel `6.8.12-1021-tegra`. Kernel baru mungkin sudah mendekompresi firmware `.zst` saat load, sehingga fix ini tidak perlu. Selalu kerjakan Step 1 dan Step 2 dulu dan konfirmasi gejalanya sebelum menerapkan.
:::

## 1. Cek hardware dan driver

```bash
lspci -nnk | grep -A3 -iE 'network|wireless'
```

Harusnya:

```
MEDIATEK Corp. MT7922 802.11ax PCI Express Wireless Network Adapter [14c3:0616]
Kernel driver in use: mt7921e
Kernel modules: mt7921e
```

Bila `mt7921e` terdaftar dan bekerja, jangan instal driver lain: driver in-tree sudah benar. Masalahnya (bila ada) adalah firmware, bukan driver.

::: warning Kartu hilang, atau driver hilang?
Dua kegagalan yang lebih jarang, beda dari masalah firmware:

- **Kartu hilang total dari `lspci`.** Cek seating, daya, dan config PCIe/BSP. Firmware tidak bisa memperbaiki enumerasi PCIe yang hilang. Matikan daya sebelum reseat.
- **Kartu terdaftar, tapi tanpa baris `Kernel driver in use`, atau driver beda.** Cek modul ada di kernel ini: `modinfo mt7921e`. Nama paket Tegra tidak selalu `linux-modules-$(uname -r)`. Bila modul ada tapi tidak bind, cek kernel log dan policy modul. Repo ini tidak punya prosedur repair kernel.
:::

## 2. Cek firmware MT7922

```bash
ls -l /lib/firmware/mediatek/ | grep -i MT7922
```

Pada kasus yang dilaporkan folder hanya berisi file terkompresi:

```
WIFI_RAM_CODE_MT7922_1.bin.zst
WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst
```

padahal kernel meminta nama polos:

```
WIFI_RAM_CODE_MT7922_1.bin
WIFI_MT7922_patch_mcu_1_1_hdr.bin
```

Konfirmasi dengan:

```bash
sudo dmesg | grep -iE 'mt792|firmware'
```

Gejalanya terlihat seperti:

```
Direct firmware load for mediatek/WIFI_RAM_CODE_MT7922_1.bin failed with error -2
Direct firmware load for mediatek/WIFI_MT7922_patch_mcu_1_1_hdr.bin failed with error -2
mt7921e ... hardware init failed
```

`error -2` artinya "file tidak ditemukan". Konfirmasi nama yang diminta, file terinstal, dan dukungan loader kernel ini sebelum memperbaiki.

::: warning Folder hilang, atau tidak ada file sama sekali?
Masalah beda: paket firmware tidak pernah terinstal, bukan sekadar terinstal terkompresi:

```bash
sudo apt update
sudo apt install --reinstall linux-firmware
ls -l /lib/firmware/mediatek/ | grep -i MT7922
```

`./setup.sh --provision-network` hanya mencoba `apt-get install -y linux-firmware` polos saat interface STA diset tapi tidak ada. Tidak mendekompresi atau me-reload driver. Bila file kembali sebagai `.zst`, lanjutkan Step 3-4 di bawah. Bila folder tetap kosong atau install gagal, cek `apt-cache policy linux-firmware` dan `sudo apt update`: mirror paket rusak, bukan kartu ini.
:::

## 3. Pastikan `zstd` ada

```bash
which zstd
```

Bila hilang:

```bash
sudo apt update
sudo apt install zstd
```

## 4. Dekompresi firmware `.zst` menjadi `.bin`

Hanya untuk kasus terkompresi saja yang terkonfirmasi. Perintah ini tidak force-overwrite; berhenti dan periksa bila `.bin` sudah ada. Setelah update paket firmware, cek copy ekstraksi manual agar file basi tidak menutupi firmware paket yang lebih baru.

```bash
cd /lib/firmware/mediatek

sudo zstd -d WIFI_RAM_CODE_MT7922_1.bin.zst \
    -o WIFI_RAM_CODE_MT7922_1.bin

sudo zstd -d WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst \
    -o WIFI_MT7922_patch_mcu_1_1_hdr.bin
```

Kedua bentuk harus berdampingan sekarang:

```bash
ls -lh /lib/firmware/mediatek/*MT7922*
```

```
WIFI_RAM_CODE_MT7922_1.bin
WIFI_RAM_CODE_MT7922_1.bin.zst
WIFI_MT7922_patch_mcu_1_1_hdr.bin
WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst
```

::: info Biarkan file `.zst`
Jangan hapus. Ini hanya menambah copy `.bin` di sampingnya; file asli tetap untuk package management.
:::

## 5. Reload driver

Reload hanya dari konsol lokal atau koneksi kabel: unload memutus client dan AP di radio itu. Jangan force bila modul sibuk; reboot mungkin diperlukan.

```bash
sudo modprobe -r mt7921e
sudo modprobe mt7921e
```

Lalu:

```bash
sudo dmesg | grep -iE 'mt792|firmware' | tail -50
```

Pesan init baru harus muncul. Error lama tetap di log; bandingkan timestamp. Sukses terlihat seperti:

```
ASIC revision: 79220010
HW/SW Version: ...
WM Firmware Version: ...
wlP1p1s0: renamed from wlan0
```

## 6. Cek NetworkManager

```bash
nmcli device
```

Radio bekerja muncul sebagai device WiFi; `disconnected` normal sampai join jaringan. Repair firmware saja tidak men-join apa-apa. Cek konkurensi hotspot terpisah dengan output penuh `iw phy <phy> info`.

Nama interface tidak harus `wlP1p1s0`; beda tiap mesin.

## Diagnosis

![Diagnosis](./diagrams/wifi-mt7922-diagnosis.drawio)

## Setup one-shot untuk unit berikutnya

Untuk mesin lain dengan kasus terkompresi saja yang terkonfirmasi dan belum ada copy `.bin`. Pakai konsol lokal atau akses kabel, dan terapkan cek di atas dulu; jangan jalankan buta di tiap unit MT7922.

```bash
sudo apt update
sudo apt install zstd

cd /lib/firmware/mediatek

sudo zstd -d WIFI_RAM_CODE_MT7922_1.bin.zst \
    -o WIFI_RAM_CODE_MT7922_1.bin

sudo zstd -d WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst \
    -o WIFI_MT7922_patch_mcu_1_1_hdr.bin

sudo modprobe -r mt7921e
sudo modprobe mt7921e

nmcli device
```

## Terkait

- [Alur setup WiFi Hotspot](/id/setup/wifi-hotspot#alur-setup): lanjutkan di sini setelah halaman ini (provisioning, verifikasi; dongle cadangan optional).
- [Primary radio vs. backup dongle](/id/setup/wifi-hotspot#radio-primary-vs-dongle-cadangan): cek apakah driver bisa jalan tanpa dongle.
- [Troubleshooting](/id/setup/troubleshooting): diagnostik umum.
