---
outline: deep
search: false
---

# MQTT コマンド

<RoleBadge role="developer" />

コマンドチャネル([経路 A](/ja/development/message-contracts/#two-control-paths))です。クラウドからユニットへの
MQTT トピックが 1 つ、戻りが 1 つ。ダッシュボードが行うモード変更、開始、停止、保存、トグルはすべてここを通り、
[HTTP エンドポイント](/ja/development/message-contracts/http-api) に包まれています。

## トピック {#topics}

| MQTT トピック | 方向 | 送信側 | 受信側 | ロボットの ROS トピック |
| --- | --- | --- | --- | --- |
| `/unit_<ULID>/system_command` | クラウド → ロボット | `backend_node` | `system_command.py` | `/system_command` (`std_msgs/String`) |
| `/unit_<ULID>/system_feedback` | ロボット → クラウド | `system_command.py` | `backend_node` | `/system_feedback` (`std_msgs/String`) |

どちらも文字列ペイロードとして JSON ドキュメントを運びます。ユニットのローカルダッシュボードでは、ブラウザも
MQTT over WebSocket で 1 種類のフレームを直接 `system_command` に publish します:
[`hardware.heartbeat`](/ja/development/message-contracts/heartbeat-and-lease#heartbeat-frame)。

## コマンドエンベロープ {#command-envelope}

`backend_node` の `createMSDSystemData()` が組み立てます:

```json
{
  "header": "navigation",
  "command": "init",
  "config": {
    "resource": { "map_name": "01JZ8QK2H0000000000000MAP" }
  },
  "metadata": {
    "timestamp": "2026-08-12T04:11:52.913Z",
    "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10"
  }
}
```

| フィールド | 型 | 必須 | 意味 |
| --- | --- | --- | --- |
| `header` | string | はい | ロボット側のどのハンドラーか: `hardware`、`navigation`、`mapping`、`boustrophedon`、`autoalign`、`emergency_stop`、`manual`、`autopilot` |
| `command` | string | はい | そのハンドラー内の操作。未知の値はログに記録して破棄され、フィードバックは返りません(HTTP 呼び出しはタイムアウトします)。 |
| `config` | object | コマンドによる | パラメーター。通常は `config.resource` の下 |
| `data` | object | `hardware.ping` のみ | リースのフィールド |
| `metadata.request_id` | UUID v4 | はい | HTTP リクエストごとに発行され、フィードバックでそのまま返る |
| `metadata.timestamp` | ISO 8601 | はい | 送信側の時刻。トレース用のみ |

## フィードバックエンベロープ {#feedback-envelope}

```json
{
  "header": "navigation",
  "command": "init",
  "data": { "status": true, "message": "Navigation started" },
  "metadata": { "timestamp": 1786503112.913, "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10" }
}
```

| フィールド | 型 | 意味 |
| --- | --- | --- |
| `data.status` | boolean | `true` で完了、`false` で拒否または失敗。バックエンドは文字列 `"true"` も受け付けます。 |
| `data.message` | string | オペレーターに表示される、人が読める理由 |
| `metadata.timestamp` | float | ロボット時刻、`rospy.get_time()` の秒 |
| `metadata.request_id` | UUID v4 | コマンドからのコピー。コマンドになければ `"NaN"` |

バックエンドがこれを HTTP 応答に変える方法: [HTTP API § 応答エンベロープ](/ja/development/message-contracts/http-api#envelopes)。

## 相関とリトライ {#correlation-and-retry}

![コマンドの相関とリトライ](../../../development/message-contracts/diagrams/message-contracts-command-correlation-and-retry-architectu.drawio)

| パラメーター | 既定値 | 場所 | 意味 |
| --- | --- | --- | --- |
| `DEFAULT_TIMEOUT` | `30000` ms | `backend_node` | `504` を返すまで HTTP リクエストがフィードバックを待つ時間 |
| `COMMAND_RETRY_INTERVAL` | `1500` ms (env) | `backend_node` | フィードバックが来るまでの再送周期 |
| 重複排除の範囲 | 直近 512 個の `request_id` | `system_command.py` | 既知の `request_id` を持つ再送は再実行せず、キャッシュしたフィードバックを再送します |

バックエンドはフィードバックが届くまで **同一の** エンベロープ(同じ `request_id`)を再送します。ロボットは
各 `request_id` を一度だけ実行し、繰り返しにはキャッシュから応答するので、再送によって launch や保存が
やり直されることはありません。

::: danger `hardware.*` は重複排除されず、`ping` はリトライされない
失われた ping はウォッチドッグに届かなければならないため、ロボットは `header: "hardware"` のコマンドすべてで
重複排除を行いません。同じ理由でバックエンドは `hardware.ping` をリトライしません。その他の `hardware`
コマンド(`check`、`init`、`stop`、`idle`)はバックエンドがリトライするので、応答が遅いとロボットが複数回
実行することがあります。これらは繰り返しても安全なように書かれています。
:::

## コマンドカタログ {#catalogue}

各サブセクションには、動詞、ロボットが読むパラメーター、ROS 側の副作用を載せているので、コマンドをロボットの
スタックまで追跡できます。`/switch_mode` は `mode, open_rviz, use_simulator, map_file, point_mode, use_autocover`
を持つ `msd700_msgs/SwitchMode` です。[動的モード切り替え](/ja/development/ros/mode-switching) を参照。

### `hardware` {#hardware}

| コマンド | パラメーター | ロボット側 | 送信元 |
| --- | --- | --- | --- |
| `ping` | `data` のリースブロック | リース、ウォッチドッグ、状態報告 | [`POST /api/hardware/ping`](/ja/development/message-contracts/http-api#hardware-ping)。完全な仕様は [ハートビート & リース](/ja/development/message-contracts/heartbeat-and-lease#ping-request) |
| `heartbeat` | `{ "page": "navigation" }` | 2 秒の presence 段階だけを更新 | ブラウザ、MQTT over WebSocket、[5 Hz](/ja/development/message-contracts/heartbeat-and-lease#heartbeat-frame) |
| `check` | なし | `/hardware_node/check_hardware` (`Trigger`) | [`POST /api/hardware/check`](/ja/development/message-contracts/http-api#hardware-commands) |
| `init` | なし | `/hardware_node/init_all` (`SetBool`) | [`POST /api/hardware/init`](/ja/development/message-contracts/http-api#hardware-commands) |
| `stop` | なし | `/hardware_node/shutdown_all_hardware` (`SetBool`) | [`POST /api/hardware/stop`](/ja/development/message-contracts/http-api#hardware-commands) |
| `idle` | なし | `/switch_mode(mode=idle)`: ナビゲーション/マッピングを終了し、ロボットは電源オンのまま | [`POST /api/hardware/idle`](/ja/development/message-contracts/http-api#hardware-commands) |
| `battery_update` | `config.resource.value` | 報告するバッテリー残量を上書き | 現在の呼び出し元なし |

### `navigation` {#navigation}

```json
// init: マップを開いてナビゲーションを起動
{
  "header": "navigation",
  "command": "init",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "default_save_path": "/home/ubuntu/ros_maps",
      "homebase_x": 1.25, "homebase_y": -0.5, "homebase_z": 0.0,
      "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
    },
    "ensure_unpaused": true
  },
  "metadata": { "timestamp": "...", "request_id": "..." }
}

// pointstamped: 単一の点 (レガシー経路、下記参照)
{
  "header": "navigation",
  "command": "pointstamped",
  "config": { "resource": { "X": 3.1416, "Y": -1.2, "Z": 0.0 } },
  "metadata": { "timestamp": "...", "request_id": "..." }
}
```

| コマンド | パラメーター | ロボット側 |
| --- | --- | --- |
| `init` | `config.resource.map_name` (マップ ULID = `<ULID>.pgm/.yaml`)、マップにあれば `homebase_*`、`config.ensure_unpaused` | 残っていた手動操作を解除し、パスのオーバーレイとすべてのモーションロックを消去し、`/map/retire` を呼び([マップ配信](/ja/development/message-contracts/bridge-topics#map-delivery)参照)、ディスクになければメディアサーバーからマップファイルをダウンロードし、`/switch_mode(mode=navigation, map_file=<ULID>)` を呼び、ホームベースを `/initialpose` に publish します。アクティビティ `navigation_ready`。 |
| `deactivate` | なし | `/switch_mode(mode=idle)`、`/map/reset`。アクティビティ `idle`。 |
| `pointstamped` | `config.resource.X/Y/Z` | `/clicked_point` に `geometry_msgs/PointStamped` (`frame_id: map`) を publish。アクティビティ `navigation_point_published`。 |

`default_save_path` は古いロボットイメージのために今も送られます。現在のイメージは自身の `MAPS_FOLDER` を
使います。現在のダッシュボードのピンポイントナビゲーションは `pointstamped` を **使わず**、
[rosbridge](/ja/development/message-contracts/rosbridge#move-base-action) 経由で `move_base` ゴールを送ります。

HTTP の入口: [`/api/navigation/init`](/ja/development/message-contracts/http-api#navigation-init)、
[`/deactivate`](/ja/development/message-contracts/http-api#navigation-deactivate)、
[`/pointstamped`](/ja/development/message-contracts/http-api#navigation-pointstamped)。

### `mapping` {#mapping}

```json
// stop: マップを保存してアップロード
{
  "header": "mapping",
  "command": "stop",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "display_map_name": "Production Hall Level 1",
      "map_ulid": "01JZ8QK2H0000000000000MAP",
      "created_by": "01JZ7YV5CQUSER00000000000",
      "default_save_path": "/home/ubuntu/ros_maps",
      "unit_id": "01JZ8P9WZ0UNIT00000000000",
      "homebase_x": 1.2, "homebase_y": 0.5, "homebase_z": 0.0,
      "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
    }
  },
  "metadata": { "timestamp": "...", "request_id": "..." }
}
```

| コマンド | パラメーター | ロボット側 |
| --- | --- | --- |
| `start` | なし | ロボットがマップを保存できるか確認し、`/switch_mode(mode=explore)`。アクティビティ `mapping_active`。 |
| `pause` | なし | `operator_pause` モーションロック(`/emergency_pause`)を保持。SLAM セッションは開いたまま。アクティビティ `mapping_paused`。 |
| `stop` | 上のブロック | `/mapsaver/full_path` が `<map_name>.pgm/.yaml` を書き、[`/api/media/uploadMap`](/ja/development/message-contracts/http-api#media-server) でユニットのメディアサーバー(必須)とクラウド(ベストエフォート)にアップロードし、idle に切り替え。通常のフィードバックではなく [`mapping_progress`](#mapping-progress) で報告します。 |
| `discard` | なし | `mapping_teardown` ロックを保持、`/switch_mode(mode=idle)`、`/map/reset`。アクティビティ `idle`。 |

`map_name` と `map_ulid` は同じ ULID(ファイル名)で、`display_map_name` はオペレーターが入力した名前です。
HTTP の入口: [`/api/mapping`](/ja/development/message-contracts/http-api#mapping-control)、
[`/api/mapping/discard`](/ja/development/message-contracts/http-api#mapping-discard)。

#### `mapping_progress` {#mapping-progress}

保存は HTTP の 30 秒タイムアウトより長くかかるため、`mapping.stop` は HTTP 呼び出しにすぐ応答し、ロボットは
`header: "mapping_progress"` で `system_feedback` に報告します。バックエンドは各 `data` ブロックを
[SSE ストリーム](/ja/development/message-contracts/http-api#mapping-progress) に転送し、保留中のリクエストを
これで完了させることはありません。

```json
{
  "header": "mapping_progress",
  "command": "stop",
  "data": {
    "status": true,
    "progress": 100,
    "stage": "completed",
    "message": "Saved on the robot and the server.",
    "terminal": true,
    "outcome": "completed"
  },
  "metadata": { "timestamp": 1734000000.0, "request_id": "..." }
}
```

| `progress` | `stage` | 意味 |
| --- | --- | --- |
| 15 | `saving_map` | `map_saver` がファイルを書き込み中 |
| 30 | `map_saved` | ファイルがディスクにあり、アップロード準備中 |
| 50 | `uploading` | ユニットのメディアサーバーへアップロード中 |
| 85 | `upload_complete` または `cloud_pending` | ユニットに保存済み。クラウドのコピーは完了、または同期に委ねる |
| 95 | `switching_mode` | idle に戻る |
| 100 | `completed` | 最後のイベント (`terminal: true`) |
| -1 | `save_failed` | 最後のイベント、何も保存されていない |

`terminal` は最後のイベントだけ `true` で、`outcome` もそのイベントだけが持ちます:

| `outcome` | 意味 |
| --- | --- |
| `completed` | ユニットとクラウドに保存済み |
| `cloud_pending` | ユニットに保存済み。クラウドのコピーは [データ同期](/ja/development/data-sync) で後から |
| `failed` | どこにも保存されていない。SLAM セッションは再試行のため開いたまま |

古いロボットイメージは `stop` に通常の `header: "mapping"` フィードバックで応答します。バックエンドはそれを
1 つの終端進捗イベント(`100`/`completed` または `-1`/`error`)に変換します。

### `boustrophedon` {#boustrophedon}

```json
{
  "header": "boustrophedon",
  "command": "init",
  "config": {
    "use_autocover": false,
    "polygon": [],
    "areas": [
      [ { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 }, { "x": 10.0, "y": 5.0 }, { "x": 0.0, "y": 5.0 } ]
    ],
    "exclusions": [
      [ { "x": 3.0, "y": 2.0 }, { "x": 5.0, "y": 2.0 }, { "x": 5.0, "y": 4.0 }, { "x": 3.0, "y": 4.0 } ]
    ],
    "ensure_unpaused": true
  },
  "metadata": { "timestamp": "...", "request_id": "..." }
}
```

| コマンド | パラメーター | ロボット側 |
| --- | --- | --- |
| `init` | `use_autocover`。カスタムカバレッジでは `areas` + `exclusions`(プレイリスト、優先)または `polygon`(エリア 1 つ) | 手動操作とモーションロックを解除し、アクティビティ `boustrophedon_initializing`、`/switch_mode(mode=boustrophedon, use_autocover)`。プレイリストは JSON `{ areas, exclusions }` として `/msd700/coverage_plan` (`std_msgs/String`、latched) に、単一エリアは `geometry_msgs/Polygon` として `/msd700/coverage_polygon` に送られます。3 点未満のポリゴンは捨てられます。 |
| `pause` | `config.pause` (`true` で一時停止、`false` で再開) | `/path_coverage/pause` または `/path_coverage/resume` (`Empty`)。それらを持たない古いカバレッジノードでは `operator_pause` モーションロックにフォールバック。一時停止中のアクティビティは `paused`。 |
| `deactivate` | `config.use_autocover` (`init` と一致が必要) | `/move_base/cancel` でゴールをキャンセルし、計画とポリゴンを消去、`/path_coverage/cancel`、`/switch_mode(mode=stop_additional_feature)`。 |

生成されたパスは [`string/boustrophedon_path`](/ja/development/message-contracts/bridge-topics#topic-map) の
オーバーレイとして戻り、ブラウザが ACK します。ライフサイクルは `string/coverage_status` のプレーン文字列
(`running`、`complete`、`aborted`。キャンセルされた走行は何も publish しない)です。

HTTP の入口: [`init`](/ja/development/message-contracts/http-api#boustrophedon-init)、
[`pause`](/ja/development/message-contracts/http-api#boustrophedon-pause)、
[`deactivate`](/ja/development/message-contracts/http-api#boustrophedon-deactivate)。

### `autoalign` {#autoalign}

パラメーターなし。いずれも `data.status` と `data.message` で応答します。

| コマンド | ロボット側 |
| --- | --- |
| `start` | `/alignment/start` (`Trigger`): マップに対するロボット姿勢を求める。アクティビティ `auto_aligning`。 |
| `status` | `/check_alignment` (`Trigger`): 読み取りのみ、アクティビティは変わらない |
| `reset` | `/alignment/reset` (`Trigger`): 結果を破棄してナビゲーションに戻る |

HTTP の入口: [`/api/autoalign/*`](/ja/development/message-contracts/http-api#autoalign)。

### `emergency_stop` {#emergency-stop}

| コマンド | ロボット側 |
| --- | --- |
| `activate` | `/emergency_stop` に `std_msgs/Bool(true)` (latched)、`/switch_mode(mode=idle)`、`/map/reset`。アクティビティ `emergency_stopped`。 |
| `deactivate` | `/emergency_stop` に `std_msgs/Bool(false)`、`/move_base/cancel` で残っているゴールをキャンセル。動作スタックは再起動しません。アクティビティ `emergency_cleared`。 |

HTTP の入口: [`/api/emergency_stop`](/ja/development/message-contracts/http-api#emergency-stop)。

### `manual` {#manual}

テレオペは実行中のモードに重ねるオーバーレイで、`/switch_mode` を呼ばないためナビゲーションは起動したままです。
運転そのものは [`string/key_vel`](/ja/development/message-contracts/bridge-topics#json-twist) で届きます。

| コマンド | ロボット側 |
| --- | --- |
| `enable` | アクティブなゴールをキャンセルし、カバレッジを専用サービスで一時停止し、emergency-pause ロックを解除し、`/msd700/manual_state` を `true` にし、`/mux/key_vel` チャネル(twist_mux 優先度 90)を開きます。アクティビティ `manual`。 |
| `disable` | ゼロの twist を publish してチャネルを閉じ、ロボットを即座に止め、`/msd700/manual_state` を `false` にし、手動操作で一時停止したカバレッジなら再開し、以前のアクティビティに戻します。 |

HTTP の入口: [`/api/manual`](/ja/development/message-contracts/http-api#manual)。

### `autopilot` {#autopilot}

| コマンド | ロボット側 |
| --- | --- |
| `enable` | `/msd700/autopilot_state` を `true`: `operation_supervisor` がウェイポイントの送出を引き継ぎます([オペレーション同期](/ja/development/message-contracts/operation-sync)参照)。ping 途絶ウォッチドッグを停止し、ウォッチドッグ自身の保持だけを解除します。オペレーターの一時停止は解除しません。 |
| `disable` | `/msd700/autopilot_state` を `false`: 送出はブラウザのループに戻り、ping 途絶ウォッチドッグが再び有効になります。 |

HTTP の入口: [`/api/autopilot`](/ja/development/message-contracts/http-api#autopilot)。

## ロボットのアクティビティ値 {#robot-activity}

[ping 応答](/ja/development/message-contracts/heartbeat-and-lease#ping-response) の `robot_activity` は上記の
ハンドラーが設定します。ダッシュボードでよく見る値:

| 値 | 設定元 |
| --- | --- |
| `idle` | `hardware.idle`、`navigation.deactivate`、`mapping.discard` |
| `navigation_ready`、`navigation_point_published` | `navigation.init`、`navigation.pointstamped` |
| `mapping_active`、`mapping_paused` | `mapping.start`、`mapping.pause` |
| `boustrophedon_initializing`、`paused` | `boustrophedon.init`、`boustrophedon.pause` |
| `auto_aligning` | `autoalign.start` |
| `manual` | `manual.enable` |
| `emergency_stopped`、`emergency_cleared` | `emergency_stop.*` |
| `stuck` | スタック検出器 (コマンドではない) |
| `*_failed` (例: `mapping_failed`) | 対応するコマンドの失敗時 |

## 関連ドキュメント

- [HTTP API](/ja/development/message-contracts/http-api): これらのコマンドを送るエンドポイント。
- [状態と振る舞い](/ja/development/state-and-behavior): アクティビティとモードの遷移。
- [安全ウォッチドッグ](/ja/development/ros/safety-watchdog): `ping` と `heartbeat` が供給する段階。
