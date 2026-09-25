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
| `/msd700/hazard_cells` | ハザードセルの累積軌跡(`nav_msgs/Path`) | デバッグ |

穴縁を静的マップに焼き込むとローカライゼーションに永遠に祟るため、分離は構造的である:SLAMにはクリーンスキャン、コストマップには危険な方。高さゲーティングはコストマップ側では無効(`min/max_obstacle_height ∓100.0`)であり、ここ上流で既に済ませているからである。

## パイプライン(`msd700_perception/launch/cloud_hazard.launch`)

![パイプライン(msd700perception/launch/cloudhazard.launch)](../../../development/ros/diagrams/perception-and-hazard-scan-pipeline-msd700perception-launch-cloudha.drawio)

帯域はセンサーからでなく**適合地表面からの**メートルである:`ground_tolerance 0.06`、`min_obstacle_height 0.08`(フロア帯より上は真の障害物)、`max_obstacle_height 0.65`(これより上はロボットが下を潜る)、`hole_depth_threshold 0.12`(`config/hazard_scan.yaml`)。適合は2次(次数2、うねる地面を跨ぐために必要)で、3.0 m以内の床リターンを3回再重み付けし、床壁判別器(`steepest_ring_deg 15.0`)で壁が地面を傾けないようにする。

`hazard_scan.launch` はノードを包む(`hazard_scan_node.py`、respawnあり):`scan_topic /scan_hazard`、`obstacles_topic /scan_obstacles`、`holes_topic /scan_holes`、`cells_topic /msd700/hazard_cells`、ベースフレーム `base_footprint`。LiDAR取付高さはこの設定でなくTF由来である。

### Cの高速パス(`fastops`)

パイプライン内のグループ単位のmin/max集約(垂直性、傾斜・下り区間、ビンごとの距離、穴のマーク)は、小さなCライブラリ`src_cpp/fastops.cpp`で実行される。catkinが`libmsd700_perception_fastops.so`としてビルドし、`src/msd700_perception/fastops.py`から`ctypes`経由で呼び出す。29k点のフレームでは、パイプライン時間が約52-63 msから36-39 msに短縮され、出力はビット単位で一致する。

すべてのエントリポイントにnumpy実装が残っている。Cターゲットなしでビルドされたワークスペースやライブラリの読み込み失敗時は、危険検知を失うのではなく従来速度のnumpyにフォールバックする。再ビルドせずにnumpyパスを強制するには`MSD700_FASTOPS_DISABLE=1`を設定する(実機で疑わしい差異をA/B比較する場合など)。`test/hazard_harness.py --selftest`は両方のパスを実行する。

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
