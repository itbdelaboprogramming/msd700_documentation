---
outline: deep
search: false
---

# メッセージ仕様

<RoleBadge role="developer" />

このドキュメントは、MSD700 システムにおけるすべてのマシン間データペイロードについて、完全かつ正典となる仕様を提供します。MQTT のコマンドおよびフィードバックチャネル、シリアライズされた ROS ストリーミングトピック、operation supervisor 同期プロトコル、WebRTC シグナリング、ハードウェア登録のやり取りを扱います。

HTTP サーフェスについては [API リファレンス](/ja/development/api-reference) を、有限状態機械については [State and Behavior](/ja/development/state-and-behavior) を、システム全体の設計については [アーキテクチャ](/ja/development/architecture) を参照してください。

::: info コントラクト検証に関する注意
ペイロードの形は、稼働中のソースコード(`backend_node`、`system_command.py`、`operation_supervisor.py`、`topic2string`、`enroll_api.js`)から直接導出されています。コードベース内でのフィールドの変更は、同じコミットでここも更新しなければなりません。
:::

## コミュニケーションサーフェス

MSD700 のマシン間インターフェースと、その契約がどこで規定されているかの一覧です。このページが
すべての正典です。HTTP と rosbridge の詳細は重複を避けるため、下の 2 つのリンク先ページが持ちます。

| サーフェス | トランスポート | 方向 | 契約 |
| --- | --- | --- | --- |
| コマンドとフィードバック | MQTT 3.1.1(TLS 8883) | cloud ↔ robot | [コマンド & コントロールチャネル](#コマンド-コントロールチャネル) |
| テレメトリ、オーバーレイ、ACK | MQTT → cloud ROS → rosbridge | robot → browser | [テレメトリとオーバーレイのトピック](#テレメトリとオーバーレイのトピック) |
| ウォッチドッグ ping / pong | MQTT(TLS 8883) | robot → cloud | [ウォッチドッグ Ping と Pong](#ウォッチドッグ-ping-と-pong) |
| Presence と egress プロファイル | robot ローカル ROS | robot 内部 | [Presence と Egress プロファイル](#presence-と-egress-プロファイル) |
| マップの配送と制御 | MQTT、robot ROS サービス | 双方向 | [マップの配送](#map-delivery) |
| Operation supervisor | MQTT | 双方向 | [Operation Supervisor 同期](#operation-supervisor-同期) |
| ロボット登録 | HTTPS(device secret) | robot → cloud | [ロボット登録ハンドシェイク](#ロボット登録ハンドシェイク) |
| ハードウェアリンク | rosserial(USB シリアル) | STM32 ↔ Jetson | [ファームウェアリンク(rosserial)](#ファームウェアリンク-rosserial) |
| WebRTC シグナリング | WSS | browser ↔ signalling_server | [WebRTC シグナリング](#webrtc-シグナリング) |
| カメラ映像 | WebRTC(SRTP) | robot → browser | [WebRTC シグナリング](#webrtc-シグナリング) |
| フリート HTTP API | HTTPS(REST) | browser / robot → cloud | [API リファレンス](/ja/development/api-reference) |
| rosbridge WebSocket | WSS | browser ↔ cloud ROS | [rosbridge プロトコル](/ja/development/rosbridge-protocol) |
| メディア資産 | HTTPS | browser ↔ media-server | [メディアサーバーリファレンス](/ja/development/webui/database/media-server-reference) |

## フリートアドレス指定方式

すべての物理ロボットは一意のプレフィックス `/unit_<ULID>/...` でアドレス指定されます。ULID(Universally Unique Lexicographically Sortable Identifier)は、登録時に中央の `units` データベーステーブルでそのロボットに割り当てられる主キーです。

![フリートアドレス指定方式](../../development/diagrams/message-contracts-fleet-addressing-scheme.drawio)

| ホップの場所 | トピック形式 | エンジニアリング上の目的 |
| --- | --- | --- |
| **ロボットのローカル ROS Master** | `/string/robotpose` | スコープのないローカル名前空間(オンボードの roscore ごとにロボット1台)。 |
| **中央 MQTT ブローカー** | `/unit_<ULID>/string/robotpose` | HiveMQ 上ですべてのロボットを多重化する、フリートスコープのトピック名前空間。 |
| **クラウド ROS Master** | `/unit_<ULID>/string/robotpose` | ユニット単位のクラウドリレーと rosbridge が消費する、名前空間化されたトピック。 |

::: warning 必須の `unit_` プレフィックスルール
ROS のグラフリソース名は、アルファベット文字、チルダ、またはスラッシュで始まらなければなりません。ULID は数字で始まる(例: `01JZ...`)ため、`/01JZ.../string/map` は無効な構文であり ROS によって拒否されます。`unit_` プレフィックスは、MQTT トピックとの 1:1 マッピングを維持しながら、厳格な ROS 準拠を保証します。
:::

## コマンド & コントロールチャネル

2つの専用 MQTT トピックが、クラウドサーバーと物理ユニットの間のすべての双方向リクエスト・レスポンスのやり取りを処理します。

| MQTT トピック | 方向 | プロデューサーノード | コンシューマーノード | 説明 |
| --- | --- | --- | --- | --- |
| `/unit_<ULID>/system_command` | クラウドからロボットへ | `backend_node`(Express) | `system_command.py`(ROS) | 制御コマンド、ナビゲーションゴール、モード変更をディスパッチする。 |
| `/unit_<ULID>/system_feedback` | ロボットからクラウドへ | `system_command.py`(ROS) | `backend_node`(Express) | 実行ステータス、エラーメッセージ、テレメトリ ping を返す。 |

### コマンドペイロードのエンベロープ

```json
{
  "header": "navigation",
  "command": "pointstamped",
  "config": {
    "resource": {
      "X": 3.1416,
      "Y": -1.2,
      "Z": 0.0
    }
  },
  "metadata": {
    "timestamp": "2026-08-12T04:11:52.913Z",
    "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10"
  }
}
```

| フィールド名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `header` | string | Yes | 対象サブシステムハンドラー: `hardware`、`navigation`、`mapping`、`boustrophedon`、`manual`、`autopilot`、`emergency_stop`、`autoalign`。 |
| `command` | string | Yes | ハンドラー内の具体的なアクション動詞。認識されない動詞はログに記録され破棄される。 |
| `config` | object | Conditional | コマンドパラメータ(通常は `config.resource` の中)。 |
| `data` | object | Conditional | `hardware.ping` が使用する代替パラメータブロック。 |
| `metadata.request_id` | UUID v4 | Yes | `backend_node` によって HTTP リクエストごとに生成される一意の相関トークン。 |
| `metadata.timestamp` | ISO 8601 | Yes | 診断トレース用の送信者タイムスタンプ文字列。 |

### フィードバックペイロードのエンベロープ

```json
{
  "header": "navigation",
  "command": "pointstamped",
  "data": {
    "status": true,
    "message": "Goal published to move_base"
  },
  "metadata": {
    "timestamp": 1786503112.913,
    "request_id": "0b0d1f4e-6a2c-4c7e-9a51-1f1b6f7a2f10"
  }
}
```

| フィールド名 | 型 | 説明 |
| --- | --- | --- |
| `data.status` | boolean | `true` はコマンドが受理/実行されたことを示し、`false` は実行が拒否されたことを示す。 |
| `data.message` | string | ロボットからの人間が読める診断説明。 |
| `metadata.timestamp` | float | ロボットからのウォールクロックのエポック秒(`rospy.get_time()`)。 |
| `metadata.request_id` | UUID v4 | コマンドエンベロープの元の `request_id` と一致する。 |

### コマンドの相関とリトライアーキテクチャ

![コマンドの相関とリトライアーキテクチャ](../../development/diagrams/message-contracts-command-correlation-and-retry-architectu.drawio)

| パラメータ | デフォルト値 | 設定場所 | 目的 |
| --- | --- | --- | --- |
| `DEFAULT_TIMEOUT` | `30000` ms(30秒) | `backend_node` | `504 Gateway Timeout` で応答する前に、HTTP リクエストがフィードバックを待つ最大時間。 |
| `COMMAND_RETRY_INTERVAL` | `1500` ms(1.5秒) | `backend_node` | 状態を変更するコマンドが確認応答されないままである間の再送周期。 |

::: danger Ping ハートビートの除外
`header: "hardware", command: "ping"` は各間隔につき厳密に**1回だけ**送信され、決してリトライされません。ハートビートの喪失は、ロボットのセーフティウォッチドッグの主要なトリガーです。失われた ping をリトライすると、ネットワークの断絶を覆い隠し、自動緊急停止メカニズムを無効化してしまいます。
:::

## コマンドリファレンスカタログ

### 1. ハードウェアサブシステム(`header: "hardware"`)

```json
// Command: "check"
{ "header": "hardware", "command": "check", "metadata": { ... } }

// Command: "idle"
{ "header": "hardware", "command": "idle", "metadata": { ... } }
```

| コマンド動詞 | ペイロード内容 | 目的 |
| --- | --- | --- |
| `ping` | [ハートビート Ping セクション](#ハートビート-ping-とリース契約)参照 | ハートビート、リースの取得、テレメトリの取得、ウォッチドッグのリフレッシュ。 |
| `heartbeat` | `{ "page": "navigation" }`のみ。ブラウザが5 Hz、QoS 0でMQTT over WebSocket経由でユニットのMosquittoへ直接送信(ローカルダッシュボードのみ) | 2秒ウォッチドッグ階層向けの在席証明。権限は一切与えない: リース、claim/release、`origin`、フィードバックなし。[セーフティウォッチドッグ](/ja/development/ros/safety-watchdog#_2つの在席シグナル)参照。 |
| `check` | なし | 低レベルのモータードライバーとマイクロコントローラーのステータスを問い合わせる。 |
| `init` | なし | ハードウェアインターフェースと電源ラインを初期化する。 |
| `stop` | なし | ハードウェア周辺機器と電源段をシャットダウンする。 |
| `idle` | なし | ロボットに電源を入れたまま、稼働中のナビゲーション/マッピングノードを終了する。 |
| `battery_update` | `{ "config": { ... } }` | 電源テレメトリのレベルを手動で更新する。 |

### 2. ナビゲーションサブシステム(`header: "navigation"`)

```json
// Command: "init"
{
  "header": "navigation",
  "command": "init",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "default_save_path": "/home/ubuntu/ros_maps",
      "homebase_x": 1.25,
      "homebase_y": -0.5,
      "homebase_z": 0.0,
      "homebase_ox": 0.0,
      "homebase_oy": 0.0,
      "homebase_oz": 0.0,
      "homebase_ow": 1.0
    }
  },
  "ensure_unpaused": true
}

// Command: "pointstamped" (Single Goal)
{
  "header": "navigation",
  "command": "pointstamped",
  "config": {
    "resource": { "X": 3.1416, "Y": -1.2, "Z": 0.0 }
  }
}
```

- `map_name`: ディスク上の `<ULID>.pgm` および `<ULID>.yaml` に対応するマップ ULID の識別子。
- `ensure_unpaused: true`: ナビゲーションを開始する際に、残っている `/emergency_pause` ロックを自動的に解除するようロボットに指示する。
- `command: "deactivate"`: アクティブなナビゲーションスタックを終了する(ペイロードは受け取らない)。

### 3. マッピングサブシステム(`header: "mapping"`)

```json
// Command: "stop" (Save and Upload Map)
{
  "header": "mapping",
  "command": "stop",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "display_map_name": "Production Hall Level 1",
      "map_ulid": "01JZ8QK2H0000000000000MAP",
      "created_by": "01JZ7YV5CQUSER00000000000",
      "unit_id": "01JZ8P9WZ0UNIT00000000000",
      "homebase_x": 1.2,
      "homebase_y": 0.5,
      "homebase_z": 0.0,
      "homebase_ox": 0.0,
      "homebase_oy": 0.0,
      "homebase_oz": 0.0,
      "homebase_ow": 1.0
    }
  }
}
```

マッピングのコマンド動詞:

| コマンド動詞 | ペイロード | 目的 |
| --- | --- | --- |
| `start` | なし(`metadata` のみ) | マップを保存できるかを確認したうえで SLAM 実行を開始する。 |
| `pause` | なし | モーションロックを保持する。SLAM セッションは開いたまま。 |
| `stop` | 上の `config.resource` ブロック | マップをローカルに保存し、クラウドへ送り、下の進捗ストリームで報告する。 |
| `discard` | なし | 保存せずにロボットを `idle` へ切り替え、SLAM セッションを破棄する。 |

SLAM マップの保存には、標準の30秒 HTTP タイムアウトより長い時間がかかります。そのため `mapping stop` は、`{ request_id, map_ulid }` を伴う HTTP 200 を即座に返します。フロントエンドは進捗を監視するために `GET /api/mapping/progress/:request_id` の SSE ストリームへ接続します。

#### マッピング進捗フィードバック(`header: "mapping_progress"`)

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
  "metadata": {
    "timestamp": 1734000000.0,
    "request_id": "..."
  }
}
```

| Outcome の値 | 説明 |
| --- | --- |
| `completed` | ローカルユニットの media-server とクラウドサーバーの両方への書き込みに成功した。 |
| `cloud_pending` | ローカルユニットの media-server にのみ書き込まれた。クラウドへのレプリケーションは次回の同期間隔で完了する。 |
| `failed` | マッピングの保存に失敗した。セッションはリトライのために開いたままになる。 |

### 4. ボウストロフェドン・エリアカバレッジ(`header: "boustrophedon"`)

```json
// Command: "init"
{
  "header": "boustrophedon",
  "command": "init",
  "config": {
    "use_autocover": false,
    "polygon": [
      { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 },
      { "x": 10.0, "y": 5.0 }, { "x": 0.0, "y": 5.0 }
    ],
    "areas": [
      [ { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 }, { "x": 10.0, "y": 5.0 }, { "x": 0.0, "y": 5.0 } ]
    ],
    "exclusions": [
      [ { "x": 3.0, "y": 2.0 }, { "x": 5.0, "y": 2.0 }, { "x": 5.0, "y": 4.0 }, { "x": 3.0, "y": 4.0 } ]
    ],
    "ensure_unpaused": true
  }
}
```

- `areas`: 対象の運用プレイリストを構成する、順序付きポリゴンの配列。
- `exclusions`: カバレッジスイープから差し引かれる keep-out 障害物ゾーン。
- `command: "pause"`: `{ "pause": true }` または `{ "pause": false }` を受け取る。
- `command: "deactivate"`: カバレッジプランニングを停止する。

### 5. オートアライン(`header: "autoalign"`)

ペイロードなし(`metadata` のみ)のコマンドで、それぞれ `data.status` / `data.message` を返します。

| コマンド動詞 | 目的 |
| --- | --- |
| `start` | `/alignment/start` サービスを呼び、マップに対するロボット姿勢を求める。アクティビティを `auto_aligning` にする。 |
| `reset` | `/alignment/reset` を呼び、解を破棄してナビゲーションへ戻る。 |
| `status` | `/check_alignment` を呼ぶ読み取り専用クエリ。アクティビティは変わらない。 |

### 6. 緊急停止(`header: "emergency_stop"`)

| コマンド動詞 | ペイロード | 目的 |
| --- | --- | --- |
| `activate` | なし | 緊急停止トピックへ `std_msgs/Bool(true)` を publish し、スタックを `idle` へ切り替え、`/map/reset` を呼ぶ。 |
| `deactivate` | なし | `std_msgs/Bool(false)` を publish して停止を解除する。モーションスタックは再起動しない。 |

### 7. マニュアルオーバーライド(`header: "manual"`)

テレオペは非破壊の制御オーバーレイです。`/switch_mode` を **呼ばない** ため、ナビゲーションスタックは
生きたままです。ブラウザーは `/unit_<ULID>/string/key_vel` で `Twist` を送ります
([テレメトリとオーバーレイのトピック](#テレメトリとオーバーレイのトピック) を参照)。

| コマンド動詞 | ペイロード | 目的 |
| --- | --- | --- |
| `enable` | なし | 自律移動をキャンセルし(カバレッジは独自サービスで一時停止)、緊急一時停止ロックを解除し、マニュアル mux チャネルを開く。 |
| `disable` | なし | マニュアル mux チャネルをゼロにして解放するため制御を手放した瞬間にロボットが止まり、その後、以前のアクティビティへ戻す。 |

### 8. オートパイロット(`header: "autopilot"`)

| コマンド動詞 | ペイロード | 目的 |
| --- | --- | --- |
| `enable` | なし | ウェイポイントの順序制御を `operation_supervisor` へ渡し、ping-loss ウォッチドッグを一時停止する。解放するのはウォッチドッグ自身の保持のみで、オペレーターの一時停止は決して解放しない。 |
| `disable` | なし | 順序制御をブラウザーループへ戻し、ping-loss ウォッチドッグを再び有効にする。 |

## ハートビート Ping とリース契約

ハートビート ping メッセージは、ロボットの operating lease、セーフティウォッチドッグタイマー、ステータステレメトリを管理します。

### リクエストペイロード(`data` ブロック)

```json
{
  "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
  "user_id": "01JZ7YV5CQUSER00000000000",
  "claim": true,
  "release": false,
  "page": "navigation",
  "origin": "cloud",
  "force_takeover": false
}
```

| パラメータ | 出所 | 説明 |
| --- | --- | --- |
| `session_id` | ブラウザタブ | ブラウザタブごとの一意な UUID。 |
| `user_id` | バックエンドの JWT | サーバーバックエンドによって、認証された JWT トークンから厳密に抽出される。 |
| `claim` | ブラウザ | 運用ページ(Navigation、Mapping)からは `true`。読み取り専用のフリート一覧を閲覧している場合は `false`。 |
| `release` | ブラウザ | ページを離れる際に operating lease を明示的に解放する。 |
| `page` | ブラウザ | 起点となったページ: `dashboard`、`login`、`navigation`、`mapping`。 |
| `origin` | バックエンドの環境設定 | サーバー設定によって決まる `cloud` または `local`。 |
| `force_takeover` | ブラウザ | オペレーターが既存のリースの引き継ぎを確認したときに `true`。 |

### レスポンスペイロード(`data` ブロック)

```json
{
  "status": true,
  "robot_activity": "navigation_point_published",
  "active_page": "navigation",
  "battery": 87.5,
  "uptime": 42.3,
  "hw_status": "ready",
  "manual_override": false,
  "autopilot": false,
  "active_map_id": "01JZ8QK2H0000000000000MAP",
  "in_use": false,
  "in_use_by": null,
  "origin_conflict": false,
  "origin_conflict_side": null
}
```

| レスポンスフィールド | 説明 |
| --- | --- |
| `robot_activity` | フィルタリングされたアクティビティ状態(例: `idle`、`navigating`、`mapping`、`stuck`)。 |
| `active_page` | stuck-detector の評価前の、生のアクティブページ。正しいルーティングを保証する。 |
| `battery` | バッテリー残量のパーセンテージ(float)。 |
| `uptime` | システムのアップタイム(分)。 |
| `hw_status` | ハードウェア監視サブシステムが報告するステータス(`ready`、`fault`)。 |
| `manual_override` | 手動テレオペモードが有効なとき `true`。 |
| `autopilot` | 自律 autopilot シーケンサーがアクティブなとき `true`。 |
| `in_use` | アカウントレベルのロック: 別のユーザーアカウントがリースを保持していることを示す。 |
| `origin_conflict` | セッションレベルの競合: 同じアカウントの別のタブがアクティブであることを示す。 |

## テレメトリとオーバーレイのトピック

テレメトリは、ユニット上で `topic2string` によって JSON 文字列にシリアライズされ、MQTT 経由で
ルーティングされ、サーバー上で `rosbridge` 向けに型付き ROS メッセージへ変換し戻されます。
ブラウザーがこれらのために MQTT を話すことはありません。`rosbridge` 経由で購読します
([rosbridge プロトコル](/ja/development/rosbridge-protocol) を参照)。

![ストリーミングテレメトリトピック](../../development/diagrams/message-contracts-streaming-telemetry-topics.drawio)

### テレメトリストリームの定義

| ロボット側トピック | クラウドサーバー側トピック | 更新レート | 内容の説明 |
| --- | --- | --- | --- |
| `/string/robotpose` | `/unit_<ULID>/server/robot_pose` | 25 Hz | `map` フレームにおけるロボットの位置と姿勢(`geometry_msgs/PoseStamped`)。 |
| `/string/map` | `/unit_<ULID>/server/slam/map` | 変化時 + ハートビート | 圧縮された占有グリッド。セルを生の int8 のまま詰めた `base64(zlib(M1))`。旧来の `base64(zlib(JSON))` 形式もデコーダは受け付ける。[マップの配送](#map-delivery)を参照。 |
| `/string/laserscan` | `/unit_<ULID>/server/scan` | 2 Hz | 圧縮された2Dレーザースキャンデータ(`sensor_msgs/LaserScan`)。 |
| `/string/move_base/NavfnROS/plan` | `/unit_<ULID>/server/move_base/NavfnROS/plan` | プラン時 | グローバルパスの座標(`nav_msgs/Path`)。 |
| `/string/move_base/TebLocalPlannerROS/local_plan` | `/unit_<ULID>/server/move_base/TebLocalPlannerROS/local_plan` | 継続的 | ローカル軌跡(`nav_msgs/Path`)。 |
| `/string/boustrophedon_path` | `/unit_<ULID>/server/boustrophedon_path` | プラン時 | カバレッジスイープラインの座標(`nav_msgs/Path`)。 |
| `/string/operation_snapshot` | `/unit_<ULID>/string/operation_snapshot` | ラッチ | 再接続時の復旧のための、完全なアクティブミッションのスナップショット。 |

レートはノードの既定値です。いくつかは `topic2string/config/egress.yaml` の egress プロファイル
(idle / watching / driving)ごとにゲートされます。[Presence と Egress プロファイル](#presence-と-egress-プロファイル)を参照。

### ブリッジトピックの全体マップ

クラウドリレー(`gen_bridge_params.py` / `nakayama_cloud_multi.launch`)は、下のトピックをフリート
内のすべてのユニットへ、per-unit ブリッジと同じ名前で運びます。特に断りのない限り、ペイロードは
`std_msgs/String` 内の JSON 文字列です。

ロボット → クラウド:

| トピック(`/unit_<ULID>/...`) | 内容 | リレーでラッチ |
| --- | --- | --- |
| `string/robotpose` | `map` フレームの姿勢。 | いいえ |
| `string/map` | 圧縮された占有グリッド([マップの配送](#map-delivery)を参照)。 | はい |
| `string/laserscan` | 圧縮された2Dレーザースキャン。 | いいえ |
| `string/laserscan_holes` | スキャン上に描く穴 / 段差オーバーレイ。 | いいえ |
| `string/hazard_cells` | 今回の実行の累積的な穴の軌跡。 | はい |
| `string/move_base/NavfnROS/plan` | グローバルプランのオーバーレイ。 | はい |
| `string/move_base/TebLocalPlannerROS/local_plan` | ローカル軌跡のオーバーレイ。 | はい |
| `string/boustrophedon_path` | カバレッジパスのオーバーレイ(累積)。 | はい |
| `string/coverage_debug` | カバレッジプランナーの診断。 | はい |
| `string/uncovered_regions` | 未スイープ領域。 | はい |
| `string/coverage_status` | カバレッジのライフサイクルイベント。 | はい |
| `string/move_base/status` | ゴールステータスのストリーム(`actionlib_msgs/GoalStatusArray`)。 | いいえ |
| `string/move_base/result` | ゴール結果。信頼配送は `result_ack` で閉じる。 | いいえ |
| `string/operation_progress` | Operation supervisor の進捗。 | いいえ |
| `string/operation_snapshot` | ラッチされた完全な操作スナップショット。 | はい |
| `string/skipped_waypoints` | 実行が到達できなかったウェイポイント。 | いいえ |
| `server/pong` | ウォッチドッグの応答([ウォッチドッグ Ping と Pong](#ウォッチドッグ-ping-と-pong) を参照)。 | いいえ |

クラウド → ロボット:

| トピック(`/unit_<ULID>/...`) | 内容 | 備考 |
| --- | --- | --- |
| `server/ping`(MQTT `msd/ping`) | ウォッチドッグ ping。唯一の非対称ペアで、ROS 名は `server/ping`、MQTT 名は `msd/ping`。 | 下記参照 |
| `string/move_base/goal` | ナビゲーションゴール。 | |
| `string/move_base/cancel` | アクティブなゴールをキャンセル。 | |
| `string/initialpose` | AMCL の初期姿勢をリセット。 | |
| `string/move_base/result_ack` | `move_base/result` の信頼性 ACK。 | |
| `string/boustrophedon_path_ack` | カバレッジパスの信頼性 ACK。 | |
| `string/key_vel` | 手動テレオペの `Twist`(JSON、WASD)。 | 0.5 秒のタイムアウトでロボットをゼロにする |
| `string/operation_sync` | Operation supervisor の batch/progress/takeover。 | [Operation Supervisor 同期](#operation-supervisor-同期)を参照 |
| `string/map_request` | 「マップがないので送ってほしい」(プルチャネル)。 | ロボット側でレート制限 |

## ウォッチドッグ Ping と Pong

`hardware.ping` コマンドとは別に、ロボットはクラウドがユニットをオンラインと判定するための
presence ping を定期的に publish します。ロボット側では ROS `/msd/ping`、クラウド側のブリッジは
ROS `/unit_<ULID>/server/ping` を MQTT `/unit_<ULID>/msd/ping` へマップし(ブリッジで唯一の非対称
ペア)、応答は `/unit_<ULID>/server/pong` として戻ります。per-unit の正確なマッピングは
`aws_mqtt/launch/nakayama_msd.launch` と `nakayama_cloud.launch` にあり、フリートリレーは
`gen_bridge_params.py` でそれを再現します。

## Presence と Egress プロファイル

アイドル状態のロボットが帯域を浪費しないよう、`system_command.py` はロボットローカルの
`/msd700/viewers` トピックへ、`idle` / `watching` / `driving` のいずれかのプロファイルを持つ
ラッチされた `std_msgs/String` を毎秒 1 回 publish します。これはユニットから出ません。
`topic2string` の `presence_gate.py` がこれを読み、`topic2string/config/egress.yaml` に従って
egress を絞ります(例えば `laserscan` はアイドル時 0 Hz、マップのハートビートは 300 秒へ延び、
プランナーのオーバーレイは完全に止まります)。信号がない、または古い場合、すべてのゲートは
フルレートで fail-open します。

### マップの配送 {#map-delivery}

マップはこのリンク上で最大のペイロードであり、かつオペレーターがそれなしでは作業できない唯一の
データです。そのため、単純に繰り返し送るということをしない唯一のストリームになっています。ロボッ
トはグリッドをコンテンツハッシュし、実際に変化したときだけ送信します。加えて、誰かが見ている間は
60 秒ごと、誰も見ていない間は 300 秒ごとのハートビートを送ります。ナビゲーションモードではグリッ
ドは `map_server` 由来で一切変化しないため、実際にはハートビートごとに 1 通だけになります。

つまり、ブラウザが絶対に必要とするものを、QoS 0 でブローカーの retain もないホップ上の 1 通の
メッセージが運ぶことになります。それを成立させる仕組みが 3 つあり、どれも省略できません。

| 仕組み | 場所 | カバーする範囲 |
| --- | --- | --- |
| クラウド側リレーが `/unit_<ULID>/string/map` をラッチする | `aws_mqtt/scripts/gen_bridge_params.py` | 2 回の送信の間に接続してきたブラウザ、およびリレーの再起動(フリートのロスターが変わるたびに発生します)。 |
| マップのリセットまたはリタイア後に `burst_interval` 間隔で `burst_sends` 回繰り返す | `topic2string/src/nodelets/map_compression.cpp` (Python twin: `scripts/map_compression_pipeline.py`) | オペレーターが今開いたばかりのマップ。ちょうどロボットがナビゲーションスタックを再起動している最中に配送されます。新しいマッピングの開始もカバーされます。 |
| プルチャネル `/string/map_request` | ブラウザからロボットへ、ACK トピックと同じ経路 | それ以外のすべて。パケット落ち、悪いタイミングでマウントしたダッシュボード、トピック型の学習中に最初のメッセージを飲み込んだローカルモードのリレーなど。 |

ダッシュボードは Navigation キャンバスがマウントされた時点で `/unit_<ULID>/string/map_request` に
`std_msgs/String` を publish し、マップが描画されるまで要求を繰り返します。ロボット側は要求をレート
制限する(`request_min_interval`、既定 2 秒)ため、1 台のユニットに複数タブがあっても追加送信は
タブごとではなく 1 通で済みます。

**0x0 のグリッドは壊れたメッセージではありません。** ロボットは、リレーがラッチしているグリッドを
引退させるためにこれを publish します。これがないと、たった今 *別の* マップを開いたダッシュボードに
前のセッションの部屋が渡され、それを何の疑いもなく描画してしまいます。キャンバスはこれを「まだマッ
プがない」として扱い、読み込み中であることを表示して新しいマップを要求します。

コンプレッサーは 2 つのサービスを advertise します。両者の違いは、どちらの状況なのかという点です。

| サービス | 呼び出し元 | 効果 |
| --- | --- | --- |
| `/map/reset` | マッピングの停止・破棄、ナビゲーションの停止、緊急停止 | ロボットが自分のマップを忘れます。ダッシュボードがすでに描画しているものには触れません。オペレーターはそのページから離れる途中であり、キャンバスを白紙にしても得るものがないためです。 |
| `/map/retire` | `navigation.init` のみ | 上記に加えて 0x0 のセンチネルを送ります。ラッチされたコピーが実際に誤りであるのは、別のマップが開かれたこの 1 ケースだけです。 |

どちらもバーストを armed にします。`/map/retire` を持たない古いロボットでは通常のリセットに
フォールバックするため、ローリングデプロイで失われるのは古いマップの修正であって、リセット自体では
ありません。

::: warning
上記 3 つの仕組みがすべて揃っていることを確認せずに、`topic2string/config/egress.yaml` の
`change_heartbeat` を長くしないでください。変化時送信だけでどれも無い状態では、送信を逃した
ダッシュボードは次の 1 通まで実測で約 52 秒待たされました。
:::

## Operation Supervisor 同期

`operation_supervisor.py` はロボット上で自律ミッションの実行を管理し、ブラウザタブが閉じられてもミッションが中断なく継続するようにします。

![Operation Supervisor 同期](../../development/diagrams/message-contracts-operation-supervisor-synchronization.drawio)

### Operation Sync ペイロード(`/string/operation_sync`)

```json
{
  "type": "batch",
  "operation": "multi_pinpoint",
  "route_mode": "round-trip",
  "waypoints": [
    {
      "position": { "x": 1.0, "y": 2.0, "z": 0.0 },
      "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
    },
    {
      "position": { "x": 4.5, "y": 2.0, "z": 0.0 },
      "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
    }
  ],
  "current_index": 0,
  "map_name": "01JZ8QK2H0000000000000MAP",
  "coverage": null,
  "timestamp": 1786503112.913
}
```

| アクションタイプ(`type`) | 目的 |
| --- | --- |
| `batch` | ミッション開始時に完全なウェイポイントシーケンスをアップロードする。 |
| `progress` | オペレーター主導の run 中に現在のウェイポイントインデックスを更新する。 |
| `takeover` | Autopilot モードを起動し、ウェイポイントのシーケンシングを supervisor に引き渡す。 |
| `release` | Autopilot モードを解除し、制御をブラウザのループへ戻す。 |
| `pause` | ウェイポイントキューを保持したまま実行を一時停止する。 |
| `stop` | ミッションを停止し、ウェイポイントバッチをクリアする。 |
| `resync` | ミッションスナップショットの即時再ブロードキャストを要求する。 |

## WebRTC シグナリング

シグナリングサーバー(`signalling_server`、`wss://<host>/services/signalling`)は、ブラウザーピアと
カメラピア(`camera_client.py`)の間の WebRTC ネゴシエーションを中継します。クライアントは認証後、
各メッセージに `type` と `target`(ピア id)を付けて送り、サーバーはそのピアへ転送します。この
チャネルにメディアは流れません - SDP と ICE のみです。

| `type` | 方向 | ペイロード | 目的 |
| --- | --- | --- | --- |
| `authenticate` | client → server | `{ type, token }` | 最初のメッセージ。サーバーは JWT を検証し、`auth_success`(`userId`)または `auth_error` を返す。 |
| `offer` | peer → target | `{ type, target, offer }` | SDP オファー。 |
| `answer` | peer → target | `{ type, target, answer }` | SDP アンサー。 |
| `candidate` | peer → target | `{ type, target, candidate }` | ICE 候補。 |
| `client_ready` | peer → target | `{ type, target, ... }` | 準備完了のビーコン。target へ転送される。 |
| `ping` | client → server | `{ type }` | キープアライブ。サーバーは `{ type: "pong" }` を返す。 |
| `error` | server → client | `{ type, message }` | 中継または検証のエラー。 |
| `server_shutdown` | server → all | `{ type, message }` | シャットダウンの通知。 |

カメラピアは `offer` に対し、ロボットのカメラから SRTP でローカル映像を返します。デバイスと
ビットレートの挙動は [Camera Streaming](/ja/development/webui/camera/overview) を参照してください。

## ファームウェアリンク(rosserial)

STM32H7 ファームウェア(`firmware-msd700`)は、USB シリアル上の rosserial で Jetson と通信します。
トピックは 2 つで、どちらも `msd700_msgs` です:

| トピック | 方向 | 型 | 内容 |
| --- | --- | --- | --- |
| `/hardware_state` | STM32 → Jetson | `msd700_msgs/HardwareState` | 8 つの超音波距離、左右モーターのパルス差分、heading/pitch/roll、加速度/ジャイロ/磁気の三軸、UWB の distance/deviation/rho/theta。 |
| `/hardware_command` | Jetson → STM32 | `msd700_msgs/HardwareCommand` | `movement_command`、`cam_angle_command`、`right_motor_speed`、`left_motor_speed`。 |

これは `hardware` コマンドハンドラの低レベル側です。`hardware.check`、`hardware.init`、
`hardware.stop` がこのリンクを駆動し、`hardware_state` がロボットのオドメトリとセンサーフュージョン
へ供給します。

## ロボット登録ハンドシェイク

未登録のロボットは、安全な3段階の暗号学的ハンドシェイクを経てクラウドサーバーへ自己登録します。

![ロボット登録ハンドシェイク](../../development/diagrams/message-contracts-robot-enrolment-handshake.drawio)

::: tip Nonce によるセキュリティの目的
32バイトのシークレット nonce は、物理ロボットの電源が切れている間、MAC アドレスのなりすましが承認済みのロボット登録を乗っ取ることができないことを保証します。デバイスシークレットは、実物のロボットが事前登録されたハッシュと一致する元の平文 nonce を明らかにしたときにのみ送信されます。
:::

## 関連ドキュメント

- [API リファレンス](/ja/development/api-reference): フリート HTTP/REST サーフェス。
- [rosbridge プロトコル](/ja/development/rosbridge-protocol): WebSocket JSON プロトコルとキャンバス描画。
- [メディアサーバーリファレンス](/ja/development/webui/database/media-server-reference): マップ資産の HTTP ルート。
- [Camera Streaming](/ja/development/webui/camera/overview): WebRTC 映像パイプライン。
- [State and Behavior](/ja/development/state-and-behavior): ステートマシンと障害時の遷移。
- [アーキテクチャ](/ja/development/architecture): システムトポロジーとトラスト境界。
