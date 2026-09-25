---
outline: deep
search: false
---

# ブリッジトピック (MQTT ↔ ROS)

<RoleBadge role="developer" />

ロボットとクラウドの間のストリーミングチャネル([経路 B](/ja/development/message-contracts/#two-control-paths))です。
`topic2string` が型付き ROS メッセージを JSON(または圧縮)文字列に変換し、`aws_mqtt` が各文字列を
`std_msgs/String` のパススルー(`primitive: true`)として運び、反対側で元に戻します。型付きの結果をブラウザが
どう使うかは [rosbridge](/ja/development/message-contracts/rosbridge) にあります。

![ストリーミングテレメトリトピック](../../../development/message-contracts/diagrams/message-contracts-streaming-telemetry-topics.drawio)

ブリッジの設定: ロボット `aws_mqtt/launch/nakayama_msd.launch`、クラウド `aws_mqtt/scripts/gen_bridge_params.py`
(ユニットリレー、ロスターのユニットごとに 1 エントリ)または `nakayama_cloud.launch`(レガシーなユニット単位
コンテナ)。リレー: ロボット `topic2string/launch/msd.launch`、クラウド `topic2string/launch/cloud_multi.launch`。

## トピックマップ {#topic-map}

### ロボット → クラウド {#robot-to-cloud}

| ロボット側のソース | ロボットの文字列トピック | MQTT (`/unit_<ULID>/...`) | クラウドの型付きトピック (`/unit_<ULID>/...`) | 形式 |
| --- | --- | --- | --- | --- |
| `/client/robotpose` | `/string/robotpose` | `string/robotpose` | `server/robot_pose` (`geometry_msgs/Pose`、latched) | [姿勢 JSON](#json-pose) |
| `/map` | `/string/map` | `string/map` | `server/slam/map` (`nav_msgs/OccupancyGrid`) | [圧縮グリッド](#compressed-formats)、[マップ配信](#map-delivery) 参照 |
| `/scan` | `/string/laserscan` | `string/laserscan` | `server/scan` (`sensor_msgs/LaserScan`) | [圧縮スキャン](#compressed-formats) |
| `/scan_holes` | `/string/laserscan_holes` | `string/laserscan_holes` | `server/scan_holes` (`sensor_msgs/LaserScan`) | 圧縮スキャン |
| `/msd700/hazard_cells` | `/string/hazard_cells` | `string/hazard_cells` | `server/hazard_cells` (`nav_msgs/Path`) | [圧縮パス](#compressed-formats) |
| `/move_base/NavfnROS/plan` | `/string/move_base/NavfnROS/plan` | 同じ | `server/move_base/NavfnROS/plan` (`nav_msgs/Path`) | 圧縮パス |
| `/move_base/TebLocalPlannerROS/local_plan` | `/string/move_base/TebLocalPlannerROS/local_plan` | 同じ | `server/move_base/TebLocalPlannerROS/local_plan` (`nav_msgs/Path`) | 圧縮パス。ロボット側で `odom` → `map` に座標変換 |
| `/msd700/boustrophedon_path` | `/string/boustrophedon_path` | `string/boustrophedon_path` | `server/boustrophedon_path` (`nav_msgs/Path`) | 圧縮パス。`header.seq` はブラウザが [ACK](#acks) するリビジョン |
| `/msd700/skipped_waypoints` | `/string/skipped_waypoints` | `string/skipped_waypoints` | `server/skipped_waypoints` (`nav_msgs/Path`) | 圧縮パス |
| `/msd700/coverage_debug` | (なし) | `string/coverage_debug` | 文字列のまま | プレーン JSON |
| `/msd700/uncovered_regions` | (なし) | `string/uncovered_regions` | 文字列のまま | プレーン JSON |
| `/msd700/coverage_status` | (なし) | `string/coverage_status` | 文字列のまま | `running`、`complete`、`aborted` |
| `/move_base/status` | `/string/move_base/status` | `string/move_base/status` | `server/move_base/status` (`actionlib_msgs/GoalStatusArray`) | [status JSON](#json-status) |
| `/move_base/result` | `/string/move_base/result` | `string/move_base/result` | `server/move_base/result` (`move_base_msgs/MoveBaseActionResult`) | [result JSON](#json-result)、[ACK](#acks) まで再送 |
| `operation_supervisor` | `/string/operation_progress` | `string/operation_progress` | 文字列のまま | [オペレーション同期](/ja/development/message-contracts/operation-sync#progress-out) |
| `operation_supervisor` | `/string/operation_snapshot` | `string/operation_snapshot` | 文字列のまま、リレーで latched | [オペレーション同期](/ja/development/message-contracts/operation-sync#snapshot) |
| `system_command.py` | `/system_feedback` | `system_feedback` | (`backend_node` が MQTT で読む) | [フィードバックエンベロープ](/ja/development/message-contracts/mqtt-commands#feedback-envelope) |

リレーは `string/map`、計画とカバレッジのオーバーレイ、`hazard_cells`、`operation_snapshot` を latch するので、
遅れて subscribe したブラウザも最後の値を受け取れます。

### クラウド → ロボット {#cloud-to-robot}

| クラウドの型付きトピック (`/unit_<ULID>/...`) | クラウドの文字列トピック | MQTT (`/unit_<ULID>/...`) | ロボットのトピック | 形式 |
| --- | --- | --- | --- | --- |
| `server/move_base/goal` (`move_base_msgs/MoveBaseActionGoal`) | `string/move_base/goal` | 同じ | `/string/move_base/goal` → `/move_base/goal` | [goal JSON](#json-goal) |
| `server/move_base/cancel` (`actionlib_msgs/GoalID`) | `string/move_base/cancel` | 同じ | `/string/move_base/cancel` → `/move_base/cancel` | [cancel JSON](#json-cancel) |
| `initialpose` (`geometry_msgs/PoseWithCovarianceStamped`) | `string/initialpose` | 同じ | `/string/initialpose` → `/initialpose` | [initialpose JSON](#json-initialpose) |
| `server/key_vel` (`geometry_msgs/Twist`) | `string/key_vel` | 同じ | `/string/key_vel` → `/mux/key_vel` | [twist JSON](#json-twist) |
| (ブラウザが文字列を publish) | `string/move_base/result_ack` | 同じ | `/string/move_base/result_ack` | [ACK](#acks) |
| (ブラウザが文字列を publish) | `string/boustrophedon_path_ack` | 同じ | `/string/boustrophedon_path_ack` | [ACK](#acks) |
| (ブラウザが文字列を publish) | `string/operation_sync` | 同じ | `/string/operation_sync` | [オペレーション同期](/ja/development/message-contracts/operation-sync) |
| (ブラウザが文字列を publish) | `string/map_request` | 同じ | `/string/map_request` | [マップ要求](#map-delivery) |
| (`backend_node` が MQTT で) | | `system_command` | `/system_command` | [コマンドエンベロープ](/ja/development/message-contracts/mqtt-commands#command-envelope) |

ロボットとクラウドは別々の ROS クロックで動くため、ゴール、初期姿勢、パスのスタンプは境界で受信側の時刻に
書き換えられます(`clock_boundary.BoundaryPublisher`)。result と status は `goal_id.id` で照合され、変更されずに通ります。

## JSON 文字列の形式 {#json-formats}

### 姿勢 {#json-pose}

`/string/robotpose`。コンパクトな JSON で、位置は小数 3 桁、クォータニオンは 6 桁に丸めます:

```json
{"position":{"x":1.234,"y":-0.5,"z":0.0},"orientation":{"x":0.0,"y":0.0,"z":0.382683,"w":0.92388}}
```

最大 25 Hz で送られますが、姿勢がデッドバンドを超えて動いたときだけです。誰も見ていない停車中のロボットでは、
最長 25 秒ごとに繰り返されます(`max_silence.idle`)。

### ゴール {#json-goal}

`string/move_base/goal`。クラウドの `action_server.py` がブラウザの `MoveBaseActionGoal` から書き出します:

```json
{
  "header": { "seq": 2, "stamp": { "secs": 0, "nsecs": 0 }, "frame_id": "" },
  "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" },
  "goal": {
    "target_pose": {
      "header": { "seq": 0, "stamp": { "secs": 1758547188, "nsecs": 323692321 }, "frame_id": "map" },
      "pose": {
        "position": { "x": 6.01, "y": 0.95, "z": 0.0 },
        "orientation": { "x": 0.0, "y": 0.0, "z": -0.0157, "w": -0.9999 }
      }
    }
  }
}
```

ブラウザは、そのゴールの status か result が届くまで同じゴール(同じ `goal_id`)を毎秒再送します。ロボットの
`action_client.py` は既に見た `goal_id` を捨てます。

### キャンセル {#json-cancel}

```json
{ "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" } }
```

ブラウザは自分のゴールを `id` でキャンセルします。空の `id` はすべてのゴールをキャンセルします。ロボット自身の
ハンドラー(手動操作、カバレッジ停止、非常停止解除)はそれを `/move_base/cancel` に直接 publish します。

### ステータス {#json-status}

```json
{
  "header": { "seq": 51, "stamp": { "secs": 1758547190, "nsecs": 0 }, "frame_id": "" },
  "status_list": [
    { "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" }, "status": 1, "text": "" }
  ]
}
```

リストが変わったとき(`id`、`status`、`text` をハッシュ)に送られ、それ以外は最長 2 秒ごとに繰り返されます
(`status_heartbeat`)。`status` は actionlib のコードです: `1` active、`2` preempted、`3` succeeded、
`4` aborted、`5` rejected、`8` recalled、`9` lost。

### リザルト {#json-result}

```json
{
  "header": { "seq": 3, "stamp": { "secs": 1758547230, "nsecs": 0 }, "frame_id": "" },
  "status": {
    "goal_id": { "stamp": { "secs": 0, "nsecs": 0 }, "id": "goal_0.0481_1758547188322" },
    "status": 3,
    "text": "Goal reached."
  }
}
```

### 初期姿勢 {#json-initialpose}

`geometry_msgs/PoseWithCovarianceStamped` の JSON: `header`、続いて `pose.pose.position`、`pose.pose.orientation`、
36 個の値を持つ `pose.covariance`。キーの配置は ROS メッセージと同じです。

### Twist {#json-twist}

```json
{ "linear": { "x": 0.4, "y": 0.0, "z": 0.0 }, "angular": { "x": 0.0, "y": 0.0, "z": 1.0 } }
```

ロボットは `/mux/key_vel`(twist_mux 優先度 90)に再 publish します。チャネルは
[`manual.enable`](/ja/development/message-contracts/mqtt-commands#manual) の間だけ開いており、0.5 秒途切れると
ロボットは止まります。

### 圧縮形式 {#compressed-formats}

| ストリーム | エンコード |
| --- | --- |
| パス (`plan`、`local_plan`、`boustrophedon_path`、`hazard_cells`、`skipped_waypoints`) | `base64(zlib(JSON))`、JSON = `{ header, poses: [{ header, pose }] }` |
| レーザースキャン (`laserscan`、`laserscan_holes`) | `base64(zlib(Q1))`、量子化したスキャン(`q1_encode`)。量子化が無効なら ROS でシリアライズした `LaserScan` |
| マップ | `base64(zlib(M1))`、セルは生の int8 で詰めたもの。デコーダーは旧形式 `base64(zlib(JSON))` も受け付けます |

## 信頼性のための ACK {#acks}

| ACK トピック | ペイロード (`std_msgs/String`) | 閉じるループ |
| --- | --- | --- |
| `string/move_base/result_ack` | result の `goal_id.id` | `action_client.py` は終端 result を ACK されるまで毎秒(最長 300 秒)再 publish します。result が 1 つ失われても複数ウェイポイントの走行が止まりません |
| `string/boustrophedon_path_ack` | パスのリビジョン(`header.seq`)を 10 進文字列で | カバレッジノードは保持するリビジョンが ACK されるまでパスのオーバーレイを再送します |

## マップ配信 {#map-delivery}

マップはリンク上で最大のペイロードで、オペレーターにとって欠かせない唯一のものです。ロボットはグリッドの内容を
ハッシュし、変わったときだけ送ります。加えて、誰かが見ていれば 60 秒ごと、誰も見ていなければ 300 秒ごとに
ハートビートとして送ります。ナビゲーションモードではグリッドは `map_server` から来て変化しないため、実際には
ハートビートごとに 1 通です。QoS 0 の 1 通を確実に届けるため、3 つの仕組みがあります:

| 仕組み | 場所 | 対象 |
| --- | --- | --- |
| リレーが `/unit_<ULID>/string/map` を latch | `aws_mqtt/scripts/gen_bridge_params.py` | 2 回の送信の間に接続したブラウザ、リレーの再起動(ユニットのロスターが変わるたび) |
| マップの reset または retire 後に `burst_sends`(3)回、`burst_interval`(2 秒)間隔で繰り返し送信 | `topic2string` のマップ圧縮器(nodelet `map_compression.cpp`、Python 版 `map_compression_pipeline.py`) | ロボットがナビゲーションスタックを再起動している最中に、オペレーターが開いたマップ。新しいマッピング走行も |
| プル用チャネル `string/map_request` | ブラウザ → ロボット | それ以外すべて: 失われたパケット、悪いタイミングでマウントしたページ |

ダッシュボードはキャンバスがマウントされるとすぐ `/unit_<ULID>/string/map_request` に publish し、マップが
描画されるまで要求し続けます:

```json
{ "reason": "map-init", "at": 1758547188322 }
```

ロボットは要求頻度を制限する(`request_min_interval`、既定 2 秒)ので、複数タブがあっても追加の送信は 1 回分です。

**0x0 のグリッドは壊れたメッセージではありません。** ロボットはリレーが latch しているグリッドを引退させるために
これを publish します。これがなければ、別のマップを開いたばかりのダッシュボードに前のセッションの部屋が渡されます。
キャンバスはこれを「まだマップがない」として扱い、再度要求します。

| サービス | 呼び出し元 | 効果 |
| --- | --- | --- |
| `/map/reset` | マッピングの停止または破棄、ナビゲーションの停止、非常停止 | ロボットがマップを忘れます。ダッシュボードが既に描いているものはそのまま |
| `/map/retire` | `navigation.init` のみ | 同上に加えて 0x0 の番兵を送ります。別のマップが開かれたからです |

どちらもバースト送信を開始します。`/map/retire` を持たないロボットは通常の reset にフォールバックします。

::: warning
`topic2string/config/egress.yaml` の `change_heartbeat` を延ばす場合は、上の 3 つの仕組みがすべて残っているか
必ず確認してください。変化検出だけだと、送信を取り逃したダッシュボードは次の送信まで実測 ~52 秒待ちました。
:::

## presence と egress プロファイル {#egress-profiles}

見られていないロボットが帯域を使わないよう、`system_command.py` はロボットローカルの `/msd700/viewers` に
latched の `std_msgs/String` を毎秒 publish します: `idle`、`watching`、`driving`。これはユニットの外に出ません。
`topic2string` の `presence_gate.py` がそれを読み、`topic2string/config/egress.yaml` を適用します:

| ストリーム | `idle` | `watching` | `driving` |
| --- | --- | --- | --- |
| `laserscan` | 0 Hz (停止) | 1 Hz | ノード既定 |
| 変化のない `robotpose` の繰り返し | 25 秒ごと | ノード既定 | ノード既定 |
| マップのハートビート | 300 秒、変更は保留 | ノード既定 (60 秒) | ノード既定 |
| グローバル / ローカル計画 | 停止 | ノード既定 | ノード既定 |
| `move_base` の result 再送と status | 停止 | 有効 (status ハートビート 2 秒) | 有効 |

15 秒間信号がなければ視聴者はいなくなったとみなします。信号がない、または 8 秒より古い場合、すべての
ゲートは `driving` 側に開きます(fail open)。

## 関連ドキュメント

- [rosbridge (WebSocket)](/ja/development/message-contracts/rosbridge): これらのトピックのブラウザ側。
- [ユニットコンテナライフサイクル](/ja/development/unit-container-lifecycle): クラウドのリレーを動かすユニットリレー。
- [ナビゲーション: ROS 連携](/ja/development/webui/navigation/ros-integration): オーバーレイの描画方法。
