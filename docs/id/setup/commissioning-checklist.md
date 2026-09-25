---
outline: deep
search: false
---

# Checklist Commissioning (Unit Baru)

<RoleBadge role="technician" />

Acceptance end-to-end untuk satu robot baru, dari unboxing hingga sign-off. Ikuti halaman tertaut untuk caranya; centang tiap kotak hanya bila kriteria lolosnya terpenuhi. Sebuah unit **belum** ter-commissioning sampai semua kotak lolos.

## 1. Persiapan host

- [ ] `setup.sh` dijalankan (Docker, grup, xhost). Lolos: `--check` bersih.
- [ ] Tautan Velodyne (`--configure-lidar`, `192.168.103.231` terjangkau). Lolos: ping menjawab.
- [ ] `setup.sh --provision-network` dari konsol kabel, hotspot + client tersimpan ke `/etc/hostapd/*.conf` (0600), password tersembunyi diketik dua kali. Lolos: SSID mengudara.

Lihat [Unit Setup](/id/setup/unit-setup).

## 2. Build dan start

- [ ] `docker/.env` direview (IP Velodyne cocok dengan launch file, `AP_SSID`, `AP_PASSWORD` 8+ karakter). Lolos: tidak ada `change_me` tersisa di tempat yang penting.
- [ ] `docker-manager.sh build` lalu `up`. Lolos: `status` menunjukkan container up; tidak ada error build.
- [ ] Boot pertama mencetak CLAIM CODE; adopsi/daftarkan di Pending. Lolos: unit muncul di bawah ULID-nya, tanpa baris pending kedua.

Lihat [Unit Setup](/id/setup/unit-setup), [Docker Reference § Unit `docker-manager.sh`](/id/setup/docker-reference#unit-docker-manager-sh).

## 3. Identitas dan jaringan

- [ ] `Certificates/robot/device.json` + `token.cred` ada, mode 0600. Lolos: log `token_refresh` menunjukkan renewal 6-jam, tanpa loop re-enrol.
- [ ] Hotspot melayani operator; uplink client tersambung. Lolos: laptop operator melihat SSID dan mencapai dashboard unit; unit mencapai backend cloud.
- [ ] `msd700.service` terpasang dengan flag yang benar (`--dev`/`--simulator` lestari). Lolos: `print-autostart-unit` menunjukkan `ExecStart` yang diharapkan.

Lihat [WiFi Hotspot](/id/setup/wifi-hotspot), [Hardware Enrolment](/id/development/webui/accounts/enrolment).

## 4. Stack robot

- [ ] `tmux attach -t robot_services`: `roscore`, `ros_webui`, `camera_client`, `switch_mode`, `log_janitor`, `token_refresh` semuanya hidup. Lolos: tidak ada window mati pada menit ke-5.
- [ ] `ros_doctor.sh` bersih. Lolos: `OK master answers`, stempel stack ada, rosbridge listening, tanpa node asing.
- [ ] `curl http://localhost:5002/local/status` menjawab. Lolos: HTTP 200 berisi status unit.

Lihat [Docker Reference § Unit `run_msd.sh`](/id/setup/docker-reference#unit-run-msd-sh).

## 5. Kemampuan

- [ ] Kemudikan manual (teleop) 5 m pergi-pulang. Lolos: kembali, tanpa jeda watchdog saat link hidup.
- [ ] Petakan sebuah ruangan, berhenti, simpan. Lolos: peta muncul di Database cloud di bawah ULID unit ini.
- [ ] Navigasi ke pin di peta itu. Lolos: goal diterima dan tercapai.
- [ ] Kamera live di dashboard cloud dan di dashboard lokal-unit. Lolos: video di keduanya, tanpa loop stall 15 dtk.
- [ ] Autopilot coverage satu poligon. Lolos: sweep selesai, snapshot bertahan setelah tab dibuka ulang.

Lihat [User Guide](/id/user-guide/) untuk alur operator.

## 6. Sign-off

- [ ] `docker/.env` di-backup keluar unit (ia per-host dan ter-track di git hanya sebagai `.env.example`).
- [ ] Baris unit, nama, dan assignment rental terverifikasi di admin console.
- [ ] Tanggal, teknisi, ULID unit, dan versi software tercatat.

Kegagalan masuk ke [Setup Troubleshooting](/id/setup/troubleshooting) dengan window tmux dan file log dilampirkan.
