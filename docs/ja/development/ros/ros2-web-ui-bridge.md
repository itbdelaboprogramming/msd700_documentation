---
outline: deep
search: false
---

# ROS 2 Web UIブリッジ (msd_system)

<RoleBadge role="developer" />

`msd_system`のROS 2 Jazzyロボットが、ダッシュボード上で**ユニット**として現れ、そこから操縦される仕組み。すべてそのワークスペースの`src/msd_webui/`(ブランチ`web-ui-bridge`)にあり、ROS 1ユニットと同じMQTT契約で通信するため、ダッシュボード、バックエンド、クラウドリレーは変更不要である。このページはロボット側を扱う。共通のペイロードは[メッセージ仕様](/ja/development/message-contracts/)に、ダッシュボードでの使われ方は[ROS Web UI](/ja/development/webui/)にある。ユニットでの動かし方は[ユニット構築 § ROS 2スタックへの切り替え](/ja/setup/unit-setup#ros2-stack)を参照。

ロボットはロボットのbringupの担当であり、`webui.launch.py`はその隣で動く。ブリッジはダッシュボードのコマンドでその2つの部分を起動・停止する。ハードウェアは**Initialize**と**Stop**で(`hardware_prototype.launch.py`)、ナビゲーションスタックはモード(自由走行、保存マップでのナビゲーション、マッピング)ごとにbringup自身の`msd_bringup.launch.xml`を通して起動する。Web UIの2つの機能パッケージ、`src/msd_feature/`の`msd_map_manager`と`msd_coverage`は、既定で無効の引数でそのbringupに組み込まれている。それ以外に`src/msd_webui/`の外のファイルは編集せず、bringupには行を追加するだけである(`tools/check_additive.sh`が検査する)。

## パッケージ

| パッケージ | ノードとlaunchファイル | 役割 |
| --- | --- | --- |
| `msd_webui_bridge` | `webui_bridge` | ユニットエージェント: ローカルとクラウドのブローカーへのMQTT、コマンド処理、操作リース、在席ウォッチドッグ、緊急停止、手動走行、ロボット姿勢、マップ・スキャン・穴ストリームのエンコーダ、GPS・フォロワー・帰還のブリッジ |
| | `motion_guard` | ベースの直前の最終段: `cmd_vel`を書く唯一のノード |
| | `webui.launch.py` | `webui_bridge`、`motion_guard`、viewを起動する |
| | `hardware_prototype.launch.py`、`follower.launch.py`、`rth.launch.py` | ブリッジが起動・停止するlaunchレイヤー: ロボットのハードウェア、フォロワー、帰還(msd_rth) |
| `msd_webui_views` | `scan_flattener`、`hole_trail`、`grid_mapper` | ダッシュボードが描くもの。CMUのテレインマップから作る |
| | `livox_to_cloud` | Livox Mid-360の`CustomMsg`をVelodyne形式の`PointCloud2`にする(Livoxユニットのみ、`hardware_prototype.launch.py`が起動) |
| | `image_to_v4l2` | RealSenseの画像を`camera_client`用のv4l2loopbackカメラに書き、ダッシュボードのカメラとフォロワーのvisionでRealSenseを共有する(`camera_device`設定時のみ) |
| `msd_map_manager` | `map_server` | 保存したpgm/yamlマップを`/map`として配信(latched) |
| | `map_recorder` | マッピング走行の2Dマップと登録済み3Dスキャンを保持し、`~/save`で`<名前>.pgm/.yaml/.pcd`を書く |
| | `scan_aligner` | Auto Align: LiDARを保存マップと照合し、結果を`/initialpose`として送る |
| | `grid_to_pcd`、`explore.launch.py` | 2Dマップから3Dマップを作る(壁を押し出す)。ゴールトピックを引数で指定できるTARE探索 |
| `msd_coverage` | `coverage_node` | 保存マップ上のboustrophedonカバレッジ: レーンを計画し、ゴールを1つずつ走る |

`webui.launch.py`の引数: `profile`(`sim`または`prototype`)、`use_sim_time`、`unit_id`または`cred_dir`、`dev`(開発クラウドのブローカー)、`enable_cloud`、`enable_local`、`guard_input`、`guard_output`、`enable_views`、`terrain_topic`(既定は`/terrain_map_ext`)、`camera_device`(既定は空)。

### ナビゲーションスタックのモード {#stack-modes}

ブリッジは`ros2 launch msd_bringup msd_bringup.launch.xml run_robot:=none ...`を同時に1つだけ動かす:

| モード | 起動のきっかけ | bringupの引数 |
| --- | --- | --- |
| `free` | ナビゲーションが動いていないときの`follower.start`、`rth.go_home` | `navigation_mode:=kiss_icp` |
| `navigation` | `navigation.init` | `navigation_mode:=lidar_map_localization map_path:=<マップ>.pcd`、`run_map_manager:=true map_yaml:=<マップ>.yaml run_aligner:=true`、`run_coverage:=true coverage_goal_topic:=webui/coverage/way_point` |
| `mapping` | `mapping.start` | `navigation_mode:=kiss_icp`、`run_map_manager:=true record_map:=true`。`mapping_explore`では`run_exploration:=true exploration_goal_topic:=webui/explore/way_point`も |

保存マップは1回のマッピング走行から作る、同じ`map`フレームの組である。ダッシュボードとメディアサーバー用の`<マップ>.pgm/.yaml`と、`lidar_map_localization`が位置推定に使いロボットに残る`<マップ>.pcd`(`$MAPS_FOLDER`)。pgm/yamlしかないマップ(ROS 1ユニットで作ったもの)には壁から作ったpcdを使う。ブリッジが起動していないナビゲーションスタックには触れず、その場合ブリッジはマップツールとカバレッジだけを起動する。ユニットはros-web-uiの`scripts/enroll.py`で一度だけ登録する。[ファームウェアと登録](/ja/development/message-contracts/firmware-and-enrolment)を参照。

## トピックの流れ {#topic-flow}

ロボットからダッシュボードへ: CMUナビゲーションスタックとハードウェアが配信し、`msd_webui_views`が3Dテレインマップを平面の描画に変え、`webui_bridge`がすべてをエンコード・選別してMQTTへ中継する。

![ロボットからダッシュボードへのトピックの流れ](../../../development/ros/diagrams/ros2-web-ui-bridge-topic-flow-robot-to-dashboard.drawio)

ダッシュボードからロボットへ: すべてのコマンドは`system_command`で届き、ブリッジがROSトピック(手動走行、モーションロック、ゴール、msd_rthへのコマンド)に変えるか、launchレイヤーを起動・停止する。`motion_guard`は常に`twist_mux`とベースの間にいる。

![ダッシュボードからロボットへのトピックの流れ](../../../development/ros/diagrams/ros2-web-ui-bridge-topic-flow-dashboard-to-robot.drawio)

## トピック一覧 {#topic-list}

**最小構成**の列は[最小構成での運用](#minimum)のレベルを指す: **Core**(ユニットがオンライン)、**Drive**(Initializeと手動走行)、**マップページ**(ダッシュボード上の姿勢・スキャン・マップ)、機能名(その機能にのみ必要)、**任意**(なくても問題ない)。

### ロボットから読むもの {#ros-inputs}

bringupが提供し、Web UIのノードが読むトピック。

| トピック | 型 | パブリッシャー | 読む側 | 用途 | 最小構成 |
| --- | --- | --- | --- | --- | --- |
| `/msd_hardware/imu/data` | `sensor_msgs/Imu` | msd_hardware(Xsens) | `webui_bridge` | ハードウェア稼働確認。`string/gps`の方位 | Drive |
| `/msd_hardware/wheel/left_vel`、`right_vel` | `std_msgs/Float64` | `hardware_interface_node` | `webui_bridge` | ハードウェア稼働確認(prototypeプロファイル) | Drive |
| `/msd_hardware/scan_3d/points` | `PointCloud2`または`livox_ros_driver2/CustomMsg`(型はグラフから取得) | LiDARドライバまたは`livox_to_cloud` | `webui_bridge` | ハードウェア稼働確認 | Drive |
| `mux/cmd_vel` | `geometry_msgs/TwistStamped` | `twist_mux` | `motion_guard` | `motion_guard`が通すかゼロにする指令 | Drive |
| TF `map` → `base_link`、`base_footprint` | tf2 | ナビゲーションスタック(状態推定。`map` → `odom`は静的) | `webui_bridge`、view | `string/robotpose`。スキャンのフレームと局所的な地面の高さ | マップページ |
| `/terrain_map_ext` | `map`フレームの`PointCloud2`、`intensity` = 局所的な地面からの高さ | CMU `terrain_analysis_ext` | `scan_flattener`、`hole_trail`、`grid_mapper` | スキャン、穴のマーク、穴の軌跡、2Dマップ | マップページ |
| `/state_estimation` | `nav_msgs/Odometry` | ナビゲーションスタック | `webui_bridge` | 「ナビゲーション稼働中」の判定、フォロワーのゴールのフレーム、停車位置 | フォロワー、RTH |
| `/msd_hardware/gps/fix` | `sensor_msgs/NavSatFix` | msd_hardware | `webui_bridge` | `string/gps`。RTHの`go_home`にはfixが必要 | GPS、RTH |
| `/gps/hdop` | `std_msgs/Float32` | GPSドライバ | `webui_bridge` | `string/gps`の`hdop` | 任意 |
| `/gps/satcount` | `std_msgs/Int32` | GPSドライバ | `webui_bridge` | `string/gps`の`sats` | 任意 |
| `/vision/target_point`、`/uwb/target_point` | `geometry_msgs/PointStamped` | フォロワーのターゲット源 | `webui_bridge` | `string/follower_status`の`source` | 任意 |
| `/msd_hardware/uwb` | `msd_interfaces/UWBStamped` | `hardware_interface_node` | `webui_bridge` | `uwb_range_m`(`msd_interfaces`未導入なら省略) | 任意 |
| `/path` | `vehicle`フレームの`nav_msgs/Path` | CMU `localPlanner` | `webui_bridge` | ローカルプランのオーバーレイ(`map`に変換) | 任意 |
| `/map` | `nav_msgs/OccupancyGrid`、latched | `msd_map_manager`の`map_server` | `webui_bridge`、`scan_aligner`、`coverage_node` | 保存マップ: 開いている間の`string/map`、Auto Align、カバレッジ | ナビゲーション |
| `/registered_scan` | `PointCloud2` | ナビゲーションスタック | `map_recorder` | マッピング走行の3Dマップ | マッピング |
| `/exploration_finish` | `std_msgs/Bool` | TARE | `webui_bridge` | `mapping_completed` | 任意 |

名前はすべて`webui_bridge`のパラメータである(`config/bridge.yaml`、`config/profile_<profile>.yaml`)。稼働確認の一覧は`liveness_topics`で、2秒以内(`liveness_max_age`)にメッセージが届いていれば稼働中とみなす。

### Web UIノード間 {#ros-internal}

| トピック | 型とQoS | パブリッシャー | 読む側 | 内容 | 最小構成 |
| --- | --- | --- | --- | --- | --- |
| `webui/motion_lock` | `std_msgs/Bool`、reliable、transient local、1秒ごとに再送 | `webui_bridge` | `motion_guard`、`twist_mux`(ロック255) | `true` = ロボットを止める(在席による一時停止、緊急停止、ハードウェア停止) | Drive |
| `webui/guard_heartbeat` | `std_msgs/Empty`、0.2秒ごと | `webui_bridge` | `motion_guard` | ブリッジのウォッチドッグが動いている証拠 | Drive |
| `webui/scan` | `sensor_msgs/LaserScan`、best effort、`base_link`で720ビーム | `scan_flattener` | `webui_bridge` | `obstacle_height`を超える障害物、方位ごとの最近傍 | マップページ |
| `webui/scan_holes` | `sensor_msgs/LaserScan`、best effort | `scan_flattener` | `webui_bridge` | 穴のマーク | 任意 |
| `webui/hazard_cells` | `map`フレームの`nav_msgs/Path`、reliable、transient local | `hole_trail` | `webui_bridge` | この走行の穴セルすべて、0.10m | 任意 |
| `webui/map` | `map`フレームの`nav_msgs/OccupancyGrid`、reliable、transient local | `grid_mapper` | `webui_bridge` | 2D対数オッズグリッド、0.1m | マップページ |
| `webui/follower/way_point` | `geometry_msgs/PointStamped` | フォロワー(`follower.launch.py`) | `webui_bridge` | フォロワーのゴール。フォロワーがゴールゲートを持つ間だけ`/way_point`へ中継 | フォロワー |
| `webui/rth/command` | `std_msgs/String`(JSON) | `webui_bridge` | msd_rth | `start_session`、`go_home`、`cancel` | RTH |
| `webui/rth/status` | `std_msgs/String`(JSON)、5Hz | msd_rth | `webui_bridge` | RTHの状態。届くことがmsd_rth稼働の証拠 | RTH |
| `webui/rth/way_point` | `geometry_msgs/PointStamped` | msd_rth | `webui_bridge` | 帰路のゴール。RTHがゴールゲートを持つ間だけ`/way_point`へ中継 | RTH |
| `webui/coverage/way_point`、`webui/explore/way_point` | `geometry_msgs/PointStamped` | `coverage_node`、TARE | `webui_bridge` | カバレッジと探索のゴール。その源がゴールゲートを持つ間だけ`/way_point`へ中継 | カバレッジ、マッピング |
| `coverage/plan` | `std_msgs/String`(JSON)、latched | `webui_bridge` | `coverage_node` | `{"plan_id", "areas", "exclusions"}`。空で解除 | カバレッジ |
| `coverage/status`、`coverage/path`、`coverage/skipped`、`coverage/uncovered`、`coverage/debug` | String / `nav_msgs/Path`、latched | `coverage_node` | `webui_bridge` | 走行の状態とオーバーレイ。`string/`ストリームへ中継 | カバレッジ |
| `webui/system_command` | `std_msgs/String` | ベンチ用ツール | `webui_bridge` | MQTTと同じエンベロープ。ブローカーなしの試験用 | 任意 |

### ロボットへ書くもの {#ros-outputs}

| トピック | 型とQoS | パブリッシャー | 読む側 | 内容 | 最小構成 |
| --- | --- | --- | --- | --- | --- |
| `webui/manual_vel` | `base_link`の`geometry_msgs/TwistStamped` | `webui_bridge` | `twist_mux`(優先度90、タイムアウト0.5秒) | `string/key_vel`。`manual.enable`が有効な間のみ | Drive |
| `cmd_vel` | `geometry_msgs/TwistStamped`、20Hz、常時 | `motion_guard` | `hardware_interface_node` | `mux/cmd_vel`またはゼロ | Drive |
| `/way_point` | `geometry_msgs/PointStamped` | `webui_bridge` | `cmu_nav_executor` | 同時に1つの源のゴール: ダッシュボードとオートパイロットのスーパーバイザー、カバレッジ、探索、フォロワー、RTH。停車用にはロボット自身の位置のゴール | ナビゲーション |
| `/initialpose` | `map`フレームの`geometry_msgs/PoseWithCovarianceStamped` | `webui_bridge`、`scan_aligner` | `lidar_map_localization` | `navigation.init`のホームベース、ダッシュボードの姿勢推定、Auto Alignの結果 | ナビゲーション |
| `/clicked_point` | `geometry_msgs/PointStamped` | `webui_bridge` | msd_systemでは読む側なし | ROS 1と同じく`navigation.pointstamped` | 任意 |
| `webui/guard_state` | `std_msgs/String`(JSON)、latched、変化時 | `motion_guard` | デバッグ用 | `cmd_vel`がゼロの理由 | 任意 |
| `webui/watchdog_status` | `std_msgs/String`(JSON)、latched、5Hz | `webui_bridge` | デバッグ用 | ウォッチドッグの段階、ロック保持者、閲覧プロファイル | 任意 |
| `webui/system_feedback` | `std_msgs/String` | `webui_bridge` | デバッグ用 | MQTTに送ったすべてのフィードバックのROS側コピー | 任意 |
| `msd_hardware/cmd_arm` | `std_msgs/Bool` | `motion_guard` | MCU | `use_cmd_arm: true`のときのみ(既定は無効: ros2/devファームウェアのARM動作が未確認) | 任意 |

### サービス {#ros-services}

| サービス | 型 | 効果 |
| --- | --- | --- |
| `grid_mapper/reset` | `std_srvs/Trigger` | 2Dマップを空にする |
| `hole_trail/clear` | `std_srvs/Trigger` | 穴の軌跡を空にする |
| `map_recorder/save`、`map_recorder/reset` | `std_srvs/Trigger` | 走行のマップの組を書く(応答にファイル名)。3Dマップを忘れる |
| `alignment/start`、`alignment/reset`、`check_alignment` | `std_srvs/Trigger` | ROS 1と同じAuto Align |
| `coverage/pause`、`coverage/resume`、`coverage/cancel` | `std_srvs/Trigger` | カバレッジ走行 |

### MQTT {#mqtt-topics}

トピックはすべて`/unit_<ULID>/`の下にある。ブリッジはクラウドブローカー(`msd.nglobal.jp:8883`、`dev:=true`では`8884`)とユニットのローカルMosquitto(`localhost:1883`)に同時に接続し、両方を同じように扱う。例外は3つの機能ストリームで、クラウドリレーが扱えるようになるまでローカルブローカーにだけ送る(`feature_streams_cloud: false`)。

ロボットからダッシュボードへ:

| MQTT | 元 | 形式 | レート | ブローカー | 最小構成 |
| --- | --- | --- | --- | --- | --- |
| `system_feedback` | すべてのコマンド | [フィードバックJSON](#payload-system-feedback) | コマンドごと。pingごとに1回応答 | 両方 | Core |
| `string/robotpose` | TF `map` → `base_link` | [姿勢JSON](#payload-robotpose) | 5mm / 0.5°のデッドバンドを超えたとき最大25Hz。少なくとも5秒ごと(誰も見ていなければ25秒ごと)に再送 | 両方 | マップページ |
| `string/laserscan` | `webui/scan` | [base64(zlib(Q1))](#payload-laserscan) | 2Hz。閲覧中1Hz。idle中は停止 | 両方 | マップページ |
| `string/laserscan_holes` | `webui/scan_holes` | base64(zlib(Q1)) | `string/laserscan`と同じ | 両方 | 任意 |
| `string/hazard_cells` | `webui/hazard_cells` | [base64(zlib(Path JSON))](#payload-hazard-cells) | 0.5Hzで確認し、変化時と15秒ごとに送信。idle中は停止 | 両方 | 任意 |
| `string/map` | `webui/map` | [base64(zlib(M1))](#payload-map) | 変化時に最短5秒ごと。ハートビート60秒(idle中300秒)。リセット後は3回送信 | 両方 | マップページ |
| `string/gps` | GPSのfix、HDOP、衛星数、IMUのヨー | [JSON](#payload-gps) | 1Hz。idle中は停止 | ローカル | GPS |
| `string/follower_status` | フォロワーのゴールとターゲット源 | [JSON](#payload-follower-status) | 追従中2Hz、変化のたびにも送信 | ローカル | フォロワー |
| `string/rth_status` | `webui/rth/status` | [JSON](#payload-rth-status) | 状態が変わるたび、帰還中は1Hz | ローカル | RTH |
| `string/rth_path` | msd_rthの軌跡ファイル(`map`に変換) | [base64(zlib(Path JSON))](#payload-rth-path) | 記録が伸びたとき(2秒ごとに確認) | ローカル | RTH |
| `string/move_base/status`、`string/move_base/result` | ブリッジのゴール追跡 | [status](/ja/development/message-contracts/bridge-topics#json-status)、[result](/ja/development/message-contracts/bridge-topics#json-result) JSON | statusは変化時と2秒ごと。resultはACKまで1秒ごと(誰も見ていない間は送らない) | 両方 | ナビゲーション |
| `string/move_base/NavfnROS/plan`、`string/move_base/TebLocalPlannerROS/local_plan` | ロボットからゴールへの直線、`/path` | base64(zlib(Path JSON)) | `string/hazard_cells`と同じ | 両方 | 任意 |
| `string/boustrophedon_path`、`string/skipped_waypoints` | `coverage/path`、`coverage/skipped` | base64(zlib(Path JSON))。経路は`header.seq`にリビジョンを持つ | 経路は変化時と、ACKまで2秒ごと | 両方 | カバレッジ |
| `string/coverage_status`、`string/uncovered_regions`、`string/coverage_debug` | `coverage_node` | テキスト / JSON | 変化時 | 両方 | カバレッジ |
| `string/operation_progress`、`string/operation_snapshot` | 運転スーパーバイザー | [JSON](/ja/development/message-contracts/operation-sync#supervisor-to-browser) | ステップごと。スナップショットは変化のたび | 両方 | オートパイロット |

ダッシュボードからロボットへ:

| MQTT | 元 | 形式 | 読まれ方 | 最小構成 |
| --- | --- | --- | --- | --- |
| `system_command` | `backend_node`(コマンド、ping)、ブラウザ(0.2秒ごとのハートビートフレーム) | [コマンドエンベロープ](#payload-system-command) | `header`で振り分け | Core |
| `string/key_vel` | ブラウザ、Manual Override中に10Hz | [Twist JSON](#payload-key-vel) | `webui/manual_vel` | Drive |
| `string/map_request` | ブラウザ、マップキャンバスにマップがない間 | [JSON](#payload-map-request) | 次の`string/map`をすぐ送る | マップページ |
| `string/move_base/goal`、`string/move_base/cancel`、`string/move_base/result_ack` | ブラウザ | [goal](/ja/development/message-contracts/bridge-topics#json-goal)、[cancel](/ja/development/message-contracts/bridge-topics#json-cancel)、[ACK](/ja/development/message-contracts/bridge-topics#acks) | `/way_point`のゴール、プリエンプト、resultの再送停止 | ナビゲーション |
| `string/initialpose` | ブラウザ(姿勢推定) | [初期姿勢JSON](/ja/development/message-contracts/bridge-topics#json-initialpose) | `/initialpose` | ナビゲーション |
| `string/boustrophedon_path_ack` | ブラウザ | 経路のリビジョン | カバレッジ経路の再送停止 | カバレッジ |
| `string/operation_sync` | ブラウザ | [operation sync JSON](/ja/development/message-contracts/operation-sync#sync-messages) | 運転スーパーバイザー | オートパイロット |

## 最小構成での運用 {#minimum}

各レベルは、それより上のレベルのものをすべて必要とする。

| レベル | 使えるもの | ROS側に必要なもの | MQTTに必要なもの |
| --- | --- | --- | --- |
| **Core** | ユニットがオンライン表示され、pingとリースに応答し、未対応コマンドにはすぐ応答する | ユニットID(`unit_id`、`$UNIT_ID`、または`device.json`)付きで動く`webui_bridge`と、到達できるブローカー。他のトピックは不要 | `system_command`、`system_feedback` |
| **Drive** | InitializeとStop、手動走行、緊急停止、2秒の在席一時停止 | `twist_mux`とベースの間の`motion_guard`。`webui/manual_vel`入力と`webui/motion_lock`ロックを持ち`mux/cmd_vel`に書く`twist_mux`。`cmd_vel`に他のパブリッシャーがないこと。Initializeから20秒以内に稼働確認トピックが届くこと | + `string/key_vel`とハートビートフレーム |
| **マップページ** | ロボット位置、スキャン、2Dマップ | ナビゲーションスタック: TF `map` → `base_link`と`base_footprint`、`/terrain_map_ext`。`msd_webui_views`(`enable_views`) | + `string/robotpose`、`string/laserscan`、`string/map`、`string/map_request` |
| **GPS** | fixの表示と位置 | `/msd_hardware/gps/fix` | + `string/gps`(ローカルブローカー) |
| **フォロワー** | 人やタグへの追従 | `/state_estimation`、`/way_point`を読む`cmu_nav_executor`、フォロワーのパッケージ | + `follower`コマンド、`string/follower_status` |
| **RTH** | ホームの記録と、記録した経路での帰還 | `/state_estimation`、GPSのfix、msd_rth、`cmu_nav_executor` | + `rth`コマンド、`string/rth_status`、`string/rth_path` |
| **ナビゲーション** | 保存マップを開く、ピンポイント、姿勢推定、Auto Align | `msd_bringup.launch.xml`経由のCMUスタックと`lidar_map_localization`、`msd_map_manager`。マップの`.pcd`(または壁から作ったもの) | + `navigation`、`autoalign`コマンド、`string/move_base/*`、`string/initialpose` |
| **マッピング** | マップを作って保存する | KISS-ICPのCMUスタック、`msd_map_manager`、メディアサーバーと認証情報。自動探索にはTARE | + `mapping`コマンドと進捗イベント |
| **カバレッジ** | オートカバレッジ、カスタムエリア、立入禁止付きプレイリスト | ナビゲーション用に開いたマップ、`msd_coverage` | + `boustrophedon`コマンド、カバレッジのストリーム |
| **オートパイロット** | ダッシュボードを閉じてもマルチピンポイントの走行が続く | ナビゲーション用に開いたマップ | + `autopilot`コマンド、`string/operation_*` |

レベルを欠いても安全である。そのレベルが描くものは空のままで、そのコマンドには理由付きで`status: false`が返る。**マップページ**のレベルがないと姿勢ストリームは止まり、ダッシュボードの操作ページは姿勢が約30秒届かないと再接続する。なくても影響のない任意の要素: `string/laserscan_holes`、`string/hazard_cells`、`/gps/hdop`、`/gps/satcount`、UWB距離、visionターゲット、デバッグ用トピック。

pingの応答の`hw_status`は稼働確認トピックがすべて新しい間だけ`true`になるため、Initialize前は`false`である。

## ペイロード例 {#payloads}

ROS 1ユニットと共通のペイロードは[メッセージ仕様](/ja/development/message-contracts/)で定義されており、以下の各例はその定義にリンクしている。GPS、フォロワー、帰還はmsd_systemユニットにしかない。これらのペイロードは、バックエンド、リレー、ダッシュボードが使うまでここでの草案であり、その後メッセージ仕様へ移す。

### MQTT、ダッシュボードからロボットへ

#### `system_command` {#payload-system-command}

[コマンドエンベロープ](/ja/development/message-contracts/mqtt-commands#command-envelope)。`backend_node`が送るping([pingリクエスト](/ja/development/message-contracts/heartbeat-and-lease#ping-request)):

```json
{
  "header": "hardware",
  "command": "ping",
  "data": {
    "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
    "user_id": "01JZ7YV5CQUSER00000000000",
    "claim": true, "release": false, "page": "navigation",
    "origin": "cloud", "force_takeover": false
  },
  "metadata": { "timestamp": "2026-10-21T04:11:52.913Z", "request_id": "6f0c2d7e-1b44-4c55-9f0e-5d2b1a9e8c31" }
}
```

ブラウザの[ハートビートフレーム](/ja/development/message-contracts/heartbeat-and-lease#heartbeat-frame)、0.2秒ごと:

```json
{ "header": "hardware", "command": "heartbeat", "metadata": { "request_id": "heartbeat" }, "data": { "page": "navigation" } }
```

ブリッジが扱うコマンド。すべて同じエンベロープ:

| `header` | `command` | `config`または`data` |
| --- | --- | --- |
| `hardware` | `ping`、`heartbeat`、`check`、`init`、`stop`、`idle` | なし(上記の`ping`と`heartbeat`を除く) |
| `hardware` | `battery_update` | `"config": { "resource": { "value": 87 } }` |
| `emergency_stop` | `activate`、`deactivate` | なし |
| `manual` | `enable`、`disable` | なし |
| `follower` | `start` | 任意で`"data": { "sources": ["uwb"] }`。`vision`、`uwb`を優先順に |
| `follower` | `stop` | なし |
| `rth` | `mark_home`、`go_home`、`cancel` | なし |
| `navigation` | `init`、`deactivate`、`pointstamped` | ROS 1と同じ([MQTTコマンド](/ja/development/message-contracts/mqtt-commands)) |
| `mapping` | `start`、`pause`、`stop`、`discard` | ROS 1と同じ。`mapping_progress`イベントも同じ |
| `boustrophedon` | `init`、`pause`、`deactivate` | ROS 1と同じ: `use_autocover`、`polygon`、`areas`、`exclusions`、`pause` |
| `autoalign` | `start`、`reset`、`status` | なし |
| `autopilot` | `enable`、`disable` | なし |

```json
{ "header": "follower", "command": "start", "data": { "sources": ["uwb"] },
  "metadata": { "timestamp": "2026-10-21T04:12:03.120Z", "request_id": "c3a1e0b2-7d9f-4e1a-8b6c-2f4d5e6a7b8c" } }
```

#### `string/key_vel` {#payload-key-vel}

[Twist JSON](/ja/development/message-contracts/bridge-topics#json-twist)。ブリッジが読むのは`linear.x`と`angular.z`だけ:

```json
{ "linear": { "x": 0.4, "y": 0.0, "z": 0.0 }, "angular": { "x": 0.0, "y": 0.0, "z": 1.0 } }
```

#### `string/map_request` {#payload-map-request}

内容は問わない。ダッシュボードは次を送る([マップの配信](/ja/development/message-contracts/bridge-topics#map-delivery)):

```json
{ "reason": "map-init", "at": 1792555923120 }
```

### MQTT、ロボットからダッシュボードへ

#### `system_feedback` {#payload-system-feedback}

[フィードバックエンベロープ](/ja/development/message-contracts/mqtt-commands#feedback-envelope)。通常の応答:

```json
{ "header": "follower", "command": "start",
  "data": { "status": true, "message": "Following (sources: uwb, goals in odom)" },
  "metadata": { "timestamp": 1792555923.42, "request_id": "c3a1e0b2-7d9f-4e1a-8b6c-2f4d5e6a7b8c" } }
```

pingの応答([pingレスポンス](/ja/development/message-contracts/heartbeat-and-lease#ping-response))には、ROS 1ユニットが送らないフィールド`capabilities`が1つ加わる:

```json
{
  "header": "hardware", "command": "ping",
  "data": {
    "status": true, "robot_activity": "hardware_ready", "active_page": "navigation",
    "battery": 0.0, "uptime": 42, "hw_status": true,
    "manual_override": false, "autopilot": false, "active_map_id": null,
    "in_use": false, "in_use_by": null, "origin_conflict": false, "origin_conflict_side": null,
    "motion_locked": false,
    "capabilities": ["autopilot", "coverage", "autoalign", "gps", "follower", "rth"]
  },
  "metadata": { "timestamp": 1792555912.95, "request_id": "6f0c2d7e-1b44-4c55-9f0e-5d2b1a9e8c31" }
}
```

`capabilities`はこのユニットが扱う任意機能の一覧である。ROS 1ユニットは送らず、その場合は`["autopilot", "coverage", "autoalign"]`と読む。`battery`は誰かが`battery_update`を送るまで`0.0`のまま。新しい`robot_activity`の値: `following`、`follower_target_lost`、`returning_home`、`returned_home`。`stuck`はROS 1と同じく報告される。動くはずのアクティビティで、20秒間に0.15m動かないロボット(最初に動くまでは60秒)は`stuck`と読まれ、`active_page`は実際のアクティビティに従う。

#### `string/robotpose` {#payload-robotpose}

[姿勢JSON](/ja/development/message-contracts/bridge-topics#json-pose)。TF `map` → `base_link`から:

```json
{"position":{"x":1.234,"y":-0.5,"z":0.0},"orientation":{"x":0.0,"y":0.0,"z":0.382683,"w":0.92388}}
```

#### `string/laserscan`と`string/laserscan_holes` {#payload-laserscan}

`base64(zlib(Q1))`([圧縮形式](/ja/development/message-contracts/bridge-topics#compressed-formats))。ブリッジ自身のエンコーダで作った8ビームのスキャン:

```text
eJwLNLzN73ngyWkxByBtzwAB9mfPnLFlYFjgyAHkcDIkJRanxudk5mXXMvz/H8JoByQPMp0AkgBgUhX9
```

デコード結果: マジック`Q1`、`angle_min` -3.1416、`angle_max` 2.3562、`angle_increment` 0.7854、`time_increment` 0、`scan_time` 0.5、`range_min` 0.1、`range_max` 20.0、8ビーム、フレーム`base_link`、続いてビームごとにセンチメートル単位のリトルエンディアンuint16: `125, 65535, 340, 62, 65535, 705, 200, 65535`(65535 = 反射なし)。実際のスキャンは720ビーム。

#### `string/hazard_cells` {#payload-hazard-cells}

`map`フレームの`nav_msgs/Path`の`base64(zlib(JSON))`。穴セルごとに1つの姿勢:

```text
eJy9TssOAiEQ+5XNnJUMu64af8UYQ9wxcuAhbOKD8O8OBA/e1QvTlrZpggupiQLsugSRrnxx0UGclfFNO0UGcrNdjzhI2fOvbSJmJuegDB31xByM8lA07yIVwz79rL6mGehZO1vJnd9eDCMbHgyXUmDBz9IkapcLmuysPhLY7Pi28r2VRTlz5P/7V1/cf8gvYOmDeA==
```

デコード結果:

```json
{"header": {"seq": 0, "stamp": {"secs": 1786503112, "nsecs": 0}, "frame_id": "map"},
 "poses": [
  {"header": {"seq": 0, "stamp": {"secs": 1786503112, "nsecs": 0}, "frame_id": "map"},
   "pose": {"position": {"x": 2.35, "y": -1.05, "z": 0.0}, "orientation": {"x": 0, "y": 0, "z": 0, "w": 1}}},
  {"header": {"seq": 0, "stamp": {"secs": 1786503112, "nsecs": 0}, "frame_id": "map"},
   "pose": {"position": {"x": 2.45, "y": -1.05, "z": 0.0}, "orientation": {"x": 0, "y": 0, "z": 0, "w": 1}}}]}
```

#### `string/map` {#payload-map}

`base64(zlib(M1))`。4×3のグリッド:

```text
eJzzNTx75owtCwMDAzMQnz3js2/WTMl9DBigwR6Zd+J+dRYDWE9uYsF/BoYUIDvlP5ABAJU+ECY=
```

デコード結果: マジック`M1`、解像度0.1、幅4、高さ3、原点(-0.2, -0.15, 0.0)、恒等の向き、フレーム`map`、続いて原点から行ごとに12個のint8セル: `-1 0 0 100 / 0 0 0 100 / -1 -1 0 0`(-1 不明、0 空き、100 占有)。0×0のグリッド`eJzzNWSgADAz5CYWAAAjlAHA`は破損ではなくretireの合図である([マップの配信](/ja/development/message-contracts/bridge-topics#map-delivery))。

#### `string/gps` {#payload-gps}

草案、msd_systemのみ。

```json
{"status":0,"lat":-6.89123,"lon":107.61045,"alt":760.12,"hdop":0.84,"sats":14,"heading_deg":12.5,"age_s":0.3}
```

| フィールド | 意味 |
| --- | --- |
| `status` | `sensor_msgs/NavSatStatus`: -1 fixなし、0 fix、1 SBAS、2 GBAS。3秒より古いfixは-1と読む |
| `lat`、`lon`、`alt` | 度、度、メートル。`status`が-1なら`null` |
| `hdop`、`sats` | `/gps/hdop`や`/gps/satcount`がなければ`null`(シミュレーター) |
| `heading_deg` | `/msd_hardware/imu/data`による方位、0 = 北、時計回り。なければ`null` |
| `age_s` | 最後のfixメッセージからの秒数 |

最初のfixメッセージが届くまでは何も送らない。

#### `string/follower_status` {#payload-follower-status}

草案、msd_systemのみ。

```json
{"state":"following","source":"uwb","target":{"x":3.2,"y":-0.4,"frame":"odom"},"uwb_range_m":2.85}
```

| フィールド | 意味 |
| --- | --- |
| `state` | `following`、`target_lost`、`stopped` |
| `source` | 今新しいターゲット源: `vision`、`uwb`、または空 |
| `target` | ロボットが向かうゴール、`/state_estimation`のフレーム。追従中以外は`null` |
| `uwb_range_m` | UWBタグまでの距離。直近2秒に読み取りがなければ`null` |

#### `string/rth_status` {#payload-rth-status}

草案、msd_systemのみ。msd_rthの状態にブリッジのセッションIDを付けたもの:

```json
{"state":"RETURNING_HOME","session_id":"01M5C39HBDDTJ45SHG79AGX383","waypoint_index":3,"total_waypoints":12,"distance_to_next_m":1.7}
```

`state`は`IDLE`、`RETURNING_HOME`、`HOME`のいずれか。経路の3フィールドは帰還中のみ。

#### `string/rth_path` {#payload-rth-path}

ドラフト、msd_systemのみ。記録したセッション、つまり帰還でたどり直す経路: `map`フレームの`nav_msgs/Path`の`base64(zlib(JSON))`で、[`string/hazard_cells`](#payload-hazard-cells)と同じ形式。ブリッジはmsd_rthの軌跡ファイル(GNSSフレーム`gps_map`)を読み、0.25m以上離れた点だけを残し(最大1000点)、TFで`map`に移す。セッションが終わると空のパスを送る。

### ROS 2トピック

`ros2 topic echo`の表示形式で、一部省略。

#### `webui/motion_lock`と`webui/guard_heartbeat` {#payload-motion-lock}

```yaml
# webui/motion_lock (std_msgs/Bool): trueでロボットを止める
data: true
---
# webui/guard_heartbeat (std_msgs/Empty): メッセージそのものが合図
{}
```

#### `webui/manual_vel`、`mux/cmd_vel`、`cmd_vel` {#payload-cmd-vel}

3つとも`geometry_msgs/TwistStamped`で、使うのは`linear.x`と`angular.z`だけ。

```yaml
header:
  stamp: {sec: 1792555923, nanosec: 120000000}
  frame_id: base_link
twist:
  linear: {x: 0.4, y: 0.0, z: 0.0}
  angular: {x: 0.0, y: 0.0, z: 1.0}
```

#### `webui/guard_state` {#payload-guard-state}

```json
{"state": "bridge_heartbeat_lost"}
```

`state`は`pass`、または`cmd_vel`がゼロの理由: `motion_lock`、`another_cmd_vel_publisher`、`bridge_heartbeat_lost`、`no_fresh_command`。

#### `webui/watchdog_status` {#payload-watchdog-status}

```json
{"alive": 5120, "interval": 0.2, "presence_age": 0.18, "operation_age": 0.18,
 "operation_page": "navigation", "activity": "manual", "autopilot": false, "manual_override": true,
 "state": "manual_override", "lock_holders": [],
 "tiers": {"pause": {"threshold": 2.0, "fired": false},
           "idle": {"threshold": 600.0, "fired": false},
           "shutdown": {"threshold": 1800.0, "fired": false}},
 "errors": 0, "last_error": null, "viewers": "driving"}
```

`state`は`starting`、`disabled`、`autopilot_suspended`、`operator_paused`、`no_operation`、`manual_override`、`paused_ping_loss`、`supervised`のいずれか。`lock_holders`はモーションロックの保持者(`emergency_stop`、`ping_watchdog`、`hardware_shutdown`)。`viewers`はegressプロファイル: `idle`、`watching`、`driving`。

#### `webui/scan`、`webui/map`、`webui/hazard_cells` {#payload-view-topics}

```yaml
# webui/scan (sensor_msgs/LaserScan)。webui/scan_holesも同じ形
header: {frame_id: base_link}
angle_min: -3.14159
angle_max: 3.13286
angle_increment: 0.00873   # 720ビーム
range_min: 0.1
range_max: 20.0
ranges: [.inf, .inf, 3.42, 3.40, ...]
---
# webui/map (nav_msgs/OccupancyGrid)、latched
header: {frame_id: map}
info:
  resolution: 0.1
  width: 812
  height: 640
  origin: {position: {x: -40.6, y: -32.0, z: 0.0}, orientation: {w: 1.0}}
data: [-1, -1, 0, 0, 100, ...]
---
# webui/hazard_cells (nav_msgs/Path)、latched: 穴セルごとに1つの姿勢、0.10mセルの中心
header: {frame_id: map}
poses:
- pose: {position: {x: 2.35, y: -1.05, z: 0.0}, orientation: {w: 1.0}}
```

#### `/way_point`、`webui/follower/way_point`、`webui/rth/way_point` {#payload-way-point}

`/state_estimation`のフレームの`geometry_msgs/PointStamped`:

```yaml
header:
  stamp: {sec: 1792555930, nanosec: 0}
  frame_id: odom
point: {x: 3.2, y: -0.4, z: 0.0}
```

停車用のゴールは、ロボットの最新の`/state_estimation`位置に置いた同じメッセージである。

#### `webui/rth/command`と`webui/rth/status` {#payload-rth-topics}

`data`にJSONを入れた`std_msgs/String`:

```json
{"command": "start_session", "session_id": "01M5C39HBDDTJ45SHG79AGX383"}
{"command": "go_home", "session_id": "01M5C39HBDDTJ45SHG79AGX383"}
{"command": "cancel"}
```

`webui/rth/status`はmsd_rth自身の5Hzの状態で、[`string/rth_status`](#payload-rth-status)の元になる。

## コマンド

`webui_bridge`は両方のブローカーで`/unit_<ULID>/system_command`を購読し、`system_feedback`で応答する。エンベロープ、リクエストIDの重複排除、リースの規則は`system_command.py`と同じである([MQTTコマンド](/ja/development/message-contracts/mqtt-commands)と[ハートビートとリース](/ja/development/message-contracts/heartbeat-and-lease)を参照)。

| ヘッダー | 状態 | 備考 |
| --- | --- | --- |
| `hardware`(`ping`、`heartbeat`、`check`、`init`、`stop`、`idle`、`battery_update`) | 完了 | `hardware_managed`が設定されていれば(prototypeプロファイル)、`init`と`stop`が`hardware_prototype.launch.py`を起動・停止する。手動で起動されたハードウェアには触れない。simプロファイルは稼働状態を報告するだけ |
| `emergency_stop`、`manual` | 完了 | [安全チェーン](#safety-chain)を参照 |
| `follower`(`start`、`stop`)、`rth`(`mark_home`、`go_home`、`cancel`) | 完了 | `capabilities`にある場合のみ。ゴール源は同時に1つ。セッションがなければ`follower.start`がRTHの記録も始める |
| `navigation`(`init`、`deactivate`、`pointstamped`) | 完了 | `init`はマップがなければダウンロードし、`navigation`モードを起動し、ホームベースを`/initialpose`として送る。ゴールは`string/move_base/goal`で届く: ACTIVE、0.6m以内でSUCCEEDED、20秒間に0.2m進まなければABORTED、PREEMPTED、ナビゲーションなし・緊急停止中・カバレッジ走行中はREJECTED |
| `mapping`(`start`、`pause`、`stop`、`discard`) | 完了 | マップを保存できないときは`start`を拒否する。`stop`は`<マップ>.pgm/.yaml`(アップロード)と`<マップ>.pcd`(ロボットに残す)を書く。保存に失敗しても走行は開いたまま |
| `boustrophedon`(`init`、`pause`、`deactivate`) | 完了 | Navigationページでマップを開いている必要がある。Manual Overrideは走行を一時停止し、解除で再開する |
| `autoalign`(`start`、`reset`、`status`) | 完了 | `scan_aligner`。車輪は動かさない |
| `autopilot`(`enable`、`disable`) | 完了 | 在席の段階を停止し、ダッシュボードを閉じても運転スーパーバイザーがマルチピンポイントの走行を続ける |

`boustrophedon`、`autoalign`、`autopilot`は`capabilities`にある場合だけ扱う(両プロファイルとも載せている)。ない場合は、ダッシュボードが30秒待って504になるのではなく、理由を付けてすぐ応答する。後片付けだけのコマンド(`deactivate`、`discard`、`reset`)はno-opとして成功するため、ログアウトの流れでエラーが表示されない。フォロワーとRTHは、緊急停止中、Manual Override中、`/state_estimation`がないときは拒否する。`go_home`にはGPSのfixと記録済みのセッションも必要である。

## 安全チェーン {#safety-chain}

![駆動チェーンとモーションガード](../../../development/ros/diagrams/ros2-web-ui-bridge-drive-chain-and-motion-guard.drawio)

`hardware_interface_node`はすべての`cmd_vel`をタイムアウトなしでMCUへ転送し、ファームウェアも最後のホイール速度を永遠に保持する。そのため、ノードが止まるとロボットは走り続ける。`motion_guard`がこれを防ぐ。20Hzで常に配信し、次の4条件がすべて成り立たない限りゼロを送る。

- モーションロック(`webui/motion_lock`)が解除されている
- ブリッジのハートビート(`webui/guard_heartbeat`、5Hz)が0.6秒未満である
- `mux/cmd_vel`が0.3秒未満である
- `cmd_vel`のパブリッシャーが自分だけである

そのため`twist_mux`は`cmd_vel`ではなく`mux/cmd_vel`に出力し、ナビゲーションとテレオペの入力に加えてWeb UI用の2つのエントリを持つ。入力`webui/manual_vel`(優先度90、タイムアウト0.5)とロック`webui/motion_lock`(優先度255)である。`msd_webui_bridge/config/twist_mux_webui.yaml`が参照用ファイルで、実機では`hardware_prototype.launch.py`がbringupを編集せずに両方を設定する。

| 段階 | トリガー | 効果 |
| --- | --- | --- |
| 一時停止 | 2秒間在席なし(`ping_pause_timeout`、0.2秒ごとに判定) | モーションロックを保持する。次のpingまたはハートビートで解除される |
| アイドル | 10分間在席なし(`ping_timeout`) | リースを破棄し、モード、フォロワー、帰還を停止する |
| シャットダウン | 30分間在席なし(`ping_shutdown_timeout`) | リースを破棄し、ロックを保持したままハードウェアを停止する。再接続しても回復しない |

値はROS 1のウォッチドッグ([セーフティウォッチドッグ](/ja/development/ros/safety-watchdog))と同じである。緊急停止は同じモーションロック上のキーで、`~/.msd_webui/estop.json`に保存されるため、ブリッジを再起動しても解除されず、手動オーバーライドでそこから走り出すこともできない。`manual.enable`が`webui/manual_vel`を開く。ダッシュボードの`string/key_vel`は10Hzで届き、0.5秒途切れるとロボットは停止する。

## マップ・スキャン・穴のストリーム {#streams}

![マップ・スキャン・穴のストリーム](../../../development/ros/diagrams/ros2-web-ui-bridge-map-scan-and-hole-streams.drawio)

3Dの処理はブリッジでは行わない。CMUスタックがすでにLiDARを`/terrain_map_ext`に集約している。これは`map`フレームの`PointCloud2`で、`intensity`は局所的な地面からの高さである。viewノードがそれをダッシュボードの描画内容に平坦化し、ブリッジはエンコードして中継するだけである。

| ノード | 出力 | 描画内容 |
| --- | --- | --- |
| `scan_flattener` | `webui/scan`、`webui/scan_holes`(`LaserScan`、720ビーム、`base_link`) | 局所的な地面より`obstacle_height`を超えて高いテレインの点を、方位ごとの最近傍で。スロープは床のまま。穴のマークは2つ目のスキャンへ |
| `hole_trail` | `webui/hazard_cells`(`nav_msgs/Path`、`map`、latched) | この走行で穴と判定されたすべてのセル、0.10mセル、ROS 1と同じく最大1000。セルは`min_hits`(2)回の更新でマークされて初めて保持される |
| `grid_mapper` | `webui/map`(`OccupancyGrid`、`map`、latched) | 0.1mの対数オッズグリッド、1辺400mまでチャンク単位で拡張。壁は一度見えれば固定され、通り過ぎた人は床に戻り、穴は含めない |

エンコーダはROS 1の`topic2string`とバイト単位で同一であり、`test/test_codec.py`でROS 1コードのゴールデン出力に固定されている。egressゲート、変化ハートビート、マップ要求、リセット後の3回の再送バーストは、[ブリッジトピック](/ja/development/message-contracts/bridge-topics#map-delivery)と[egressプロファイル](/ja/development/message-contracts/bridge-topics#egress-profiles)の説明どおりに動く。誰も見ていない間(`idle`)はスキャンが止まり、起動直後のブリッジは15秒間(`viewer_idle_after`)閲覧中として扱われる。ストリームは`MultiThreadedExecutor`の専用コールバックグループで動くため、大きなマップの圧縮がガードのハートビートを遅らせることはない。

### ROS 1との違い

穴と複数の高さの障害物は、[知覚 & ハザードスキャン](/ja/development/ros/perception-and-hazard-scan)の`hazard_scan`を移植したものではなく、CMUの`terrain_analysis`が検出する。Web UIは、そのノードが付けたマークを表示するだけで、そのマークはプランナーが避けるものと同じである。`msd_webui_views/config/views.yaml`の3つの値は、ロボットの`terrain_analysis.yaml`と一致させなければならない。

| `views.yaml` | `terrain_analysis.yaml` |
| --- | --- |
| `obstacle_height` | `obstacleHeightThre` |
| `forced_intensity` | `vehicleHeight` |
| `hole_depth` | \|`negObstacleRelZThre`\| |

知っておくべき2つの帰結:

- CMUスタックを含むすべてのブランチで現在`negObstacle`は`-1`(無効)であり、ナビゲーションチームが有効にするまで穴のオーバーレイと穴の軌跡は空のままである。
- `terrain_analysis`は穴をフレームごとにマークする。ROS 1の`hazard_scan_node`は報告の前に穴を確認していた。`min_hits`はその代用であり、テレインのパラメータが確定したら見直す必要がある。

ライブの2Dマップはダッシュボード用の絵であり、位置推定用ではない。保存マップでは3Dの対(`<マップ>.pcd`、[ナビゲーションスタックのモード](#stack-modes))で位置推定する。開いている間、`string/map`はライブのグリッドではなく保存マップを表示する。

## bringupがすべきこと

1. `twist_mux`の出力を`mux/cmd_vel`にし、上記2つのWeb UIエントリを与える(実機では`hardware_prototype.launch.py`が行う)。
2. `webui.launch.py`を含める(Gazeboでは`profile:=sim use_sim_time:=true`)。
3. `cmd_vel`に他のパブリッシャーを置かない。
4. ナビゲーションはブリッジに任せる(Gazeboでは`run_navigation:=false`)。ブリッジがモードごとに`msd_bringup.launch.xml`でCMUスタックを起動する。別の方法で起動したナビゲーションスタックはそのまま使うが、その場合保存マップでの位置推定は行わない。

`twist_mux`がまだ`cmd_vel`に書くbringupの隣で`webui.launch.py`を動かすと、`motion_guard`がそれに逆らってゼロを保持し、ロボットは途切れ途切れに動くか停止する。

## 状態

| 部分 | 状態 |
| --- | --- |
| MQTT、リース、在席ウォッチドッグ、緊急停止、手動走行、ロボット姿勢 | 完了、ベンチ試験済み。実際のダッシュボードに対しては未実行 |
| マップ、スキャン、穴、穴の軌跡のストリーム | 完了、合成テレインマップで確認済み。CMUスタック、Gazebo、実機では未実行 |
| ロボットのハードウェアレイヤー(`hardware_prototype.launch.py`)、LiDARの`scan_3d/points`化 | 完了、代替ドライバでJazzy上で確認済み。実機では未実行 |
| GPS、フォロワー、帰還 | 完了、代替のフォロワーとRTHプロセスでJazzy上で確認済み。機能ストリームはローカルブローカーのみ |
| 保存マップでのナビゲーション(M3)、マッピング(M4)、オートパイロット(M5)、探索(M6)、カバレッジ、Auto Align、`stuck` | 完了(2026-10-21)。`tools/ops_harness/ops_check.py`でJazzy上でエンドツーエンドに確認済み: 本物のブリッジ、`msd_bringup.launch.xml`、`msd_map_manager`、`msd_coverage`をMQTT経由で、CMUスタックとロボットの代替、模擬メディアサーバーと組み合わせた。CMUスタック、Gazebo、実機、実際のダッシュボードでは未実行 |
| `string/rth_path`、カメラ共有(`image_to_v4l2`) | 完了、単体試験済み。msd_rthやv4l2loopbackデバイスでは未実行 |
| バッテリー残量 | 利用不可。0.0と報告される |

ハードウェアなしのJazzyコンテナでのベンチ結果: 手動入力はキー入力が途切れて0.30秒後に停止し、2つ目の`cmd_vel`パブリッシャーは0.17〜0.52秒でゼロを強制し、`webui_bridge`を停止するとロボットは0.53秒で、`twist_mux`を停止すると0.28秒で止まる。3072×3072のマップでも、ガードのハートビートの最長の途切れは0.21秒のままである。

## 関連ドキュメント

- [メッセージ仕様: ブリッジトピック](/ja/development/message-contracts/bridge-topics)
- [メッセージ仕様: MQTTコマンド](/ja/development/message-contracts/mqtt-commands)
- [セーフティウォッチドッグ](/ja/development/ros/safety-watchdog)
- [知覚 & ハザードスキャン](/ja/development/ros/perception-and-hazard-scan)
- [座標系変換 (TF)](/ja/development/ros/tf-transforms)
- [ユニット構築 § ROS 2スタックへの切り替え](/ja/setup/unit-setup#ros2-stack)
