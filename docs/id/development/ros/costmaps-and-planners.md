---
outline: deep
search: false
---

# Costmap dan Motion Planner

<RoleBadge role="developer" />

Dokumen ini merinci arsitektur costmap berlapis, algoritma perencanaan jalur global (`navfn`), dan mekanika optimisasi trajektori lokal (`teb_local_planner`) yang diimplementasikan dalam stack navigasi MSD700.

## Pipeline Perencanaan Gerak

![Pipeline Perencanaan Gerak](../../../development/ros/diagrams/costmaps-and-planners-motion-planning-pipeline.drawio)

---

## Arsitektur Costmap Berlapis

Lingkungan direpresentasikan sebagai occupancy grid 2D dimana setiap sel menyimpan nilai cost antara $0$ (ruang bebas) dan $254$ (obstacle mematikan).

### Perhitungan Cost dan Peluruhan Inflasi Eksponensial

Ketika sel obstacle teridentifikasi pada posisi $\mathbf{p}_{obs}$, cost dari sel tetangga mana pun pada jarak $d = \|\mathbf{p} - \mathbf{p}_{obs}\|$ dihitung oleh layer inflasi:

$$\text{Cost}(d) = \begin{cases}
254 & \text{if } d \le r_{\text{inscribed}} \quad (\text{Lethal Obstacle Buffer}) \\
\text{round}\left( 253 \cdot \exp\left(-\alpha \cdot (d - r_{\text{inscribed}})\right) \right) & \text{if } r_{\text{inscribed}} < d \le r_{\text{inflation}} \\
0 & \text{if } d > r_{\text{inflation}} \quad (\text{Free Space})
\end{cases}$$

### Parameter Inflasi yang Dikonfigurasi:
- **Radius Inscribed ($r_{\text{inscribed}}$)**: $0.35\text{ m}$ (setengah lebar footprint fisik `0.90 x 0.70 m`; envelope perencanaan yang ber-padding adalah `1.20 x 0.85 m`).
- **Radius Inflasi ($r_{\text{inflation}}$)**: $0.45\text{ m}$ (harus tetap di atas setengah lebar inscribed $0.35\text{ m}$, atau pita peluruhan runtuh).
- **Faktor Skala Cost ($\alpha$)**: $10.0$.


```yaml
# config/costmap/costmap_common_params_field.yaml
footprint: [[-0.45, -0.35], [0.45, -0.35], [0.45, 0.35], [-0.45, 0.35]]
# footprint_padding 0.01 hanya ada di komentar di sini; envelope
# 1.20 x 0.85 m yang ber-padding terdokumentasi, bukan parameter.

obstacle_layer:
  enabled: true
  max_obstacle_height: 2.0
  min_obstacle_height: 0.0
  obstacle_range: 3.0
  raytrace_range: 3.0   # lokal; global memakai 3.0 / 6.0
  # Tanpa sensor_frame dengan sengaja: raytrace memakai frame header scan itu sendiri.
  obstacles: { data_type: LaserScan, topic: scan, marking: true, clearing: true }
  # move_base.launch meng-override topik via arg obstacle_scan
  # (persepsi meneruskan scan_hazard; sisanya tetap scan).

inflation_layer:
  enabled: true
  inflation_radius: 0.45
  cost_scaling_factor: 10.0
```

---

## Optimisasi Trajektori Timed-Elastic-Band (TEB)

`teb_local_planner` merumuskan pembentukan trajektori sebagai masalah optimisasi non-linear multi-objektif atas sekuens state robot $\mathbf{s}_k = [x_k, y_k, \theta_k]^T$ dan selisih waktu $\Delta T_k$:

$$\mathcal{B} = \left\{ \mathbf{s}_0, \Delta T_0, \mathbf{s}_1, \Delta T_1, \dots, \mathbf{s}_N \right\}$$

### Fungsi Objektif:
Planner meminimalkan jumlah tertimbang dari fungsi penalti objektif:

$$V(\mathcal{B}) = \sum_k \left( \gamma_{\text{time}} \cdot \Delta T_k^2 + \gamma_{\text{path}} \cdot \|\mathbf{s}_{k+1} - \mathbf{s}_k\|^2 + \gamma_{\text{obs}} \cdot f_{\text{obs}}(\mathbf{s}_k) + \gamma_{\text{kin}} \cdot f_{\text{kin}}(\mathbf{s}_k, \mathbf{s}_{k+1}) \right)$$

### Fungsi Penalti Kunci:
1. **Penalti Time-Optimality**:
   $$f_{\text{time}}(\Delta T_k) = \Delta T_k^2$$
   Mendorong robot mencapai goal dalam waktu minimal dalam batas kecepatan ($v_{\max} = 0.40\text{ m/s}$, $\omega_{\max} = 1.0\text{ rad/s}$).

2. **Penalti Clearance Obstacle**:
   $$f_{\text{obs}}(\mathbf{s}_k) = \begin{cases}
   \left( d_{\min} - \text{dist}(\mathbf{s}_k, \mathcal{O}) \right)^2 & \text{if } \text{dist}(\mathbf{s}_k, \mathcal{O}) < d_{\min} \\
   0 & \text{otherwise}
   \end{cases}$$
   Dengan $d_{\min} = 0.05\text{ m}$ (`min_obstacle_dist`, batas keras) sebagai jarak clearance obstacle minimum. Gradien lunaknya adalah `inflation_dist` $0.35\text{ m}$ pada `weight_inflation` $2.0$. Keduanya diturunkan pada 2026-09-17 (dari 0.10 / 0.75) agar TEB tidak macet di celah yang sudah bisa direncanakan `navfn`; nilai ini hanya menambah margin, bukan memperbaiki robot yang menyerempet dinding, yang penyebabnya local costmap berada di frame `odom` saat pivot.

3. **Constraint Kinematik Non-Holonomic**:
   Memberi penalti pada kecepatan pergeseran lateral untuk menegakkan kinematika differential drive:
   $$\dot{y}_k \cdot \cos(\theta_k) - \dot{x}_k \cdot \sin(\theta_k) = 0$$

---

## Zona Keep-Out dan Dynamic Reconfigure

1. **Layer Grid Keep-Out (`keepout_layer`)**: Subscribe ke `/msd700/keepout_grid` dimana poligon kustom operator dirasterisasi menjadi sel cost $254$, mencegah planner global dan lokal menghasilkan trajektori yang melintasi zona terlarang.
2. **Adaptasi Mode Coverage**: Selama sapuan boustrophedon, `path_coverage_node` menyetel `weight_kinematics_forward_drive` ke `500.0` via `dynamic_reconfigure` (nilai dasar juga `500`; sweep juga mengencangkan `yaw_goal_tolerance` ke `0.10`), memungkinkan belokan pivot comb 90 derajat yang mulus tanpa stall.

## Dokumentasi Terkait

- [Cakupan Boustrophedon](/id/development/ros/boustrophedon-and-alignment): Geometri cakupan dan dekomposisi sel.
- [Sensor Fusion & Kontrol](/id/development/ros/sensor-fusion-and-control): Estimasi state kinematik dan EKF.
- [Simulasi](/id/development/ros/simulation): Lingkungan pengujian warehouse.
