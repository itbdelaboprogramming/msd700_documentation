---
outline: deep
search: false
---

# 手動操作 & 自律動作

<RoleBadge role="developer" />

マップ構築中にロボットを動かす2つの方法で、どちらもセッションが`mapping_active`になった時点で同じ
[マッピング](/ja/development/webui/mapping/overview)画面から利用できる。ロボットに自律的に探索させるか、自分でスティックを握るかである。マッピングセッション自体の裏にあるワイヤー契約については[ROS連携](/ja/development/webui/mapping/ros-integration)を参照。

## 自律探索がデフォルト

`MappingActionBar`でPlayを押すと、デフォルトで自律フロンティア探索(`explore_lite`)が開始される。ロボットは未マッピング空間へ自ら外側へ押し進みながら、オペレーターが操縦することなく自走する。これがマップが構築される通常の方法であり、オペレーターはPlayを押して主に見守り、必要に応じてPause/Stopと緊急停止を使う。

## Manual Override

サイドバーはNavigation画面で使われているのと同じ共有コンポーネント`ManualAutopilotPanel`をレンダーする。Mapping画面で**Manual
Override**を切り替えると、WASDキーボードテレオペがオペレーターに引き渡され、上記の自律探索の動作から運転が奪われる。これはNavigationと同じコンポーネント・同じトグルである。異なるのは、制御を*何から*奪うかだけである(ここでは自律探索であり、Navigationでは送信済みのゴールやカバレッジ清掃の掃引である)。そのため、その仕組みは本ページでは繰り返さない。

## 本ページにおける「Autopilot」の意味

同じパネルは**Autopilot**トグルも公開している。Mappingに限って言えば、これを有効にすると自律探索セッションがヘッドレスで走り続ける。オペレーターがブラウザタブを閉じても探索は続く。これはNavigation画面でのAutopilotの実務上の意味(そちらでは自律ウェイポイント/カバレッジの送信を管理する)とは異なる。トグルとコンポーネントは共有されているが、各画面が「ブラウザなしで動き続ける」ことの意味を、それぞれの操作に応じて独自に定義している。

::: info ハートビートの適用除外
失われたハートビートに対するセーフティウォッチドッグの切断階層(2秒の動作一時停止、10分のidle、30分のシャットダウン)は、Autopilotがアクティブな間はすべて停止される。そのため、マッピングセッションは接続の切断やノートPCの蓋を閉じる操作をまたいで動き続けることができる。完全なタイミング階層については[セーフティウォッチドッグ](/ja/development/ros/safety-watchdog)を参照。そのページは本ページには重複記載していない。
:::

## 関連

- [概要](/ja/development/webui/mapping/overview): Play/Pause/Stop、ライブマップビュー、Stop時の保存フロー
- [ROS連携](/ja/development/webui/mapping/ros-integration):
  マッピングセッションの裏にあるREST/MQTTワイヤー契約
- [アーキテクチャ](/ja/development/architecture)
- [状態 & 挙動](/ja/development/state-and-behavior):
  ロボットのアクティビティステートマシンとセーフティウォッチドッグのタイミング
