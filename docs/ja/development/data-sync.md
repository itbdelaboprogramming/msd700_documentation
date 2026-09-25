---
outline: deep
search: false
---

# データ同期

<RoleBadge role="developer" />

このドキュメントは、ユニットのローカル MySQL データベース(`ROS_DB`)と中央クラウドデータベースが、断続的な無線接続の中でどのように双方向の一貫性を維持するかを詳述します。

繰り返される整合ループ(`sync_agent.js`、`sync_engine.js`、`sync_tables.js`)、競合解決アルゴリズム、ウォーターマーク追跡、Local Mode のオペレーターステータスバッジについて扱います。

HTTP 同期コントラクトについては [API リファレンス](/ja/development/api-reference) を参照してください。リアルタイムのマップ保存アップロードについては [State and Behavior](/ja/development/state-and-behavior) を参照してください。

::: info 基本原則: ローカルはキャッシュである
ユニットは登録された後、無期限にオフラインで機能します。ユーザーアカウント、権限、レンタルプロファイルはクラウドを起点としますが、ロボット上で記録されたマップ、ルート、プレイリストは、ネットワーク接続が確立されるとクラウドへ同期し返されます。
:::

## テーブル同期方式

すべてのデータベーステーブルが同じ方向に同期するわけではありません。

| 同期方向 | 対象テーブル | アーキテクチャ上の理由 |
| --- | --- | --- |
| **ダウンストリームのみ**(クラウドからユニットへ) | `units`、`rental_profiles`、`users`(オフラインログイン用の bcrypt パスワードハッシュを含む)、`profile_members`、`profile_units`。 | セキュリティ境界: アイデンティティとレンタルのテナンシーは厳密にクラウドサーバーを起点とします。ローカルユニットは新しいグローバルアカウントを発行したり、自身のフリートのテナンシーを再割り当てしたりすることはできません。 |
| **双方向**(行単位の Last-Write-Wins) | `maps_data`、`routes_data`、`areas_data`、`playlists_data`。 | 運用データは両側で作成されます。SLAM マップはロボット上で記録され、ウェイポイントルートやプレイリストは Web ダッシュボード上で作成されます。 |

バイナリアセット(`.pgm` の占有グリッド、`.yaml` メタデータ、マップサムネイルなど)は専用のエンドポイント(`/sync/file/:mapId/:kind`)経由で同期され、正確なファイルサイズによって検証されます。

## 同期の仕組み

![同期の仕組み](../../development/diagrams/data-sync-synchronization-mechanics.drawio)

### 主要コンポーネント:
- **`sync_agent.js`**: ユニット上でのみ動作し、ポーリングタイマー、到達可能性のプローブ、クラウドエンドポイントへの送信 HTTP 呼び出しを管理します。(クラウドは NAT の背後にあるロボットへ能動的に発信することはありません)。
- **`sync_engine.js`**: 両側で共有されるライブラリで、ウォーターマークに基づいて変更された行をクエリし、upsert を実行し、削除トゥームストーンを管理します。
- **`sync_tables.js`**: 各テーブルについて、同期方向、主キー、競合解決ルールを定義します。

## クラウド半分(`sync_api.js`)

駆動するのはユニット、応えるのはクラウド。`sync_api.js` はロボットトークンを認証し(`role: robot`、`typ: access`、`unit_id` はクレーム由来、ボディ由来決して不可)、`POST /handshake|/pull|/push|/ack` と `GET|PUT /file/:mapId/:kind` および `/route-file/:routeId/:kind` を提供する。pushは呼出者ユニット+プロファイルにスコープされ、強制される。identity系テーブルは拒否する。

## 競合解決ルール

競合解決は決定論的な**行単位の Last-Write-Wins** 戦略に従います。

1. **行レベルの粒度**: 新しい行が古いレコードを完全に置き換えます。
2. **削除トゥームストーン**: レコードを削除すると、`deleted_at` タイムスタンプ付きのエントリが `sync_tombstones` に生成されます。最近の削除は、それより古い編集に優先します。
3. **クロックスキュー補正**: 初回のハンドシェイク時に、ユニットはクラウドサーバー時刻に対する `clock_offset_ms` を計算します。すべてのローカルタイムスタンプは、比較の前にクラウドの時間参照系へ正規化されます。
4. **決定論的なタイブレーク**: タイムスタンプが完全に一致する場合、削除は編集に優先し、クラウド側のバージョンはユニット側のバージョンに優先します。
5. **名前衝突の処理**: 2人のオペレーターがオフライン中に同じ名前の異なるルートやマップを作成した場合、その後の同期は既存データを上書きするのではなく、自動的にインクリメンタルなサフィックス(例: `(1)`、`(2)`)を付加します。

## Local Mode ステータスバッジ

ローカルダッシュボードビルド(`NEXT_PUBLIC_DEPLOYMENT_MODE=local`)では、右上のヘッダーに Local Mode バッジが表示されます。

![Local Mode ステータスバッジ](../../development/diagrams/data-sync-the-local-mode-status-badge.drawio)

### 詳細な同期フェーズ:
1. `token`: ロボットの資格情報を使ってクラウドサーバーで認証する。
2. `handshake`: ウォーターマークを交換し、クロックオフセットを校正する。
3. `pull`: ダウンストリームのアカウントおよびプロファイルの更新をダウンロードする。
4. `apply`: 取得したレコードをローカル MySQL にコミットする。
5. `push`: ローカルで記録されたマップとルートをクラウドへアップロードする。
6. `files`: バイナリの `.pgm` と `.yaml` マップ画像を転送する。
7. `finish`: コミットされたウォーターマークを確認応答する。

::: warning フェーズラベルと障害の発生箇所は別物
進捗バーに表示されるフェーズ名は、ラウンドが*いつ*停止したかを反映するものであり、*どこで*停止したかを反映するものではありません。このユニット自身の `sync_state` 行を最初に読み取る `readState()` は、ハンドシェイクの HTTP 呼び出し直後、しかし `setPhase('pull')` の前に実行されます。そのため、そこで発生した障害はネットワークに一切触れていなくても `handshake` として表示され続けます。両者を区別するには、ログ行そのもの(下記参照)を読んでください。
:::

### 障害の分類

クラウドへの接続拒否と、このユニット自身のローカル `ROS_DB` への接続拒否は、どちらも同一の `ECONNREFUSED` として表面化するため、`sync_agent.js` はエラーがログに到達する前に、失敗したすべての呼び出しにその出所のタグを付けます。このタグがなければ、以前はローカルデータベースの停止が「クラウドに到達できない」と報告されていました。

| 出所タグ | 原因の例 | ログの文言 | ステータスバッジ |
| --- | --- | --- | --- |
| `local_db`：資格情報が拒否された | このユニットの `docker/.env` にある `MYSQL_USER`/`MYSQL_PASSWORD` が、ローカルの `mysql_data_local` ボリュームが既に初期化された時点のパスワードと一致しない(mysql2 `ER_ACCESS_DENIED_ERROR`)。 | *"this unit's own database refused the login it was given..."* | `error` |
| `local_db`：到達不能 | ユニットのローカル MySQL コンテナが稼働していない(`ECONNREFUSED`、`PROTOCOL_CONNECTION_LOST`)。 | *"cannot reach this unit's own database..."* | `error` |
| `local_db`：その他 | ローカルの読み書き中に発生するその他の MySQL エラー(スキーマ、ロックなど)。 | *"this unit's own database rejected the &lt;phase&gt; step..."* | `error` |
| `cloud`：ネットワークエラー | クラウドエンドポイントへの DNS 失敗、タイムアウト、または接続拒否。ユニットにアップリンクがない間は想定内。 | *"cloud not reachable, will retry..."* | `offline` |
| `cloud`：HTTP エラー | 既知の `NOT_ENROLLED`/`NO_RENTAL`/reenroll のケース以外で、クラウドが非 2xx ステータスで応答した。 | *"the cloud rejected the &lt;phase&gt; request (HTTP &lt;status&gt;)..."* | `error` |
| *(なし)* | HTTP ステータスもネットワーク上の特徴もない、`sync_agent.js` 自体の内部での throw。接続や資格情報の問題ではなく、エージェント自体のバグ。 | *"sync_agent hit an unexpected internal error during &lt;phase&gt;..."* | `error` |

正確な優先順位ルールについては `sync_agent.js` の `classifyFailure()` を参照してください。

## 関連ドキュメント

- [API リファレンス](/ja/development/api-reference): REST 同期エンドポイントとペイロード。
- [State and Behavior](/ja/development/state-and-behavior): マップ保存とストレージレプリケーションのフロー。
- [アーキテクチャ](/ja/development/architecture): ハードウェアとクラウドのトラストドメインモデル。
- [データベース設計](/ja/development/database-schema): `sync_state` と `sync_tombstones` のスキーマ定義。
