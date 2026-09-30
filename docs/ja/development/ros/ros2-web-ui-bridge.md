---
outline: deep
search: false
---

# ROS 2 Web UIブリッジ (msd_system)

<RoleBadge role="developer" />

`msd_system`のROS 2 Jazzyロボットが、ダッシュボード上で**ユニット**として現れ、そこから操縦される仕組み。すべてそのワークスペースの`src/msd_webui/`にあり、ROS 1ユニットと同じMQTT契約で通信するため、ダッシュボード、バックエンド、クラウドリレーは変更不要である。このページはロボット側を扱う。ペイロードは[メッセージ仕様](/ja/development/message-contracts/)に、ダッシュボードでの使われ方は[ROS Web UI](/ja/development/webui/)にある。

このフォルダはロボットを起動しない。ベースコントローラ、`twist_mux`、センサー、ナビゲーションスタックはロボットのbringupの担当であり、`webui.launch.py`はその隣で動く。`src/msd_webui/`の外のファイルは一切編集しない(`tools/check_additive.sh`が検査する)。

## パッケージ

| パッケージ | ノード | 役割 |
| --- | --- | --- |
| `msd_webui_bridge` | `webui_bridge` | ユニットエージェント: ローカルとクラウドのブローカーへのMQTT、コマンド処理、操作リース、在席ウォッチドッグ、緊急停止、手動走行、ロボット姿勢、マップ・スキャン・穴ストリームのエンコーダ |
| | `motion_guard` | ベースの直前の最終段: `cmd_vel`を書く唯一のノード |
| `msd_webui_views` | `scan_flattener`、`hole_trail`、`grid_mapper` | ダッシュボードが描くもの。CMUのテレインマップから作る |

`webui.launch.py`がすべてを起動する。引数: `profile`(`sim`または`prototype`)、`use_sim_time`、`unit_id`または`cred_dir`、`enable_cloud`、`enable_local`、`guard_input`、`guard_output`、`enable_views`、`terrain_topic`(既定は`/terrain_map_ext`)。ユニットはros-web-uiの`scripts/enroll.py`で一度だけ登録する。[ファームウェアと登録](/ja/development/message-contracts/firmware-and-enrolment)を参照。

## コマンド

`webui_bridge`は両方のブローカーで`/unit_<ULID>/system_command`を購読し、`system_feedback`で応答する。エンベロープ、リクエストIDの重複排除、リースの規則は`system_command.py`と同じである([MQTTコマンド](/ja/development/message-contracts/mqtt-commands)と[ハートビートとリース](/ja/development/message-contracts/heartbeat-and-lease)を参照)。

| ヘッダー | 状態 | 備考 |
| --- | --- | --- |
| `hardware`(`ping`、`heartbeat`、`check`、`init`、`stop`) | 完了 | `init`と`stop`は、プロファイルで`hardware_managed`を設定した場合のみbringupのlaunchを起動・停止する。設定しなければブリッジは稼働状態を報告するだけ |
| `emergency_stop`、`manual` | 完了 | [安全チェーン](#safety-chain)を参照 |
| `navigation`、`mapping`、`autopilot` | `status:false`で応答 | マイルストーンM3、M4、M5 |
| `boustrophedon`、`autoalign` | `status:false`で応答 | msd_systemユニットでは利用不可 |

ユニットが扱わないヘッダーには、ダッシュボードが30秒待って504になるのではなく、理由を付けてすぐ応答する。後片付けだけのコマンド(`deactivate`、`discard`、`reset`)はno-opとして成功するため、ログアウトの流れでエラーが表示されない。

## 安全チェーン {#safety-chain}

![駆動チェーンとモーションガード](../../../development/ros/diagrams/ros2-web-ui-bridge-drive-chain-and-motion-guard.drawio)

`base_controller_node`は最後の`cmd_vel`を永遠に保持し、ファームウェアも最後のホイール速度を永遠に保持する。そのため、ノードが止まるとロボットは走り続ける。`motion_guard`がこれを防ぐ。20Hzで常に配信し、次の4条件がすべて成り立たない限りゼロを送る。

- モーションロック(`webui/motion_lock`)が解除されている
- ブリッジのハートビート(`webui/guard_heartbeat`、5Hz)が0.6秒未満である
- `mux/cmd_vel`が0.3秒未満である
- `cmd_vel`のパブリッシャーが自分だけである

そのため`twist_mux`は`cmd_vel`ではなく`mux/cmd_vel`に出力し、ナビゲーションとテレオペの入力に加えてWeb UI用の2つのエントリを持つ。入力`webui/manual_vel`(優先度90、タイムアウト0.5)とロック`webui/motion_lock`(優先度255)である。`msd_webui_bridge/config/twist_mux_webui.yaml`が参照用ファイルである。

| 段階 | トリガー | 効果 |
| --- | --- | --- |
| 一時停止 | 2秒間在席なし(`ping_pause_timeout`、0.2秒ごとに判定) | モーションロックを保持する。次のpingまたはハートビートで解除される |
| アイドル | 10分間在席なし(`ping_timeout`) | リースを破棄し、モードを停止する |
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

`grid_mapper/reset`と`hole_trail/clear`(`std_srvs/Trigger`)で2つのレイヤーを空にする。

| ROS 2トピック | MQTT(`/unit_<ULID>/...`) | 形式 | 既定のレート |
| --- | --- | --- | --- |
| `webui/scan` | `string/laserscan` | [Q1](/ja/development/message-contracts/bridge-topics#compressed-formats) | 2Hz |
| `webui/scan_holes` | `string/laserscan_holes` | Q1 | 2Hz |
| `webui/hazard_cells` | `string/hazard_cells` | 圧縮パス | 0.5Hz、変化時 |
| `webui/map` | `string/map` | M1 | 変化があれば5秒ごと、ハートビート60秒 |
| (MQTT受信)`string/map_request` | | | `request_min_interval`内に応答 |

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

2Dマップはダッシュボード用の絵であり、位置推定用ではない。msd_systemでは`map`は`odom`への静的な恒等変換であるため、保存したマップは次のセッションが同じ姿勢から始まる場合にのみ合う。保存マップに対する位置推定は未解決である。

## bringupがすべきこと

1. `twist_mux`の出力を`mux/cmd_vel`にし、上記2つのWeb UIエントリを与える。
2. `webui.launch.py`を含める(Gazeboでは`profile:=sim use_sim_time:=true`)。
3. `cmd_vel`に他のパブリッシャーを置かない。
4. Web UIを使うすべてのモードでCMUスタックを動かす。`/terrain_map_ext`とTFの`map`から`base_link`・`base_footprint`がなければ、ダッシュボードにスキャンもマップも表示されない。

`twist_mux`がまだ`cmd_vel`に書くbringupの隣で`webui.launch.py`を動かすと、`motion_guard`がそれに逆らってゼロを保持し、ロボットは途切れ途切れに動くか停止する。

## 状態

| 部分 | 状態 |
| --- | --- |
| MQTT、リース、在席ウォッチドッグ、緊急停止、手動走行、ロボット姿勢 | 完了、ベンチ試験済み。実際のダッシュボードに対しては未実行 |
| マップ、スキャン、穴、穴の軌跡のストリーム | 完了、合成テレインマップで確認済み。CMUスタック、Gazebo、実機では未実行 |
| 保存マップでのナビゲーション(M3)、マッピング(M4)、オートパイロット(M5) | 未着手。`status:false`で応答 |
| バッテリー残量、`stuck`アクティビティ | 利用不可。バッテリーは0.0と報告される |

ハードウェアなしのJazzyコンテナでのベンチ結果: 手動入力はキー入力が途切れて0.30秒後に停止し、2つ目の`cmd_vel`パブリッシャーは0.17〜0.52秒でゼロを強制し、`webui_bridge`を停止するとロボットは0.53秒で、`twist_mux`を停止すると0.28秒で止まる。3072×3072のマップでも、ガードのハートビートの最長の途切れは0.21秒のままである。

## 関連ドキュメント

- [メッセージ仕様: ブリッジトピック](/ja/development/message-contracts/bridge-topics)
- [メッセージ仕様: MQTTコマンド](/ja/development/message-contracts/mqtt-commands)
- [セーフティウォッチドッグ](/ja/development/ros/safety-watchdog)
- [知覚 & ハザードスキャン](/ja/development/ros/perception-and-hazard-scan)
- [座標系変換 (TF)](/ja/development/ros/tf-transforms)
