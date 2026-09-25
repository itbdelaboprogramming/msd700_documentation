---
outline: deep
search: false
---

# WebSocket と rosbridge プロトコル

<RoleBadge role="developer" />

このドキュメントは `rosbridge_suite` が提供する WebSocket インターフェースについて詳述し、JSON プロトコル仕様、メッセージのサブスクリプション形式、サービス呼び出しスキーマ、圧縮技術、Web キャンバスのレンダリング統合を説明します。

## rosbridge アーキテクチャ概要

Web ダッシュボードは、永続的な WebSocket 接続を介して `rosbridge_server` 経由でライブの ROS トピックおよびサービスとやり取りします。

![rosbridge アーキテクチャ概要](../../development/diagrams/rosbridge-protocol-rosbridge-architecture-overview.drawio)

## 接続エンドポイント

| 環境 | プロトコル & パス | 接続先ポート |
| --- | --- | --- |
| **本番サーバー** | `wss://msd.nglobal.jp/services/rosbridge` | 内部の `localhost:9090` へプロキシされる |
| **開発サーバー** | `ws://<server-ip>:9091` | 開発用 rosbridge コンテナへの直接 WebSocket |
| **ユニットローカルサーバー** | `ws://<unit-ip>:9090` | オンボードの `rosbridge_suite` への直接 WebSocket |

## rosbridge プロトコルの操作

rosbridge v2 プロトコルは、標準化された JSON 操作(`op`)を使用します。

### 1. トピックのサブスクリプション(`op: "subscribe"`)
ブラウザへの ROS トピックのストリーミングを開始します。

```json
{
  "op": "subscribe",
  "id": "sub_robot_pose_1",
  "topic": "/unit_01JZ8P9WZ0UNIT00000000000/server/robot_pose",
  "type": "geometry_msgs/PoseStamped",
  "throttle_rate": 40,
  "queue_length": 1,
  "compression": "none"
}
```

- `topic`: ユニットの ULID 名前空間を含む、完全修飾された ROS トピック名。
- `throttle_rate`: メッセージ間の最小時間(ミリ秒単位、例: 40 ms = 25 Hz)。
- `compression`: `none` または `png`(高帯域幅の占有グリッド用)をサポート。

### 2. トピックのパブリッシュ(`op: "publish"`)
ブラウザから ROS master へ型付きの ROS メッセージをパブリッシュします。

```json
{
  "op": "publish",
  "id": "pub_cmd_vel_1",
  "topic": "/unit_01JZ8P9WZ0UNIT00000000000/server/key_vel",
  "type": "geometry_msgs/Twist",
  "msg": {
    "linear": { "x": 0.35, "y": 0.0, "z": 0.0 },
    "angular": { "x": 0.0, "y": 0.0, "z": 0.50 }
  }
}
```

### 3. サービス呼び出し(`op: "call_service"`)
ROS サービスを同期的に呼び出します。

```json
{
  "op": "call_service",
  "id": "srv_call_102",
  "service": "/unit_01JZ8P9WZ0UNIT00000000000/server/global_localization",
  "args": {}
}
```

- **サービスレスポンスのエンベロープ**:
```json
{
  "op": "service_response",
  "id": "srv_call_102",
  "service": "/unit_01JZ8P9WZ0UNIT00000000000/server/global_localization",
  "values": {},
  "result": true
}
```

## 主要な Web キャンバスのサブスクリプション

Web ダッシュボード(`ROS-dashboard-next-ts`)は、以下の主要なビジュアルトピックをサブスクライブします。

| トピック識別子 | ROS メッセージ型 | キャンバス上の目的 |
| --- | --- | --- |
| `/server/robot_pose` | `geometry_msgs/PoseStamped` | 2D ロボットアイコンの位置と向きの矢印を更新する(25 Hz)。 |
| `/server/slam/map` | `nav_msgs/OccupancyGrid` | EaselJS キャンバス上にライブの SLAM フロアプランビットマップをレンダリングする。 |
| `/server/scan` | `sensor_msgs/LaserScan` | ロボット周囲に赤いレーザービームの点をレンダリングする。 |
| `/server/move_base/NavfnROS/plan` | `nav_msgs/Path` | 計画されたグローバルナビゲーション軌跡を青色でレンダリングする。 |
| `/server/move_base/TebLocalPlannerROS/local_plan` | `nav_msgs/Path` | 動的なローカル軌跡線をレンダリングする。 |
| `/server/boustrophedon_path` | `nav_msgs/Path` | ボウストロフェドン・エリアカバレッジのスイープパスをオレンジ色でレンダリングする。 |

## フロントエンドのレジリエンスとセルフヒーリング

1. **`ROS2D.js` Stage プロトタイプのパッチ**: 高速なコンポーネント再マウント時に EaselJS の stage オブジェクトが ROS 座標変換関数を失うことで発生するクラッシュを防ぐため、フロントエンドはビューアのインスタンス化前に `globalToRos` と `rosToGlobal` メソッドを `createjs.Stage.prototype` に動的に注入します。
2. **再接続のデバウンス**: WebSocket が切断された場合、クライアントは切断警告を表示する前に3回連続の再接続試行を待ちます。これにより、一時的なネットワークの不具合の間の UI のちらつきを防ぎます。

## 関連ドキュメント

- [メッセージ仕様](/ja/development/message-contracts): MQTT とシリアライズされたトピックの仕様。
- [アーキテクチャ](/ja/development/architecture): 2マシンモデルと rosbridge ルーティング。
- [API リファレンス](/ja/development/api-reference): HTTP REST API エンドポイント。
