---
outline: deep
search: false
---

# マッピング

<RoleBadge role="developer" />

Mapping画面は、オペレーターが新しい空間でロボットを走らせてSLAMマップを構築し、それを保存する場所である。ダッシュボードの`unit/mapping`(`pages/unit/mapping/index.tsx`)であり、`MappingActionBar`(`src/components/mappingActionBar/mappingActionBar.tsx`)によって駆動される。本ページはこの画面の挙動を説明する。マップ構築中に実際にロボットを動かす2つの方法(自律探索と手動操作)については
[手動操作 &
自律動作](/ja/development/webui/mapping/manual-and-autonomous)を参照。その背後にあるREST/MQTTワイヤー契約とロボット側の保存処理については[ROS連携](/ja/development/webui/mapping/ros-integration)を参照。

## マッピング開始前: 「Ready to Map」

オペレーターがPlayを押すまで、ライブマップビューは`MappingOverlay`というプレースホルダーで覆われており、画面がマッピングセッションを開始する準備ができていることをオペレーターに伝える。SLAMノードは動いておらず、occupancy
gridも存在しないため、まだ描画するものは何もない。

## Play、Pause、Stop

`MappingActionBar`は、マッピングセッションを駆動する3つのコントロールを公開している。

- **Play**はセッションを開始する。Playを押した際のデフォルトの挙動は、ロボットを自律的に走らせる自律フロンティア探索(`explore_lite`)である。これが手動運転とどう相互作用するかについては
  [手動操作 & 自律動作](/ja/development/webui/mapping/manual-and-autonomous)を参照。
- **Pause**はセッションを終了せずに探索を一時的に止める。
- **Stop**はセッションを終了し、以下で説明する保存フローに入る。

ロボットはハートビートのたびに自身のアクティビティ文字列を報告する(`mapping_active`、`mapping_paused`、そして保存に失敗した場合は`mapping_stop_failed`。これはオペレーターが保存を再試行できるようSLAMセッションを維持し続ける)。これらのキーが属する完全なステートマシンは本ページの対象外である。完全な図と遷移表については[状態
& 挙動](/ja/development/state-and-behavior)を参照。

**メッセージ仕様:** Play と Pause は `{ start: true }` または `{ pause: true }` の
[`POST /api/mapping`](/ja/development/message-contracts/http-api#mapping-control) → [`mapping.start` / `mapping.pause`](/ja/development/message-contracts/mqtt-commands#mapping)
(`/switch_mode(explore)`、続いて `operator_pause` モーションロック)。Stop は下の保存フローに進む。

## ライブマップビュー

セッションがアクティブな間、構築中のoccupancy
gridはインラインでレンダーされ、Navigation画面と同じcanvasの仕組みを再利用する。パン、ズーム、回転、そしてロボットのライブポーズへのフォーカス追従である。別のビューアやページは関与しない。

**メッセージ仕様:** 成長するグリッドは [`<root>/server/slam/map`](/ja/development/message-contracts/rosbridge#subscriptions)、姿勢は
`<root>/server/robot_pose` で、どちらも rosbridge 経由。ロボットからの出方は [ブリッジトピック](/ja/development/message-contracts/bridge-topics#topic-map) を参照。

## Robot Stuck通知

`RobotStuckNotification`は、マッピング中にロボットが進捗を止めたように見える場合にバナーを表示する。そのバナーの背後にある検出ロジックはNavigationと共有されており、ここでは再文書化しない。

## マップの保存(Stopフロー)

Stopを押しても即座には保存されない。`ConfirmSaving`(`src/components/confirm-saving-mapping/confirmSaving.tsx`)というダイアログが開き、永続化される前にオペレーターがマップに名前を付ける。確定すると、`MapSaving`進捗オーバーレイが画面を覆い、その間にロボットはマップを書き込みアップロードする(このウィンドウの間にワイヤー上で何が起きるか、なぜ保存が単一のHTTPリクエスト/レスポンス内で完了しないかについては
[ROS連携 §
マッピングセッションの開始と停止](/ja/development/webui/mapping/ros-integration#starting-and-stopping-a-mapping-session)を参照)。

::: info ホームベースのポーズは自動取得され、手入力ではない
マップのホームベースポーズは、マッピング開始後にロボットが最初に報告したポーズから自動的に取得される。オペレーターは保存ダイアログの一部として手動でそれを設定するよう求められることはない。Stopが確定した時点で、マップの他のメタデータと一緒に自動的に付随する。
:::

**メッセージ仕様:** 名前の確認は [`GET /api/media/checkMapName`](/ja/development/message-contracts/http-api#media-server)。保存は
`{ stop: true, map_name, homebase_* }` の [`POST /api/mapping`](/ja/development/message-contracts/http-api#mapping-control) で、即座に
`{ request_id, map_ulid }` を返す。その後オーバーレイは [`GET /api/mapping/progress/:request_id`](/ja/development/message-contracts/http-api#mapping-progress)
を追い、そのイベントはロボットの [`mapping_progress`](/ja/development/message-contracts/mqtt-commands#mapping-progress) メッセージである。破棄は
[`POST /api/mapping/discard`](/ja/development/message-contracts/http-api#mapping-discard)。

## 緊急停止

`EmergencyButton`はMapping画面全体で利用可能である。これをトリガーすると`/emergency-mode`へ抜け、ダッシュボードの他の場所でも使われている同じ共有の緊急フローに入る。

**メッセージ仕様:** [`POST /api/emergency_stop`](/ja/development/message-contracts/http-api#emergency-stop) `{ enable: true }` →
[`emergency_stop.activate`](/ja/development/message-contracts/mqtt-commands#emergency-stop)。

## 共有クローム

画面の残りの部分は、他の操作系ページと共有されるクロームである。`Header`、画面切り替えリンクを持つサイドバー、ライブカメラフィード、Manual
Override / Autopilotパネル(
[手動操作 &
自律動作](/ja/development/webui/mapping/manual-and-autonomous)を参照)、そして`Footer`、`ControlInstruction`、`TokenExpired`である。

## 関連

- [メッセージ仕様 § マッピングページ](/ja/development/message-contracts/#trace-mapping): マッピングセッションが送る全メッセージ。
- [手動操作 & 自律動作](/ja/development/webui/mapping/manual-and-autonomous):
  マッピングセッション中にロボットを運転する2つの方法
- [ROS連携](/ja/development/webui/mapping/ros-integration): REST/MQTTワイヤー契約とロボット側の保存処理
- [アーキテクチャ](/ja/development/architecture)
- [状態 & 挙動](/ja/development/state-and-behavior):
  ロボットのアクティビティステートマシンとセッションの再接続/復旧の挙動(本ページには重複記載していない)
