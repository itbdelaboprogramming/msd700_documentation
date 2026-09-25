---
search: false
---

# Panduan Setup dan Deployment

<RoleBadge role="technician" />

Cara menginstal dan mengonfigurasi hardware dan software MSD700. Untuk teknisi, system engineer, dan installer lapangan.

Setiap halaman berisi perintah shell, contoh output, dan template konfigurasi yang dibutuhkan.

<LinkCards>
  <LinkCard icon="✅" title="Prasyarat" details="Hardware, versi OS, dan port firewall yang harus disiapkan dulu." link="/id/setup/prerequisites" />
  <LinkCard icon="🖥️" title="Setup Server" details="Deploy cloud produksi: Docker Compose, Apache reverse proxy, dan SSL." link="/id/setup/server-setup" />
  <LinkCard icon="📡" title="Setup Unit" details="Instal robot fisik di NVIDIA Jetson, build, dan daftarkan (enrol)." link="/id/setup/unit-setup" />
  <LinkCard icon="🔗" title="Setup Sistem" details="Pastikan server dan unit bekerja sama, lalu serahkan ke operator." link="/id/setup/system-setup" />
  <LinkCard icon="📋" title="Checklist Commissioning" details="Lembar penerimaan satu unit baru: dari unboxing hingga sign-off." link="/id/setup/commissioning-checklist" />
  <LinkCard icon="🐳" title="Referensi Docker" details="Semua profile Docker Compose, perintah, environment variable, dan volume." link="/id/setup/docker-reference" />
  <LinkCard icon="📶" title="WiFi Hotspot + Client" details="Jalankan hotspot Wi-Fi milik unit plus koneksi client untuk internet." link="/id/setup/wifi-hotspot" />
  <LinkCard icon="📡" title="Setup Wi-Fi MT7922" details="Perbaiki firmware MediaTek MT7922 onboard di kernel Tegra." link="/id/setup/wifi-mt7922" />
  <LinkCard icon="🧰" title="Maintenance" details="Rotasi log, rotasi key, perpanjangan sertifikat, dan backup." link="/id/setup/maintenance" />
  <LinkCard icon="🛠️" title="Troubleshooting Teknisi" details="Perbaiki masalah hardware, container, MQTT broker, dan sensor." link="/id/setup/troubleshooting" />
</LinkCards>

## Urutan instalasi

MSD700 selalu terdiri dari dua mesin: satu Server plus satu atau lebih Unit. Instal dengan urutan ini:

![Urutan instalasi](./diagrams/setup-install-order.drawio)

1. [Prasyarat](/id/setup/prerequisites): cek hardware dan buka port firewall.
2. [Setup Server](/id/setup/server-setup): jalankan cloud server lebih dulu, agar unit punya tempat untuk enrol.
3. [Setup Unit](/id/setup/unit-setup): build container robot di Jetson dan enrol ke server.
4. [Setup Sistem](/id/setup/system-setup): jalankan checklist end-to-end (10 item).
5. [Checklist Commissioning](/id/setup/commissioning-checklist): terima satu unit baru, box per box.

Setelah itu, lihat [Maintenance](/id/setup/maintenance) dan [Troubleshooting](/id/setup/troubleshooting) untuk perawatan armada.
