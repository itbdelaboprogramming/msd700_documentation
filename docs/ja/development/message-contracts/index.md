---
outline: deep
search: false
---

# メッセージ仕様

<RoleBadge role="developer" />

MSD700 でプロセス境界をまたぐすべてのペイロードを、このセクションで規定します。Web ダッシュボードが
呼び出す HTTP API、クラウドとユニット間の MQTT コマンドチャネル、ブリッジが運ぶ ROS トピック、
ブラウザが描画に使う rosbridge WebSocket、operation supervisor プロトコル、WebRTC シグナリング、
ファームウェアリンク、エンロールのハンドシェイクです。

このセクション全体での用語: **ユニット** はソフトウェアから見た登録済みロボット 1 台(`units` の 1 行、
`/unit_<ULID>` でアドレス指定)です。**ロボット** は物理的な機体です。ユニットの上位にグループ用の
オブジェクトはありません。

::: info 仕様の検証
ペイロードの形は稼働中のソース(`backend_node`、`system_command.py`、`operation_supervisor.py`、
`topic2string`、`aws_mqtt`、`media-server`、ダッシュボードの `src/`)から取っています。コード側で
フィールドを変更した場合は、同じコミットでここも更新してください。
:::

## このセクションのページ {#pages}

| ページ | トランスポート | 規定する内容 |
| --- | --- | --- |
| [HTTP API (Web)](/ja/development/message-contracts/http-api) | HTTPS REST、SSE | ダッシュボード、管理コンソール、ロボットが `backend_node` と `media-server` に対して呼ぶ全エンドポイント |
| [MQTT コマンド](/ja/development/message-contracts/mqtt-commands) | MQTT 3.1.1 over TLS 8883 | `system_command` / `system_feedback` エンベロープ、リトライ、すべての `header`/`command` の組 |
| [ハートビート & リース](/ja/development/message-contracts/heartbeat-and-lease) | HTTP → MQTT、MQTT over WebSocket | `hardware.ping` のリースフィールド、5 Hz の `hardware.heartbeat` フレーム |
| [ブリッジトピック (MQTT ↔ ROS)](/ja/development/message-contracts/bridge-topics) | MQTT、ROS | ロボット ↔ クラウドの全トピックマップ、JSON 文字列形式、マップ配信、egress プロファイル |
| [rosbridge (WebSocket)](/ja/development/message-contracts/rosbridge) | WSS | ブラウザが subscribe・publish するもの、`move_base` アクションクライアントで送るもの |
| [オペレーション同期](/ja/development/message-contracts/operation-sync) | ROS over MQTT | `operation_sync`、`operation_progress`、`operation_snapshot` |
| [WebRTC シグナリング](/ja/development/message-contracts/webrtc-signalling) | WSS、SRTP | カメラのネゴシエーションメッセージ |
| [ファームウェア & エンロール](/ja/development/message-contracts/firmware-and-enrolment) | rosserial、HTTPS | STM32 ↔ Jetson のトピック、`/enroll` ハンドシェイク |

## 2 つの制御経路 {#two-control-paths}

オペレーターの操作は 2 つの経路のどちらかでロボットに届きます。ある操作がどちらを使うかが分かれば、
追跡作業のほとんどは済みます。

![2 つの制御経路](../../../development/message-contracts/diagrams/message-contracts-two-control-paths.drawio)

- **経路 A、コマンドチャネル。** ブラウザが HTTP エンドポイントを呼び、`backend_node` がそれを
  `system_command` エンベロープに包んで MQTT で publish し、対応する `system_feedback` が届くまで
  (または 30 秒経つまで) HTTP リクエストを保持します。モードを変えるもの、可否の応答が必要なものに
  使います: navigation init、マッピングの開始/保存、カバレッジの開始/一時停止/停止、手動操作、
  オートパイロット、非常停止、自動位置合わせ。[MQTT コマンド](/ja/development/message-contracts/mqtt-commands)を参照。
- **経路 B、ストリーミングチャネル。** ブラウザはクラウドの ROS マスターに rosbridge 経由で publish と
  subscribe を行います。`topic2string` のリレーが型付きメッセージを JSON 文字列に変換し、MQTT ブリッジが
  運び、ロボット側の `topic2string` が型付きメッセージに戻します。ナビゲーションのゴール、テレオペ、
  ACK、オペレーション同期、マップ上に描画されるすべてのオーバーレイに使います。
  [rosbridge](/ja/development/message-contracts/rosbridge) と
  [ブリッジトピック](/ja/development/message-contracts/bridge-topics) を参照。

ロボットに触れないデータ(マップ一覧、ルート、エリア、プレイリスト、アカウント)は `backend_node` または
`media-server` への通常の HTTP で、MySQL かディスクに保存されます。

## ユニットのアドレス指定 {#unit-addressing}

各ユニットは接頭辞 `/unit_<ULID>` でアドレス指定されます。ULID は `units` の行の主キーです。
`GET /unit/all` は組み立て済みの `topic_root` をブラウザに渡すので、ダッシュボードが接頭辞を自分で
作ることはありません。

![ユニットのアドレス指定](../../../development/message-contracts/diagrams/message-contracts-unit-addressing-scheme.drawio)

| ホップ | トピックの形 | 備考 |
| --- | --- | --- |
| ロボットの ROS マスター | `/string/robotpose` | 接頭辞なし: オンボードの `roscore` 1 つにロボット 1 台。 |
| MQTT ブローカー | `/unit_<ULID>/string/robotpose` | ロボットの `aws_mqtt` ブリッジが接頭辞を付けます。 |
| クラウドの ROS マスター | `/unit_<ULID>/string/robotpose`、次に `/unit_<ULID>/server/robot_pose` | ユニットリレーは接頭辞を保ち、`server/` の下に型付きトピックとして再 publish します。 |

::: warning `unit_` 接頭辞が必須な理由
ROS のグラフ名は英字、`~`、`/` のいずれかで始まる必要があります。ULID は数字で始まる(`01JZ...`)ため、
`/01JZ.../string/map` は ROS に拒否されます。接頭辞により MQTT 名と ROS 名の 1:1 対応を保ちます。
:::

## アクショントレース {#action-trace}

各行はオペレーターがダッシュボードで行う操作 1 つと、それが引き起こすすべてのメッセージです。リンク先で
正確な仕様を確認できます。*クライアントのみ* の操作は、後の操作(通常は Play)が準備内容を使うまで
何も送信しません。

### セッションとユニット一覧 {#trace-session}

| 操作 | ブラウザが送るもの | ロボット側 | 応答の戻り方 |
| --- | --- | --- | --- |
| ログイン | [`POST /user/login`](/ja/development/message-contracts/http-api#user-login) | なし | HTTP ボディ内のトークン |
| トークン更新 | [`POST /user/refresh`](/ja/development/message-contracts/http-api#user-refresh) | なし | 新しいトークンの組 |
| ユニット一覧を開く | [`GET /unit/all`](/ja/development/message-contracts/http-api#unit-list)、続いてユニットごとに `claim: false` で [`POST /api/hardware/ping`](/ja/development/message-contracts/http-api#hardware-ping) | [`hardware.ping`](/ja/development/message-contracts/heartbeat-and-lease#ping-request) | `details.data` 内の [ping 応答](/ja/development/message-contracts/heartbeat-and-lease#ping-response) |
| 操作ページに留まる | 毎秒 `claim: true` の [`hardware.ping`](/ja/development/message-contracts/heartbeat-and-lease#ping-request)、15 秒ごとに [`POST /api/unit/heartbeat`](/ja/development/message-contracts/http-api#unit-heartbeat)。ユニットのローカルダッシュボードでは [5 Hz の `hardware.heartbeat`](/ja/development/message-contracts/heartbeat-and-lease#heartbeat-frame) も | リース更新、ウォッチドッグの段階 | ping 応答内のリース状態 |
| 操作ページを離れる | `release: true`、`page: "other"` の ping | リース解放 | なし (送りっぱなし) |
| 別セッションから引き継ぐ | `force_takeover: true` の ping | リースが移る | `in_use`、`origin_conflict` が解消 |
| ログアウト | [`POST /api/hardware/idle`](/ja/development/message-contracts/http-api#hardware-commands) (オートパイロット中を除く)、[`POST /user/logout`](/ja/development/message-contracts/http-api#user-logout) | [`hardware.idle`](/ja/development/message-contracts/mqtt-commands#hardware) | `{ success, remaining, retained }` |

### ナビゲーションページ {#trace-navigation}

| 操作 | ブラウザが送るもの | ロボット側 | 応答の戻り方 |
| --- | --- | --- | --- |
| ナビゲーション用にマップを開く | [`POST /api/navigation/init`](/ja/development/message-contracts/http-api#navigation-init) | [`navigation.init`](/ja/development/message-contracts/mqtt-commands#navigation): `/switch_mode(navigation)`、`/map/retire`、ホームベースを `/initialpose` へ | HTTP 200。その後 [`map_request`](/ja/development/message-contracts/bridge-topics#map-delivery) を経てマップが [`server/slam/map`](/ja/development/message-contracts/rosbridge#subscriptions) に届く |
| ピンポイント配置、ウェイポイント追加、Delete All Pinpoints | *クライアントのみ* | なし | なし |
| Play、単一ピンポイント | `server/move_base/goal` への [`move_base` ゴール](/ja/development/message-contracts/rosbridge#move-base-action)、`single_pinpoint` の [`operation_sync` `batch`](/ja/development/message-contracts/operation-sync#batch) | [`string/move_base/goal`](/ja/development/message-contracts/bridge-topics#json-goal) → `/move_base/goal` | [`server/move_base/status` と `/result`](/ja/development/message-contracts/rosbridge#move-base-action)。各 result は [`result_ack`](/ja/development/message-contracts/bridge-topics#acks) で ACK |
| Play、複数ピンポイント (Basic、Round Trip、Loop) | ウェイポイントごとに 1 ゴール、`multi_pinpoint` と `route_mode` の [`batch`](/ja/development/message-contracts/operation-sync#batch)、ウェイポイントごとの [`progress`](/ja/development/message-contracts/operation-sync#progress)、最後に [`complete`](/ja/development/message-contracts/operation-sync#stop-complete) | 上と同じ、ウェイポイントごと | 上と同じ |
| Pause | [`server/move_base/cancel`](/ja/development/message-contracts/rosbridge#move-base-action) でゴールをキャンセル、[`operation_sync` `pause`](/ja/development/message-contracts/operation-sync#pause) | [`string/move_base/cancel`](/ja/development/message-contracts/bridge-topics#json-cancel) → `/move_base/cancel` | ゴール状態 `PREEMPTED` |
| Stop | ゴールをキャンセル、[`operation_sync` `stop`](/ja/development/message-contracts/operation-sync#stop-complete) | Pause と同じ、batch は消去 | ゴール状態、`active: false` の [スナップショット](/ja/development/message-contracts/operation-sync#snapshot) |
| Save Route | [`POST /api/routes`](/ja/development/message-contracts/http-api#routes)、続いて [`POST /api/media/uploadRouteImage`](/ja/development/message-contracts/http-api#media-server) | なし | `201 { data: { route_id } }` |
| ルートの読込 / 名前変更 / 削除 | [`GET`、`PUT`、`DELETE /api/routes`](/ja/development/message-contracts/http-api#routes) | なし | ルート一覧 / `{ success }` |
| Set Home Base | [`PUT /api/maps_data/homebase/:mapId`](/ja/development/message-contracts/http-api#map-homebase)、続いて [`batch` `homebase`](/ja/development/message-contracts/operation-sync#batch) を伴う `move_base` ゴール | 上と同じゴール | ゴール状態 |
| Return to Home Base | 保存済みホームベースへの [`move_base` ゴール](/ja/development/message-contracts/rosbridge#move-base-action) | 上と同じゴール | ゴール状態 |
| 姿勢推定 / ホームベース姿勢の初期化 | [`/unit_<ULID>/initialpose`](/ja/development/message-contracts/rosbridge#publications) に publish | [`string/initialpose`](/ja/development/message-contracts/bridge-topics#json-initialpose) → `/initialpose` | `server/robot_pose` 上でロボットの姿勢が移動 |
| Manual Override オン / オフ | [`POST /api/manual`](/ja/development/message-contracts/http-api#manual) | [`manual.enable` / `disable`](/ja/development/message-contracts/mqtt-commands#manual) | HTTP 200。ping 応答の `manual_override` |
| WASD で運転 | 10 Hz で [`server/key_vel` の `geometry_msgs/Twist`](/ja/development/message-contracts/rosbridge#publications) | [`string/key_vel`](/ja/development/message-contracts/bridge-topics#json-twist) → `/mux/key_vel` | ロボット姿勢 |
| Autopilot オン / オフ | [`POST /api/autopilot`](/ja/development/message-contracts/http-api#autopilot)、[`batch` + `takeover`](/ja/development/message-contracts/operation-sync#takeover) または [`release`](/ja/development/message-contracts/operation-sync#release) | [`autopilot.enable` / `disable`](/ja/development/message-contracts/mqtt-commands#autopilot) | [`operation_progress`](/ja/development/message-contracts/operation-sync#progress-out)、[スナップショット](/ja/development/message-contracts/operation-sync#snapshot) |
| 非常停止 / 解除 | [`POST /api/emergency_stop`](/ja/development/message-contracts/http-api#emergency-stop) | [`emergency_stop.activate` / `deactivate`](/ja/development/message-contracts/mqtt-commands#emergency-stop) | HTTP 200 |
| Auto Align | [`POST /api/autoalign/start`、`/status`、`/reset`](/ja/development/message-contracts/http-api#autoalign) | [`autoalign.*`](/ja/development/message-contracts/mqtt-commands#autoalign) | 呼び出しごとに HTTP 200 |

### カバレッジ清掃 {#trace-coverage}

| 操作 | ブラウザが送るもの | ロボット側 | 応答の戻り方 |
| --- | --- | --- | --- |
| 自動カバレッジ開始 | `use_autocover: true` の [`POST /api/boustrophedon/init`](/ja/development/message-contracts/http-api#boustrophedon-init)、[`batch` `coverage`](/ja/development/message-contracts/operation-sync#batch) | [`boustrophedon.init`](/ja/development/message-contracts/mqtt-commands#boustrophedon): `/switch_mode(boustrophedon)` | HTTP 200、その後 [`server/boustrophedon_path`](/ja/development/message-contracts/rosbridge#subscriptions) にパス |
| カスタムエリア開始 | 同じエンドポイントに `polygon`、[`batch` `custom_coverage`](/ja/development/message-contracts/operation-sync#batch) | `/msd700/coverage_polygon` にポリゴン | 同上 |
| プレイリスト開始 (エリア + keep-out) | 同じエンドポイントに `areas` と `exclusions`、[`batch` `playlist`](/ja/development/message-contracts/operation-sync#batch) | `/msd700/coverage_plan` に計画 JSON | 同上 |
| カバレッジパス受信 | パスのリビジョンを載せた [`boustrophedon_path_ack`](/ja/development/message-contracts/bridge-topics#acks) | ロボットは再送を停止 | なし |
| 一時停止 / 再開 | [`POST /api/boustrophedon/pause`](/ja/development/message-contracts/http-api#boustrophedon-pause) | [`boustrophedon.pause`](/ja/development/message-contracts/mqtt-commands#boustrophedon): `/path_coverage/pause` または `/resume` | HTTP 200 |
| 停止 | [`POST /api/boustrophedon/deactivate`](/ja/development/message-contracts/http-api#boustrophedon-deactivate)、[`operation_sync` `stop`](/ja/development/message-contracts/operation-sync#stop-complete) | [`boustrophedon.deactivate`](/ja/development/message-contracts/mqtt-commands#boustrophedon) | HTTP 200 |
| エリアの保存 / 名前変更 / 削除 | [`/api/areas`](/ja/development/message-contracts/http-api#areas) | なし | `{ success, data }` |
| プレイリストの保存 / 編集 / 削除 | [`/api/playlists`](/ja/development/message-contracts/http-api#playlists) | なし | `{ success, data }` |

### マッピングページ {#trace-mapping}

| 操作 | ブラウザが送るもの | ロボット側 | 応答の戻り方 |
| --- | --- | --- | --- |
| マッピング開始 | [`POST /api/mapping`](/ja/development/message-contracts/http-api#mapping-control) `{ start: true }` | [`mapping.start`](/ja/development/message-contracts/mqtt-commands#mapping): `/switch_mode(explore)` | HTTP 200。成長するマップが [`server/slam/map`](/ja/development/message-contracts/rosbridge#subscriptions) に |
| 一時停止 | `POST /api/mapping` `{ pause: true }` | [`mapping.pause`](/ja/development/message-contracts/mqtt-commands#mapping) | HTTP 200 |
| マップ名の確認 | [`GET /api/media/checkMapName`](/ja/development/message-contracts/http-api#media-server) | なし | `data.available` |
| 保存 (停止) | `POST /api/mapping` `{ stop: true, map_name, homebase_* }`、続いて [`GET /api/mapping/progress/:request_id`](/ja/development/message-contracts/http-api#mapping-progress) | [`mapping.stop`](/ja/development/message-contracts/mqtt-commands#mapping): `/mapsaver/full_path`、[`/api/media/uploadMap`](/ja/development/message-contracts/http-api#media-server) へアップロード | 即時に `{ request_id, map_ulid }`、その後 SSE で [`mapping_progress`](/ja/development/message-contracts/mqtt-commands#mapping-progress) イベント |
| 破棄 | [`POST /api/mapping/discard`](/ja/development/message-contracts/http-api#mapping-discard) | [`mapping.discard`](/ja/development/message-contracts/mqtt-commands#mapping) | HTTP 200 |

### データベースページ {#trace-database}

| 操作 | ブラウザが送るもの | ロボット側 | 応答の戻り方 |
| --- | --- | --- | --- |
| マップ一覧 | [`GET /api/maps_data?unit_id=`](/ja/development/message-contracts/http-api#maps-list) | なし | `{ data: [map] }` |
| サムネイル | [`GET /api/media/images/<マップ ULID>.png`](/ja/development/message-contracts/http-api#media-server) | なし | PNG |
| マップ名の変更 | [`PUT /api/maps_data/rename/:mapId`](/ja/development/message-contracts/http-api#map-rename) | なし (ユニットは [データ同期](/ja/development/data-sync) で変更を受け取る) | `{ data: { old_map_name, new_map_name } }` |
| マップの削除 | `map_id` を付けた [`DELETE /api/maps_data`](/ja/development/message-contracts/http-api#map-delete) | なし | `{ data: { mapId, files } }` |
| マップ上でナビゲーション | [`POST /api/navigation/init`](/ja/development/message-contracts/http-api#navigation-init) | ナビゲーションの表を参照 | ナビゲーションの表を参照 |

### 管理コンソール、エンロール、カメラ {#trace-other}

| 操作 | 仕様 |
| --- | --- |
| 管理コンソールの各タブ | `admin` トークンでの [`/admin/api/*`](/ja/development/message-contracts/http-api#admin-api) |
| ロボットのエンロール、起動時のトークン更新 | [`/enroll/claim`、`/status`、`/token`](/ja/development/message-contracts/firmware-and-enrolment#enrolment) |
| ユニット ↔ クラウドのデータ同期 | [`/sync/*`](/ja/development/message-contracts/http-api#sync-api) |
| ライブカメラ | [WebRTC シグナリング](/ja/development/message-contracts/webrtc-signalling) |

## 関連ドキュメント

- [アーキテクチャ](/ja/development/architecture): システムトポロジーと信頼境界。
- [状態と振る舞い](/ja/development/state-and-behavior): これらのメッセージが駆動する状態機械。
- [ROS Web UI](/ja/development/webui/): 上で追跡した各ページの機能説明。
