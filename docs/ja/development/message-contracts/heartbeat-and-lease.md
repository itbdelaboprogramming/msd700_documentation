---
outline: deep
search: false
---

# ハートビート & リース

<RoleBadge role="developer" />

2 つの信号が、誰かがユニットを見ていることを伝えます。そのうち 1 つは、誰が運転してよいかも決めます。

| 信号 | トランスポート | 頻度 | 権限を持つか | 供給先 |
| --- | --- | --- | --- | --- |
| [`hardware.ping`](#ping-request) | HTTP → `backend_node` → MQTT、往復 | 操作ページから 1 秒ごと、ユニット一覧からはユニットごと | はい: claim、release、takeover | 操作リース、idle/shutdown のウォッチドッグ段階、ダッシュボードが表示する状態 |
| [`hardware.heartbeat`](#heartbeat-frame) | MQTT over WebSocket、ブラウザ → ユニットのブローカー、片方向 | 5 Hz (200 ms) | いいえ | 2 秒の presence 段階のみ |

ハートビートはユニットのローカルダッシュボード(`NEXT_PUBLIC_MQTT_WS_URL` 設定時)にのみ存在します。
クラウドダッシュボードは ping だけに頼ります。ウォッチドッグの振る舞い:
[安全ウォッチドッグ](/ja/development/ros/safety-watchdog#two-presence-signals)。

## ping リクエスト {#ping-request}

ブラウザが [`POST /api/hardware/ping`](/ja/development/message-contracts/http-api#hardware-ping) を呼び、
`backend_node` が `/unit_<ULID>/system_command` に次のエンベロープを送ります:

```json
{
  "header": "hardware",
  "command": "ping",
  "data": {
    "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
    "user_id": "01JZ7YV5CQUSER00000000000",
    "claim": true,
    "release": false,
    "page": "navigation",
    "origin": "cloud",
    "force_takeover": false
  },
  "metadata": { "timestamp": "2026-08-12T04:11:52.913Z", "request_id": "..." }
}
```

| フィールド | 設定元 | 意味 |
| --- | --- | --- |
| `session_id` | ブラウザ | ブラウザタブごとに 1 つの UUID (`getOperatingSessionId()`) |
| `user_id` | バックエンド、JWT から | リースの識別子。ボディからは取らないので、クライアントが他人として claim することはできません。ユーザー名ではなく ULID なので、名前変更でリースが移ることはありません。 |
| `claim` | ブラウザ | 操作ページ(Navigation、Mapping)からは `true`。状態を読むだけのユニット一覧からは `false` |
| `release` | ブラウザ | 操作ページを離れるときに `true` (`page: "other"`、`keepalive` 付きで送信) |
| `page` | ブラウザ | `dashboard`、`navigation`、`mapping`、`other`。ping が更新するウォッチドッグ段階を決めます。 |
| `origin` | バックエンド、`DEPLOYMENT_MODE` から | `cloud` または `local`。ボディからは取りません。 |
| `force_takeover` | ブラウザ | オペレーターが引き継ぎ確認に同意したときだけ `true` |

ping はリトライも重複排除もされません。失われた ping こそウォッチドッグが検知すべきものだからです。

## ping 応答 {#ping-response}

`system_feedback`、続いて HTTP 応答の `details.data`:

```json
{
  "status": true,
  "robot_activity": "navigation_ready",
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
  "origin_conflict_side": null,
  "motion_locked": false
}
```

| フィールド | 意味 |
| --- | --- |
| `robot_activity` | スタック検出後の現在のアクティビティ。[アクティビティ値](/ja/development/message-contracts/mqtt-commands#robot-activity) 参照 |
| `active_page` | スタック検出前に最後にロボットを claim したページ。ダッシュボードを正しいタブへ戻すのに使います |
| `battery` | 充電率、パーセント (float) |
| `uptime` | ノード起動からの分 |
| `hw_status` | ハードウェアモニターの状態 (`ready`、`fault`、...) |
| `manual_override` | 手動操作が有効 |
| `autopilot` | オートパイロットが有効 |
| `active_map_id` | 実行中のナビゲーションセッションのマップ ULID、または `null` |
| `in_use` | **別アカウント** がリースを保持中。ユニット一覧は *In Use* と表示し、選択を拒否します。誰も見ていないオートパイロット中のユニットは `false` で、次のオペレーターが走行を引き継げます。 |
| `in_use_by` | 保持者のユーザー ULID |
| `origin_conflict` | **同じアカウント** が別タブまたは別サーフェスからリースを保持中。ダッシュボードは引き継ぎ確認を表示します |
| `origin_conflict_side` | `cloud` または `local`、保持者のサーフェス |
| `motion_locked` | `/emergency_pause` が上がっており、UI の表示に関係なくロボットは動きません |

その後バックエンドが `intended_mode`、`map_id`、`sync_status`、`needs_recovery` を合成します。
[HTTP API § ping](/ja/development/message-contracts/http-api#hardware-ping) を参照。

## ハートビートフレーム {#heartbeat-frame}

`src/services/heartbeatService.ts` が `/unit_<ULID>/system_command` に publish します。QoS 0、retain なし、
200 ms ごと、タブごとに 1 つの MQTT クライアント(`clientId` `msd700-hb-<ランダム>`、clean session、keepalive 1 秒):

```json
{
  "header": "hardware",
  "command": "heartbeat",
  "metadata": { "request_id": "heartbeat" },
  "data": { "page": "navigation" }
}
```

ロボットが読むのは `page` だけです。リース、claim や release、`origin`、フィードバックはありません。
存在を示すだけの信号です。

## クラウドの presence ping (ブリッジのエントリ) {#presence-ping}

MQTT ブリッジは、`hardware.ping` とは独立した ping/pong の組も運んでいます:

| 側 | ROS トピック | MQTT トピック |
| --- | --- | --- |
| ロボット、送信 | `/msd/ping` | `/unit_<ULID>/server/ping` |
| ロボット、受信 | `/msd/pong` | `/unit_<ULID>/msd/pong` |
| クラウド、送信 | `/unit_<ULID>/server/ping` | `/unit_<ULID>/msd/ping` |
| クラウド、受信 | `/unit_<ULID>/server/pong` | `/unit_<ULID>/server/pong` |

現在のソースで `/msd/ping` や `/unit_<ULID>/server/ping` を publish するノードはなく、名前も端から端まで
対応していないため、現状ここを流れるものはありません。ダッシュボードでのユニットの生存確認は上の ping 応答から得ます。

## 関連ドキュメント

- [安全ウォッチドッグ](/ja/development/ros/safety-watchdog): これらの信号が供給する段階。
- [ナビゲーション: ROS 連携](/ja/development/webui/navigation/ros-integration): ダッシュボードがリースのフィールドにどう反応するか。
- [MQTT コマンド](/ja/development/message-contracts/mqtt-commands): 両フレームが使うエンベロープ。
