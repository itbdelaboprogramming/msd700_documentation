---
outline: deep
search: false
---

# ナビゲーション: ROS連携

<RoleBadge role="developer" />

ナビゲーションページ全体の裏にあるワイヤー契約。Mode
Listの各機能(Map Sync、Coverage
Area、ピンポイント運転、手動/オートパイロット)が実際に使用する、あらゆるMQTTコマンドエンベロープ、RESTエンドポイント、rosbridgeサブスクリプションである。本ページは、3つのより大きな共有リファレンス文書
[メッセージ契約](/ja/development/message-contracts)、[APIリファレンス](/ja/development/api-reference)、
[WebSocketとrosbridgeプロトコル](/ja/development/rosbridge-protocol)からナビゲーションに関連する部分だけを抜き出し、関心事ごとに整理したものである。ナビゲーション固有でない事項については、これら3つの文書が引き続き網羅的かつ正典のリファレンスであり、本ページはその内容を丸ごと複製するのではなくリンクで参照する。

これらのワイヤー呼び出しが実装する機能レベルの挙動については、
[概要](/ja/development/webui/navigation/overview)、
[マップ同期 & Auto Align](/ja/development/webui/navigation/map-sync-and-alignment)、
[カバレッジ清掃](/ja/development/webui/navigation/coverage-cleaning)、
[ピンポイント & ルート](/ja/development/webui/navigation/pinpoint-and-routes)、
[手動操作 & オートパイロット](/ja/development/webui/navigation/manual-and-autopilot)を参照。

::: info スコープ
本ページは、ナビゲーションとBoustrophedonのMQTTサブシステム、ハートビート/リースの契約、operation
supervisor同期、ナビゲーションcanvasがレンダーするテレメトリトピック、ナビゲーションとAuto
AlignのRESTエンドポイント、ライブcanvasに供給するrosbridgeサブスクリプションを扱う。Mapping(SLAM)、ハードウェア/エンロールメント、WebRTCシグナリングは扱わない。これらは他の機能領域に属し、上記でリンクした共有リファレンス文書で完全に扱われている。
:::

## MQTTコマンド: ナビゲーションサブシステム

エンベロープの完全な形状、リトライ/タイムアウトのパラメータ、`hardware`/`mapping`サブシステムについては
[メッセージ契約 § コマンドリファレンスカタログ](/ja/development/message-contracts#コマンドリファレンスカタログ)にある。ナビゲーションに関連するコマンド(`header:
"navigation"`)は以下のとおりである。

| コマンド | ペイロード | 目的 |
| --- | --- | --- |
| `init` | `config.resource`: `map_name`(マップULID)、`default_save_path`、`homebase_x/y/z`、`homebase_ox/oy/oz/ow`。トップレベルの`ensure_unpaused: true`。 | 指定したマップでナビゲーションスタックを起動する。`ensure_unpaused`は残存する`/emergency_pause`ロックをクリアし、ナビゲーションが一時停止状態で立ち上がらないようにする。 |
| `pointstamped` | `config.resource`: `X`、`Y`、`Z`。 | `move_base`へ単一のウェイポイントゴールを送信する。 |
| `deactivate` | なし | アクティブなナビゲーションスタックを終了する。 |

コマンドペイロード内の`map_name`と、下記のRESTボディ内の`map_id`は同じマップULIDを指す。このフィールドはHTTP境界でリネームされるが、ロボットへのワイヤー上ではリネームされない。

## MQTTコマンド: Boustrophedonサブシステム

`header: "boustrophedon"`コマンドは[カバレッジ清掃](/ja/development/webui/navigation/coverage-cleaning)を駆動する。

| コマンド | ペイロード | 目的 |
| --- | --- | --- |
| `init` | `config`: `use_autocover`(bool)、`polygon`(単一のカスタム範囲境界)、`areas`(順序付きポリゴン配列: Auto
  Coverageのマップ全体ケース、Custom
  Rangeの単一ポリゴン、またはPlaylistのcover項目)、`exclusions`(keep-outポリゴン、Playlistの`no_cover`項目)、`ensure_unpaused:
  true`。 | 掃引を開始する。`polygon`/`areas`/`exclusions`のどれが埋まるかは、どのCoverage Cleaningのエントリポイントから送信されたかに依存する(Auto
  Coverageはどれも送らず、Custom
  Rangeは`polygon`を送り、Playlistは`areas`と`exclusions`の両方を送る)。 |
| `pause` | `{ "pause": true }`または`{ "pause": false }` | 計画を破棄せずに進行中の掃引を一時停止または再開する。 |
| `deactivate` | なし | カバレッジ計画を完全に停止する。 |

これらのポリゴンを実際の掃引経路に変換するアルゴリズム(セル分解、レーン間隔、障害物処理)は
[Boustrophedonカバレッジ & Zero-Spinアラインメントアーキテクチャ](/ja/development/ros/boustrophedon-and-alignment)で文書化されており、ここでは対象外である。

## ハートビート/リース

ナビゲーションページの読み込みとモード切り替えは、すべて同じハートビート契約に乗る。これは
[メッセージ契約 § ハートビートPingとリース契約](/ja/development/message-contracts#ハートビート-ping-とリース契約)で完全に文書化されている。本ページに最も関連するフィールドは以下のとおり。

- **リクエスト**: `page: "navigation"`と`claim: true`は、読み取り専用のフリート一覧(`claim:
  false`)とは異なり、稼働中のナビゲーションセッションがpingごとに送信するものである。
- **レスポンス**: `robot_activity`(例: `navigating`、`stuck`)と`active_page`はルーティングとstuck検出を駆動する。`manual_override`と`autopilot`は
  [手動操作 &
  オートパイロット](/ja/development/webui/navigation/manual-and-autopilot)で扱う2つのモードを反映する。`in_use`と`origin_conflict`は、このタブが上記のコマンドを発行することすらできるかどうかを制御する。

同じpingのREST側の形は`POST /api/hardware/ping`であり、
[APIリファレンス § ロボットハートビートPing](/ja/development/api-reference#_2-ロボットハートビート-ping)で文書化されている。`data`ブロックはMQTT契約とフィールド単位で一致する。

## Operation Supervisor同期

`operation_supervisor.py`は、ブラウザが`/string/operation_sync`で送信するものをすべてミラーリングする。これにより、マルチピンポイントであれカバレッジであれ、ナビゲーションミッションはブラウザタブが閉じても実行を続ける。完全なプロトコルとシーケンス図は
[メッセージ契約 §
Operation
Supervisor同期](/ja/development/message-contracts#operation-supervisor-同期)にある。ナビゲーション固有の点として、

- Auto Coverage、Custom Range Coverage、またはPlaylist
  runの開始はそれぞれ、その操作を記録する`batch`同期を送信する(`operation: "coverage" |
  "custom_coverage" | "playlist"`と関連する`coverage`ペイロード)。カバレッジ実行は送信された時点ですでにロボット側で走っているため、これは記録専用のミラーであり、supervisorがそれをさらに駆動することはない。
- `takeover`と`release`は、
  [手動操作 &
  オートパイロット](/ja/development/webui/navigation/manual-and-autopilot)のAutopilotトグルが、ウェイポイントのシーケンシングをsupervisorへ引き渡し、また引き戻すために送信するものである。
- `progress`は、ブラウザが自身の制御下でマルチピンポイントルートを進める際に送信される
  (([ピンポイント & ルート](/ja/development/webui/navigation/pinpoint-and-routes))を参照)。

## ストリーミングテレメトリ

ナビゲーションcanvasは、ユニット上で`topic2string`によりシリアライズされ、MQTT経由で運ばれ、cloudサーバー上で`rosbridge`向けに型付きROSメッセージへ再構成されるトピックのみから構築されている。ホップ単位の完全な詳細は
[メッセージ契約 §
ストリーミングテレメトリトピック](/ja/development/message-contracts#ストリーミングテレメトリトピック)にある。ナビゲーションcanvasに具体的に供給されるトピックは以下のとおり。

| ロボットトピック | Cloudサーバートピック | レート | canvasでの役割 |
| --- | --- | --- | --- |
| `/string/robotpose` | `/unit_<ULID>/server/robot_pose` | 25 Hz | ロボットアイコンの位置/向き、および[Show/Hide
  Trace](/ja/development/webui/navigation/coverage-cleaning#show-hide-trace)の元となるポーズストリーム。 |
| `/string/map` | `/unit_<ULID>/server/slam/map` | 変化時 + ハートビート | レンダーされる平面図ビットマップ。キャンバスは次の送信を待たずにマウント時点で要求し、描画されるまで「Loading map from robot...」を表示します。[メッセージ契約 § マップの配送](/ja/development/message-contracts#map-delivery)を参照。 |
| `/string/laserscan` | `/unit_<ULID>/server/scan` | 2 Hz | ロボット周囲の赤いレーザースキャン点。 |
| `/string/move_base/NavfnROS/plan` | `/unit_<ULID>/server/move_base/NavfnROS/plan` | プラン発生時 | ピンポイント/ルートナビゲーション用の青いグローバルプラン線。 |
| `/string/move_base/TebLocalPlannerROS/local_plan` | `/unit_<ULID>/server/move_base/TebLocalPlannerROS/local_plan` | 継続的 | ローカル軌道線。 |
| `/string/boustrophedon_path` | `/unit_<ULID>/server/boustrophedon_path` | プラン発生時 | オレンジ色の[カバレッジパスオーバーレイ](/ja/development/webui/navigation/coverage-cleaning#カバレッジパスオーバーレイ)。 |
| `/string/operation_snapshot` | `/unit_<ULID>/string/operation_snapshot` | ラッチ | 再接続/リロード時にナビゲーションstateを復旧するために使われるミッションの完全なスナップショット。 |

## RESTエンドポイント

[APIリファレンス §
ナビゲーションとミッション送信](/ja/development/api-reference#ナビゲーションとミッション送出)より。

### ナビゲーションモードの初期化: `POST /api/navigation/init`

`map_id`でナビゲーションスタックを起動する。そのマップは、呼び出し元が参加しているレンタル内の要求元ユニットに属していなければならない。呼び出し元からは見えるが同じレンタル上の**別の**ロボットによって記録されたマップは、転送されるのではなく`404`で拒否される。かつては転送していたため、ロボットが一度も記録したことのないマップファイルを見つけられずに静かに失敗する一方で、リクエスト自体は通過していた(この修正の元になったインシデントについては
[APIリファレンス §
ナビゲーションモードの初期化](/ja/development/api-reference#_1-ナビゲーションモードの初期化)を参照)。

### ウェイポイントゴールの送信: `POST /api/navigation/pointstamped`

`{ unit_id, X, Y, Z }`という単一の目的地を送信する。これは上記の`navigation`/`pointstamped`
MQTTコマンドのRESTラッパーである。単一/複数ピンポイント運転がこれをどう使うかについては
[ピンポイント & ルート](/ja/development/webui/navigation/pinpoint-and-routes)を参照。

### Boustrophedonエリアカバレッジの開始: `POST /api/boustrophedon/init`

上記の`boustrophedon`/`init` MQTTコマンド(`unit_id`、`areas`、`exclusions`)のRESTラッパーである。これと兄弟の`deactivate`/`pause`呼び出しのフロントエンドトランスポートは`src/components/navigationMap/coverageApi.ts`にある。どのUI操作がどのフィールドを埋めるかについては
[カバレッジ清掃](/ja/development/webui/navigation/coverage-cleaning)を参照。

### カスタムウェイポイントルートの保存: `POST /api/routes`

名前付きウェイポイント列(`profile_id`、`map_id`、`route_name`、`route_type`、`waypoints`)を永続化する。詳細は
[ピンポイント & ルート](/ja/development/webui/navigation/pinpoint-and-routes)で扱う。同じAPIリファレンスのセクションにあるためここに挙げているにすぎない。

### Auto Alignシステム: `POST /api/autoalign/start`

[APIリファレンス § Auto
Alignシステム](/ja/development/api-reference#auto-align-システム)より、パーティクルフィルター/スキャンマッチの収束チェックを開始する。`api-reference.md`は`start`のみを文書化している。フロントエンドも呼び出す(`src/components/navigationMap/autoAlignApi.ts`)`status`と`reset`の対については、現時点でRESTリファレンス自体には書かれていないため、
[マップ同期 & Auto
Align](/ja/development/webui/navigation/map-sync-and-alignment#api-autoalign-status)でソースから文書化されている。

## rosbridgeサブスクリプション

ナビゲーションcanvasは、
[WebSocketとrosbridgeプロトコル](/ja/development/rosbridge-protocol)で完全に文書化されているWebSocketプロトコルを通じて`rosbridge_suite`と通信する。環境ごとの接続エンドポイント、`subscribe`/`publish`/`call_service`操作の形状、フロントエンドのレジリエンス/自己修復(EaselJSの`createjs.Stage`プロトタイプパッチと3回失敗での再接続デバウンス)はすべてナビゲーションにも変更なく適用され、ここでは繰り返さない。

ナビゲーションが実際にレンダーする
[主要Web Canvasサブスクリプション](/ja/development/rosbridge-protocol#主要な-web-キャンバスのサブスクリプション)のサブセットは、上記の[ストリーミングテレメトリ](#ストリーミングテレメトリ)に挙げたのと同じトピック群であるが、MQTT側の`/unit_<ULID>/server/...`形式ではなく、rosbridge側の名前(例:
`/server/robot_pose`、`/server/boustrophedon_path`)でアドレス指定される。rosbridgeはユニットごとのrelayに対してサブスクライブするため、ULIDセグメントはそのレイヤーの各トピック名に繰り返されるのではなく、ブラウザがどのrelayに接続しているかに暗黙的に含まれる。

## 関連

- [概要](/ja/development/webui/navigation/overview): ナビゲーションページとその完全なMode
  List。
- [マップ同期 & Auto Align](/ja/development/webui/navigation/map-sync-and-alignment):
  ポーズ補正とAuto Align REST呼び出しをその機能文脈で。
- [カバレッジ清掃](/ja/development/webui/navigation/coverage-cleaning):
  boustrophedon機能をその機能文脈で。
- [ピンポイント & ルート](/ja/development/webui/navigation/pinpoint-and-routes):
  単一/複数ピンポイント運転と保存済みルート。
- [手動操作 & オートパイロット](/ja/development/webui/navigation/manual-and-autopilot):
  テレオペとオートパイロットシーケンサー、およびOperation Supervisorのtakeover/release呼び出し。
- [Boustrophedonカバレッジ & Zero-Spinアラインメントアーキテクチャ](/ja/development/ros/boustrophedon-and-alignment):
  掃引アルゴリズムとその場回転ガード。
- [メッセージ契約](/ja/development/message-contracts): 完全なMQTTコマンド/フィードバックリファレンス。
- [APIリファレンス](/ja/development/api-reference): 完全なREST APIリファレンス。
- [WebSocketとrosbridgeプロトコル](/ja/development/rosbridge-protocol): 完全なrosbridgeワイヤープロトコル。
