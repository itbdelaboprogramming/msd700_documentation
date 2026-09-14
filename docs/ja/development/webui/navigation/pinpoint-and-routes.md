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
[概要 § 座標変換](/ja/development/webui/navigation/overview#座標変換-メートル空間から画面ピクセルへ)で説明した同じクリック・トゥ・メートル変換を通る。canvas上のクリックは、
[概要 § `createjs.Stage.prototype`パッチ](/ja/development/webui/navigation/overview#createjs-stage-prototypeパッチ)で説明したように`createjs.Stage.prototype`にパッチされた`stage.globalToRos`によって、ピクセル座標からROSのメートル座標に変換される。

これは、keep-outゾーンやカバレッジエリアに使われる閉ループのポリゴン描画(カーソルに追従する一時的な辺をラバーバンド表示し、開始頂点から15ピクセル以内でスナップして閉じる)よりも軽量なcanvasのインタラクティブ描画エンジンの使い方である。ピンポイント配置は単一頂点の操作であり、クリックごとに1つのメートル座標を記録して1つのマーカーを落とす。閉じる工程は不要である。ピンポイントは境界ではなく目的地だからだ。

## Single Pinpoint

一度きりのポイント・アンド・ゴーモード。オペレーターがcanvas上の目的地をクリックすると、そのクリックがメートル単位のゴールに変換され、ロボットはその単一の点へ向けて発進する。

## Multiple Pinpoint

同じクリックで配置する仕組みを繰り返し、順序付けられたウェイポイントの並びを構築する。ロボットはそれを順に巡回する。

### Save Route / Load Route

Multiple Pinpointの並びは`SaveRouteModal.tsx`によって名前を付けて永続化でき、後から`LoadRouteModal.tsx`で呼び出すと、保存済みのウェイポイント列がcanvasに再現される。どちらの経路での失敗も、
[概要 § 補助UI](/ja/development/webui/navigation/overview#補助ui)で説明した`TopToast`コンポーネントを通じて表示される。

### Round Trip / Loop Route

`RouteControls.tsx`は、Multiple Pinpointルートが最後のウェイポイントに到達したときに何が起こるかを変える、Round TripとLoop Routeという2つの独立したトグルを、上記のSave/Load Routeコントロールと並べて公開している。

## Set Home Base

canvasをクリックすることでロボットのホーム位置を配置または更新し、データベースサービス層の`updateHomebase`を呼び出す。これはDatabase画面に表示されるのと同じホームベース位置(`homebase_x`/`homebase_y`列。
[Database概要 § マップ一覧](/ja/development/webui/database/overview#マップ一覧)を参照)であり、Action BarのReturn to Home Baseアクションが使う目的地でもある
(([概要 § 1つのページ、多数のモード](/ja/development/webui/navigation/overview#_1つのページ、多数のモード))を参照)。

## Delete All Pinpoints

特定のモードに紐づくものではなく、Mode List内の恒久的なエントリである。配置済みのすべてのピンポイントを一度に消去する。削除するものが何もないときはグレーアウトされる。

## 関連

- [概要](/ja/development/webui/navigation/overview): これらのモードが基盤とするMode
  List/Action Barパターン、canvasパイプライン、座標変換。
- [手動操作 & オートパイロット](/ja/development/webui/navigation/manual-and-autopilot): 手動運転、
  Autopilotへの引き継ぎ、アクティビティからタブへのルーティング。
- [マップ同期 & アラインメント](/ja/development/webui/navigation/map-sync-and-alignment)
- [カバレッジ清掃](/ja/development/webui/navigation/coverage-cleaning)
- [ROS連携](/ja/development/webui/navigation/ros-integration)
- [アーキテクチャ](/ja/development/architecture)
- [状態 & 挙動](/ja/development/state-and-behavior)
