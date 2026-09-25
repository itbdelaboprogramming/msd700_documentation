---
outline: deep
search: false
---

# オペレーション同期

<RoleBadge role="developer" />

複数ウェイポイントの走行はブラウザが駆動します(`Nav2D` のループが `move_base` ゴールを 1 つずつ送る)。
ロボット上の `operation_supervisor.py` は走行のコピーを持ち、オートパイロット有効時に送出を引き継ぎ、タブを
閉じた後も走行を続け、戻ってきたダッシュボードに走行を返します。このページは両者の間のプロトコルです。

![Operation Supervisor 同期](../../../development/message-contracts/diagrams/message-contracts-operation-supervisor-synchronization.drawio)

## トピック {#topics}

| ロボットのトピック | MQTT / クラウド (`/unit_<ULID>/...`) | 方向 | 型 |
| --- | --- | --- | --- |
| `/string/operation_sync` | `string/operation_sync` | ブラウザ → supervisor | `std_msgs/String`、JSON |
| `/string/operation_progress` | `string/operation_progress` | supervisor → ブラウザ | `std_msgs/String`、JSON |
| `/string/operation_snapshot` | `string/operation_snapshot` | supervisor → ブラウザ | `std_msgs/String`、JSON、latched |
| `/msd700/supervisor_status` | (ロボット内のみ) | supervisor → `system_command.py` | `std_msgs/String`、`{ active, detail }`、latched |
| `/msd700/autopilot_state`、`/msd700/manual_state` | (ロボット内のみ) | `system_command.py` → supervisor | `std_msgs/Bool`、latched |

ブラウザは rosbridge 経由で `<root>/string/operation_sync` に publish し
([Publish](/ja/development/message-contracts/rosbridge#publications))、残り 2 つを subscribe します。

## ブラウザ → supervisor: `operation_sync` {#sync-messages}

各メッセージは `type` とブラウザの `timestamp`(秒)を持つ JSON オブジェクトです。supervisor は **どの** メッセージを
処理した後でも [スナップショット](#snapshot) を再 publish し、ブラウザはそれでメッセージの到達を確認します。

### `batch` {#batch}

走行を記録します。走行を開始・再開するたびに送られ、前の batch を置き換えます。

```json
{
  "type": "batch",
  "operation": "multi_pinpoint",
  "route_mode": "round-trip",
  "waypoints": [
    { "position": { "x": 1.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } },
    { "position": { "x": 4.5, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } }
  ],
  "current_index": 0,
  "direction": "forward",
  "map_name": "01JZ8QK2H0000000000000MAP",
  "coverage": null,
  "timestamp": 1786503112.913
}
```

| フィールド | 値 | 意味 |
| --- | --- | --- |
| `operation` | `single_pinpoint`、`multi_pinpoint`、`homebase`、`coverage`、`custom_coverage`、`playlist`、`automap` | 走行の種類。supervisor が送出するのはピンポイント系だけで、その他は戻ってきたタブが表示を復元できるよう **記録のみ** です。 |
| `route_mode` | `basic`、`round-trip`、`loop` | 最後のウェイポイントの後どうするか |
| `waypoints` | ROS の姿勢 | 保存済みルートの `route_points` と同じ形 |
| `current_index` | 整数 | 走行が今いるウェイポイント |
| `direction` | `forward`、`backward` | Round Trip でのみ意味を持つ: A-B-C-D の往路のインデックス 2 と復路のインデックス 2 は同じではない |
| `map_name` | マップ ULID | 走行が属するマップ |
| `coverage` | オブジェクトまたは `null` | 記録のみ: `{ use_autocover: true }`、`{ polygon }`、`{ areas, exclusions }` |

### `progress` {#progress}

`{ "type": "progress", "current_index": 3, "direction": "forward" }`。ブラウザがウェイポイントを送出するたびに
送られます。supervisor 自身が運転している間は無視されます。

### `takeover` {#takeover}

`{ "type": "takeover", "current_index": 3, "direction": "backward" }`。オートパイロットがオンになった:
supervisor はこのインデックスからこの向きで送出を始めます。ブラウザは `batch` に続けて `takeover` を送り、
同じウェイポイント数で `paused: false` のスナップショットを最大 2.5 秒待ち、最大 3 回試します。ロボットが
確認しなければ、ブラウザは自分で運転を続けます。

### `release` {#release}

`{ "type": "release" }`。オートパイロットがオフになった: supervisor は手を引き、ブラウザのループが最後の
[`operation_progress`](#progress-out) から再開します。

### `pause` {#pause}

`{ "type": "pause" }`。オペレーターが一時停止: 送出は止まり、batch は保持され、`paused` が `true` になります。

### `stop` と `complete` {#stop-complete}

`{ "type": "stop" }`(オペレーターが停止、またはブラウザが再開できない走行をあきらめた)と
`{ "type": "complete" }`(ルートを完走)は、どちらも batch を消去します。

### `resync` {#resync}

`{ "type": "resync" }`。何も変更せず、supervisor にスナップショットの再 publish を求めます。latched のコピーが
MQTT のホップを越えて新しい購読者に届く保証はないため、接続したばかりのダッシュボードが送ります。

## supervisor → ブラウザ {#supervisor-to-browser}

### `operation_progress` {#progress-out}

supervisor が運転している間と、終了時に publish されます:

```json
{
  "type": "progress",
  "current_index": 2,
  "active": true,
  "operation": "multi_pinpoint",
  "direction": "forward",
  "timestamp": 1786503150.2
}
```

`type` は `progress` または `complete`。ブラウザはインデックスが 2 以上飛んだことでピンポイントの飛ばしを
報告し、release 時には `current_index` と `direction` から自分のループを再開します。

### `operation_snapshot` {#snapshot}

走行の完全な状態。latched で、同期メッセージごとに再 publish されます:

```json
{
  "type": "snapshot",
  "operation": "multi_pinpoint",
  "route_mode": "loop",
  "waypoints": [ { "position": { "x": 1.0, "y": 2.0, "z": 0.0 }, "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } } ],
  "current_index": 0,
  "direction": "forward",
  "map_name": "01JZ8QK2H0000000000000MAP",
  "coverage": null,
  "active": true,
  "driving": false,
  "paused": false,
  "autopilot": false,
  "manual": false,
  "timestamp": 1786503150.2
}
```

| フィールド | 意味 |
| --- | --- |
| `active` | 走行が設定されている: supervisor が運転中、または batch が記録済み |
| `driving` | supervisor 自身がゴールを送出中(オートパイロットの引き継ぎ) |
| `paused` | オペレーターが一時停止。batch は保持、送出なし |
| `autopilot`、`manual` | ロボットのフラグの写し |

新しいタブで開いたダッシュボードは `sessionStorage` を失っているため、ピン、ルートモード、カバレッジの
オーバーレイをこのメッセージから再構築します。

## ロボット側の振る舞い {#robot-side}

| パラメーター | 既定値 | 意味 |
| --- | --- | --- |
| `~goal_timeout` | 300 秒 | 送出したゴールがこれまでに終わらなければ失敗とみなす |
| `~state_max_age` | 3600 秒 | これより古い保存済みの走行は再起動後に復元しない |

supervisor は batch を持ち、オートパイロットが有効、手動操作がオフ、走行が一時停止していない間だけ運転します。
状態をディスクに保存するので、再起動したノードも再開できます。

## 関連ドキュメント

- [ナビゲーション: 手動操作 & オートパイロット](/ja/development/webui/navigation/manual-and-autopilot): 引き継ぎと解除の UI 側。
- [MQTT コマンド § autopilot](/ja/development/message-contracts/mqtt-commands#autopilot): supervisor の運転を許可するフラグ。
- [rosbridge § move_base アクションクライアント](/ja/development/message-contracts/rosbridge#move-base-action): ブラウザのループがゴールを送出する方法。
