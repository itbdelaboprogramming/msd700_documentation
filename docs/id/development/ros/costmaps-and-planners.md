---
outline: deep
search: false
---

# Costmap dan Motion Planner

<RoleBadge role="developer" />

Dokumen ini merinci arsitektur costmap berlapis, perencanaan jalur global (`msd700_lane_planner` dengan fallback `navfn`), dan mekanika optimisasi trajektori lokal (`teb_local_planner`) yang diimplementasikan dalam stack navigasi MSD700.

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

## Global Planner: Plan Lane dengan Fallback navfn {#global-planner-lane-plans-with-a-navfn-fallback}

move_base memuat `msd700_lane_planner/LanePlanner` (`move_base_params.yaml`). Plugin ini memegang satu instance `navfn/NavfnROS` dan mengembalikan plan instance itu apa adanya selama **lane mode** mati, sehingga navigasi titik ke titik, transit, dan recovery direncanakan persis seperti dengan navfn biasa. Ia membaca parameter `NavfnROS` yang sama dan mem-publish setiap plan, baik lane maupun navfn, ke `/move_base/NavfnROS/plan`, topic yang sudah dipakai relay web dan RViz.

### Kenapa coverage membutuhkannya

Sweep mengirim satu goal move_base per waypoint, berjarak sekitar 1 m sepanjang lane, dan setiap goal membawa arah lane sebagai yaw-nya. navfn hanya memakai posisi goal. Plannya mengikuti grid cost, jadi berjalan sekitar satu cell di samping lane lalu menempelkan goal yang persis di ujungnya, yang tampak sebagai belokan diagonal pendek di akhir setiap plan. TEB mengikuti belokan itu lewat via-point-nya, goal berikutnya datang sekitar 1 m kemudian, dan robot bergoyang di lane yang lurus.

### Cara plan dipilih

`path_coverage_node` menyetel `/move_base/LanePlanner/lane_mode` ke true saat run melaporkan `running`, dan kembali ke false saat `complete`, `aborted`, `coverage_failed`, node shutdown, dan node start. move_base replan 5 kali per detik, dan setiap panggilan diputuskan ulang:

| Kondisi | Plan yang dikembalikan |
|---|---|
| Lane mode mati | navfn |
| Goal kurang dari `min_length` (0.10 m) di depan menurut heading-nya, misalnya pivot di tempat | navfn |
| Robot lebih jauh dari lane daripada koridor (masuk 0.43 x lebar badan, keluar 0.65 x lebar badan: 0.30 / 0.46 m pada robot field) | navfn |
| Ada titik plan lurus yang bernilai `blocked_cost` (253, inscribed) atau lebih, atau unknown, di global costmap | navfn, yang merencanakan jalan memutar |
| Selain itu | plan lane lurus |

Lane adalah garis yang melewati goal searah yaw goal, jadi tidak perlu topic tambahan. Plan lurus dimulai dari robot, kembali ke garis itu lewat kurva smoothstep, dan berakhir tepat di goal dengan heading goal. Panjang penyatuan adalah yang terbesar dari `merge_gain` x offset (kemiringan puncak 1.5 / 6, sekitar 14 derajat), panjang yang menjaga kelengkungan di bawah `merge_max_curvature` (0.5 1/m), dan `merge_min_length` (0.30 m), dibatasi sisa jarak ke goal.

Pergantian antara kedua plan terjadi di dalam plugin, sehingga move_base tidak pernah di-reconfigure atau di-reset karenanya. Obstacle yang muncul di lane masuk ke global costmap dari scan, replan berikutnya mendapati garisnya terhalang, dan jalan memutar dari navfn dikembalikan dalam 0.2 detik. Setelah robot kembali di dalam koridor dan garisnya bebas, plan lane dipakai lagi.

::: info Hasil ukur (simulasi, robot field, area 6 x 5.4 m, lane 4.8 m)
Di badan setiap lane (1.0 m setelah lane mulai sampai 0.5 m sebelum berakhir):

| | navfn | lane planner |
|---|---|---|
| Ujung plan dibanding heading waypoint (median) | 18 derajat | 0 derajat |
| Ayunan heading per lane, puncak ke puncak (median) | 12.3 derajat | 2.1 derajat |
| Cross-track RMS / maks | 48.6 / 87.9 mm | 2.5 / 8.1 mm |
| Yaw rate badan RMS | 0.154 rad/s | 0.024 rad/s |
:::

### Parameter

`msd700_navigation/config/planner/lane_planner_params.yaml`, namespace `/move_base/LanePlanner`. Semuanya dibaca (cached) di setiap plan, jadi `rosparam set` live berlaku di replan berikutnya. Nilai koridor ditimpa oleh `path_coverage_node` dari `boustrophedon_params.yaml` -> `lane_planner` di awal setiap run.

| Parameter | Default | Arti |
|---|---|---|
| `lane_mode` | `false` | Disetel oleh `path_coverage_node` selama run |
| `corridor_enter` / `corridor_exit` | 0.30 / 0.45 m | Jarak dari lane untuk mulai / berhenti memakai plan lane (histeresis) |
| `min_length` | 0.10 m | Leg yang lebih pendek tetap memakai navfn |
| `merge_gain`, `merge_min_length`, `merge_max_curvature`, `merge_max_fraction` | 6.0, 0.30 m, 0.5 1/m, 1.0 | Bentuk penyatuan kembali ke lane |
| `blocked_cost` | 253 | Nilai costmap yang menghalangi garis (inscribed: badan akan menyentuh) |
| `unknown_is_blocked` | `true` | Cell unknown menghalangi garis |

::: warning Rebuild image robot sekali
`msd700_lane_planner` adalah plugin C++. `run_msd.sh` hanya menjalankan `catkin build` kalau workspace belum pernah di-build, dan `devel/` ada di dalam container, bukan di bind mount, sehingga unit yang start dari image yang di-build sebelum plugin ini tidak punya class-nya: move_base keluar saat start dengan "Failed to create the msd700_lane_planner/LanePlanner planner" dan tidak ada yang bisa bernavigasi. Jalankan `docker-manager.sh build` sekali. `up --build` juga bisa, tetapi hanya untuk container itu; `down` lalu `up` berikutnya start lagi dari image lama.
:::

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
2. **Adaptasi Mode Coverage**: Selama sapuan boustrophedon, `path_coverage_node` menyetel `weight_kinematics_forward_drive` ke `500.0` via `dynamic_reconfigure` (nilai dasar juga `500`; sweep juga mengencangkan `yaw_goal_tolerance` ke `0.10`), memungkinkan belokan pivot comb 90 derajat yang mulus tanpa stall. Node ini juga menyalakan lane mode global planner selama run ([di atas](#global-planner-lane-plans-with-a-navfn-fallback)).

## Dokumentasi Terkait

- [Cakupan Boustrophedon](/id/development/ros/boustrophedon-and-alignment): Geometri cakupan dan dekomposisi sel.
- [Sensor Fusion & Kontrol](/id/development/ros/sensor-fusion-and-control): Estimasi state kinematik dan EKF.
- [Simulasi](/id/development/ros/simulation): Lingkungan pengujian warehouse.
