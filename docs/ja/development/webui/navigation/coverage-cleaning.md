---
outline: deep
search: false
---

# カバレッジ清掃

<RoleBadge role="developer" />

Coverage Areaは、ナビゲーションを「1点へ運転する」から「ある領域を清掃する」へと変えるMode
Listのエントリである。オペレーターが1つ以上のポリゴンを定義し、ロボットはそれをboustrophedon(往復、「畑を耕すような」)パターンで自律的に掃引する。本ページはこの機能をオペレーター側から扱う。サブメニュー、各エントリが何をするか、何が保存されるかであり、掃引アルゴリズムそのものではない。それについては
[Boustrophedonカバレッジ &
Zero-Spinアラインメントアーキテクチャ](/ja/development/ros/boustrophedon-and-alignment)を参照。そのページがジオメトリモデル、セル分解、障害物処理の正典(source
of truth)であり、本ページでは意図的に再説明しない。本ページの各操作の裏にあるワイヤー契約については[ROS連携](/ja/development/webui/navigation/ros-integration)を参照。

::: info スコープ
本ページは「オペレーターが何をし、何を見るか」を扱う。レーン間隔、クリアランス定数、掃引可能なセルへのセル分解、5層構成の障害物回避スタックは
[Boustrophedonカバレッジ & Zero-Spinアラインメントアーキテクチャ](/ja/development/ros/boustrophedon-and-alignment)で文書化されており、ここでは繰り返さずリンクするにとどめる。
:::

## Coverage Areaモードへの入り方

Mode Listで`Coverage Area`を選択すると(アクティブ中は`Finish Coverage
Area`とラベルが変わり、`ModeListPanel.tsx`内では`NAV_MODE.COVERAGE` /
`NAV_MODE.COVERAGE_ACTIVATE`)、ピンポイント/ルートのエントリに代わってカバレッジ専用コントロールのサブメニューが開く。Coverageはポイントベースのピンを使わないため、未完了セッションから残っていたsingle/multiピンポイントのマーカーは、このモードに入ると消去される。指示ポップアップは、このモードに入るたびに表示される。これはセッションごとに1回しか表示されないMap
Syncの指示とは異なる。描画ミスや誤解のあるカバレッジエリアは、やり直すことによる影響がより大きいためである。

## Auto Coverage

Auto
Coverageは、オペレーターが描いた境界なしでロードされたマップ全体を掃引する。到達可能な床面はロボット自身の境界検出が判断する。これを開始すると(`src/components/navigationMap/coverageApi.ts`、`use_autocover:
true`を伴う`POST
/api/boustrophedon/init`)、残っていたピンポイントを消去し、前回のrunの[ロボット軌跡オーバーレイ](#show-hide-trace)を消して新しいrunがきれいな線を描けるようにし、以前のCancelでサブスクリプションが破棄されていた場合は[カバレッジパスオーバーレイ](#the-coverage-path-overlay)のサブスクリプションを再開する。境界となるポリゴンが存在しないため、描画済みエリアのオーバーレイ自体は生成されるのではなく消去される。掃引の境界はオペレーターが描くのではなく、ロボットが発見するものだからである。

## Custom Range Coverage

Custom Range
Coverageはオペレーターが描く側の対になる機能である。オペレーターは自動検出に頼る代わりに、マップ上に手で境界を描き(`src/components/navigationMap/customAreaDraw.ts`)、その正確なポリゴンの掃引を開始する(`use_autocover:
false`と描かれた`polygon`を伴う`POST /api/boustrophedon/init`)。

描画アルゴリズムは2つ存在し、ビルド時に`NEXT_PUBLIC_CUSTOM_AREA_DRAW_MODE`で選択する(デフォルトは`manual`)。

- **`manual`**: オペレーターが境界の頂点を順番に1つずつクリックし、辺はクリック順どおりに続く。形状を自動補完する仕組みがないため、これは凹形の輪郭(L字型の部屋、柱を回り込むエリア)を表現できる唯一のモードである。すでに描かれた辺と交差するようなクリックは完全に拒否される。自己交差する境界は内側が明確に定義できず、ロボット側で拒否されるか壊れた形になってしまうためである。最初の頂点付近(設定可能なスナップ許容範囲内)へのクリックでループが閉じる。
- **`hull`(レガシー)**: すべてのクリックは緩やかなヒント点であり、ポリゴンはこれまでに配置されたすべての点の凸包(convex
  hull)として継続的に自動補完される。ループは常に閉じているが、凹形のエリアを正確に描くことは決してできない。凹みはすべてhullに飲み込まれてしまう。

### Close LoopとClear Area

描画中、同じボタンの位置は描画モードと進行状況に応じて二役をこなす。

- **Close Loop**: `manual`モードでは、境界を早めに完成させる明示的なコントロールであり、最初の頂点へクリックし直すのと等価である。`hull`モードでは輪郭は点が追加されるたびにすでに自動補完されているため、「完成」は描画状態からready状態への単なるフェーズ変更であり、少なくとも3点が配置されていることが条件となる。
- **Clear Area**: 境界が完成(`ready`)すると、ボタンは`Clear
  Area`とラベルが変わる。クリックすると描かれたすべての頂点とオーバーレイが消去されるが、Custom
  Rangeモードを終了するのではなく描画フェーズに戻るため、オペレーターはサブメニューに入り直すことなくすぐに描き直せる。

掃引を開始すると、残っていたピンポイントが消去され、前回のrunのロボット軌跡オーバーレイが消去され、バックエンドの応答を待つのではなく、シアンの「描画中」ポリゴンマーカーが即座に緑色の掃引オーバーレイに置き換わる。`/api/boustrophedon/init`でのロボットのモード切り替えには十分な時間がかかるため、応答を待ってからcanvasを更新すると、マップが数秒間idleに見えてしまうからである。開始が拒否された場合、ポリゴンはドロワーに復元され、オペレーターは描き直すことなく再試行できる。

## Save Area

Save
Area(`src/components/save-area/SaveAreaModal.tsx`)は、描いた境界をすぐに消費するのではなく再利用可能なライブラリとして保存する。オペレーターはそれに名前を付け、**Cover**エリア(掃引対象)または**Not-to-Cover**エリア(keep-outゾーン)としてマークし、`POST
/api/areas`(`src/components/area-playlist/areaApi.ts`)経由で書き込まれる。保存されたエリアは同じ`areaApi.ts`モジュール(`fetchAreas`、`renameArea`、`deleteArea`)を通じて一覧表示、リネーム、削除され、それが描かれたマップ(`map_id`)にスコープされる。これは
[Database § ROS連携](/ja/development/webui/database/ros-integration)で説明されているDatabase機能のマップ単位・ユニット単位のスコープと一致する。ここで保存されたエリアが、以下のOperation
Playlistが参照する元になる。

## Operation Playlist

Operation
Playlist(`src/components/area-playlist/AreaPlaylistModal.tsx`)は、保存済みエリアの**順序付き**シーケンスを構築し、cover項目とkeep-out項目を混在させて1回の送信で実行する。プレイリスト内の各項目は、追加された時点での元エリアのポリゴンのスナップショットを保持する(`PlaylistItem.polygon_points`)。そのため、元の保存エリアが後でリネームまたは削除されても、プレイリストは正しく動作し続ける。プレイリストは`POST
/api/playlists`で永続化され、`GET /api/playlists/:mapId`(`areaApi.ts`)で一覧取得される。

プレイリストの実行は、送信前に項目をタイプ別に分割する。各`cover`項目のポリゴンはcoverage-init呼び出しの`areas`の1つになり、各`no_cover`項目は`exclusions`の1つになる。これは
[ROS連携 § MQTTコマンド: Boustrophedonサブシステム](/ja/development/webui/navigation/ros-integration#mqttコマンド-boustrophedonサブシステム)で文書化されているのと同じ`areas`/`exclusions`形式である。少なくとも1つのcoverエリアが必要であり、keep-outゾーンのみで構成されたプレイリストはロボットに届く前にクライアント側で拒否される。送信後、プレイリストのrunは、その後のpause/deactivate呼び出しに関してCustom
Range
Coverageと同じcustom-coverage(`use_autocover: false`)経路にルーティングされる。ロボットの視点からは、これは一連の個別の掃引ではなく1つの境界付きマルチポリゴン掃引だからである。

## Show/Hide Trace

Show/Hide
Traceは、カバレッジrun中にロボットが移動した経路を示す視覚オーバーレイを切り替える。赤いポリライン(`src/components/navigationMap/robotTrace.ts`)がロボットのライブポーズトピックを購読し、新しいポーズが来るたびに軌跡の形に追加することでcanvas上に描かれる。これは下記の[カバレッジパスオーバーレイ](#the-coverage-path-overlay)とは独立している。この軌跡はそのオーバーレイとは異なる問いに答える。軌跡はロボットが実際にどこにいたかを示すものであり、プランナーが掃引しようとしている計画を示すものではない。軌跡は新しいカバレッジrun(Auto、Custom
Range、Playlistのいずれか)の開始時に毎回リセット(消去して再開)されるが、pause/resumeをまたいでは意図的に保持される。そのため、一時停止して再開されたrunは、線を最初から引き直すのではなく、進捗を表示し続ける。

## カバレッジパスオーバーレイ

軌跡とは別に、オレンジ色のオーバーレイがboustrophedonプランナー自身の意図した掃引経路をレンダーする(`/server/boustrophedon_path`上の`nav_msgs/Path`、
[ROS連携 §
ストリーミングテレメトリ](/ja/development/webui/navigation/ros-integration#ストリーミングテレメトリ)で説明)。このオーバーレイのサブスクリプションはCancel/Finish時に破棄され、次のrunの開始時に再開される(Auto
Coverage、Custom Range
Coverage、Playlistはいずれも同じ「必要なら初期化してから表示する」というシーケンスを呼び出す)。またrun終了時には破棄ではなく意図的に非表示にされ、新しいrunが始まるまで完了した掃引線が見え続けるようにしている。

## 関連

- [概要](/ja/development/webui/navigation/overview): ナビゲーションページとその完全なMode
  List。
- [マップ同期 & Auto Align](/ja/development/webui/navigation/map-sync-and-alignment):
  本ページのもう一つの静止開始・自律run機能。
- [ピンポイント & ルート](/ja/development/webui/navigation/pinpoint-and-routes):
  単一/複数ピンポイント運転と保存済みルート。
- [手動操作 & オートパイロット](/ja/development/webui/navigation/manual-and-autopilot):
  テレオペとオートパイロットシーケンサー。
- [ROS連携](/ja/development/webui/navigation/ros-integration): 上記で参照したboustrophedonコマンドエンベロープを含む、ナビゲーションの完全なワイヤー契約。
- [Boustrophedonカバレッジ & Zero-Spinアラインメントアーキテクチャ](/ja/development/ros/boustrophedon-and-alignment):
  掃引アルゴリズム自体、ジオメトリモデル、セル分解、障害物管理。
- [メッセージ契約](/ja/development/message-contracts): 完全なMQTTコマンド/フィードバックリファレンス。
- [APIリファレンス](/ja/development/api-reference): 完全なREST APIリファレンス。
- [WebSocketとrosbridgeプロトコル](/ja/development/rosbridge-protocol): 完全なrosbridgeワイヤープロトコル。
