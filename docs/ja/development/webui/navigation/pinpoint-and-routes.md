---
outline: deep
search: false
---

# ナビゲーション: ピンポイント & ルート

<RoleBadge role="developer" />

ナビゲーション画面のポイント・アンド・ゴー系モード。Single Pinpoint、Save/Load RouteとRound
Trip/Loop RouteコントロールをともなうMultiple Pinpoint、Set Home Base、Delete All
Pinpointsである。これらのモードが基盤とするcanvasレンダリングパイプラインと座標計算、および選択に用いるMode
List/Action Barパターンについては[概要](/ja/development/webui/navigation/overview)を参照。手動運転とAutopilotへの引き継ぎについては[手動操作 &
オートパイロット](/ja/development/webui/navigation/manual-and-autopilot)を参照。

## canvas上への点の配置

本ページでマーカーを落とす各モード(単一のピンポイント、複数点ルート内のウェイポイント、あるいは新しいホームベース位置)はすべて、
[概要 § 座標変換](/ja/development/webui/navigation/overview#座標変換-メートル空間から画面ピクセルへ)で説明した同じクリック・トゥ・メートル変換を通る。canvas上のクリックは、
[概要 § `createjs.Stage.prototype`パッチ](/ja/development/webui/navigation/overview#createjs-stage-prototypeパッチ)で説明したように`createjs.Stage.prototype`にパッチされた`stage.globalToRos`によって、ピクセル座標からROSのメートル座標に変換される。

これは、keep-outゾーンやカバレッジエリアに使われる閉ループのポリゴン描画(カーソルに追従する一時的な辺をラバーバンド表示し、開始頂点から15ピクセル以内でスナップして閉じる)よりも軽量なcanvasのインタラクティブ描画エンジンの使い方である。ピンポイント配置は単一頂点の操作であり、クリックごとに1つのメートル座標を記録して1つのマーカーを落とす。閉じる工程は不要である。ピンポイントは境界ではなく目的地だからだ。

## Single Pinpoint

一度きりのポイント・アンド・ゴーモード。オペレーターがcanvas上の目的地をクリックすると、そのクリックがメートル単位のゴールに変換され、ロボットはその単一の点へ向けて発進する。

**メッセージ仕様:** ピンを置いただけでは何も送らない。Play は [rosbridge 経由の `move_base` ゴール](/ja/development/message-contracts/rosbridge#move-base-action)
(ロボットへは [`string/move_base/goal`](/ja/development/message-contracts/bridge-topics#json-goal) として届く)を送り、
[`operation_sync` `batch`](/ja/development/message-contracts/operation-sync#batch)(`single_pinpoint`)で走行を記録する。完了は
`server/move_base/status` と `/result` で戻り、各 result は [`result_ack`](/ja/development/message-contracts/bridge-topics#acks) で ACK される。
Pause と Stop はゴールをキャンセルし([`cancel`](/ja/development/message-contracts/bridge-topics#json-cancel))、
[`pause`](/ja/development/message-contracts/operation-sync#pause) または [`stop`](/ja/development/message-contracts/operation-sync#stop-complete) を送る。

## Multiple Pinpoint

同じクリックで配置する仕組みを繰り返し、順序付けられたウェイポイントの並びを構築する。ロボットはそれを順に巡回する。

**メッセージ仕様:** ブラウザはウェイポイントごとに 1 つの [`move_base` ゴール](/ja/development/message-contracts/rosbridge#move-base-action) を送り、
完了したら次に進む。走行は [`batch`](/ja/development/message-contracts/operation-sync#batch)(`multi_pinpoint`、`route_mode` と全 `waypoints`)で
記録され、送出した各ウェイポイントは [`progress`](/ja/development/message-contracts/operation-sync#progress) で、ルートの終わりは
[`complete`](/ja/development/message-contracts/operation-sync#stop-complete) で反映される。Autopilot がオンなら、ロボットの supervisor が送出する
([`takeover`](/ja/development/message-contracts/operation-sync#takeover))。

### Save Route / Load Route

Multiple Pinpointの並びは`SaveRouteModal.tsx`によって名前を付けて永続化でき、後から`LoadRouteModal.tsx`で呼び出すと、保存済みのウェイポイント列がcanvasに再現される。どちらの経路での失敗も、
[概要 § 補助UI](/ja/development/webui/navigation/overview#補助ui)で説明した`TopToast`コンポーネントを通じて表示される。

**メッセージ仕様:** Save Route はピンポイントを `route_points`(点ごとに ROS の姿勢 1 つ)とした
[`POST /api/routes`](/ja/development/message-contracts/http-api#routes) で、続いてキャンバスのサムネイルを
[`POST /api/media/uploadRouteImage`](/ja/development/message-contracts/http-api#media-server) に送る。Load Route は
[`GET /api/routes/:map_id`](/ja/development/message-contracts/http-api#routes) と、サムネイル用の `GET /api/media/images/<ルート id>.jpg`。名前変更と
削除は `PUT` と `DELETE /api/routes/:id`。いずれもロボットには届かない。

### Round Trip / Loop Route

`RouteControls.tsx`は、Multiple Pinpointルートが最後のウェイポイントに到達したときに何が起こるかを変える、Round TripとLoop Routeという2つの独立したトグルを、上記のSave/Load Routeコントロールと並べて公開している。

**メッセージ仕様:** このモードは単独ではロボットに送られず、保存ルートにも含まれない。
[`operation_sync` `batch`](/ja/development/message-contracts/operation-sync#batch) の `route_mode`(`basic`、`round-trip`、`loop`)と走行の
`direction` として運ばれ、supervisor が引き継いだときにパターンを続けられるようにする。

## Set Home Base

canvasをクリックすることでロボットのホーム位置を配置または更新し、データベースサービス層の`updateHomebase`を呼び出す。これはDatabase画面に表示されるのと同じホームベース位置(`homebase_x`/`homebase_y`列。
[Database概要 § マップ一覧](/ja/development/webui/database/overview#マップ一覧)を参照)であり、Action BarのReturn to Home Baseアクションが使う目的地でもある
(([概要 § 1つのページ、多数のモード](/ja/development/webui/navigation/overview#_1つのページ、多数のモード))を参照)。

**メッセージ仕様:** `{ x, y, z, ox, oy, oz, ow }` を付けた
[`PUT /api/maps_data/homebase/:mapId`](/ja/development/message-contracts/http-api#map-homebase)、続いてそこへの走行を
[`move_base` ゴール](/ja/development/message-contracts/rosbridge#move-base-action) として送り、操作 `homebase` の [`batch`](/ja/development/message-contracts/operation-sync#batch)
で記録する。保存したばかりのマップでは、ホームベースは [`mapping.stop`](/ja/development/message-contracts/mqtt-commands#mapping) に含まれて届き、
`navigation.init` がロボットの `/initialpose` に渡す([MQTT `navigation`](/ja/development/message-contracts/mqtt-commands#navigation))。

## Delete All Pinpoints

特定のモードに紐づくものではなく、Mode List内の恒久的なエントリである。配置済みのすべてのピンポイントを一度に消去する。削除するものが何もないときはグレーアウトされる。

**メッセージ仕様:** クライアントのみ。ロボットにもバックエンドにも何も送らない。

## 関連

- [メッセージ仕様 § ナビゲーションページ](/ja/development/message-contracts/#trace-navigation): これらのモードが送る全メッセージを 1 つの表で。
- [概要](/ja/development/webui/navigation/overview): これらのモードが基盤とするMode
  List/Action Barパターン、canvasパイプライン、座標変換。
- [手動操作 & オートパイロット](/ja/development/webui/navigation/manual-and-autopilot): 手動運転、
  Autopilotへの引き継ぎ、アクティビティからタブへのルーティング。
- [マップ同期 & アラインメント](/ja/development/webui/navigation/map-sync-and-alignment)
- [カバレッジ清掃](/ja/development/webui/navigation/coverage-cleaning)
- [ROS連携](/ja/development/webui/navigation/ros-integration)
- [アーキテクチャ](/ja/development/architecture)
- [状態 & 挙動](/ja/development/state-and-behavior)
