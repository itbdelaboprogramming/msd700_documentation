---
outline: deep
search: false
---

# rosbridge (WebSocket)

<RoleBadge role="developer" />

ストリーミングチャネル([経路 B](/ja/development/message-contracts/#two-control-paths))のブラウザ側です。
ダッシュボードはクラウドの ROS マスター(ローカルダッシュボードではユニット自身のもの)への rosbridge v2
WebSocket を 1 本保持し、その上で roslibjs を使います。rosbridge のサービス呼び出しは **使いません**。
応答が必要なものはすべて [HTTP API](/ja/development/message-contracts/http-api) を通ります。

![rosbridge アーキテクチャ概要](../../../development/message-contracts/diagrams/rosbridge-protocol-rosbridge-architecture-overview.drawio)

## エンドポイント {#endpoints}

| 環境 | URL | バックエンド |
| --- | --- | --- |
| 本番クラウド | `wss://msd.nglobal.jp/services/rosbridge` | Apache → `localhost:9090` |
| 開発クラウド | `ws://<server-ip>:9091` | 開発用 rosbridge |
| ユニットのローカルダッシュボード | `ws://<unit-ip>:9090` | ユニットの `rosbridge_suite` |

ビルド時に `NEXT_PUBLIC_WS_ROSBRIDGE_URL` として設定します。以下のトピック名はすべて
[`GET /unit/all`](/ja/development/message-contracts/http-api#unit-list) で得たユニットの `topic_root` で始まり、
ここでは `<root>` と書きます。

## ワイヤー操作 {#operations}

roslibjs は標準の rosbridge v2 JSON 操作を使います:

```json
{ "op": "subscribe", "id": "subscribe:/unit_01JZ.../server/robot_pose:1",
  "topic": "/unit_01JZ.../server/robot_pose", "type": "geometry_msgs/Pose", "throttle_rate": 40 }

{ "op": "advertise", "id": "advertise:/unit_01JZ.../server/key_vel:2",
  "topic": "/unit_01JZ.../server/key_vel", "type": "geometry_msgs/Twist" }

{ "op": "publish", "id": "publish:/unit_01JZ.../server/key_vel:3",
  "topic": "/unit_01JZ.../server/key_vel",
  "msg": { "linear": { "x": 0.4, "y": 0, "z": 0 }, "angular": { "x": 0, "y": 0, "z": 0 } } }

{ "op": "publish", "topic": "/unit_01JZ.../server/slam/map", "msg": { "...": "..." } }
```

`throttle_rate` は最小間隔(ms、40 = 25 Hz)です。マップの subscribe は `compression: "png"` を要求するので、
rosbridge はグリッドを PNG エンコードしたペイロードで送ります。

::: tip advertise は一度、publish は何度でも
同じ瞬間に advertise と publish をしたトピックは、最初のメッセージを失うことがあります。新しい ROS publisher が、
それを subscribe するリレーにまだ接続されていないためです。そのためダッシュボードは名前ごとに advertise 済みの
`ROSLIB.Topic` をセッション中 1 つ保持し(`operation_sync`、`boustrophedon_path_ack`、`result_ack`)、
`operation_sync` はソケットが開いた時点で advertise します。
:::

## Subscribe {#subscriptions}

| トピック | 型 | 描画内容 / 用途 | 送信元の仕様 |
| --- | --- | --- | --- |
| `<root>/server/robot_pose` | `geometry_msgs/Pose` | ロボットのマーカーと向き、25 Hz | [姿勢](/ja/development/message-contracts/bridge-topics#json-pose) |
| `<root>/server/slam/map` | `nav_msgs/OccupancyGrid` | マップ。0x0 のグリッドは「まだマップなし」 | [マップ配信](/ja/development/message-contracts/bridge-topics#map-delivery) |
| `<root>/server/scan` | `sensor_msgs/LaserScan` | LiDAR の点 | [圧縮スキャン](/ja/development/message-contracts/bridge-topics#compressed-formats) |
| `<root>/server/scan_holes` | `sensor_msgs/LaserScan` | ライブの穴 / 段差マーク | 同上 |
| `<root>/server/hazard_cells` | `nav_msgs/Path` | 走行中の穴の累積軌跡 | [圧縮パス](/ja/development/message-contracts/bridge-topics#compressed-formats) |
| `<root>/server/move_base/NavfnROS/plan` | `nav_msgs/Path` | グローバル計画の線 | 同上 |
| `<root>/server/move_base/TebLocalPlannerROS/local_plan` | `nav_msgs/Path` | 短期のローカル計画 | 同上 |
| `<root>/server/boustrophedon_path` | `nav_msgs/Path` | カバレッジのレーン。`header.seq` を ACK | 同上 |
| `<root>/server/skipped_waypoints` | `nav_msgs/Path` | カバレッジ走行で到達できなかったウェイポイント | 同上 |
| `<root>/string/uncovered_regions` | `std_msgs/String` | 未清掃の領域(プレーン JSON) | [トピックマップ](/ja/development/message-contracts/bridge-topics#robot-to-cloud) |
| `<root>/string/operation_progress` | `std_msgs/String` | オートパイロット運転中の supervisor の進捗 | [オペレーション同期](/ja/development/message-contracts/operation-sync#progress-out) |
| `<root>/string/operation_snapshot` | `std_msgs/String` | リロード後や新しいタブでの走行の復元 | [オペレーション同期](/ja/development/message-contracts/operation-sync#snapshot) |
| `<root>/server/move_base/status`、`/result`、`/feedback` | actionlib | 下のアクションクライアント経由 | [status](/ja/development/message-contracts/bridge-topics#json-status)、[result](/ja/development/message-contracts/bridge-topics#json-result) |

## Publish {#publications}

| トピック | 型 | 送信タイミング | ロボットが受け取るもの |
| --- | --- | --- | --- |
| `<root>/server/key_vel` | `geometry_msgs/Twist` | 手動操作中: 10 Hz で送り続ける(キーを押していなければゼロの twist)。加えてウィンドウのフォーカス喪失時と手動操作オフ時にゼロの twist。`linear.x` ±0.4 m/s、`angular.z` ±1.0 rad/s(Shift で 0.2 と 0.5) | [`/mux/key_vel`](/ja/development/message-contracts/bridge-topics#json-twist) |
| `<root>/initialpose` | `geometry_msgs/PoseWithCovarianceStamped` | 姿勢推定、ホームベース姿勢の初期化 | [`/initialpose`](/ja/development/message-contracts/bridge-topics#json-initialpose) |
| `<root>/string/move_base/result_ack` | `std_msgs/String` | 受け取った `move_base` の result ごと、data = `goal_id.id` | [ACK](/ja/development/message-contracts/bridge-topics#acks) |
| `<root>/string/boustrophedon_path_ack` | `std_msgs/String` | 描画したカバレッジパスのリビジョンごと、data = リビジョン | [ACK](/ja/development/message-contracts/bridge-topics#acks) |
| `<root>/string/map_request` | `std_msgs/String` | キャンバスのマウントからマップが描画されるまで、data = `{"reason","at"}` | [マップ配信](/ja/development/message-contracts/bridge-topics#map-delivery) |
| `<root>/string/operation_sync` | `std_msgs/String` | 走行の開始、ウェイポイント、一時停止、停止、オートパイロットの変更ごと | [オペレーション同期](/ja/development/message-contracts/operation-sync) |

`initialpose` トピックは `server/` の子ではなく兄弟です。クラウドのリレーは `<root>/initialpose` を subscribe します。

## `move_base` アクションクライアント {#move-base-action}

ピンポイント、ルート、ホームベースへの走行は、`public/script/Nav2D.js` の roslibjs `ActionClient`
(`serverName: <root>/server/move_base`、`actionName: move_base_msgs/MoveBaseAction`)で送る `move_base` ゴールです。
内部的には 5 つのトピックです:

| トピック | 方向 | 型 |
| --- | --- | --- |
| `<root>/server/move_base/goal` | ブラウザ → クラウド | `move_base_msgs/MoveBaseActionGoal` |
| `<root>/server/move_base/cancel` | ブラウザ → クラウド | `actionlib_msgs/GoalID` |
| `<root>/server/move_base/status` | クラウド → ブラウザ | `actionlib_msgs/GoalStatusArray` |
| `<root>/server/move_base/result` | クラウド → ブラウザ | `move_base_msgs/MoveBaseActionResult` |
| `<root>/server/move_base/feedback` | クラウド → ブラウザ | `move_base_msgs/MoveBaseActionFeedback`(リレーは生成しない) |

ブラウザが組み立てるゴールメッセージ:

```json
{
  "target_pose": {
    "header": { "frame_id": "map" },
    "pose": {
      "position": { "x": 4.5, "y": 2.0, "z": 0.0 },
      "orientation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
    }
  }
}
```

| 振る舞い | 規則 |
| --- | --- |
| 配送 | そのゴールの status か result が届くまで、同じゴール(同じ `goal_id`)を 1 秒ごとに最大 60 回再送します。 |
| 完了 | `/result` と `/status` のどちらかから来た最初の終端コードで決まります: `3` → Arrived、`4`/`5`/`9` → Failed、`2`/`8` → Cancelled。リスナー登録前に届いた終端メッセージは 2 秒ごとのポーリングで拾います。 |
| result の ACK | 再接続後に届いたものも含め、すべての result を `string/move_base/result_ack` で ACK します。 |
| 複数ウェイポイント | ブラウザは 1 つずつゴールを送り、完了したら次に進みます。Round Trip は最後のウェイポイントで折り返し、Loop は最初から繰り返します。各送出は [`operation_sync` `progress`](/ja/development/message-contracts/operation-sync#progress) で反映されます。 |
| Pause / Stop | 現在のゴールに `goal.cancel()`。結果は `PREEMPTED` (2) で、Arrived とは報告されません。 |

ロボット側では、ゴールとキャンセルは [`string/move_base/goal`](/ja/development/message-contracts/bridge-topics#json-goal) と
[`/cancel`](/ja/development/message-contracts/bridge-topics#json-cancel) を経て `/move_base/goal` と `/move_base/cancel` になります。

## 接続の振る舞い {#connection}

- ページごとに共有接続が 1 本(`window.__msdRos`)。マップコンポーネント、オペレーション同期、カバレッジの
  オーバーレイがすべて使います。テレオペパネルはあればそれを使い、なければ自分で開きます。
- 切れたソケットは静かに再接続します。再接続の表示は短い猶予の後にだけ出るので、一瞬のネットワーク断で UI が
  ちらつきません。
- 再接続後、ダッシュボードは subscribe し直し、`map_request` のループを再開し、走行を復元するため
  [`operation_sync` `resync`](/ja/development/message-contracts/operation-sync#resync) を送ります。

これらのトピックを使ったキャンバス描画: [フロントエンドキャンバス](/ja/development/frontend-canvas)、
[ナビゲーション概要](/ja/development/webui/navigation/overview)。

## 関連ドキュメント

- [ブリッジトピック](/ja/development/message-contracts/bridge-topics): 各トピックがクラウドとロボットの間で運ぶもの。
- [オペレーション同期](/ja/development/message-contracts/operation-sync): `operation_*` トピック。
- [ナビゲーション: ROS 連携](/ja/development/webui/navigation/ros-integration): ページ側から見たこれらのトピック。
