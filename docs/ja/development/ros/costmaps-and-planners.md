---
outline: deep
search: false
---

# コストマップとモーションプランナー

<RoleBadge role="developer" />

本ドキュメントは、MSD700ナビゲーションスタックに実装されているレイヤー化コストマップアーキテクチャ、グローバル経路計画(`navfn`フォールバック付きの`msd700_lane_planner`)、およびローカル軌道最適化の仕組み(`teb_local_planner`)を詳述する。

## モーションプランニングパイプライン

![モーションプランニングパイプライン](../../../development/ros/diagrams/costmaps-and-planners-motion-planning-pipeline.drawio)

---

## レイヤー化コストマップアーキテクチャ

環境は、各セルが$0$(自由空間)から$254$(致死的な障害物)までのコスト値を保持する2D occupancy gridとして表現される。

### コスト計算と指数関数的インフレーション減衰

障害物セルが位置$\mathbf{p}_{obs}$で検出されると、距離$d = \|\mathbf{p} - \mathbf{p}_{obs}\|$にある近傍セルのコストは、インフレーションレイヤーによって以下のように計算される:

$$\text{Cost}(d) = \begin{cases}
254 & \text{if } d \le r_{\text{inscribed}} \quad (\text{Lethal Obstacle Buffer}) \\
\text{round}\left( 253 \cdot \exp\left(-\alpha \cdot (d - r_{\text{inscribed}})\right) \right) & \text{if } r_{\text{inscribed}} < d \le r_{\text{inflation}} \\
0 & \text{if } d > r_{\text{inflation}} \quad (\text{Free Space})
\end{cases}$$

### 設定されているインフレーションパラメータ:
- **内接半径($r_{\text{inscribed}}$)**: $0.35\text{ m}$(物理フットプリント`0.90 x 0.70 m`の半幅。パディング付き計画エンベロープは`1.20 x 0.85 m`)。
- **インフレーション半径($r_{\text{inflation}}$)**: $0.45\text{ m}$(内接半幅$0.35\text{ m}$を上回らなければ減衰帯が崩壊する)。
- **コストスケーリング係数($\alpha$)**: $10.0$。


```yaml
# config/costmap/costmap_common_params_field.yaml
footprint: [[-0.45, -0.35], [0.45, -0.35], [0.45, 0.35], [-0.45, 0.35]]
# footprint_padding 0.01 はここのコメントにのみ存在する。パディング付き
# 1.20 x 0.85 m エンベロープは文書化されているがパラメータではない。

obstacle_layer:
  enabled: true
  max_obstacle_height: 2.0
  min_obstacle_height: 0.0
  obstacle_range: 3.0
  raytrace_range: 3.0   # ローカル。グローバルは 3.0 / 6.0
  # sensor_frame は意図的に未設定。レイ tracing はスキャン自体のヘッダフレームを使う。
  obstacles: { data_type: LaserScan, topic: scan, marking: true, clearing: true }
  # move_base.launch が obstacle_scan 引数でトピックを上書きする
  # (知覚系は scan_hazard を渡す。それ以外は scan のまま)。

inflation_layer:
  enabled: true
  inflation_radius: 0.45
  cost_scaling_factor: 10.0
```

---

## グローバルプランナー: navfnフォールバック付きレーンプラン {#global-planner-lane-plans-with-a-navfn-fallback}

move_baseは`msd700_lane_planner/LanePlanner`を読み込む(`move_base_params.yaml`)。このプラグインは`navfn/NavfnROS`のインスタンスを1つ保持し、**レーンモード**がオフの間はそのプランをそのまま返す。そのため地点間ナビゲーション、移動区間、リカバリーは従来のnavfnとまったく同じに計画される。同じ`NavfnROS`パラメータを読み、レーンでもnavfnでもすべてのプランを`/move_base/NavfnROS/plan`に配信する。Webリレーと RViz がすでに使っているトピックである。

### カバレッジで必要な理由

スイープはウェイポイントごとに move_base ゴールを1つ送る。間隔はレーンに沿って約1 mで、各ゴールはレーンの向きをyawとして持つ。navfnはゴールの位置しか使わない。プランはコストグリッドに沿うため、レーンから約1セル横を走り、最後に正確なゴールを付け足す。これが各プランの終端の短い斜めの折れ曲がりとして現れる。TEBはビアポイントでその折れ曲がりを追い、約1 m後に次のゴールが来るため、ロボットはまっすぐなレーン上で蛇行する。

### プランの選び方

`path_coverage_node`は走行が`running`を報告した時点で`/move_base/LanePlanner/lane_mode`をtrueにし、`complete`、`aborted`、`coverage_failed`、ノードの終了時と起動時にfalseに戻す。move_baseは5 Hzで再計画し、毎回あらためて判断する:

| 条件 | 返すプラン |
|---|---|
| レーンモードがオフ | navfn |
| ゴールが向きに沿って`min_length`(0.10 m)未満しか先にない(その場ピボットなど) | navfn |
| ロボットがレーンからコリドーより離れている(入る 0.43 x 車体幅、出る 0.65 x 車体幅。フィールドロボットで 0.30 / 0.46 m) | navfn |
| 直線プランのいずれかの点がグローバルコストマップで`blocked_cost`(253、inscribed)以上、または未知 | navfn(回り込む経路を計画する) |
| それ以外 | 直線レーンプラン |

レーンはゴールを通りゴールのyawに沿う直線なので、追加のトピックは不要。直線プランはロボット位置から始まり、smoothstepでその直線に戻り、ゴールの向きのまま正確にゴールで終わる。合流長は`merge_gain` x オフセット(最大傾き 1.5 / 6、約14度)、曲率を`merge_max_curvature`(0.5 1/m)以下に保つ長さ、`merge_min_length`(0.30 m)のうち最大のもので、ゴールまでの残り距離を上限とする。

2つのプランの切り替えはプラグイン内部で行われるため、move_baseが再設定やリセットされることはない。レーン上に現れた障害物はスキャンからグローバルコストマップに入り、次の再計画で直線が遮られていると判定され、0.2秒以内にnavfnの回り込み経路が返される。ロボットがコリドー内に戻り直線が空くと、レーンプランに戻る。

::: info 計測値(シミュレーション、フィールドロボット、6 x 5.4 m エリア、4.8 m レーン)
各レーンの本体部分(レーン開始 1.0 m 後から終了 0.5 m 前まで):

| | navfn | レーンプランナー |
|---|---|---|
| プラン終端とウェイポイントの向きの差(中央値) | 18 度 | 0 度 |
| レーンあたりの向きの振れ幅、ピーク間(中央値) | 12.3 度 | 2.1 度 |
| クロストラック RMS / 最大 | 48.6 / 87.9 mm | 2.5 / 8.1 mm |
| 車体ヨーレート RMS | 0.154 rad/s | 0.024 rad/s |
:::

### パラメータ

`msd700_navigation/config/planner/lane_planner_params.yaml`、名前空間`/move_base/LanePlanner`。すべてプランごとにキャッシュ経由で読まれるため、実行中の`rosparam set`は次の再計画から有効になる。コリドーの値は各走行の開始時に`path_coverage_node`が`boustrophedon_params.yaml` -> `lane_planner`から上書きする。

| パラメータ | 既定値 | 意味 |
|---|---|---|
| `lane_mode` | `false` | 走行中のみ`path_coverage_node`が設定 |
| `corridor_enter` / `corridor_exit` | 0.30 / 0.45 m | レーンプランを使い始める / やめるレーンからの距離(ヒステリシス) |
| `min_length` | 0.10 m | これより短い区間はnavfnのまま |
| `merge_gain`、`merge_min_length`、`merge_max_curvature`、`merge_max_fraction` | 6.0、0.30 m、0.5 1/m、1.0 | レーンへ戻る曲線の形 |
| `blocked_cost` | 253 | 直線を遮るコストマップ値(inscribed: 車体が触れる) |
| `unknown_is_blocked` | `true` | 未知セルは直線を遮る |

::: warning ロボットイメージを一度再ビルドする
`msd700_lane_planner`はC++プラグインである。`run_msd.sh`はワークスペースが一度もビルドされていない場合にしか`catkin build`を実行せず、`devel/`はバインドマウントではなくコンテナ内にある。そのため、プラグイン追加前にビルドされたイメージから起動したユニットにはこのクラスがなく、move_baseは起動時に "Failed to create the msd700_lane_planner/LanePlanner planner" で終了し、何もナビゲーションできない。`docker-manager.sh build`を一度実行すること。`up --build`でも動くが、そのコンテナ限りで、次の`down`と`up`では古いイメージから起動する。
:::

---

## Timed-Elastic-Band (TEB) 軌道最適化

`teb_local_planner`は、ロボット状態のシーケンス$\mathbf{s}_k = [x_k, y_k, \theta_k]^T$と時間差$\Delta T_k$に対する非線形多目的最適化問題として軌道生成を定式化する:

$$\mathcal{B} = \left\{ \mathbf{s}_0, \Delta T_0, \mathbf{s}_1, \Delta T_1, \dots, \mathbf{s}_N \right\}$$

### 目的関数:
プランナーは目的ペナルティ関数の重み付き和を最小化する:

$$V(\mathcal{B}) = \sum_k \left( \gamma_{\text{time}} \cdot \Delta T_k^2 + \gamma_{\text{path}} \cdot \|\mathbf{s}_{k+1} - \mathbf{s}_k\|^2 + \gamma_{\text{obs}} \cdot f_{\text{obs}}(\mathbf{s}_k) + \gamma_{\text{kin}} \cdot f_{\text{kin}}(\mathbf{s}_k, \mathbf{s}_{k+1}) \right)$$

### 主要なペナルティ関数:
1. **時間最適性ペナルティ**:
   $$f_{\text{time}}(\Delta T_k) = \Delta T_k^2$$
   速度制限内($v_{\max} = 0.40\text{ m/s}$、$\omega_{\max} = 1.0\text{ rad/s}$)で最短時間でゴールに到達することを促す。

2. **障害物クリアランスペナルティ**:
   $$f_{\text{obs}}(\mathbf{s}_k) = \begin{cases}
   \left( d_{\min} - \text{dist}(\mathbf{s}_k, \mathcal{O}) \right)^2 & \text{if } \text{dist}(\mathbf{s}_k, \mathcal{O}) < d_{\min} \\
   0 & \text{otherwise}
   \end{cases}$$
   $d_{\min} = 0.05\text{ m}$(`min_obstacle_dist`、ハードフロア)が最小障害物クリアランス距離である。ソフト勾配は `inflation_dist` $0.35\text{ m}$、`weight_inflation` $2.0$ である。どちらも2026-09-17に(0.10 / 0.75から)下げられ、`navfn`が計画できる隙間でTEBが止まらないようにした。これは余裕を増やすだけで、壁をかすめる問題の対策ではない(原因は旋回中のローカルコストマップが`odom`フレームにあること)。

3. **非ホロノミック運動学制約**:
   差動駆動のキネマティクスを満たすため、横滑り速度にペナルティを課す:
   $$\dot{y}_k \cdot \cos(\theta_k) - \dot{x}_k \cdot \sin(\theta_k) = 0$$

---

## 進入禁止ゾーンとDynamic Reconfigure

1. **進入禁止グリッドレイヤー(`keepout_layer`)**: `/msd700/keepout_grid`をサブスクライブし、オペレーターが指定したカスタムポリゴンをコスト$254$のセルにラスタライズすることで、グローバル/ローカルプランナーが除外ゾーンを横断する軌道を生成しないようにする。
2. **網羅走行モードへの適応**: ブストロフェドン走行のパスの間、`path_coverage_node`は`dynamic_reconfigure`経由で前進駆動の重み(`weight_kinematics_forward_drive`)を`500.0`に設定する(ベース値も`500`。走行時はさらに `yaw_goal_tolerance` を `0.10` に締める)。これにより失速することなく滑らかな90度のコム状ピボットターンが可能になる。また、走行中はグローバルプランナーのレーンモードをオンにする([上記](#global-planner-lane-plans-with-a-navfn-fallback))。

## 関連ドキュメント

- [ブストロフェドン網羅走行](/ja/development/ros/boustrophedon-and-alignment): 網羅走行のジオメトリとセル分解。
- [センサーフュージョン & 制御](/ja/development/ros/sensor-fusion-and-control): 運動状態推定とEKF。
- [シミュレーション (Gazebo)](/ja/development/ros/simulation): 倉庫テスト環境。
