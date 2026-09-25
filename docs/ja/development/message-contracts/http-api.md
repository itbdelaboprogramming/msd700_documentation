---
outline: deep
search: false
---

# HTTP API (Web)

<RoleBadge role="developer" />

ダッシュボード、管理コンソール、ロボットが呼び出すすべての HTTP エンドポイントです: `backend_node`
(Express)、そこにマウントされたルーター(`/admin/api`、`/enroll`、`/sync`)、および `media-server`。
ロボットに指令を出すエンドポイントは MQTT エンベロープの薄いラッパーです。ロボットが何を受け取るかは、
各エンドポイントから [MQTT コマンド](/ja/development/message-contracts/mqtt-commands) へのリンクをたどってください。

## 規約 {#conventions}

### ベース URL {#base-urls}

| 環境 | `backend_node` | `media-server` |
| --- | --- | --- |
| 本番クラウド | `https://msd.nglobal.jp/services/rosbackend` (Apache → `localhost:5000`) | `NEXT_PUBLIC_MEDIA_URL` (コンテナ `nakayama_media`、ポート `3003`) |
| 開発クラウド | `http://<server-ip>:5001` | 開発用メディアコンテナ |
| ユニットのローカルダッシュボード | `http://<unit-ip>:5002` (`backend_local`) | `media_local`、ポート `3003` |

ローカルモードでは、ダッシュボードはビルド時の各 URL のホストをブラウザが実際に使っているホストに
置き換えます(`src/config/apiConfig.ts` の `withBrowserHost`)。そのため同じビルドがどの LAN アドレスでも動きます。

### 認証 {#authentication}

保護されたルートは `Authorization` ヘッダーで JWT を受け取ります:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

トークンは HS256 で、共有キーリング(コンテナ内の `/run/secrets/jwt_keyring`、本番では
`JWT_SECRET_KEY`/`JWT_SECRET` にフォールバック)で検証されます。署名はアクティブな鍵が行い、
ローテーション直後の鍵も猶予期間中は検証に通ります。

![認証と認可](../../../development/message-contracts/diagrams/api-reference-authentication-and-authorization.drawio)

| トークンの `typ` | 受け付けるルート | 拒否するルート |
| --- | --- | --- |
| `access` (または `typ` なしのリフレッシュ導入前トークン) | すべてのオペレータールート | なし |
| `refresh` | `/user/refresh` のみ | その他すべて、`401` |
| `admin` | `/admin/api/*` | オペレータールート、`401` (`user_id` を持たないため) |

### ユニット認可 (`attachUnit`) {#attach-unit}

`unit_id` (ボディまたはクエリ) を含むリクエストは、トークンの直後に検査されます。呼び出し元はそのユニットを
含む **有効なレンタルプロファイル** を持っている必要があります。`verifyToken` が直接 `attachUnit` に
つながるため、どのハンドラーもこれを省略できません。

![ユニット認可ミドルウェア (attachUnit)](../../../development/message-contracts/diagrams/api-reference-unit-authorization-middleware-attachunit.drawio)

| 結果 | ステータス | ボディ |
| --- | --- | --- |
| `unit_id` が ULID でない | `400` | `{ success: false, msg: "Invalid unit id" }` |
| そのユニットを含む有効なレンタルがない | `403` | `{ success: false, msg: "This unit is not assigned to you" }` |
| 照会エラー | `500` | 拒否側に倒す (fail closed) |

アクセス判定はユーザーとユニットの組ごとに 60 秒キャッシュされます。

### 応答エンベロープ {#envelopes}

データ系エンドポイントは `{ success: true, data, msg? }` または `{ success: false, msg }` を返します。

ロボットに指令を出すエンドポイント(`/api/hardware`、`/api/navigation`、stop 以外の `/api/mapping`、
`/api/boustrophedon`、`/api/autoalign`、`/api/manual`、`/api/autopilot`、`/api/emergency_stop` 配下の
すべての `POST`)は、`sendCommandAndWaitForFeedback()` が決める 1 つの形を共有します:

| 状況 | ステータス | ボディ |
| --- | --- | --- |
| ロボットが `data.status: true` を返した | `200` | `{ success: true, msg: <data.message>, details: <フィードバックエンベロープ全体> }` |
| ロボットが `data.status: false` を返した | `200` | `{ success: false, msg: <data.message>, error_details: <フィードバックエンベロープ全体> }` |
| フィードバックに `data.status` がない | `500` | `{ success: false, msg: "Received malformed feedback from robot.", details }` |
| 30 秒以内にフィードバックがない | `504` | `{ success: false, msg: "Request timed out. No feedback received from robot for request ID: ..." }` |

ロボットによる拒否は意図的に `200` と `success: false` です。`4xx` はバックエンド自身が拒否した
リクエスト用に残しています。`details` 内のフィードバックエンベロープは
[MQTT コマンド § フィードバックエンベロープ](/ja/development/message-contracts/mqtt-commands#feedback-envelope) で規定しています。

## アカウント {#accounts}

### `POST /user/login` {#user-login}

```json
{ "username": "operator1", "password": "SecurePassword123" }
```

```json
{
  "success": true,
  "msg": "Login user success",
  "username": "operator1",
  "full_name": "Operator One",
  "user_id": "01JZ7YV5CQUSER00000000000",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

応答にロールやプロファイルは含まれません。呼び出し元が触れてよいユニットは、リクエストごとに
[`attachUnit`](#attach-unit) が判定します。

### `POST /user/refresh` {#user-refresh}

ボディ `{ "refresh_token": "..." }`。`{ success: true, username, user_id, token, refresh_token }` を返します。
トークンがなければ `400`、無効・期限切れ・`refresh` 以外・アカウントが存在しない場合は `401` です。

### `POST /user/logout` {#user-logout}

ボディ(すべて任意): `{ "force": false, "ignore_autopilot": false }`。ユーザーが持つすべてのリースを解放し、
ユーザーのレガシーなユニット単位コンテナを停止し(`force` で削除)、`ignore_autopilot` が `true` でない限り
オートパイロット中のユニットは動かしたままにします。

```json
{ "success": true, "msg": "Logged out", "remaining": [], "retained": [] }
```

`GET /api/unit/shutdown-status` は `{ success, running, containers }` を返し、
`POST /api/unit/force-stop` (`{ ignore_autopilot }`) は残りを強制停止します。`shutdownFlow.ts` の
ログアウト処理は両方を使います。

### 登録チェック {#user-register}

| エンドポイント | ボディ | 応答 |
| --- | --- | --- |
| `POST /user/register` | `{ username, email, full_name, password }` | `201 { data: { user_id } }`、重複は `409` |
| `POST /user/check-username` | `{ username }` | `200 "Username available"` または拒否 |
| `POST /user/check-email` | `{ email }` | `200 "Email available"` または拒否 |

## ユニットとリース {#units}

### `GET /unit/all` {#unit-list}

呼び出し元が有効なレンタルプロファイルを通じて運転できるユニットです。ライブ状態(バッテリー、アクティビティ)は
ここにはなく、[ping 応答](/ja/development/message-contracts/heartbeat-and-lease#ping-response) から得ます。

```json
{
  "success": true,
  "data": [
    {
      "id": "01JZ8P9WZ0UNIT00000000000",
      "unit_name": "Unit 01",
      "topic_root": "/unit_01JZ8P9WZ0UNIT00000000000",
      "profile_name": "Nakayama",
      "created_at": "2026-08-10T14:20:00Z"
    }
  ]
}
```

### `POST /api/hardware/ping` {#hardware-ping}

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
  "claim": true,
  "release": false,
  "page": "navigation",
  "force_takeover": false
}
```

MQTT の [`hardware.ping`](/ja/development/message-contracts/heartbeat-and-lease#ping-request) になります。バックエンドは
`user_id` (JWT から) と `origin` (自身の `DEPLOYMENT_MODE`) を付加し、どちらもクライアントは設定できません。
リトライはしません。応答は上記のコマンド応答の形で、`details.data` に
[ping 応答](/ja/development/message-contracts/heartbeat-and-lease#ping-response) と、バックエンドが合成する 4 つのフィールドが入ります:

| フィールド | 意味 |
| --- | --- |
| `intended_mode` | バックエンドがこのユニットに最後に要求したモード: `idle`、`navigation`、`mapping` |
| `map_id` | そのモードを開始したときのマップ |
| `sync_status` | ロボットの `robot_activity` が `intended_mode` と一致すれば `synced`、そうでなければ `out_of_sync` |
| `needs_recovery` | 同期していなければ `true`。ダッシュボードは init を再送します |

### `POST /api/unit/heartbeat` {#unit-heartbeat}

ボディ `{ unit_id }`、応答 `{ success: true }`。ユニットのレガシーなクラウドコンテナを生かしたまま、アイドル
タイマーをリセットします。MQTT には触れないので即座に応答します。操作ページが開いている間、ダッシュボードは
15 秒ごとに送ります。

### ハードウェアコマンド {#hardware-commands}

いずれもボディは `{ unit_id }`、応答は [コマンド応答の形](#envelopes) です。

| エンドポイント | MQTT コマンド | 備考 |
| --- | --- | --- |
| `POST /api/hardware/check` | [`hardware.check`](/ja/development/message-contracts/mqtt-commands#hardware) | |
| `POST /api/hardware/init` | [`hardware.init`](/ja/development/message-contracts/mqtt-commands#hardware) | |
| `POST /api/hardware/stop` | [`hardware.stop`](/ja/development/message-contracts/mqtt-commands#hardware) | |
| `POST /api/hardware/idle` | [`hardware.idle`](/ja/development/message-contracts/mqtt-commands#hardware) | ユニットの intended mode も消去するので、次回ログインは idle から始まります。オートパイロットでないログアウト時に送信。 |

### `POST /api/lidar` (レガシー) {#lidar}

ボディ `{ unit_id, enable, use_own_map }`。ボディをそのまま MQTT `/unit_<ULID>/lidar_command` に publish し、
即座に応答します。現在のロボットイメージにはこのトピックを subscribe するものがないため効果はありませんが、
マッピングページはまだ呼び出しています。

## ナビゲーションと動作 {#navigation}

### `POST /api/navigation/init` {#navigation-init}

```json
{ "unit_id": "01JZ8P9WZ0UNIT00000000000", "map_id": "01JZ8QK2H0000000000000MAP" }
```

マップはこのユニットが記録し、呼び出し元が参加するレンタル内のものでなければならず、そうでなければ `404`
`"That map does not belong to this unit. Pick a map recorded by this robot."` です。バックエンドはマップに
保存されたホームベースを付けて [`navigation.init`](/ja/development/message-contracts/mqtt-commands#navigation) を送ります。
`map_id` がない、または ULID でない場合は `400` です。

### `POST /api/navigation/deactivate` {#navigation-deactivate}

ボディ `{ unit_id }`。[`navigation.deactivate`](/ja/development/message-contracts/mqtt-commands#navigation) を送り、
intended mode を消去します。

### `POST /api/navigation/pointstamped` {#navigation-pointstamped}

```json
{ "unit_id": "01JZ8P9WZ0UNIT00000000000", "x": 5.25, "y": -3.1, "z": 0.0 }
```

小文字の `x`、`y`、`z` で、すべて数値(そうでなければ `400`)。小数 4 桁に丸められ、
[`navigation.pointstamped`](/ja/development/message-contracts/mqtt-commands#navigation) の `config.resource.X/Y/Z`
として送られます。ロボットは `/clicked_point` に再 publish します。現在のダッシュボードはこのエンドポイントを
呼びません。ピンポイントは [rosbridge](/ja/development/message-contracts/rosbridge#move-base-action) 経由の
`move_base` ゴールとして送られます。

### `POST /api/emergency_stop` {#emergency-stop}

ボディ `{ unit_id, enable }`。`enable: true` は
[`emergency_stop.activate`](/ja/development/message-contracts/mqtt-commands#emergency-stop) を送り intended mode を消去、
`false` は `deactivate` を送ります。

### `POST /api/manual` {#manual}

ボディ `{ unit_id, enable }`。[`manual.enable`](/ja/development/message-contracts/mqtt-commands#manual) または
`manual.disable` を送ります。運転そのものは HTTP ではありません:
[rosbridge § Publish](/ja/development/message-contracts/rosbridge#publications) (`server/key_vel`) を参照。

### `POST /api/autopilot` {#autopilot}

ボディ `{ unit_id, enable }`。[`autopilot.enable`](/ja/development/message-contracts/mqtt-commands#autopilot) または
`autopilot.disable` を送ります。すでに送信中の ping が古い値で上書きしないよう、バックエンドは新しい値を
5 秒間固定し、無効化ではコンテナ保持も即座に終了します。

## カバレッジ (boustrophedon) {#coverage}

### `POST /api/boustrophedon/init` {#boustrophedon-init}

1 つのエンドポイントに 3 つの形があります。`use_autocover` は boolean 必須です(そうでなければ `400`)。

```json
// 自動カバレッジ: マップ全体
{ "unit_id": "01JZ8P9WZ0UNIT00000000000", "use_autocover": true }

// カスタムエリア 1 つ (レガシーな単一ポリゴン)
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "use_autocover": false,
  "polygon": [ { "x": 0.0, "y": 0.0 }, { "x": 10.0, "y": 0.0 }, { "x": 10.0, "y": 5.0 } ]
}

// プレイリスト: 順序付きのカバーエリアと keep-out ポリゴン
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "use_autocover": false,
  "areas": [
    [ { "x": 0.0, "y": 0.0 }, { "x": 12.0, "y": 0.0 }, { "x": 12.0, "y": 6.0 }, { "x": 0.0, "y": 6.0 } ]
  ],
  "exclusions": [
    [ { "x": 4.0, "y": 2.0 }, { "x": 6.0, "y": 2.0 }, { "x": 6.0, "y": 4.0 }, { "x": 4.0, "y": 4.0 } ]
  ]
}
```

座標は `map` フレームのメートルです。ダッシュボードは `start: true, pause: false, stop: false` も送りますが、
バックエンドは無視します。`ensure_unpaused: true` を付けて
[`boustrophedon.init`](/ja/development/message-contracts/mqtt-commands#boustrophedon) として転送されます。応答は、
ロボットの `/switch_mode` がカバレッジスタックを起動し終えてから返ります。

### `POST /api/boustrophedon/pause` {#boustrophedon-pause}

ボディ `{ unit_id, pause }`。`pause` は boolean(`true` で一時停止、`false` で再開)。ダッシュボードは URL を
一意に保つため `?t=<timestamp>` を付けます。

### `POST /api/boustrophedon/deactivate` {#boustrophedon-deactivate}

ボディ `{ unit_id, use_autocover }`。ロボットが正しい機能を停止できるよう、`use_autocover` は開始時の値と
一致させる必要があります。intended mode を消去します。

## Auto Align {#autoalign}

`POST /api/autoalign/start`、`POST /api/autoalign/status`、`POST /api/autoalign/reset`。いずれもボディは
`{ unit_id }` で、[`autoalign.start` / `status` / `reset`](/ja/development/message-contracts/mqtt-commands#autoalign)
に 1 対 1 で対応し、応答は [コマンド応答の形](#envelopes) です。位置合わせ中、ダッシュボードは `status` をポーリングします。

## マッピング (SLAM) {#mapping}

### `POST /api/mapping` {#mapping-control}

1 つのエンドポイントでセッションを操作します。`start`、`pause`、`stop` のうちちょうど 1 つが `true`
(そうでなければ `400`)。

```json
// 保存: 走行を止め、キャンバスで取得したホームベースと一緒にマップを保存
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "stop": true,
  "map_name": "Warehouse Sector 4",
  "homebase_x": 0.0, "homebase_y": 0.0, "homebase_z": 0.0,
  "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
}
```

| フラグ | MQTT | 応答 |
| --- | --- | --- |
| `start` | [`mapping.start`](/ja/development/message-contracts/mqtt-commands#mapping) | [コマンド応答の形](#envelopes) |
| `pause` | [`mapping.pause`](/ja/development/message-contracts/mqtt-commands#mapping) | [コマンド応答の形](#envelopes) |
| `stop` | [`mapping.stop`](/ja/development/message-contracts/mqtt-commands#mapping) | 即時に `200 { success, request_id, map_ulid, msg }`、進捗は [SSE](#mapping-progress) |

`stop` 時、バックエンドはマップの ULID(ディスク上のファイル名)を発行し、`map_name` を表示名に使い
(空なら `YYYY-MM-DD_HH-MM-SS` のタイムスタンプ)、呼び出し元を `created_by` として記録し、有限な
`homebase_*` の数値をロボットに渡します。これによりホームベースはマップ行を作る同じアップロードで保存されます。

### `POST /api/mapping/discard` {#mapping-discard}

ボディ `{ unit_id }`。[`mapping.discard`](/ja/development/message-contracts/mqtt-commands#mapping) を送ります。

### `GET /api/mapping/progress/:request_id?token=<jwt>` {#mapping-progress}

`stop` で始まった保存の Server-Sent Events です。`EventSource` はヘッダーを設定できないため、トークンは
クエリ文字列で渡します。各イベントは [`mapping_progress`](/ja/development/message-contracts/mqtt-commands#mapping-progress)
メッセージの `data` ブロックです:

```text
data: {"status":true,"progress":50,"stage":"uploading","message":"Saving to the robot...","terminal":false}

data: {"status":true,"progress":100,"stage":"completed","message":"Saved on the robot and the server.","terminal":true,"outcome":"completed"}
```

送信済みのイベントは遅れて接続した購読者に再送されます。15 秒ごとに `: heartbeat` コメントが送られます。
ロボットが 90 秒沈黙すると、ストリームは合成された終端イベント(`stage: "no_response"`、`progress: -1`、
`outcome: "failed"`)で終わり、マップはまだ保存中かもしれないと伝えます。

## マップ {#maps}

### `GET /api/maps_data` {#maps-list}

クエリ `unit_id`(ワイヤー上は任意、実際には必須)。指定するとそのユニットが記録したマップのみ、指定しないと
呼び出し元のレンタル範囲の全マップです。呼び出し元にレンタルのないユニットは `403` です。

```json
{
  "success": true,
  "data": [
    {
      "id": "01JZ8QK2H0000000000000MAP",
      "map_name": "Warehouse Ground Floor",
      "unit_id": "01JZ7K3M9QA0B1C2D3E4F5G6H7",
      "unit_name": "unit1",
      "created_by": "01JZ7YV5CQUSER00000000000",
      "created_by_username": "operator1",
      "modified_by": "01JZ7YV5CQUSER00000000000",
      "modified_by_username": "operator1",
      "created_at": "2026-08-10T14:20:00Z",
      "modified_at": "2026-08-10T14:20:00Z",
      "file_size_pgm": 262159,
      "file_size_yaml": 131,
      "file_size_image": 20480,
      "homebase_x": 0.0, "homebase_y": 0.0, "homebase_z": 0.0,
      "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
    }
  ]
}
```

アカウントが削除されている場合 `*_username` は `null` です。`GET /api/maps/:mapId`(同じ任意の `unit_id`)は
そのようなオブジェクト 1 つをエンベロープなしで返すか、`404` を返します。

::: warning マップ名はユニットとレンタルごとにのみ一意
同じレンタルの 2 台のユニットが、それぞれ `hazard test` というマップを持てます。重複排除は `id` で、
範囲は `unit_id` で絞ってください。名前で行ってはいけません。
:::

### `POST /api/maps_data/check` {#map-check}

ボディ `{ map_name }`(任意で `unit_id`)。応答 `{ success, exists, map_name, msg }`。

### `PUT /api/maps_data/rename/:mapId` {#map-rename}

ボディ `{ new_map_name }`。名前が使用済みなら `409`、マップが範囲外なら `404`。

```json
{
  "success": true,
  "msg": "Map 'Old' renamed to 'New' successfully",
  "data": { "mapId": "01JZ...", "old_map_name": "Old", "new_map_name": "New", "updated": true }
}
```

### `PUT /api/maps_data/homebase/:mapId` {#map-homebase}

ボディ `{ x, y, z, ox, oy, oz, ow }`。`x` と `y` は数値必須、残りの既定値は `0, 0, 0, 0, 1`。
応答 `{ success, msg, data: { mapId, homebase: { x, y, z, ox, oy, oz, ow } } }`。

### `DELETE /api/maps_data` {#map-delete}

ボディ `{ map_id }`(`map_name` だけの場合は曖昧でない時のみ受け付け、それ以外は候補
`[{ map_id, unit_name }]` 付きの `409`)。行を削除し(ルート、エリア、プレイリストはカスケード)、同期用の
削除トゥームストーンを記録し、`pgm/<id>.pgm`、`yaml/<id>.yaml`、`images/<id>.png` を削除します。

```json
{
  "success": true,
  "msg": "Map 'Hall A' deleted successfully",
  "data": { "mapId": "01JZ...", "deleted": true, "files": { "pgm": true, "yaml": true, "image": true } },
  "warnings": []
}
```

## ルート、エリア、プレイリスト {#saved-items}

3 つともマップにぶら下がり、同じレンタル規則で範囲が決まり、次の規則を共有します: 作成は `201`、作成時の
名前重複は `409`、名前変更は空白を取り除き、名前が使用済みなら失敗せずに `(1)`、`(2)`、... を付けます。

### ルート {#routes}

| エンドポイント | ボディ | 応答 |
| --- | --- | --- |
| `POST /api/routes` | `{ route_name, map_id, route_points }` | `201 { data: { route_id } }` |
| `GET /api/routes/:map_id` | | `{ data: [{ id, route_name, map_id, created_at, modified_at, route_points }] }` |
| `PUT /api/routes/:id` | `{ route_name }` | `{ data: { id, route_name } }` |
| `DELETE /api/routes/:id` | | `{ success, msg }` |

`route_points` はキャンバスが保持するピンポイント一覧そのもので、ウェイポイントごとに ROS の姿勢 1 つです:

```json
[
  { "position": { "x": 1.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } },
  { "position": { "x": 5.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.707, "w": 0.707 } }
]
```

ルートモード(Basic、Round Trip、Loop)は保存されません。サムネイルは返された `route_id` を使った
[`/api/media/uploadRouteImage`](#media-server) への別アップロードで、その失敗は保存を失敗にしません。

### エリア {#areas}

| エンドポイント | ボディ | 応答 |
| --- | --- | --- |
| `POST /api/areas` | `{ area_name, map_id, area_type, polygon_points }` | `201 { data: { area_id } }` |
| `GET /api/areas/:map_id` | | `{ data: [{ id, area_name, map_id, area_type, created_at, modified_at, polygon_points }] }` |
| `PUT /api/areas/:id` | `{ area_name }` | `{ data: { id, area_name } }` |
| `DELETE /api/areas/:id` | | `{ success, msg }` |

`area_type` は `cover`(既定)または `no_cover`(それ以外は `400`)。`polygon_points` はメートル単位の `[{ x, y }]`。

### プレイリスト {#playlists}

| エンドポイント | ボディ | 応答 |
| --- | --- | --- |
| `POST /api/playlists` | `{ playlist_name, map_id, items }` | `201 { data: { playlist_id } }` |
| `GET /api/playlists/:map_id` | | `{ data: [{ id, playlist_name, map_id, created_at, modified_at, items }] }` |
| `PUT /api/playlists/:id` | `{ playlist_name?, items? }` (少なくとも 1 つ) | `{ data: { playlist_name } }` |
| `DELETE /api/playlists/:id` | | `{ success, msg }` |

各アイテムはポリゴンのスナップショットを持つため、元のエリアが名前変更・削除されてもプレイリストは動きます:

```json
{ "area_id": "01JZ...", "area_name": "Aisle3", "area_type": "cover", "polygon_points": [ { "x": 0, "y": 0 } ] }
```

## メディアサーバー {#media-server}

`media-server` はマップファイルとサムネイルを保存します。完全なリファレンス:
[メディアサーバーリファレンス](/ja/development/webui/database/media-server-reference)。オペレーターの操作で使われる呼び出し:

| エンドポイント | 呼び出し元 | 仕様 |
| --- | --- | --- |
| `POST /api/media/uploadMap` | `mapping.stop` 中のロボット | multipart: `id` (マップ ULID)、`map_name`、`created_by`、`unit_id`、任意の `homebase_*`、`mapFiles` にちょうど 2 ファイル(`.yaml` + `.pgm`)。マップ行を書き込み PNG を生成します。ユニットのメディアサーバーに先に送り(必須)、次にクラウドへ(ベストエフォート) |
| `GET /api/media/maps/:id/download` | `navigation.init` 中、ファイルがディスクにない場合のロボット | マップ一式 |
| `GET /api/media/checkMapName` | マッピングの保存ダイアログ | クエリ `map_name` (と `unit_id`)。応答 `data.available`。ダッシュボードは `user_id` を送りますが、サーバーは読みません。 |
| `POST /api/media/uploadRouteImage` | Save Route | multipart `id` (ルート ULID) + `imageFile`。`images/<id>.jpg` として保存 |
| `GET /api/media/images/:filename` | マップとルートのサムネイル | `<マップ ULID>.png`、`<ルート ULID>.jpg`。**トークン不要** |

## ユニットローカル専用エンドポイント {#local-endpoints}

ユニット自身のバックエンド(`DEPLOYMENT_MODE=local`)にのみマウントされ、ローカルダッシュボードの状態バッジと
Wi-Fi パネルが使います:

| エンドポイント | 用途 |
| --- | --- |
| `GET /local/status` | デプロイモード、紐づくレンタルプロファイル、最終同期時刻とエラー、クラウド URL |
| `POST /local/sync` | 今すぐ同期(`{ full: true }` で完全同期)。実行中は `429` |
| `GET /local/robot-token` | ロボットがローカルメディアサーバーに使う短命トークン |
| `POST /local/archive` | ローカルデータのユニットアーカイブを書き出す |
| `GET /local/wifi/status`、`/scan`、`/saved`、`/hotspot` | Wi-Fi の状態。ホスト側ヘルパーへ中継 |
| `POST /local/wifi/connect`、`/disconnect`、`/forget`、`/hotspot` | Wi-Fi の変更(`{ ssid, password }`、`{ name }`) |

## 管理 API {#admin-api}

`/admin/api` にマウントされ、`admin` トークン(`POST /admin/api/login` で発行)のみ受け付けます。タブごとの
機能説明: [管理コンソール](/ja/development/webui/admin-console/overview)。

| グループ | エンドポイント (ボディ) |
| --- | --- |
| セッション | `POST /login` (`username, password`)、`GET /me`、`PATCH /me` (`username, fullname`)、`POST /me/password` (`current_password, new_password`) |
| 管理者 (superadmin) | `GET/POST /admins` (`username, fullname, password, role`)、`PATCH /admins/:id/password`、`PATCH /admins/:id/status` (`status`)、`DELETE /admins/:id` |
| オペレーター | `GET/POST /users` (`username, email, fullname, password`)、`PATCH /users/:id/status`、`PATCH /users/:id/password` |
| ユニット | `GET/POST /units` (`unit_name, unit_id?`)、`PATCH /units/:id` (`unit_name`)、`DELETE /units/:id`、`DELETE /units/:id/device`、`POST /units/:id/enrollment-code` |
| 保留中のロボット | `GET /pending-units`、`POST /pending-units/:id/register` (`unit_name`)、`POST /pending-units/:id/adopt` (`unit_id, confirm?`)、`DELETE /pending-units/:id` |
| ユニットのデータ | `POST /units/:id/transfer` (`target_unit_id, profile_id \| all_profiles`)、`POST /units/:id/swap` (`target_unit_id` + スコープ)、`POST /units/:id/backups` (スコープ)、`DELETE /units/:id/data` (スコープ) |
| レンタル | `GET/POST /profiles` (`profile_name, tenant_name, notes`)、`GET/PATCH/DELETE /profiles/:id`、`POST /profiles/:id/members` (`user_id`)、`DELETE /profiles/:id/members/:userId`、`POST /profiles/:id/units` (`unit_id`)、`DELETE /profiles/:id/units/:unitId` |
| バックアップ | `GET /backups`、`POST /profiles/:id/backups`、`GET /backups/:id/download`、`DELETE /backups/:id`、`POST /backups/upload` (生のアーカイブ)、`POST /backups/:id/plan`、`POST /backups/:id/restore` |

「スコープ」は `{ profile_id }` または `{ all_profiles: true }` で、どちらかが必須です。

## エンロールルーター {#enrol-api}

ブラウザではなくロボットが呼びます: `POST /enroll/claim`、`POST /enroll/status`、`POST /enroll/token`。ボディと
応答は [ファームウェア & エンロール § エンロール](/ja/development/message-contracts/firmware-and-enrolment#enrolment) にあります。

## 同期ルーター {#sync-api}

ユニットの `sync_agent` が、レンタルに紐づいたロボットトークンでクラウドに対して呼びます:

| エンドポイント | ボディ | 用途 |
| --- | --- | --- |
| `POST /sync/handshake` | | レンタルの紐づけと時刻オフセットを確認 |
| `POST /sync/pull` | `{ since }` | `since` 以降にクラウドで変わった行とトゥームストーン |
| `POST /sync/push` | `{ payload, clock_offset_ms }` | ユニットで変わった行とトゥームストーン |
| `POST /sync/ack` | `{ up_to }` | pull した変更の適用済みを記録 |
| `GET/PUT /sync/file/:mapId/:kind` | 生ファイル | マップファイル(`pgm`、`yaml`、画像) |
| `GET/PUT /sync/route-file/:routeId/:kind` | 生ファイル | ルートのサムネイル |

意味論(順序、競合規則): [データ同期](/ja/development/data-sync)。

## 関連ドキュメント

- [MQTT コマンド](/ja/development/message-contracts/mqtt-commands): 各コマンド系エンドポイントがロボットに送るもの。
- [セキュリティと認証](/ja/development/security-and-auth): トークンの寿命とキーリング。
- [データベース設計](/ja/development/database-schema): これらのエンドポイントが読み書きするテーブル。
