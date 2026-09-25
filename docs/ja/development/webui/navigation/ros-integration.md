---
outline: deep
search: false
---

# ナビゲーション: ROS 連携

<RoleBadge role="developer" />

ナビゲーションページが送受信するものを、トランスポート別にまとめたページである。各ペイロードは
[メッセージ仕様](/ja/development/message-contracts/) で一度だけ規定されている。本ページは、ナビゲーションページが
どの仕様をなぜ使うかを述べ、該当箇所へリンクする。ボタンごとの一覧は
[メッセージ仕様 § ナビゲーションページ](/ja/development/message-contracts/#trace-navigation) を参照。

これらの呼び出しが実装する機能レベルの振る舞いについては、
[概要](/ja/development/webui/navigation/overview)、
[マップ同期 & 位置合わせ](/ja/development/webui/navigation/map-sync-and-alignment)、
[カバレッジ清掃](/ja/development/webui/navigation/coverage-cleaning)、
[ピンポイント & ルート](/ja/development/webui/navigation/pinpoint-and-routes)、
[手動操作 & オートパイロット](/ja/development/webui/navigation/manual-and-autopilot) を参照。

## ロボットへの 2 つの経路 {#two-paths}

本ページは [メッセージ仕様 § 2 つの制御経路](/ja/development/message-contracts/#two-control-paths) で説明した
両方の経路を使う:

- **コマンドチャネル (HTTP → MQTT `system_command`)**: モードを変えるもの、可否の応答が必要なものすべて。
  マップを開く、カバレッジの開始・一時停止・停止、Auto Align、Manual Override、Autopilot、非常停止。
- **ストリーミングチャネル (rosbridge → MQTT `string/*`)**: ピンポイントとルートのゴール、WASD のテレオペ、
  operation supervisor への反映、ACK、キャンバスに描くすべてのオーバーレイ。

## MQTT コマンド: Navigation サブシステム {#mqtt-commands-navigation-subsystem}

| コマンド | 送信元 | ロボット上での処理 | 仕様 |
| --- | --- | --- | --- |
| `navigation.init` | データベースページからマップを開く、または本ページの自動再開 | `/map/retire`、`/switch_mode(navigation)`、続いて保存済みホームベースを `/initialpose` へ | [`navigation`](/ja/development/message-contracts/mqtt-commands#navigation) |
| `navigation.deactivate` | ナビゲーションを離れる(idle、マップ切り替え) | `/switch_mode(idle)`、`/map/reset` | 同上 |
| `navigation.pointstamped` | 現在のダッシュボードでは使われない | `/clicked_point` に publish | 同上 |

HTTP ボディの `map_id` と MQTT ペイロードの `map_name` は同じマップ ULID である。名前が変わるのは HTTP の境界だけだ。

::: warning ピンポイントは `pointstamped` ではない
単一・複数のピンポイント、ルート、ホームベースへの走行は rosbridge 経由の `move_base` ゴールである
([下記](#move-base-goals)参照)。`POST /api/navigation/pointstamped` は残っているが、ダッシュボードは呼ばない。
:::

## MQTT コマンド: Boustrophedon サブシステム {#mqtt-commands-boustrophedon-subsystem}

| コマンド | 送信元 | ペイロード | 仕様 |
| --- | --- | --- | --- |
| `boustrophedon.init` | Auto Coverage | `use_autocover: true` | [`boustrophedon`](/ja/development/message-contracts/mqtt-commands#boustrophedon) |
| `boustrophedon.init` | Custom Range Coverage | `use_autocover: false`、`polygon` | 同上 |
| `boustrophedon.init` | Operation Playlist | `use_autocover: false`、`areas`(cover エントリ、順序どおり)、`exclusions`(keep-out エントリ) | 同上 |
| `boustrophedon.pause` | 一時停止 / 再開 | `pause: true` または `false` | 同上 |
| `boustrophedon.deactivate` | Cancel / Finish | 走行と一致する `use_autocover` | 同上 |

これらのポリゴンを清掃パスに変えるアルゴリズムは
[ブストロフェドン網羅走行 & ゼロスピン位置合わせアーキテクチャ](/ja/development/ros/boustrophedon-and-alignment) にある。

## REST エンドポイント {#rest-endpoints}

| エンドポイント | 用途 | 仕様 |
| --- | --- | --- |
| `POST /api/navigation/init` | マップを開く。別ユニットが記録したマップは `404` で拒否 | [HTTP API](/ja/development/message-contracts/http-api#navigation-init) |
| `POST /api/navigation/deactivate` | ナビゲーションを離れる | [HTTP API](/ja/development/message-contracts/http-api#navigation-deactivate) |
| `POST /api/boustrophedon/init`、`/pause`、`/deactivate` | カバレッジ (`coverageApi.ts`) | [HTTP API](/ja/development/message-contracts/http-api#coverage) |
| `POST /api/autoalign/start`、`/status`、`/reset` | マップ同期の Auto Align (`autoAlignApi.ts`) | [HTTP API](/ja/development/message-contracts/http-api#autoalign) |
| `POST /api/manual`、`POST /api/autopilot` | `ManualAutopilotPanel` の 2 つのトグル | [HTTP API](/ja/development/message-contracts/http-api#manual) |
| `POST /api/emergency_stop` | 非常停止ボタン | [HTTP API](/ja/development/message-contracts/http-api#emergency-stop) |
| `POST /api/routes`、`GET /api/routes/:map_id`、`PUT`/`DELETE /api/routes/:id` | ルートの保存・読込・名前変更・削除(`route_name`、`map_id`、`route_points`) | [HTTP API](/ja/development/message-contracts/http-api#routes) |
| `/api/areas`、`/api/playlists` | カバレッジのエリアとプレイリスト | [HTTP API](/ja/development/message-contracts/http-api#areas) |
| `PUT /api/maps_data/homebase/:mapId` | Set Home Base | [HTTP API](/ja/development/message-contracts/http-api#map-homebase) |

## `move_base` ゴール {#move-base-goals}

ピンポイント、ルート、Return to Home Base、新しいホームベースへの走行は、すべて `public/script/Nav2D.js` で
作る `<root>/server/move_base` の roslibjs `ActionClient` を通る。クラウドのリレーは各ゴールとキャンセルを
`string/move_base/goal` と `/cancel` の JSON に変え、ロボットの `action_client.py` が `/move_base/goal` と
`/move_base/cancel` に戻す。

- 配送: そのゴールの status か result が届くまで、同じゴールを毎秒再送する。
- 完了: `/status` か `/result` から来た最初の終端コードで Arrived、Failed、Cancelled が決まる。
- すべての result は `string/move_base/result_ack` で ACK され、それまでロボットは result を再送する。

完全な仕様: [rosbridge § move_base アクションクライアント](/ja/development/message-contracts/rosbridge#move-base-action)、
[ブリッジトピック § ゴール](/ja/development/message-contracts/bridge-topics#json-goal)。

## ハートビートとリース {#heartbeat-lease}

本ページは毎秒 `page: "navigation"`、`claim: true` で `POST /api/hardware/ping` を送る。ユニット一覧の読み取り専用
`claim: false` とは異なり、離れるときには `release: true` を送る。応答がページを動かす:

- `robot_activity` と `active_page` はオペレーターの誘導とスタック検出に使う。
- `manual_override` と `autopilot` は [手動操作 & オートパイロット](/ja/development/webui/navigation/manual-and-autopilot)
  の 2 つのトグルに反映する。
- `in_use` と `origin_conflict` は、このタブがそもそもコマンドを出せるかを決める。
- `motion_locked` は `/emergency_pause` がロボットを止めていることを示す。
- `intended_mode` と `needs_recovery`(バックエンドが付加)が自動再開を起動する。

完全な仕様: [ハートビート & リース](/ja/development/message-contracts/heartbeat-and-lease)。

## Operation supervisor 同期 {#operation-sync}

本ページが始める走行はすべて `string/operation_sync` で `operation_supervisor.py` に反映される:

| ページの操作 | 同期メッセージ |
| --- | --- |
| Play、単一または複数ピンポイント | `batch`(`single_pinpoint` / `multi_pinpoint`、`route_mode`、`waypoints`)、ウェイポイントごとの `progress`、最後に `complete` |
| Pause、Stop | `pause`、`stop` |
| Autopilot オン / オフ | `batch` + `takeover`(スナップショットで確認)、`release` |
| Set Home Base の走行 | `homebase` の `batch`(記録のみ) |
| Auto Coverage、Custom Range、Playlist | `coverage`、`custom_coverage`、`playlist` の `batch`(記録のみ: カバレッジは既にロボット上で動く) |
| ページ読込、再接続 | `resync`、応答は `operation_snapshot` |

完全な仕様: [オペレーション同期](/ja/development/message-contracts/operation-sync)。

## ストリーミングテレメトリ {#streaming-telemetry}

キャンバスが描くものはすべて rosbridge 経由で届く。トピック名にはユニットの接頭辞(`<root>` = `/unit_<ULID>`)が
含まれる。1 本の rosbridge 接続がすべてのユニットを扱うので、ロボットを選ぶのはこの接頭辞である。

| rosbridge トピック | 型 | キャンバスでの役割 |
| --- | --- | --- |
| `<root>/server/robot_pose` | `geometry_msgs/Pose` | ロボットのアイコン、および [Show/Hide Trace](/ja/development/webui/navigation/coverage-cleaning) の元になる姿勢ストリーム |
| `<root>/server/slam/map` | `nav_msgs/OccupancyGrid` | マップ。次の送信を待たずマウント時に `string/map_request` で要求し、描画されるまで "Loading map from robot..." を表示。[ブリッジトピック § マップ配信](/ja/development/message-contracts/bridge-topics#map-delivery) 参照。 |
| `<root>/server/scan`、`<root>/server/scan_holes` | `sensor_msgs/LaserScan` | LiDAR の点、ライブの穴 |
| `<root>/server/hazard_cells` | `nav_msgs/Path` | 走行中の穴の軌跡 |
| `<root>/server/move_base/NavfnROS/plan`、`.../TebLocalPlannerROS/local_plan` | `nav_msgs/Path` | グローバル・ローカル計画の線 |
| `<root>/server/boustrophedon_path` | `nav_msgs/Path` | カバレッジパスのオーバーレイ。リビジョンごとに ACK |
| `<root>/server/skipped_waypoints`、`<root>/string/uncovered_regions` | `nav_msgs/Path`、`std_msgs/String` | カバレッジの取り残し |
| `<root>/string/operation_snapshot`、`<root>/string/operation_progress` | `std_msgs/String` | 走行の復元と supervisor の進捗 |

頻度はユニットの egress プロファイル(idle、watching、driving)による。
[ブリッジトピック § presence と egress プロファイル](/ja/development/message-contracts/bridge-topics#egress-profiles) を参照。
subscribe の詳細: [rosbridge § Subscribe](/ja/development/message-contracts/rosbridge#subscriptions)。

## 関連

- [メッセージ仕様 § ナビゲーションページ](/ja/development/message-contracts/#trace-navigation): ボタンごとの全メッセージ。
- [概要](/ja/development/webui/navigation/overview): ナビゲーションページと Mode List 全体。
- [マップ同期 & 位置合わせ](/ja/development/webui/navigation/map-sync-and-alignment): 姿勢補正と Auto Align。
- [カバレッジ清掃](/ja/development/webui/navigation/coverage-cleaning): ブストロフェドン機能。
- [ピンポイント & ルート](/ja/development/webui/navigation/pinpoint-and-routes): ピンポイント走行と保存ルート。
- [手動操作 & オートパイロット](/ja/development/webui/navigation/manual-and-autopilot): テレオペ、オートパイロット、復旧。
- [ブストロフェドン網羅走行 & ゼロスピン位置合わせアーキテクチャ](/ja/development/ros/boustrophedon-and-alignment):
  清掃アルゴリズムとその場回転ガード。
