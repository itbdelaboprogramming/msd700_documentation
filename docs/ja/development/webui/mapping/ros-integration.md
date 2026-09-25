---
outline: deep
search: false
---

# ROS連携

<RoleBadge role="developer" />

[マッピング](/ja/development/webui/mapping/overview)画面の裏にあるワイヤー契約。SLAMセッションを開始・停止するREST呼び出し、その同じリクエストを`system_command.py`へ運ぶMQTTコマンド/フィードバックエンベロープ、そしてマップが保存される際にロボットがディスク上およびネットワーク越しに実際に行うことである。画面自体の挙動については[概要](/ja/development/webui/mapping/overview)と
[手動操作 & 自律動作](/ja/development/webui/mapping/manual-and-autonomous)を参照。

## マッピングセッションの開始と停止

[APIリファレンス § マッピング(SLAM)操作](/ja/development/api-reference#マッピング-slam-操作)より。

### Start

`POST /api/mapping/start`は対象ユニット上でSLAM(gmapping)モードを開始する。

```json
{ "unit_id": "01JZ8P9WZ0UNIT00000000000" }
```

### Stopと保存

`POST /api/mapping/stop`はアクティブなoccupancy
gridを保存し、サムネイルのメタデータを生成し、アセットをアップロードする。これは、オペレーターがマップに名前を付けた時点で`ConfirmSaving`ダイアログが送信するリクエストである。

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "display_map_name": "Warehouse Sector 4",
  "homebase_x": 0.0,
  "homebase_y": 0.0
}
```

ここでの`homebase_x` / `homebase_y`は、マッピング開始時に自動的に取得されたポーズであり(
[概要 §
マップの保存](/ja/development/webui/mapping/overview#マップの保存-stopフロー)を参照)、オペレーターが入力する値ではない。

::: info 保存は非同期である
SLAMマップの保存には、このプラットフォームの他の箇所で使われている標準の30秒HTTPタイムアウト予算(
[メッセージ契約 §
コマンド相関とリトライアーキテクチャ](/ja/development/message-contracts#コマンドの相関とリトライアーキテクチャ)を参照)よりも長い時間がかかる。そのため`POST
/api/mapping/stop`は、`request_id`と`map_ulid`を伴って即座に`200 OK`を返す。

```json
{
  "success": true,
  "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "map_ulid": "01JZ8QK2H0000000000000MAP"
}
```

その後フロントエンドは`GET
/api/mapping/progress/:request_id`のSSEストリームに接続し、保存が完了するまで追跡する。これはおそらく
[概要](/ja/development/webui/mapping/overview#マップの保存-stopフロー)で説明した`MapSaving`進捗オーバーレイの裏側にあるものだが、クライアント側の正確なサブスクリプションコードは本ページで入手可能なソース資料では扱われていない。
[メッセージ契約 §
マッピングサブシステム](/ja/development/message-contracts#_3-マッピングサブシステム-header-mapping)も参照。
:::

## MQTTコマンドエンベロープ(`header: "mapping"`)

上記のHTTP
stopリクエストは、共有の[コマンドエンベロープ](/ja/development/message-contracts#コマンドペイロードのエンベロープ)を用いて、`/unit_<ULID>/system_command`上の`mapping`
/ `stop`コマンドとしてロボットへ中継される。

```json
{
  "header": "mapping",
  "command": "stop",
  "config": {
    "resource": {
      "map_name": "01JZ8QK2H0000000000000MAP",
      "display_map_name": "Production Hall Level 1",
      "map_ulid": "01JZ8QK2H0000000000000MAP",
      "created_by": "01JZ7YV5CQUSER00000000000",
      "unit_id": "01JZ8P9WZ0UNIT00000000000",
      "homebase_x": 1.2,
      "homebase_y": 0.5,
      "homebase_z": 0.0,
      "homebase_ox": 0.0,
      "homebase_oy": 0.0,
      "homebase_oz": 0.0,
      "homebase_ow": 1.0
    }
  }
}
```

ここでの完全なホームベースポーズには、RESTボディと`maps_data`テーブルが持つ`x`/`y`位置に加えて、向きのクォータニオン(`homebase_o{x,y,z,w}`)が含まれていることに注意。これは、マップがロードされる際に`navigation`
/ `init`が後で読み戻すのと同じ形状であり(
[メッセージ契約 §
ナビゲーションサブシステム](/ja/development/message-contracts#_2-ナビゲーションサブシステム-header-navigation)を参照)、本ページの対象外である。

::: warning コマンドカタログで文書化されているのは`stop`のみ
[状態 &
挙動](/ja/development/state-and-behavior)のアクティビティステートマシンは、マッピングセッションに`pause`、`resume`、`discard`という遷移が存在することを示唆している(`mapping_active`
↔
`mapping_paused`、discard時は`mapping_active` →
`idle`)。コマンドリファレンスカタログのMapping Subsystemのエントリは、この詳細レベルでは`stop`しか文書化していない。pause/resume/discardの正確なコマンド動詞とペイロードはそこには記載されておらず、ここでも推測はしていない。
:::

### マッピング進捗フィードバック(`header: "mapping_progress"`)

保存の進捗は、stopコマンドの`request_id`に一致する`mapping_progress`フィードバックとして返ってくる。

```json
{
  "header": "mapping_progress",
  "command": "stop",
  "data": {
    "status": true,
    "progress": 100,
    "stage": "completed",
    "message": "Saved on the robot and the server.",
    "terminal": true,
    "outcome": "completed"
  },
  "metadata": {
    "timestamp": 1734000000.0,
    "request_id": "..."
  }
}
```

| Outcome値 | 説明 |
| --- | --- |
| `completed` | ローカルのUnitメディアサーバーとcloudサーバーの両方に正常に書き込まれた。 |
| `cloud_pending` | ローカルのUnitメディアサーバーにのみ書き込まれた。クラウドへのレプリケーションは次回の同期インターバルで完了する。 |
| `failed` | マッピングの保存に失敗した。セッションは再試行のため開いたままになる(ロボットのアクティビティは`mapping_stop_failed`を報告する)。 |

この表の出典については
[メッセージ契約 §
マッピング進捗フィードバック](/ja/development/message-contracts#マッピング進捗フィードバック-header-mapping-progress)を参照。

## ロボット側の保存: `map_saver`とプリフライトチェック

`mapping` / `stop`がロボットに届いても、無条件にアップロードするわけではない。何かを書き込む前に、プリフライトのヘルスチェックがローカルディスクとメディアエンドポイントに到達可能であることを検証する。

![ロボット側の保存: mapsaverとプリフライトチェック](../../../../development/webui/mapping/diagrams/ros-integration-robot-side-save-mapsaver-and-preflight-c.drawio)

ローカルディスクに書き込めない場合、破損した実行や不完全な実行をディスクに残さないよう、保存は試みられることなく即座に拒否される。プリフライトを通過すると、`map_saver`がoccupancy
gridのアセットを生成する。`.pgm`画像、`.yaml`メタデータファイル、そしてサムネイルである。

## 二段階アップロードとクラウドレプリケーション

`map_saver`の出力は、その後、要求レベルの異なる2つの独立したターゲットへアップロードされる。

| 保存先 | 要求レベル | 失敗した場合の影響 |
| --- | --- | --- |
| **Unitローカルメディアサーバー**(`media_local`、`:3003`) | **必須** | ローカル保存に失敗すると、ロボットはこのマップでナビゲーションできない。オペレーターが保存を再試行できるよう、SLAMセッションはアクティブなまま維持される(`mapping_stop_failed`)。 |
| **Cloud中央メディアサーバー**(`media-server`、`:3003`) | **ベストエフォート** | クラウドへのアップロードが失敗した場合(たとえばロボットがオフラインの場合)、マップは`cloud_pending`としてマークされる。バックグラウンドの`sync_agent`が、インターネット接続が戻り次第、自動的にマップファイルをレプリケートする。 |

この二重ターゲット設計こそが、インターネットのない倉庫で記録されたマップが、そのユニット自身でのナビゲーションに即座に使える理由である。それを制約するのは必須のローカルアップロードのみだからである。クラウドの可用性(他の場所からマップを閲覧するため、あるいはフリート全体のバックアップのために必要)は、オペレーターをブロックすることなく`sync_agent`経由で後から追いつく。

この保存フローが相互作用するロボットのアクティビティステートマシンとセッション復旧の挙動については(ここでは繰り返さない)、
[ナビゲーション: 手動操作 &
オートパイロット](/ja/development/webui/navigation/manual-and-autopilot)と[セーフティウォッチドッグ](/ja/development/ros/safety-watchdog)を参照。

## 関連

- [概要](/ja/development/webui/mapping/overview): Play/Pause/Stop、ライブマップビュー、Stop時の保存UIフロー
- [手動操作 & 自律動作](/ja/development/webui/mapping/manual-and-autonomous):
  マッピングセッション中の2つの運転モード
- [アーキテクチャ](/ja/development/architecture)
- [状態 & 挙動](/ja/development/state-and-behavior):
  ロボットのアクティビティステートマシンとセッションの再接続/復旧の挙動
