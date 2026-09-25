---
outline: deep
search: false
---

# ナビゲーション: 手動操作 & オートパイロット

<RoleBadge role="developer" />

ナビゲーションページの視点から見た`ManualAutopilotPanel`サイドバーコンポーネント、アクティビティキーからダッシュボードタブへのRobot
Activity State Machineのマッピング、そして本ページにおけるセッションの再接続・復旧を支えるフロントエンド実装の仕組みを扱う。このパネルが並んで配置されるMode
List/Action Barパターンとcanvasパイプラインについては[概要](/ja/development/webui/navigation/overview)を参照。このパネルが連携するポイント・アンド・ゴー系モードについては[ピンポイント &
ルート](/ja/development/webui/navigation/pinpoint-and-routes)を参照。

## ナビゲーションページにおけるManual OverrideとAutopilot

`ManualAutopilotPanel`はサイドバーに配置されており、Mappingページでレンダーされるのと同じコンポーネントだが、この2つのトグルはここでは実務上異なる重みを持つ。

- **Manual Override**は、このページで実行中の自律動作(送信済みのピンポイント、複数点ルート、またはカバレッジ清掃の掃引)を停止し、`twist_mux`をキーボードに引き渡す。これによりWASD入力がロボットを直接操作する。
- **Autopilot**は、ブラウザタブを開いたままにしなくても送信済みのrunを維持する。ユニット側の`operation_supervisor`がrunの送信そのものを引き継ぐためである。

同じパネルはMappingページのサイドバーにも表示されるが、そこでは2つのトグルはナビゲーションのrunではなくアクティブなSLAMセッションを制御する。そのページ独自の説明では、そちらでのManual
OverrideとAutopilotの意味を扱っている。

## カバレッジ掃引をオペレーターに渡し、また受け取る

Manual Overrideはボストロフェドン走行を**一時停止**するだけで、終了させません。ハンドルを離せば、
走行していたレーンのまま同じ掃引がロボットに戻ります。そのために3つの規則が必要で、どれも
「一見自然な近道」が誤りだったために存在します。

**掃引の停止は`/path_coverage/pause`経由であり、素の`/move_base/cancel`ではありません。**
`path_coverage_node`は`/move_base/cancel`も購読しており、自分が発行していないキャンセルはそこで
「ミッション終了」と読まれます。終端フラグ`cancelled`が立ち、走行スレッドが巻き戻ります。
`system_command.py`はManual Override有効化時に空の`GoalID`をそこへ発行していたため、ハンドルを
握った瞬間に掃引が黙って死んでいました。カバレッジノード自身のpauseサービスはその副作用なしに
内部でゴールをキャンセルするので、`_enable_manual`はまずカバレッジノードに依頼し、一括キャンセルは
依頼先のカバレッジノードが存在しない場合のために残します。ブラウザ主導のポイントナビ、
オートパイロットの経路、あるいはこのサービスを持たない古いカバレッジノードです。

**一時停止中に届いたキャンセルは無視されます。** 一時停止中の走行はすでに自分のゴールを
キャンセル済みなので、その後に届くものは第三者が車体を止めているのであって、ミッションの終了では
ありません。走行を完全に終わらせるのは`/path_coverage/cancel`で、`boustrophedon.deactivate`が
呼ぶのはこちらです。

**一時停止した者が、再開してよい者を決めます。** `system_command.py`はカバレッジ一時停止の所有者を
記録します。Manual Overrideが取ったなら`manual`、Pauseボタンが取ったなら`operator`です。
Manual Overrideの解除は自分が取った一時停止だけを再開するので、オペレーターがハンドルを握ったまま
押したPauseは解除後も生き残ります。以前はこれをアクティビティのラベルから推測しており、両方向に
誤っていました。`stuck`は`navigation_ready`として復元され、manual中のオペレーターのPauseは
アクティビティを`paused`のまま残すため、どちらも掃引を再開しませんでした。

| イベント | カバレッジノード | 直後のロボットアクティビティ |
| --- | --- | --- |
| 掃引走行中にManual Override ON | `~pause` | `manual` |
| Manual Override OFF | `~resume` | `boustrophedon_ready` |
| Manual Override OFF、再開が拒否された | 再開すべきものがない | `coverage_failed` |
| Pauseを押した（いつでも） | `~pause` | `paused` |
| そのPauseの後にManual Override OFF | 触れない | `paused` |
| Cancel Coverage | `~cancel` | `idle` |

::: warning 再開できなかった走行を走行中として報告しないこと
再開が拒否された場合、アクティビティは`boustrophedon_ready`ではなく`coverage_failed`になります。
ダッシュボードは`boustrophedon_ready`を「走行中」と読み、二度と動かないロボットの上で
**On Progress**に留まります。この経路が防ぐために存在するのは、まさにその失敗です。同じ理由で、
外部キャンセルに殺された走行は`/msd700/coverage_status`に`aborted`を発行するようになりました。
キャンセルされた走行は自分では終端ステータスを一切発行しないため、これがないと掃引は死んだのに
上位のすべての層が生きた走行を報告し続けます。
:::

## アクティビティステートマシン: ダッシュボードタブへのルーティング

`RobotStateTracker`が追跡し、ハートビートpingのたびに報告されるロボットのアクティビティ文字列が、オペレーターがどのダッシュボードタブに着地するかを決める。これは再接続時も同様である(下記[セッションの再接続と復旧](#セッションの再接続と復旧)を参照)。このページの2つのトグルは、それぞれロボットを特定のアクティビティへと駆動する。

- **Manual Override**を有効にすると、ロボットのアクティビティは`manual`になり、これはNavigationではなく**Idle**タブへルーティングされる。Manual
  Overrideがこのページのパネルから有効化されたかMappingのパネルからかは関係ない。
- 送信済みのrun中に**Autopilot**を有効にすると、ロボットのアクティビティは`supervisor_navigating`になり、**Navigation**タブへルーティングされる。

アクティビティの完全な一覧は以下のとおりである。

| アクティビティキー | 対象UIタブ | 説明 |
| --- | --- | --- |
| `idle` | Idle | システム初期化済み。モーターコントローラーは有効だがアクティブなゴールはない。 |
| `manual` | Idle | WASDキーボード操作による手動テレオペがアクティブ。 |
| `mapping_active` | Mapping | `explore_lite`のフロンティア探索によるアクティブなSLAMマッピング。 |
| `mapping_paused` | Mapping | オペレーターによってSLAM探索が一時的に停止されている。 |
| `mapping_stop_failed` | Mapping | マップ保存に失敗。オペレーターが再試行できるようSLAM状態はアクティブなまま維持される。 |
| `navigation_ready` | Navigation | マップがロード済みで`move_base`が稼働中、ゴール送信を待機している。 |
| `navigation_point_published` | Navigation | ロボットがナビゲーションゴールに向けて実際に走行中。 |
| `boustrophedon_initializing` | Navigation | カバレッジの掃引ラインを生成中(idle/stuckタイムアウトの対象外)。 |
| `boustrophedon_ready` | Navigation | boustrophedonカバレッジの掃引ラインを実行中。 |
| `supervisor_navigating` | Navigation | `operation_supervisor`が管理する自律ウェイポイント送信。 |
| `arrived` | Navigation | ウェイポイント目的地への到達、またはカバレッジエリアの完了に成功。 |
| `coverage_failed` | Navigation | カバレッジ計画または経路実行が中断された。 |
| `auto_aligning` | Navigation | Auto Alignのパーティクルフィルターによる向き較正を実行中。 |
| `paused` | Navigation | オペレーターの明示的なコマンドによりミッションが一時停止。 |
| `paused_due_to_ping_loss` | (内部) | ハートビートpingの喪失によりセーフティウォッチドッグがロボットの動作を一時停止。 |
| `emergency_stopped` | Idle | ハードウェアの緊急停止が作動(優先度255でゼロ速度に固定)。 |
| `emergency_cleared` | Idle | 緊急停止が解除され、モーターは再初期化準備完了。 |

完全な状態遷移図と`paused_due_to_ping_loss`の裏にあるセーフティウォッチドッグの挙動は[状態 &
挙動](/ja/development/state-and-behavior)で扱う。本ページにこの表を再掲しているのは、これこそが新規ログインや再接続の際にオペレーターがそもそもNavigationへ戻されるかどうかを決める、まさにそのものだからである。

## セッションの再接続と復旧

このセクションは本質的にフロントエンド実装寄りの内容である。オペレーターが閉じたブラウザタブを再度開いたとき、あるいは新しいワークステーションからログインしたときに`mapComponent.tsx`が実行するReactのstateとcanvasの仕組みを、高レベルの挙動だけでなく扱う。

![セッションの再接続と復旧](../../../../development/webui/navigation/diagrams/manual-and-autopilot-session-reconnection-and-recovery.drawio)

### 復旧の原則

1. **`active_page`によるルーティング**: フロントエンドは、上記のアクティビティ表を使い、ロボットのライブテレメトリに基づいてオペレーターをアクティブな操作タブ(NavigationまたはMapping)へ直接リダイレクトする。
2. **ラッチされたスナップショットの再構築**: ミッションの全state(アクティブなウェイポイント、現在のインデックス、進行方向、カバレッジのポリゴン)は、ラッチされたROSトピック`/string/operation_snapshot`から復元される。
3. **ゴーストステート検証**: ブラウザキャッシュが進行中のミッションを示している一方でロボットが約1 Hzのpingサンプルで4回連続(`PHANTOM_IDLE_SAMPLES = 4`)`idle`を報告している場合、フロントエンドは幻の実行表示を防ぐため自動的に`idle`にリセットする。

### ログアウトはセッションを終了する(autopilotがオンの場合を除く)

2つのログアウト契約は意図的に正反対であり、どちらもプリフライトのpeek pingが報告するロボットの
`autopilot`フラグで決まる。

- **Autopilot ON**: ログアウトしてもユニットブリッジと実行中の操作は維持される。何も解体されず、次回
  ログイン時にルーティングで戻され、ラッチされたスナップショットから操作が再構築される。
- **Autopilot OFF**: ログアウトで操作は終了する。`shutdownFlow.ts`は`/user/logout`の前に
  `POST /api/hardware/idle`を送る(`endRobotOperation`。自律実行と緊急停止ではスキップ)。意図的な
  サインアウトなので、次回ログインはゼロから始まる。

操作を終了するとは、復旧パスが読む状態を**すべて**クリアすることであり、以前は3つの保存先の内容が
食い違っていた。

| 状態の保存先 | Autopilotなしのログアウト時 |
| --- | --- |
| `operation_supervisor`のバッチ | `_idle_system`が`{"type":"stop"}`を送り、ラッチされたスナップショット(およびディスク上の写し)が実行中の操作を示さないようにする。 |
| ロボットのアクティブモード | `_idle_system`は`update_activity("idle")`だけでなく`robot_state.set_active_mode(None)`を呼ぶ必要がある。 |
| バックエンドの意図した操作 | `POST /api/hardware/idle`は`setUnitIntendedState(unit_id, 'idle', null, ...)`を呼ぶ必要がある。 |

::: warning ロボットのactivityだけではルーティングは決まらない
`derive_active_page()`は、生のactivityがマッピング/ナビゲーションのラベルでない場合、ロボットが記憶して
いる`active_mode`にフォールバックする。そのためactivityを`idle`にしてもモードが残っていれば、次のpingで
`active_page='mapping'`または`'navigation'`が報告され、`resolveActiveRoute()`は戻ってきたオペレーターを
ログアウトで終えたはずのマップセッションへ直接送ってしまう。`system_command.py`の明示的ログアウト
ハンドラーには、10分のping タイムアウトによるidle切替が既に行っている`set_active_mode(None)`の呼び出しが
欠けていた。
:::

バックエンドに保存された`intended_mode`/`map_id`を残すと、1つ上の層で同じ問題が起きる。ナビゲーションの
自動再開は`intended_map_id`をマップ候補として扱うため、ロボットが`idle`を報告した後でも古いマップが再び
開かれうる。これをクリアする動作は緊急停止とナビゲーション無効化の経路が既に行っていることと同じであり、
このエンドポイントに到達しないautopilotの保持には影響しない。

### 何がスナップショット再構築を引き起こすか

再構築は真新しいタブに限られない。次のいずれかに該当し、タブに保持する価値のあるローカルセッションがない場合は常に実行される。

- ログインルーターが`nav_recovery_pending`をセットした(復帰のためオペレーターをここへルーティングした)、または
- キャッシュに何もなかったタブに対して、ページが操作対象のマップを自動的に解決した、または
- `navStatus`が存在しない**か`Idle`**であり、かつモードが選択されていない。

3つ目の条件が「またはIdle」と書かれているのには理由がある。Databaseページからマップを再度開くと、タブのナビゲーションstate全体が意図的に破棄され(`flushNavigationRecoveryState`)、その後Navigationページは自身の初期state`Idle`から`navStatus`を少し遅れて播種する。この条件はキーが**存在しない**ことを要求していたが、意図的にローカルstateを破棄した唯一のエントリーポイントこそが、それを再構築できない唯一のものでもあった。マップから離れて実行途中に戻ってきたオペレーターは、カバレッジエリアのオーバーレイが消え、ピンもなく、新規ログイン以外にそれらを取り戻す方法がない状態を目にすることになった。現在では、ページもマップコンポーネントもマウント時に永続化されたstatusやmodeを書き込むことはなく、復旧経路だけがそれらのキーを播種する。

タブが開いているものと**異なる**マップを指すスナップショットは、適用されずに無視される。再構築はrunが属するマップを再選択するが、これはマップなしで到着したタブには正しく、オペレーターが手動でマップを選んだ直後には誤りとなる。

ラッチされた値が真新しいMQTTサブスクライバーに届くとは限らないため、ダッシュボードは0秒、0.9秒、3.4秒、9.4秒の時点でもsupervisorに再パブリッシュを促す。idleなロボットはこれらのどれにも応答しないため回数は少なく抑えられているが、回数よりも**到達すること**の方が重要である。これはブラウザからrosbridge、MQTT、ユニットへの往復であり、数秒で諦めるスケジュールは、まさに帯域幅対策の取り組み全体が生き延びさせようとしている弱いリンク上で、実行中のrunを見捨ててしまう。サブスクリプションはスケジュールより長く生き続けるため、後から届いたスナップショットも適用される。

### 再構築が最初に描くもの

順序は内容と同じくらい重要である。以前の再構築ではマップ一覧を取得し、ライブグリッドがステージをスケーリングするのを(最大8秒)待ってから初めてカバレッジオーバーレイを描画していたため、実行中の掃引にログインし直したオペレーターは、エリアが表示されるまで何秒も何もないマップを眺めることになった。このオーバーレイはどちらも必要としない。メートル単位でシーンに直接描画され、スナップショットにはすでに計画が含まれている。現在はこのオーバーレイが最初に描画され、カバレッジrunに対してはピンをスケーリングする必要がないため、ステージスケールの待機は完全にスキップされる。ピンの復元はそれでも待機する。スケーリングされていないステージに追加されたマーカーは、見えないほど小さい0.01スケールでレンダーされてしまうためである。

同じ規則はrunが**開始**するときにも適用される。エリアは計画が送信された時点で描画され、ロボットがそれを確認応答した時点ではない。`POST
/api/boustrophedon/init`は`switch_mode`がロボット上でカバレッジスタックを立ち上げてから初めて応答するため、オペレーターは何もないマップを数秒間見つめることになる。拒否されたrunは再びオーバーレイをクリアし、拒否された単一のカスタムエリアはシアンのドロワーポリゴンを再描画し、オペレーターが再試行できるエリアを残す。

## 関連

- [概要](/ja/development/webui/navigation/overview): このパネルと復旧ロジックが並んで配置される
  Mode List/Action Barパターンとcanvasパイプライン。
- [ピンポイント & ルート](/ja/development/webui/navigation/pinpoint-and-routes): 上記の復旧フローが復元するピンとルートを持つポイント・アンド・ゴー系モード。
- [マップ同期 & アラインメント](/ja/development/webui/navigation/map-sync-and-alignment)
- [カバレッジ清掃](/ja/development/webui/navigation/coverage-cleaning)
- [ROS連携](/ja/development/webui/navigation/ros-integration)
- [アーキテクチャ](/ja/development/architecture)
- [状態 & 挙動](/ja/development/state-and-behavior): 完全なアクティビティ状態遷移図と
  `paused_due_to_ping_loss`の裏にあるセーフティウォッチドッグの挙動。
