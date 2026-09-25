---
outline: deep
---

# メンテナンス

<RoleBadge role="technician" />

デプロイ済みMSD700システムの定期ケアです。各タスクに対象マシンを記載しています。Dockerコマンドの意味は[Dockerリファレンス](/ja/setup/docker-reference)参照。

## 定期チェックリスト

| タスク | 頻度 | 場所 | 備考 |
| --- | --- | --- | --- |
| JWTキーリングのローテーション | 数か月ごと、漏洩疑い時は即時 | サーバー | [シークレットのローテーション](#シークレットのローテーション) |
| TLS証明書の更新 | 期限前 | サーバー | [証明書](#証明書)。`certbot renew`だけではHiveMQは更新され**ません** |
| ユニットリレーの稼働確認 | 時々 | サーバー | `docker ps --filter name=unit_relays`。マルチユニットモード(デフォルト)では1台停止で全滅します |
| 期限切れ鍵の削除 | ローテーション猶予期間後 | サーバー | `./scripts/secrets.sh prune --dev` |
| Dockerディスク使用量 | 月次 | 両方 | `docker system df`、その後イメージ/ビルドキャッシュ削除 |
| TURNリレーの確認 | ネットワーク/ルーター変更後 | サーバー | [TURNリレー](#turnリレー) |
| ソフトウェア更新 | リリースごと | 両方 | [更新](#更新) |
| ROSログサイズ | ユニット不調時のみ手動 | ユニット | 自動janitorが処理します([以下](#ログの管理)) |

## ログの管理

ロボットコンテナはROSログを512 MBに抑えるjanitorを実行します(60秒ごとに確認)。上限超過時は大きいファイルから切り詰めます。監視対象は**コンテナ内**のログフォルダ(`ROS_LOG_DIR`、なければ`$ROS_HOME/log`、なければ`$HOME/.ros/log`)です。

**ユニットホスト**からは実際のランチャーセッションを見ます(シミュレーションは`msd700-simulator`):

```bash
docker exec -it msd700 tmux attach -t robot_services
tail -F src/ros-web-ui/logs/log_janitor.log   # msd700_noeticフォルダから
```

ROSログとは別のログがあと2系統あります:

- `src/ros-web-ui/logs/`下のランチャーログ: `rotatelogs`があればサービスごとに10 MB×5ファイル、なければ無制限`tee`。
- Docker標準出力/標準エラー: ユニットの全サービスは20 MB×3に制限。サーバー側は`coturn`のみ設定あり、他はデーモンのデフォルトです。

`ROS_LOG_CAP_MB`と`ROS_LOG_SWEEP_SECONDS`は内部ランチャーのみの設定です。ホストや`docker/.env`での指定は無効です。janitorは実ブロック使用量基準で大きい物から切り詰めます(削除しません。ROSがfdを開いたまま保持するため)。`stat` サイズは信用しません(スパースファイルの罠)。ツリーの約96%は通常 `rosout.log` です。

## `ros_doctor.sh`: 出力の読み方

`scripts/ros_doctor.sh` は読取専用です。ダッシュボードにステータスはあるがライブトピックがないとき、バックエンドコンテナ内で実行します:

- `OK master answers`：ROSマスターがそもそも応答している。
- `stamped as '<role>' owned by <host>`：`/msd700/stack_role` + `/msd700/stack_host`。話している相手が誰のマスターかを示す。
- `none: every node advertises a host this machine can resolve`：外部ノードなし。それ以外は当マシンが解決できないホストから登録されたノードを名指しする(転送ポートの乗っ取り)。
- `listening on 9090` 対 `nothing listening on 9090. Dashboards get no live topics at all.`：rosbridgeが上がっているか。
- `no rosbridge node on this master (evicted by a duplicate name, or never started)`：ブリッジが名前登録を失った(重複名で追放、または未起動)。

## `deploy_certs.sh`: 安全コピー、明示的上書き

`ros-web-ui/` から実行します。既定では `Certificates/mqtt` と `Certificates/sql` をバックエンド/mqttソースツリーへ `cp -n` でコピーします。**上書きしません**。上書きは `--force` のみです。`update_ssl.sh`(Let's Encrypt更新+HiveMQキーストア再生成)と混同しないでください。

## シークレットのローテーション

::: info 置換ではなくローテーションする理由
共有シークレット1つを置換すると全オペレーターと全ロボットが同時にログアウトします。キーリングは新鍵で署名しつつ旧鍵も猶予期間(デフォルト48時間)は**受け入れ**ます。接続中にはローテーションが見えません。
:::

開発バックエンド・メディア・シグナリングは**開発用**キーリングをマウントします。`ros-web-ui`からComposeと同じシークレットフォルダを使います:

```bash
./scripts/secrets.sh status --dev
./scripts/secrets.sh rotate --dev
```

猶予期間後:

```bash
./scripts/secrets.sh prune --dev
```

`--dev`なしでは本番がマウントしない`jwt_keyring.json`を触ります。本番にキーリングマウントはありません。作るだけでは何も設定されません。ユニットのローカルサービスはユニット`docker/.env`の別`JWT_SECRET`を使います。

鍵ファイルはプロセス起動時に一度だけ読まれます。ローテーション後は3つの開発コンシューマーを再作成し、同じ新ファイルを読ませます(コンテナ内の単なる再起動では不十分):

```bash
docker compose --profile server_dev up -d --no-deps --force-recreate nakayama_cloud_dev nakayama_media_dev nakayama_signalling_dev
```

開発ユニットリレーも再起動し、開発ユニットが一瞬切断されます。猶予期間中トークンは有効ですが、再作成中のソケットは切れます。

## 証明書

ApacheはLet's EncryptのPEMファイルを直接読みます。HiveMQは**別生成**のPKCS#12キーストアを読みます。PEM更新だけではHiveMQは更新されません。

![証明書](./diagrams/maintenance-certificates.drawio)

| 利用者 | 更新の反映方法 | 自動? |
| --- | --- | --- |
| Apache | PEM更新後のリロード | ホストのcertbot設定次第 |
| HiveMQ | キーストア再生成+ブローカー再起動 | いいえ。`update_ssl.sh`は何も再起動しません |

```bash
sudo ./source/dependencies/ssl_update/update_ssl.sh   # 更新+キーストア再生成
docker compose --profile server_dev  up -d --no-deps --force-recreate hivemq_dev
docker compose --profile server_prod up -d --no-deps --force-recreate hivemq   # メンテナンス時間帯に!
```

::: danger ブローカー再起動はその配下の全ユニットを切断します
2秒以上オペレーターピンが途切れると`/emergency_pause`が上がる場合があります。本番に限らず稼働中を避けて再起動します。両プロファイルは**同じキーストアファイル**共有のため、更新は開発分離されません。
:::

`update_ssl.sh`は`msd.nglobal.jp`と`/srv/msd/secrets/hivemq/keystore.p12`に固定です。エクスポートパスワードはブローカー設定と一致させます。診断で表示しないでください。HTTPSとMQTTそれぞれの提示期限を前後で確認します。

## TURNリレー

`coturn`は**本番専用**です。詳細な理由は[Dockerリファレンス](/ja/setup/docker-reference#coturn-本番専用サービス)。

```bash
docker compose --profile turn up -d coturn      # リレーのみ起動/再起動
docker compose logs -f coturn                   # アロケーション監視
docker compose --profile turn stop coturn       # リレーのみ停止
```

`.env`変更後は`up -d coturn`で適用します(単なる`restart`は旧環境を保持します)。

| 変更内容 | 対応 |
| --- | --- |
| ホストLANアドレス | `TURN_LISTENING_IP`+`TURN_EXTERNAL_IP`更新、リレー再起動、ルーター転送再確認 |
| パブリックIP | `TURN_EXTERNAL_IP`の公開側を更新、リレー再起動 |
| `TURN_USER` / `TURN_PASSWORD` | リレー再起動、ユニットの`camera_client`環境(`TURN_USERNAME`/`TURN_CREDENTIAL`)更新、クラウドダッシュボードイメージをリビルド(バンドルに同認証情報を焼込済み) |
| ルーター/ファイアウォール | UDP+TCP 3478とUDPリレー範囲が`TURN_LISTENING_IP`に届くことを再確認 |

::: info 覚えるべき症状
同LANではカメラが映り、外部では映らない。カメラではなくリレーです:シグナリング成功、メディア経路失敗です。
:::

## バックアップ

| データ | 場所 | 方法 |
| --- | --- | --- |
| 地図、ルート、エリア、プレイリスト | MySQL+`/srv/msd/media/map`下の地図ファイル | 管理コンソールの**プロファイルバックアップ**: プロファイルごとに`.tar.gz`1つ、復元は加算式 |
| 1台分のデータ (ハード交換、単体アーカイブ) | 同ソース、1台分 | バックアップの`scope`列で1台だけアーカイブ |
| JWTキーリング / TLSキーストア | `/srv/msd/secrets` | アプリバックアップ対象外。ファイルシステムレベルでバックアップ |

::: warning
バックアップファイルは`/srv/msd/media/backup`(開発は`/srv/msd/media/backup_dev`)に出力されます。フォルダがない、またはアプリユーザーが書けないと失敗します([トラブル対処](/ja/setup/troubleshooting)参照)。
:::

## 更新

### サーバー

```bash
git pull
docker compose --profile server_dev  build && docker compose --profile server_dev  up -d   # 先にテスト
docker compose --profile server_prod build && docker compose --profile server_prod up -d
```

バックエンド再作成は既存`unit_relays`コンテナを再起動します(デフォルトのマルチユニットモード)。手動のリレーステップは不要ですが、全ユニットのデータプレーンが一瞬切れて自動復旧します。存在しないリレーをバックエンドが作ることはありません。作成はComposeのみです。

レガシーモード(`UNIT_CONTAINERS_ENABLED=true`):稼働中の`rosweb_unit_*`コンテナは起動時に引き継がれますが、ROSノードは新マスターに再登録されません。触る前に1環境だけ列挙します(本番名は`_nakayama`、開発は`_nakayama_dev`で終わります):

```bash
docker ps --filter "name=rosweb_unit_" --format '{{.Names}}' | grep '_nakayama_dev$'
```

### ユニット

```bash
git pull
# src/は通常クローンでありサブモジュールではありません。個別にpullします
for d in src/*/; do git -C "$d" pull; done
git -C src/msd700_robot submodule update --init --recursive
```

メンテナンス時間帯にリビルド/再起動します。ユニットの`--dev` / `--simulator`フラグを保持します:

- **ロボットコンテナ**は`src/`をバインドマウントします:Pythonとlaunchの編集は次回ランチャー実行で反映され、リビルド不要です。C++変更・メッセージ・新規パッケージはcatkinビルドが必要(`up --build`)。通常`up`は`devel/setup.bash`があればビルドを省略します。
- **ローカルサーバースタック**はソースをイメージにコピーします:その編集は`local-build`後に`up`します。
- 稼働中ロボットコンテナは`build`後も旧イメージのままです。置換は`down`+同フラグの`up -d`を計画します。ロボットとローカルサービスが中断します。起動動作を変えないなら`--no-autostart`を付けます。

STM32モーターコントローラーのファームウェア更新手順はここにありません。`firmware-msd700`リポジトリ(`STM32H7_MSD700_Unified_Firmware`、STM32CubeIDE)から手動でリフラッシュします。

## ディスク管理

```bash
docker system df                 # 使用量の確認
docker image prune -a            # 未使用イメージ
docker builder prune             # ビルドキャッシュ
docker volume ls                 # 削除前に確認すること
```

::: danger `docker compose down -v`は気軽に使わないでください
`-v`は名前付きボリュームを削除し、`ros_webui_hivemq_data_prod`(保持メッセージ、クライアントセッション、QoS>0キュー)を含みます。ブローカー掃除はそのボリューム1つを名前指定で意図的に削除します。
:::

## 関連

- [Dockerリファレンス](/ja/setup/docker-reference):上記各コマンドの意味
- [トラブル対処](/ja/setup/troubleshooting):メンテナンスで問題が出たら
- [システム構築](/ja/setup/system-setup):構成の参照
