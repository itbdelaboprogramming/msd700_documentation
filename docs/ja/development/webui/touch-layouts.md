---
outline: deep
search: false
---

# ROS Web UI: スマートフォン・タブレットのレイアウト

<RoleBadge role="developer" />

オペレーター用ページ(ログインとユニット一覧、Navigation、Mapping、Database、サインアップ)には、
デスクトップ用の構成に加えて2つのタッチ用構成がある。スマートフォン用(縦向きのみ)とタブレット用
(両方向)である。どちらもデスクトップのページ状態、マップコンポーネント、ロボット接続、ダイアログを
そのまま使い、違うのは配置だけなので、通信内容は何も変わらない。管理コンソールはデスクトップ専用の
ままである。デスクトップの描画はこの変更で変わっておらず、以前のビルドとピクセル単位で比較して確認
済みである。オペレーター向けの説明は[スマートフォンとタブレット](/ja/user-guide/phones-and-tablets)
を参照。

## レイアウトの選択 {#detection}

デバイスの種類を決めるのは `DeviceGuard`(`src/components/device-guard/deviceGuard.tsx`)だけであり、
ウィンドウサイズではなくデバイスの特性で判定する。

| 判定 | 結果 |
| --- | --- |
| `detectDesktop()`: `userAgentData.mobile`、スマートフォンまたはタブレットのユーザーエージェント、iPadOS(タッチポイントが2以上のMacプラットフォーム)、`pointer: coarse` かつ `hover: none`、または長辺が1024 px未満の画面 | デスクトップではない: タッチ用レイアウト |
| `detectPhone()`(デスクトップでない場合のみ): 画面の短辺が600 CSS px未満(`PHONE_MAX_SHORT_EDGE`) | スマートフォン。それ以外はタブレット |
| デスクトップ以外で `/admin` から始まるルート | デスクトップ専用の案内。アプリはアンマウント |
| デスクトップでウィンドウが `MIN_APP_WIDTH` x `MIN_APP_HEIGHT`(1400 x 720、`NEXT_PUBLIC_MIN_APP_WIDTH/HEIGHT` で変更可)未満 | 「Screen size not supported」のオーバーレイ。アプリはマウントしたまま |

タッチスクリーン付きノートPCはトラックパッドにより細かいポインターとホバーを報告するので、
デスクトップ用レイアウトのままとなり、タッチ操作は[マップのジェスチャー](/ja/development/webui/navigation/overview#map-input)
で受け付ける。

判定結果は `src/hooks/useMobileLayout.ts` の2つのコンテキストでコンポーネントに渡る。

- `useMobileLayout()`: スマートフォン**と**タブレットで true。タッチ向けに変わるすべての操作要素
  (丸いボタン、ジョイスティック、ホバーツールチップの代わりのカード、折りたたまれたMode List)が
  これを読む。
- `useTabletLayout()`: タブレットのみ true。ページの配置を決める少数の箇所(`MobileShell`、
  ログインページ、ヘッダーの幅)が読む。

どちらもウィンドウサイズではなくデバイスの特性なので、セッションの途中で構成が切り替わってマップや
カメラのストリームが再マウントされることはない。`_app.tsx` の `MobileLayoutProvider` は、
`DeviceGuard` の外で描画されるもの(グローバルなユニットステータスバッジ)に同じ答えを渡す。

最初の計測までは、`DeviceGuard` はページの背景だけを描画する。以前はアプリをすぐに描画していたが、
計測前には構成が分からず、誤った構成を先に描画するとロボット接続、マップ、カメラが2回マウントされる。
サーバーとクライアントの最初のフレームはどちらも背景を描画するので、ハイドレーションは一致する。

横向きに持ったスマートフォンでは、デスクトップの小ウィンドウ用オーバーレイと同じく、
「Turn your phone upright」パネルの下でアプリをマウントしたままにする。実行中に端末を回しても
セッションを切ってはならないためである。

## ページの構成 {#composition}

各オペレーター用ページは `isMobile ? <MobileShell …> : <デスクトップのJSX>` で一度だけ分岐し、
両方に同じ children を渡す。末端のコンポーネントは `compact` プロップを受け取るか、自分で
`useMobileLayout()` を読む。

`MobileShell`(`src/components/mobile/MobileShell.tsx`)、スマートフォン用レイアウトの上から順:

| 部分 | 内容 |
| --- | --- |
| ヘッダーバー | ロゴ、ようこそピル(名前とユニット、360 pxに収まるよう省略)、閉じるボタン |
| 機能行 | 現在のページのピル(メニューシートを開く)、`RobotConnectionStatus compact` |
| メインパネル | `children`: マップ、またはDatabaseではマップ一覧 |
| ドライブバー用スロット | `#mobile-drive-bar`。Manual Overrideがオンのとき以外は空 |
| カメラ行 | `camera` プロップと `#mobile-drive-pad` スロット |
| 下部バー | Menu、Camera(Half / Full)、ページの `bottomActions`、Instructions、著作権表示 |
| メニューシート | ページ切り替えと `menuExtra`(NavigationとMappingではRobot Control) |

`RobotConnectionStatus` はDatabaseを含むすべての操作ページでマウントされる。これはLiDARの
インジケーターだけでなく、ロボットへのpingとハートビートであり、接続断とテイクオーバーの
ダイアログを持つためである。

メニューシートとカメラは**隠すだけで、アンマウントしない**。シート内のRobot Controlは、
オペレーターがマップを見ている間も状態とロボットの購読を保ち、カメラを隠してもWebRTCストリームを
切断して切り替えのたびに再ネゴシエーションさせることはない。

`TabletShell` は同じ部品からタブレット用レイアウトを組み立てる。メニューシートの代わりにページの
タブ(`FeatureTabs`)、ヘッダーにステータスのピル、カメラと `menuExtra` を収めた横の列である。
この列は横向きでは左、縦向きではマップの下に置かれ、Tailwind の `landscape:` と `portrait:`
クラスだけで切り替わるので、回転しても何も再マウントされない。

### 移動した要素 {#moved-parts}

デスクトップでは固定位置にあるが、スマートフォンでは場所のない要素は次のように移動した。

| デスクトップ | タッチ用レイアウト |
| --- | --- |
| マップ左上の概要ミニマップ | `MobileCameraPanel` の `#mobile-preview-slot` にポータル表示。Camera / Preview の切り替えの裏(Navigation) |
| ヘッダーのステータスピル | 非常停止の下の `MobileMapFooter`(スマートフォン)、`TabletShell` のヘッダー(タブレット) |
| マップフッターの非常停止 | `MobileMapFooter`、`EmergencyButton compact` |
| マップ上の再接続ピル | `MobileMapFooter` でマップ名の位置に表示 |
| ズーム、フィット、回転のボタン | マップ左上の「⋮」の列。すべてのマップ操作を折りたたむ「−」ボタンの下 |
| モード横のボタン(ルート、カバレッジ、Auto Align、Set Position as Home Base) | キャプション付きの44 pxの円(`navConstants.ts` の `MOBILE_SIDE_BTN`、`MOBILE_SIDE_CAPTION`) |
| ルートボタンのホバーツールチップ | `MobileModeGuide` のカード `multi-pin`。セッションごとに1回(`hasSeenMultiPinGuide`) |
| Coverage、Map Sync、Auto Align結果の画像(横長SVG) | `MobileModeGuide` のカード `coverage`、`map-sync`、`align-result`(実テキスト) |
| ページの操作説明画像 | `ControlInstruction` の `mobile_instruction_{control,mapping,database}.svg` |
| アクションバー上の情報ラベル | マップフッター上の閉じられる帯。閉じた状態はその文言にだけ有効 |
| Databaseの追加列と **Go to the Map** | 行のタップでシートを開く: プレビュー、最終更新者、サイズ、Rename、Delete、Go to the Map |
| Databaseの列ヘッダーでの並べ替え | 下部バーの **Sort maps**: 列と順序を1回のタップで選ぶ |

タッチデバイスではMode Listは折りたたんだ状態で始まり(`useMapState(!isMobile)`)、開くまで
マップを覆わない。`src/utils/statusColor.ts` がステータスピルの色を持ち、デスクトップのヘッダーと
タッチ用のピルで食い違わないようにしている。

### ポータルと重なり順 {#portals}

一部の内容は意図的にReactの親の外に描画される。

- `PreviewMap` はカメラパネルのプレビュー用スロットにポータル表示する。
- タッチデバイスでは `ManualAutopilotPanel` がダイアログ(同期オーバーレイ、Autopilotの確認)を
  `document.body` にポータル表示する。スマートフォンでは、祖先のメニューシートが `invisible` で
  閉じている間も、ドライブバーからスイッチが押されるためである。
- スマートフォンでは、ドライブバーとジョイスティックがシェルの2つのスロットにポータル表示される。
  スロットはマウント後にidで探す。

モーダルはスマートフォンに合わせた幅で、マップ操作より上に重なる(メニューシート `z-[70]`、
モードのカードと操作説明 `z-[80]`、Databaseのシートとログインページの資料メニュー `z-[90]`)。

### セッションストレージのキー {#storage}

| キー | 意味 |
| --- | --- |
| `mobileCameraPanel` | オペレーターがカメラパネルを隠すと `hidden` |
| `mobileMenuHintSeen` | Menuボタンを指す初回のヒントを閉じた |
| `hasSeenMultiPinGuide` | Multiple Pinpointsのカードをこのセッションで表示済み |

## タッチでの手動操作 {#joystick}

タッチデバイスにはキーボードがないため、`ManualAutopilotPanel` は `TouchJoystick` を追加する。
ジョイスティックは倒した量(`x` が右、`y` が前、それぞれ -1..1、触れていなければ `null`)を
`stickRef` に書き、W A S Dキーと同じ10 Hzの送信ループがそれを優先して読む。

```ts
publishTwist(stick.y * SPEED_NORMAL.linear, -stick.x * SPEED_NORMAL.angular); // right = -z
```

速度はアナログで、キーボードの通常速度(0.4 m/s、1.0 rad/s)が上限である。ノブを少しだけ倒すことが
Shiftによる低速の代わりになる。中央の0.12のデッドゾーンではゼロを送る。

ロボットはキーを離したときと同じ方法で停止する。`pointerup`、`pointercancel`、ポインターキャプチャの
喪失、ジョイスティックのアンマウント(Manual Overrideのオフ、ページ移動、操作中の収納)、ウィンドウの
フォーカス喪失、手動モードの終了で `stickRef` が消え、次のティックでゼロのtwistが送られる。

| デバイス | 配置 |
| --- | --- |
| スマートフォン | `docked`: カメラ横の `#mobile-drive-pad`。その上の `#mobile-drive-bar` にある `PhoneDriveBar` がManualとAutopilotのスイッチ、rosbridgeの状態ドットを繰り返し表示するので、メニューを開かずに停止できる。カメラ行を隠しても、パッドがある間は行が残る。 |
| タブレット | `floating`: 右下に固定(縦向きではマップの上)。つまみで右端に収納できる。収納時は先にスティックを離す。 |

**メッセージ仕様:** ジョイスティックはキーボードと同じ
[`server/key_vel` の `geometry_msgs/Twist`](/ja/development/message-contracts/rosbridge#publications)
を送る。トグルは変わらない([`POST /api/manual`](/ja/development/message-contracts/http-api#manual)、
[`POST /api/autopilot`](/ja/development/message-contracts/http-api#autopilot))。
[Manual Override & Autopilot](/ja/development/webui/navigation/manual-and-autopilot)を参照。
