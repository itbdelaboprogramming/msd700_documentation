---
outline: deep
search: false
---

# ROS連携

<RoleBadge role="developer" />

[マッピング](/ja/development/webui/mapping/overview)画面の裏にあるワイヤー契約。SLAMセッションを開始・停止するREST呼び出し、その同じリクエストを`system_command.py`へ運ぶMQTTコマンド/フィードバックエンベロープ、そしてマップが保存される際にロボットがディスク上およびネットワーク越しに実際に行うことである。画面自体の挙動については[概要](/ja/development/webui/mapping/overview)と
[手動操作 & 自律動作](/ja/development/webui/mapping/manual-and-autonomous)を参照。

## マッピングセッションの開始と停止 {#starting-and-stopping-a-mapping-session}

1 つのエンドポイント [`POST /api/mapping`](/ja/development/message-contracts/http-api#mapping-control) でセッション全体を
操作する。1 回の呼び出しで `start`、`pause`、`stop` のうちちょうど 1 つが `true` になる。破棄は専用のエンドポイントを使う。

| ボタン | HTTP | ロボットへの MQTT | ロボット側 |
| --- | --- | --- | --- |
| Play | `POST /api/mapping` `{ unit_id, start: true }` | [`mapping.start`](/ja/development/message-contracts/mqtt-commands#mapping) | `/switch_mode(explore)`。アクティビティ `mapping_active` |
| Pause | `POST /api/mapping` `{ unit_id, pause: true }` | [`mapping.pause`](/ja/development/message-contracts/mqtt-commands#mapping) | `operator_pause` モーションロック。アクティビティ `mapping_paused` |
| Stop、続いて保存 | `POST /api/mapping` `{ unit_id, stop: true, map_name, homebase_* }` | [`mapping.stop`](/ja/development/message-contracts/mqtt-commands#mapping) | 保存とアップロード(下記) |
| Stop、続いて破棄 | [`POST /api/mapping/discard`](/ja/development/message-contracts/http-api#mapping-discard) `{ unit_id }` | [`mapping.discard`](/ja/development/message-contracts/mqtt-commands#mapping) | `/switch_mode(idle)`、`/map/reset` |

オペレーターがマップ名を付けた後に `ConfirmSaving` ダイアログが送る保存リクエスト:

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "stop": true,
  "map_name": "Warehouse Sector 4",
  "homebase_x": 0.0, "homebase_y": 0.0, "homebase_z": 0.0,
  "homebase_ox": 0.0, "homebase_oy": 0.0, "homebase_oz": 0.0, "homebase_ow": 1.0
}
```

`homebase_*` はマッピング開始時に自動取得した姿勢であり([概要 § マップの保存](/ja/development/webui/mapping/overview)
参照)、オペレーターが入力する値ではない。バックエンドはマップ ULID を発行し、`map_name` を表示名とし、姿勢を
ロボットへ渡して、マップ行を作る同じアップロードで保存させる。

::: info 保存は非同期
保存は他のコマンドで使う HTTP の 30 秒の予算より長くかかる
([MQTT コマンド § 相関とリトライ](/ja/development/message-contracts/mqtt-commands#correlation-and-retry) 参照)。
そのため stop の呼び出しはすぐに応答する:

```json
{
  "success": true,
  "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "map_ulid": "01JZ8QK2H0000000000000MAP",
  "msg": "Map save initiated. Track progress via /api/mapping/progress/:request_id"
}
```

その後 `MapSaving` オーバーレイが
[`GET /api/mapping/progress/:request_id?token=<jwt>`](/ja/development/message-contracts/http-api#mapping-progress)
(Server-Sent Events)を開き、終端イベントまで追う。
:::

## MQTTコマンドエンベロープ(`header: "mapping"`)

stop リクエストは `/unit_<ULID>/system_command` 上の `mapping.stop` として、共通の
[コマンドエンベロープ](/ja/development/message-contracts/mqtt-commands#command-envelope) でロボットに届く。
`config.resource` は `map_name` と `map_ulid`(どちらも新しい ULID で、ディスク上のファイル名)、`display_map_name`
(オペレーターが入力した名前)、`created_by`、`unit_id`、7 つの `homebase_*` を持つ。ペイロード全体は
[MQTT コマンド § `mapping`](/ja/development/message-contracts/mqtt-commands#mapping) にあり、後で `navigation.init` が
同じホームベースを読み戻す。

### マッピング進捗フィードバック(`header: "mapping_progress"`)

ロボットは `header: "mapping_progress"` と stop コマンドの `request_id` で `system_feedback` に保存状況を報告し、
バックエンドは各 `data` ブロックを SSE ストリームに転送する:

| `progress` | `stage` |
| --- | --- |
| 15 | `saving_map` |
| 30 | `map_saved` |
| 50 | `uploading` |
| 85 | `upload_complete` または `cloud_pending` |
| 95 | `switching_mode` |
| 100 | `completed`(終端) |
| -1 | `save_failed`(終端) |

最後のイベントは `terminal: true` と `outcome` を持つ:

| Outcome | 説明 |
| --- | --- |
| `completed` | ユニットとクラウドの両方のメディアサーバーに書き込み済み。 |
| `cloud_pending` | ユニットのメディアサーバーのみ。クラウドのコピーは同期で後から。 |
| `failed` | 何も保存されていない。セッションは再試行のため開いたまま(アクティビティ `mapping_stop_failed`)。 |

ロボットが 90 秒沈黙すると、バックエンドが `stage: "no_response"` でストリームを終える。完全な仕様:
[MQTT コマンド § `mapping_progress`](/ja/development/message-contracts/mqtt-commands#mapping-progress)。

## ロボット側の保存: `map_saver`とプリフライトチェック

`mapping` / `stop`がロボットに届いても、無条件にアップロードするわけではない。何かを書き込む前に、プリフライトのヘルスチェックがローカルディスクとメディアエンドポイントに到達可能であることを検証する。

![ロボット側の保存: mapsaverとプリフライトチェック](../../../../development/webui/mapping/diagrams/ros-integration-robot-side-save-mapsaver-and-preflight-c.drawio)

ローカルディスクに書き込めない場合、破損した実行や不完全な実行をディスクに残さないよう、保存は試みられることなく即座に拒否される。プリフライトを通過すると、`map_saver`がoccupancy
gridのアセットを生成する。`.pgm`画像、`.yaml`メタデータファイル、そしてサムネイルである。

## 二段階アップロードとクラウドレプリケーション

`map_saver`の出力は、その後、要求レベルの異なる2つの独立したターゲットへアップロードされる。

| 保存先 | 要求レベル | 失敗した場合の影響 |
| --- | --- | --- |
| **Unitローカルメディアサーバー**(`media_local`、`:3003`) | **必須** | ローカル保存に失敗すると、ロボットはこのマップでナビゲーションできない。オペレーターが保存を再試行できるよう、SLAMセッションはアクティブなまま維持される(`mapping_stop_failed`)。 |
| **Cloud中央メディアサーバー**(`media-server`、`:3003`) | **ベストエフォート** | クラウドへのアップロードが失敗した場合(たとえばロボットがオフラインの場合)、マップは`cloud_pending`としてマークされる。バックグラウンドの`sync_agent`が、インターネット接続が戻り次第、自動的にマップファイルをレプリケートする。 |

この二重ターゲット設計こそが、インターネットのない倉庫で記録されたマップが、そのユニット自身でのナビゲーションに即座に使える理由である。それを制約するのは必須のローカルアップロードのみだからである。クラウドの可用性(他の場所からマップを閲覧するため、あるいはユニットをまたぐバックアップのために必要)は、オペレーターをブロックすることなく`sync_agent`経由で後から追いつく。

この保存フローが相互作用するロボットのアクティビティステートマシンとセッション復旧の挙動については(ここでは繰り返さない)、
[ナビゲーション: 手動操作 &
オートパイロット](/ja/development/webui/navigation/manual-and-autopilot)と[セーフティウォッチドッグ](/ja/development/ros/safety-watchdog)を参照。

## 関連

- [メッセージ仕様 § マッピングページ](/ja/development/message-contracts/#trace-mapping): マッピングセッションが送る全メッセージ。
- [概要](/ja/development/webui/mapping/overview): Play/Pause/Stop、ライブマップビュー、Stop時の保存UIフロー
- [手動操作 & 自律動作](/ja/development/webui/mapping/manual-and-autonomous):
  マッピングセッション中の2つの運転モード
- [アーキテクチャ](/ja/development/architecture)
- [状態 & 挙動](/ja/development/state-and-behavior):
  ロボットのアクティビティステートマシンとセッションの再接続/復旧の挙動
