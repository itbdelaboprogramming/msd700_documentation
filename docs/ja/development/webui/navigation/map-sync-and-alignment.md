---
outline: deep
search: false
---

# マップ同期 & Auto Align

<RoleBadge role="developer" />

「マップ上のロボットの点が、ロボットの実際の位置と一致していない」という問題に対するナビゲーションページの答え。Map
Syncはロボットを静止させたままcanvasをポーズ補正モードにするMode Listのエントリ(`ModeListPanel.tsx`内では`initial-pose`)であり、Auto
Alignはそのモード内でのみ提供されるサブ機能で、オペレーターの勘に頼ることなく同じ補正を行う。Mode
Listの他の項目については[概要](/ja/development/webui/navigation/overview)を、本ページで要約するにとどめるワイヤー契約については[ROS連携](/ja/development/webui/navigation/ros-integration)を参照。

::: info スコープ
本ページはポーズ補正、すなわちMap SyncとAuto
 Alignのみを扱う。カバレッジ清掃、ピンポイント/ルート運転、手動/オートパイロット制御は、[関連](#関連)以下のそれぞれのページで扱う。カバレッジ掃引アルゴリズム自体(ジオメトリ、セル分解、障害物処理)は、ここではなく[Boustrophedonカバレッジ](/ja/development/ros/boustrophedon-and-alignment)にある。
:::

## ポーズ補正が解決すること

AMCLは事前に記録されたマップに対してロボットを自己位置推定するが、その推定はロボットの物理的な位置から食い違っていく場合がある。手動で押された後、リフトに乗った後、メモリ上のポーズを失う電源断の後、あるいはロボットが完全に持ち上げられた後などである。従来これはAMCL自身の「その場で360度回転してパーティクルの分散を収束させる」ステップの役割だったが、
[その場回転ガード](/ja/development/ros/boustrophedon-and-alignment#その場回転-ガードは撤去済み、発生源で修正)はデフォルトで無人の回転を拒否するため、プラットフォームにはその動作に頼らずポーズを補正するオペレーター向けの手段が必要になる。

Map Syncモードがその手段である。Mode Listで`Map Sync`を選択する(アクティブ中は`Finish Map
Sync`とラベルが変わる)と、基盤となるマップcanvasがインタラクティブなポーズ補正状態に切り替わる。抜けると通常のナビゲーションcanvasに戻る。

**メッセージ仕様:** オペレーターが手動で設定する姿勢は、[`<root>/initialpose`](/ja/development/message-contracts/rosbridge#publications) 上の
`geometry_msgs/PoseWithCovarianceStamped` で、[`string/initialpose`](/ja/development/message-contracts/bridge-topics#json-initialpose) としてロボットの
`/initialpose` に運ばれる。

## Auto Align

Auto AlignはMap Syncモードがアクティブなときのみ表示されるボタンである。「オペレーターがロボットアイコンを手動で正しい位置と向きへドラッグする」という操作をワンクリックで置き換える。ロボットのライブLiDARスキャンが、静止スキャンマッチャーによってロード済みのマップと照合され、得られたポーズが回転もなく並進もなくAMCLへ直接書き込まれる。これは
[Boustrophedonカバレッジ & Zero-Spinアラインメントアーキテクチャ](/ja/development/ros/boustrophedon-and-alignment#ゼロスピン方位アライメント-パーティクルアライン検証)で完全に文書化されている、同じゼロスピンのCorrelative
Scan Matching(CSM)アルゴリズムである。スコアリング関数、確信度しきい値、マイクロジョグのフォールバックについては、そのページが正典(source of
truth)である。本ページではボタン自体とバックエンドとの契約のみを扱う。

### `/api/autoalign/start`

`POST /api/autoalign/start`([HTTP API § Auto Align](/ja/development/message-contracts/http-api#autoalign)で完全に文書化)はスキャンマッチングを開始する。フロントエンド(`autoAlignApi.ts`、`postAutoAlign('start',
{ unit_id })`)はこの呼び出しの応答で収束を報告するのを待つのではなく、即座にボタンを無効化してステータスをポーリングする。収束はロボット側で非同期に起こるためである。

### `/api/autoalign/status`

runが進行中の間、固定間隔でポーリングされ、スキャンマッチャーが収束したかどうかを確認する。フロントエンドは、応答の収束フラグが`true`のときのみそのrunをアラインメント済みとみなし、収束しないまま上限の待機時間を超えるとあきらめて、エラートーストではなく「failed」として表示する。何も動いていないので、何も復旧する必要はなく、オペレーターは単純に再トリガーできる。再トリガーが意図的にブロックされるのは、実際にrunが進行中の間だけであり、完了後やタイムアウト後はブロックされない。

### `/api/autoalign/reset`

ロボット側のアラインメントrunをクリアする。alignerの内部アクティブフラグをリセットし、ロボットが報告するアクティビティをidleに戻す。フロントエンドは収束したrunとタイムアウトしたrunの**両方**の終了経路でこれを呼び出す。そうしないとロボット側のアラインメントstateは明示的にクリアされるまで「active」/「auto_aligning」としてラッチされたままになり、他の箇所でスタックしたロボットと誤読されかねないからである。これはまた、オペレーターがrun途中でMap
Syncモードを離れた場合にも呼び出され、ロボットに停止するよう伝える。

**メッセージ仕様:** 3 つのエンドポイントはいずれも `{ unit_id }` を受け取り、MQTT コマンド
[`autoalign.start`、`status`、`reset`](/ja/development/message-contracts/mqtt-commands#autoalign)(ロボットのサービス `/alignment/start`、
`/check_alignment`、`/alignment/reset`)に 1 対 1 で対応する。応答は標準の [コマンド応答](/ja/development/message-contracts/http-api#envelopes) で、
成功時はロボットのフィードバックエンベロープが `details` に、拒否時は `error_details` に入る。

## 同意: Auto Alignはその場回転ガードの信頼元である

Auto Align自体は一切の回転を指示しない。それこそがスキャンマッチャーを回転の代わりに使う意義そのものである。しかしそれでも、プラットフォームの
[その場回転ガード](/ja/development/ros/boustrophedon-and-alignment#その場回転-ガードは撤去済み、発生源で修正)にとって不可欠な支えとなっている。このガードは、2つの同意トピックのいずれかにライブコマンドが伴わない限りすべてのその場回転を拒否するが、Auto
Align自身の内部チェッカー(`align_checker`)がその2つのうちの1つである(もう1つは手動WASD)。具体的には次のことを意味する。

- スタックの他の部分が(Auto Alignを呼ぶのではなく)ロボットをその場で回転させて自己位置推定を助けようとした場合、そのコマンドは`/mux/allign`上に届かないため、回転ガードはそれをゼロにする。
- Auto Alignボタンを押すことは、回転ガードの観点からは、自己位置推定目的でその場回転を許可するオペレーター発の唯一の手段である。そして現在の設計上、CSMアラインメントは構造上ゼロモーションであるため、それが必要になることは実際にはない。

本ページがこの関係を明記しているのは、これが本物のUI-ROS間の連携ポイントだからである。Map
Syncモードでオペレーターが押すボタンは、このガードによって信頼された同意元として名指しされている。ガードの完全なゲーティングロジック(ジオメトリゲート、許容ウィンドウ、何が無効化されたか)は、
[Boustrophedonカバレッジ & Zero-Spinアラインメントアーキテクチャ](/ja/development/ros/boustrophedon-and-alignment#その場回転-ガードは撤去済み、発生源で修正)で文書化されており、ここでは繰り返さない。

## 関連

- [メッセージ仕様 § ナビゲーションページ](/ja/development/message-contracts/#trace-navigation): Auto Align と姿勢メッセージの全体像。
- [概要](/ja/development/webui/navigation/overview): ナビゲーションページとその完全なMode
  List。
- [カバレッジ清掃](/ja/development/webui/navigation/coverage-cleaning): 本ページのもう一つの静止開始・自律run機能。
- [ピンポイント & ルート](/ja/development/webui/navigation/pinpoint-and-routes): 単一/複数ピンポイント運転と保存済みルート。
- [手動操作 & オートパイロット](/ja/development/webui/navigation/manual-and-autopilot):
  テレオペとオートパイロットシーケンサー。
- [ROS連携](/ja/development/webui/navigation/ros-integration): 他機能との文脈におけるAuto
  Align REST呼び出しを含む、ナビゲーションの完全なワイヤー契約。
- [Boustrophedonカバレッジ & Zero-Spinアラインメントアーキテクチャ](/ja/development/ros/boustrophedon-and-alignment):
  CSMアルゴリズムとその場回転ガード。
- [メッセージ仕様](/ja/development/message-contracts/): 完全なMQTTコマンド/フィードバックリファレンス。
- [HTTP API](/ja/development/message-contracts/http-api): 完全なREST APIリファレンス。
- [rosbridge (WebSocket)](/ja/development/message-contracts/rosbridge): 完全なrosbridgeワイヤープロトコル。
