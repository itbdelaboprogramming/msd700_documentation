---
outline: deep
search: false
---

# 知覚とハザードスキャン

<RoleBadge role="developer" />

Velodyneのクラウドが、スタックの残りが消費する2つの2Dスキャン(`/scan` はSLAMとローカライゼーション用、`/scan_hazard` はコストマップ用)にどうなるか。入力は1つの3Dクラウド、出力は2つの2Dスキャン、シミュレーションと実機はパイプラインを完全に共有する。

## 2つのスキャン

| トピック | 内容 | 消費先 |
| --- | --- | --- |
| `/scan` | 正の障害物のみ。穴マークは決して届けてはならない | `slam_gmapping`、AMCL |
| `/scan_hazard` | 同じクラウドに**穴を追加**(近傍リップに壁として注入) | `move_base` コストマップ |
| `/scan_holes` | 穴のみ | ダッシュボードオーバーレイ |
| `/msd700/hazard_cells` | ハザードセルの累積軌跡(`nav_msgs/Path`) | ダッシュボードの穴の軌跡。`<root>/server/hazard_cells` としてリレーされる |

穴縁を静的マップに焼き込むとローカライゼーションに永遠に祟るため、分離は構造的である:SLAMにはクリーンスキャン、コストマップには危険な方。高さゲーティングはコストマップ側では無効(`min/max_obstacle_height ∓100.0`)であり、ここ上流で既に済ませているからである。

## パイプライン(`msd700_perception/launch/cloud_hazard.launch`)

![パイプライン(msd700perception/launch/cloudhazard.launch)](../../../development/ros/diagrams/perception-and-hazard-scan-pipeline-msd700perception-launch-cloudha.drawio)

帯域はセンサーからでなく**適合地表面からの**メートルである:`ground_tolerance 0.06`、`min_obstacle_height 0.08`(フロア帯より上は真の障害物)、`max_obstacle_height 0.65`(これより上はロボットが下を潜る)、`hole_depth_threshold 0.12`(`config/hazard_scan.yaml`)。適合は2次(次数2、うねる地面を跨ぐために必要)で、3.0 m以内の床リターンを3回再重み付けし、床壁判別器(`steepest_ring_deg 15.0`)で壁が地面を傾けないようにする。

`hazard_scan.launch` はノードを包む(`hazard_scan_node.py`、respawnあり):`scan_topic /scan_hazard`、`obstacles_topic /scan_obstacles`、`holes_topic /scan_holes`、`cells_topic /msd700/hazard_cells`、ベースフレーム `base_footprint`。LiDAR取付高さはこの設定でなくTF由来である。

### Cの高速パス(`fastops`)

パイプライン内のグループ単位のmin/max集約(垂直性、傾斜・下り区間、ビンごとの距離、穴のマーク)は、小さなCライブラリ`src_cpp/fastops.cpp`で実行される。catkinが`libmsd700_perception_fastops.so`としてビルドし、`src/msd700_perception/fastops.py`から`ctypes`経由で呼び出す。29k点のフレームでは、パイプライン時間が約52-63 msから36-39 msに短縮され、出力はビット単位で一致する。

すべてのエントリポイントにnumpy実装が残っている。Cターゲットなしでビルドされたワークスペースやライブラリの読み込み失敗時は、危険検知を失うのではなく従来速度のnumpyにフォールバックする。再ビルドせずにnumpyパスを強制するには`MSD700_FASTOPS_DISABLE=1`を設定する(実機で疑わしい差異をA/B比較する場合など)。`test/hazard_harness.py --selftest`は両方のパスを実行する。

## クレストゲート:登り坂の頂上

坂の上では `base_footprint` が車体とともに傾く。そのため坂は平らに見え、頂上の先の水平な地面は坂自身の勾配ぶん下っているように見える。地面フィットは坂しか見ていない。頂上はカーブではなく角であり、上の水平面は1 m以内でフィット帯域から外れる。頂上越しに向けたすべての光線は、延長した坂の平面が予測する着地点を越えて飛び、頂上手前の坂は穴の手前の縁とまったく同じに見え、穴検出器は丘の頂上をドロップオフとしてマークする。ロボットはすべての頂上の手前で止まってしまう。

![登り坂の頂上が穴に見える理由](../../../development/ros/diagrams/perception-and-hazard-scan-crest-side-view.drawio)

ロボット自身のフレームでは、これは水平なロボットの前にある本物の下り坂とまったく同じ計測になる。そのため、このフレームで動くゲートでは両者を区別できない。`descent_run` も役に立たない。約8度を超えると手を引くが、頂上は構造上それを超えている。重力の向きを知っているセンサーはIMUだけである。重力フレームに回すと、頂上の向こう側は水平に見える。

クレストゲート(`src/msd700_perception/crest.py`)は `negative.detect` の中で、continuity gate と `descent_run` の後、膨張処理の前に動き、マークを消すことしかしない。

![各ゲートを通る穴マーク](../../../development/ros/diagrams/perception-and-hazard-scan-crest-gate.drawio)

マークを含む2度のセクタごとに、次の6つのチェックをすべて通過したときだけ、そのセクタのマークを消す。

| # | チェック | 除外するもの |
| --- | --- | --- |
| 1 | 最初のマークから `lip_window` 以内で、フィットした地面が予測した位置に光線が**着地**している | 手前に確認済みの地面がないマーク |
| 2 | 最初のオーバーシュートより**先**で、フィットした地面に再び着地する光線がない | 続いていく坂に掘られた穴。その向こう側の縁は着地する |
| 3 | `far_half_width` 以内のオーバーシュート光線に1枚の平面が合い、`max_residual` を超えてその下にあるセルがない | 遠い側にある溝の壁や穴の底 |
| 4 | その平面を縁まで戻すと、そこでフィットした地面と一致する:`step_tolerance` を超える段差がない | 頂上の先のドロップオフ。下の地面がどれだけ水平でも同じ。IMUは不要 |
| 5 | **重力フレーム**での平面の最大勾配が `max_world_grade` 以下 | 走行するには急すぎる遠い側 |
| 6 | 方位方向の相対的な下りから世界での下りを引いた値が `min_bend_explained` 以上 | 本物の下り坂に向かう水平なロボット。その下りは車体の傾きによるものではない |

遠い側は、1つの方位に沿った線ではなく、**方位の窓にわたる平面**として扱う。中程度の坂からは1本のリングしか頂上に届かないことが多く、1本のリングを通る線はそのリング自身の光線である。その線はセンサーまで戻り、どんな段差があっても「縁で地面と一致」してしまう。複数の方位にわたって掃引された1本のリングは曲がった弧になり、その弧の形が遠い面の傾きを決める。

### IMUの姿勢

ノードは `/imu/data` のサンプルを短いバッファに保持し、各クラウドを最後に届いたサンプルではなく、**自身のスタンプに最も近いサンプル**で判定する。サンプルはTFの `base_footprint` からIMUへの取付変換を通して回されるため、車体に対してまっすぐでないIMUも扱える。次の場合、このゲートと30度の勾配ガードはどちらも手を引き、すべてのマークを残す。

- IMUが姿勢を持たない(`orientation_covariance[0] = -1`、またはクォータニオンがすべてゼロ)。ノードは一度だけ警告する。
- クラウドのスタンプから `imu.stale_after`(0.5 s)以内にサンプルがない。
- TFに `base_footprint` からIMUのフレームへの変換がない。

### 設定(`config/hazard_scan.yaml`、`crest` ブロック)

| キー | 既定値 | 意味 |
| --- | --- | --- |
| `enabled` | `true` | 再ビルドなしでゲートを無効化する(`~reload_params`) |
| `sector` | `2.0` deg | まとめて判定する方位 |
| `lip_window` | `1.2` m | 最後に着地した光線が最初のマークの内側にどれだけ近くなければならないか |
| `far_window` | `16.0` m | マークの先、どこまで遠いリターンを集めるか。10度の坂からは最初のリングが約8 m先で頂上に届く |
| `far_half_width` | `15.0` deg | 遠い平面に使う左右の方位 |
| `radial_cell` | `0.15` m | フィット前に遠いリターンをビンと半径セルごとに平均する |
| `min_cells`、`min_spread` | `8`、`0.10` m | これを下回ると方位方向に平面が定まらず、マークは残る |
| `max_residual` | `0.08` m | 平面よりこれだけ下にあるセルはセクタを拒否する |
| `step_tolerance` | `0.10` m | 縁で許容する最大の段差。`hole_depth_threshold`(0.12 m)より小さい |
| `max_world_grade` | `8.0` deg | ゲートが消す、重力フレームでの遠い側の最大勾配 |
| `min_bend_explained` | `3.0` deg | 下りのうち、車体の傾きで説明されなければならない量 |

### 計測結果(`test/hazard_harness.py --selftest`)

| ケース | 前 | 後 |
| --- | --- | --- |
| 6〜14度の坂の頂上、1.5〜3.0 m先(10ケース) | 穴ビン38〜142 | すべて **0** |
| 同じ10ケース、レンジノイズ0.03 m(実際のVLP-16) | 35〜142 | **0** |
| 同じ、IMUがどちらかに3度ずれる | 83 | **0** |
| 頂上に20〜35度斜めから接近(ピッチとロールが同時) | 20〜167 | **0** |
| 丘:10度上り、向こう側を5度下り | 81 | **0** |
| 丘:4度上り、10度下り(`max_world_grade` 超) | 102 | 102、変化なし |
| 頂上のすぐ先に0.3、0.5、1.0 mのドロップオフ(12ケース。ノイズ0.03 m、IMUの2〜4度のずれでも同じ) | すべて | **すべて変化なし** |
| 続いていく坂に掘られた溝、側溝、3 mの谷 | 各245 | **245、変化なし** |
| 本物の10度または14度の下りに向かう水平なロボット | 83、102 | 変化なし |

ゲートのコストは最悪の合成フレームで約11 msで、100 msのスキャン周期に収まる。

::: warning 頂上の影
坂の上からは、頂上の先の最初の数メートルが見えない。光線は1〜5度でその上を通過し、数メートル先に着地する。その帯にある穴は遠い平面より下にリターンを残さず、再び着地する地面もないため、頂上と一緒に消される(ハーネスはこれをテスト `test_what_the_crest_gate_cannot_see` として残している)。車体が頂上で水平に戻ると、その数メートルは1.87 mの死角の中に入るため、このパッケージのどの部分もどちら側からも見ることができない。これはチューニングではなくセンサーの幾何学的な限界である。頂上はゆっくり越えること。
:::

## `MSD700_HAZARD_SCAN` スイッチ

1つの環境変数であり、合意すべき2つの半分がある:

- **LiDAR半分**(`lidar_scanner.launch`):`true` で素の `pointcloud_to_laserscan` 平坦化を `velodyne_hazard.launch` に切替え(ドライバーとSLAM/AMCL用 `/scan` は同じ、`/scan_hazard` が追加)。前提: `192.168.103.231` にVelodyne装着、`ros-noetic-velodyne` + `ros-noetic-pointcloud-to-laserscan` パッケージ(イメージに組込済み)。
- **コストマップ半分**(`navigation_core.launch`、`msd700_navigation.launch`):4つのコストマップ観測トピック全てが1つの `obstacle_scan` 引数に従う。既定は `scan`、知覚稼働時は `scan_hazard`。意図的にユニット全体でありモード別にしない(`switch_mode.yaml` に記載):モード別上書きは、誰も配信しないトピックをコストマップに要求させてしまう。

::: warning `scan_hazard` を第二ソースとして追加しないこと
`obstacle_scan` はどちらか一方のスキャンを指し、両方ではない。素スキャンのraytraceが `scan_hazard` が描いたばかりの穴マークを消してしまう(`move_base.launch` に同警告あり)。環境変数なしの手動上書き:ナビゲーションlaunchに `obstacle_scan:=scan_hazard`。
:::

ライブ既定はユニットの `docker/.env` で `MSD700_HAZARD_SCAN=true`(テンプレートは `false`)。`.env` は `velodyne_scanner.launch device_ip` と同期を保つこと。

## テスト方法

`msd700_hazard_test.launch`:実VLP-16付き実機で穴ありワールド、トレンチ、0.15 m縁石、潜りベンチ、必遮ビーム。`msd700_mine.launch`:3.0 m割れ目付き44 m露天/坑内リグ。`msd700_world.launch` は `MSD700_SIM_WORLD` で振分け:`warehouse`(平坦AWS、`/scan_hazard` = `/scan`)、`hazard`、`mine`。

ランチャーヘッダー由来のラッチテスト規則:穴の**1.87 m以内**に入って運転すること。3 mでの停止デモは何も証明しない。

## 関連ドキュメント

- [コストマップとプランナー](/ja/development/ros/costmaps-and-planners):各コストマップ層がどちらのスキャンを消費するか。
- [センサーフュージョンと制御](/ja/development/ros/sensor-fusion-and-control):素の `/scan` パイプライン。
- [シミュレーション](/ja/development/ros/simulation):Warehouseとハザードテストワールド。
- [ROSパッケージレジストリ](/ja/development/ros/ros-packages):パッケージとlaunchファイルの対応表。
