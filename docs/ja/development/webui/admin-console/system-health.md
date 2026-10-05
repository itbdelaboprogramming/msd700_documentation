---
outline: deep
search: false
---

# 管理コンソール: システムヘルス

<RoleBadge role="developer" />

システムヘルスタブ（`SystemHealthPanel.tsx`）は、システムのサーバー側が動作しているかを示す。
ダッシュボードを支えるサービス、それらが応答するポート、ブラウザとロボットの接続を保つ2つの SSL
証明書である。すべての管理者が閲覧でき、読むだけで何も変更しない。チェックは `backend_node`
（`scripts/system_health.js`）の
[`GET /admin/api/system/health`](/ja/development/message-contracts/http-api#admin-api) で実行され、
パネルはタブを開いている間30秒ごとに取得する。

各項目にはステータス（**Working**、**Needs attention**、**Not working**、**Not used**）、
オペレーターにとっての意味を示す平易な一文、対応が必要なときの対処メモ、技術的な事実（ポート、
バージョン、エラー、フィンガープリント）をまとめた **Details** がある。

## チェック内容と方法 {#checks}

| 項目 | チェック | 動作しないとき |
| --- | --- | --- |
| Database | バックエンド自身のプールで `SELECT VERSION()`、タイムアウト3秒。1秒より遅いと警告 | オペレーターがサインインできず、コンソールが保存できない |
| Backend API | 常に動作中（応答している）。稼働時間、Node.js バージョン、メモリ | |
| MQTT broker | バックエンド自身のブローカー接続: 接続状態、接続開始時刻、最後の切断、最後のエラー | ロボットがコマンドを受け取れず、状態も報告しない |
| Live link | [ゲートウェイ](/ja/development/message-contracts/rosbridge#gateway)の `health()` と `LINK_GATEWAY_PORT` への TCP 接続。変数が未設定なら "Not used" | ライブマップとロボット位置が表示されない |
| Web UI | `WEBUI_URL` への HTTP GET。500未満の応答なら稼働 | オペレーターがダッシュボードを開けない |
| Public website | `PUBLIC_SITE_URL`（Apache 経由のサイト）への HTTP GET。空ならスキップ | インターネットから到達できない |
| Media server | `MEDIA_PORT` の `/health` への HTTP GET | マップを開くことも保存することもできない |
| Camera signalling | `PORT_WS` への TCP 接続、`PORT_HTTP` への HTTP GET | ロボットのカメラを開けない |
| Website 証明書 | `CERT_HOST`（既定は `NAKAYAMA_HOST`）の443番への TLS ハンドシェイク | ブラウザがサイトを拒否する |
| MQTT broker 証明書 | バックエンドのライブなブローカーソケット上の証明書 | ロボットがブローカーを拒否する |

**Connections and ports** の表には、上記の各ポートと判定方法（"Test query"、"Backend connection"、
"Connection test"、"Web request"、"Secure connection"）、応答時間が並ぶ。

::: warning 意図的に避けている2つのプローブ
- **MySQL に TCP プローブをしない。** MySQL はハンドシェイク前に閉じた接続をそのホストのエラーと
  数え、`max_connect_errors` 回でホストをブロックする。バックエンドは Docker のポートプロキシ経由で
  MySQL に接続するため、ブロックされるのはバックエンド自身になる。データベースは実際のクエリでのみ
  確認する。
- **HiveMQ のポートにプローブしない。** MQTT の `CONNECT` 前に閉じた接続を HiveMQ は
  `Client ID: UNKNOWN ... disconnected ungracefully` として記録する。compose のヘルスチェックが
  8080番を見るのと同じ理由である（[Docker リファレンス § ヘルスチェック](/ja/setup/docker-reference#ヘルスチェック)）。
  到達性はバックエンド自身の接続から、証明書はその接続の TLS ソケットから得る。接続が切れて
  いるときだけ、証明書を読むために1回ハンドシェイクし（それが原因の可能性があるため）、10分間
  キャッシュする。
:::

## 証明書 {#certificates}

両方の証明書は、`/etc/letsencrypt` からではなくサーバーが提示するとおりに読む。そのため期限切れや
名前不一致の証明書も、拒否されずに内容が表示される。

| 残り日数 | ステータス | 理由 |
| --- | --- | --- |
| 30日以上 | Working | 最終更新日と certbot の次回更新日（期限の30日前）を表示 |
| 7〜29日 | Needs attention | certbot は期限の30日前に更新するので、更新が行われていない |
| 7日未満、期限切れ、または信頼されない | Not working | クライアントが拒否する、または数日以内に拒否する |

このタブは2つを比較もする。ブローカーが Website と異なる証明書を提示し、その期限が Website より
1日以上早い場合、ブローカー項目は "the broker keystore was not rebuilt" として **Needs attention**
になる。これは [メンテナンス § 証明書](/ja/setup/maintenance#証明書) にあるサイレント障害で
ある。certbot は Apache が読む PEM ファイルを更新するが、HiveMQ は独自の PKCS#12 キーストアを
提示し続け、Website が正常に見える間に、ロボットは古い期限日に切断される。パネルが示す対処は
`update_ssl.sh` を実行し、ロボットが作業していないときにブローカーを再起動することである。

## 設定 {#configuration}

`backend_node` が環境変数から読む。既定値は本番のものなので、`docker-compose.yml` で設定して
いるのは `nakayama_cloud_dev` だけである。

| 変数 | 既定値 | Dev |
| --- | --- | --- |
| `WEBUI_URL` | `http://127.0.0.1:3000/` | `http://127.0.0.1:3100/` |
| `PUBLIC_SITE_URL` | `https://<NAKAYAMA_HOST>/` | 空（スキップ）: 公開サイトはホストの Apache の背後にある本番フロントエンドで、dev 稼働中は本番が停止しているため |
| `MEDIA_PORT` | `3003` | `4003` |
| `CERT_HOST` | `NAKAYAMA_HOST` | 未設定 |

`PORT_WS`、`PORT_HTTP`、`LINK_GATEWAY_PORT`、`PORT`、`PORT_SQL` はスタックが既に設定している。

## サーバー負荷 {#load}

スナップショットは15秒間キャッシュされ、タブを開いているすべての管理者で共有される。同時の
リクエストは1回の実行を共有する。**Check now** は新しい実行を求めるが、5秒より短い間隔では
実行しない。各チェックのタイムアウトは3秒で並列に実行されるため、1回のスナップショットは長くても
約3秒である。

## 関連

- [メッセージ契約: HTTP API § Admin API](/ja/development/message-contracts/http-api#admin-api): `GET /admin/api/system/health`（新しい実行は `?refresh=1`）。
- [概要](/ja/development/webui/admin-console/overview): コンソールのシェルとタブ。
- [ユニット § ユニットステータス](/ja/development/webui/admin-console/units#unit-status): ロボットごとのライブステータス。このタブでは繰り返さない。
- [メンテナンス § 証明書](/ja/setup/maintenance#証明書): 更新とブローカーキーストアの再構築方法。
- [Docker リファレンス § サービスとポートの一覧](/ja/setup/docker-reference#service-and-port-map): このタブに並ぶポート。
