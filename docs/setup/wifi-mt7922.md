---
outline: deep
---

# MediaTek MT7922 Wi-Fi Setup (Tegra Kernel)

<RoleBadge role="technician" />

**Step 1** of the [WiFi Hotspot flow](/setup/wifi-hotspot#setup-flow): fix the onboard radio's firmware here first, then go back and provision the hotspot.

MT7922 is the expected onboard radio, not a hard requirement. The hotspot tries a virtual AP on the onboard radio first; check the real driver's AP+client support before skipping the USB dongle. Same for older RTL8822CE units: one phy alone proves nothing. See [Primary radio vs. backup dongle](/setup/wifi-hotspot#primary-radio-vs-backup-dongle).

On the Jetson (Tegra) kernel, the `mt7921e` driver is present, but Ubuntu's firmware package can ship only the compressed `.zst` firmware files while that kernel build expects plain `.bin` files. The card is detected but never comes up, and the hotspot quietly falls back to the backup dongle.

## Reported environment

Kept from the earlier guide, not re-tested on a Jetson in this audit. The repo preflight installs `linux-firmware` and triggers udev; it does not decompress firmware or reload the driver. Confirm the kernel, module, and firmware packaging on your machine.

| Component | Value |
| --- | --- |
| OS | Ubuntu 24.04.4 LTS |
| Architecture | arm64 |
| Kernel | `6.8.12-1021-tegra` |
| Wi-Fi card | MediaTek MT7922 |
| PCI ID | `14c3:0616` |
| Driver | `mt7921e` |

::: warning Kernel-specific fix, not universal
This matches Ubuntu 24.04 on kernel `6.8.12-1021-tegra`. Newer kernels may already decompress `.zst` firmware on load, making this fix unnecessary. Always do Step 1 and Step 2 first and confirm the symptom before applying it.
:::

## 1. Check hardware and driver

```bash
lspci -nnk | grep -A3 -iE 'network|wireless'
```

Expect:

```
MEDIATEK Corp. MT7922 802.11ax PCI Express Wireless Network Adapter [14c3:0616]
Kernel driver in use: mt7921e
Kernel modules: mt7921e
```

If `mt7921e` is listed and working, do not install another driver: the in-tree driver is correct. The problem (if any) is firmware, not the driver.

::: warning Card missing, or driver missing?
Two rarer failures, different from the firmware issue:

- **Card missing from `lspci` entirely.** Check seating, power, and PCIe/BSP config. Firmware cannot fix missing PCIe enumeration. Power down before reseating.
- **Card listed, but no `Kernel driver in use` line, or a different driver.** Check the module exists on this kernel: `modinfo mt7921e`. Tegra package names are not always `linux-modules-$(uname -r)`. If the module exists but won't bind, check kernel logs and module policy. This repo has no kernel repair procedure.
:::

## 2. Check MT7922 firmware

```bash
ls -l /lib/firmware/mediatek/ | grep -i MT7922
```

In the reported case the folder had only compressed files:

```
WIFI_RAM_CODE_MT7922_1.bin.zst
WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst
```

while the kernel asked for plain names:

```
WIFI_RAM_CODE_MT7922_1.bin
WIFI_MT7922_patch_mcu_1_1_hdr.bin
```

Confirm with:

```bash
sudo dmesg | grep -iE 'mt792|firmware'
```

The symptom looks like:

```
Direct firmware load for mediatek/WIFI_RAM_CODE_MT7922_1.bin failed with error -2
Direct firmware load for mediatek/WIFI_MT7922_patch_mcu_1_1_hdr.bin failed with error -2
mt7921e ... hardware init failed
```

`error -2` means "file not found". Confirm the requested names, installed files, and this kernel's loader support before fixing.

::: warning Folder missing, or no files at all?
Different problem: the firmware package was never installed, not just installed compressed:

```bash
sudo apt update
sudo apt install --reinstall linux-firmware
ls -l /lib/firmware/mediatek/ | grep -i MT7922
```

`./setup.sh --provision-network` only tries a plain `apt-get install -y linux-firmware` when the STA interface is set but absent. It does not decompress or reload the driver. If files come back as `.zst`, continue with Steps 3-4 below. If the folder is still empty or the install itself fails, check `apt-cache policy linux-firmware` and `sudo apt update`: a broken package mirror, not this card.
:::

## 3. Make sure `zstd` exists

```bash
which zstd
```

If missing:

```bash
sudo apt update
sudo apt install zstd
```

## 4. Decompress the `.zst` firmware to `.bin`

Only for the confirmed compressed-only case. These commands do not force-overwrite; stop and look if a `.bin` already exists. After firmware-package updates, check the hand-extracted copies so stale files don't shadow newer packaged firmware.

```bash
cd /lib/firmware/mediatek

sudo zstd -d WIFI_RAM_CODE_MT7922_1.bin.zst \
    -o WIFI_RAM_CODE_MT7922_1.bin

sudo zstd -d WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst \
    -o WIFI_MT7922_patch_mcu_1_1_hdr.bin
```

Both forms should now sit side by side:

```bash
ls -lh /lib/firmware/mediatek/*MT7922*
```

```
WIFI_RAM_CODE_MT7922_1.bin
WIFI_RAM_CODE_MT7922_1.bin.zst
WIFI_MT7922_patch_mcu_1_1_hdr.bin
WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst
```

::: info Keep the `.zst` files
Don't delete them. This only adds `.bin` copies alongside; the originals stay for package management.
:::

## 5. Reload the driver

Reload from a local console or wired connection only: unloading drops both client and AP on that radio. Don't force it if the module is busy; a reboot may be needed.

```bash
sudo modprobe -r mt7921e
sudo modprobe mt7921e
```

Then:

```bash
sudo dmesg | grep -iE 'mt792|firmware' | tail -50
```

New init messages should appear. Old errors stay in the log; compare timestamps. Success looks like:

```
ASIC revision: 79220010
HW/SW Version: ...
WM Firmware Version: ...
wlP1p1s0: renamed from wlan0
```

## 6. Check NetworkManager

```bash
nmcli device
```

A working radio shows as a WiFi device; `disconnected` is normal until you join a network. Firmware repair alone joins nothing. Check hotspot concurrency separately with full `iw phy <phy> info` output.

The interface name doesn't have to be `wlP1p1s0`; it varies by machine.

## Diagnosis

![Diagnosis](./diagrams/wifi-mt7922-diagnosis.drawio)

## One-shot setup for the next unit

For another machine with the same confirmed compressed-only case and no `.bin` copies yet. Use a local console or wired access, and apply the checks above first; don't run blindly on every MT7922 unit.

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

## Related

- [WiFi Hotspot setup flow](/setup/wifi-hotspot#setup-flow): continue here after this page (provisioning, verification; backup dongle optional).
- [Primary radio vs. backup dongle](/setup/wifi-hotspot#primary-radio-vs-backup-dongle): check whether the driver can run without a dongle.
- [Troubleshooting](/setup/troubleshooting): general diagnostics.
