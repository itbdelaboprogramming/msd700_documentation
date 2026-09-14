---
outline: deep
---

# ユニットセットアップ

<RoleBadge role="technician" />

このガイドでは、**MSD700 ユニット**(NVIDIA Jetson シングルボードコンピュータ上で動作する物理ロボット)のインストールと設定に関するステップバイステップの手順を説明します。

進める前に、稼働中の [MSD700 サーバー](/ja/setup/server-setup) が存在することを確認してください。

::: info 本番環境を優先したアーキテクチャ
このガイドは、**本番クラウド**に接続する実機ハードウェアロボットのデプロイをデフォルトとしています。シミュレーションオプション(`--simulator`)と開発クラウドへのルーティング(`--dev`)は [高度な設定](#advanced-configurations) セクションにあります。
:::

## システムトポロジー

![Arsitektur Sistem MSD700](/images/MSD700-System-Diagram.jpg)



## ディレクトリ構成の概要

Jetson のワークスペースは、ロボットパッケージ、Web ブリッジ、オンボード Web UI をサブモジュールとして管理します。

```
~/msd700_noetic/                              # Main Jetson Orchestration Workspace
├── setup.sh                                  # Host Dependency Installer (Docker, xhost)
├── scripts/
│   └── docker-manager.sh                     # Core Lifecycle CLI (build, up, down, logs)
├── docker/
│   ├── Dockerfile                            # ROS 1 Noetic Desktop Full Container
│   ├── docker-compose.yml                    # Robot Container Definition
│   └── .env                                  # Local Environment Variables
└── src/                                      # Catkin Workspace Submodules
    ├── msd700_robot/                         # Navigation, EKF Control, Hardware Drivers
    ├── ros-web-ui/                           # Web Bridges, MQTT nodes, System Command
    └── ROS-dashboard-next-ts/                # Local Operator Web Dashboard
```

---

## コアとなるステップバイステップのセットアップ

物理ロボットをセットアップするため、以下の 6 つのステップを順番に実行します。ロボット自身の WiFi ホットスポットの設定も含みます。

### ステップ 1: ワークスペースとソースリポジトリをクローンする

オーケストレーション用ワークスペース `msd700_noetic` をクローンし、続けて必要な 3 つのリポジトリを `src/` ディレクトリにクローンします。

```bash
# 1. Clone orchestration workspace
git clone git@github.com:itbdelaboprogramming/msd700_noetic.git ~/msd700_noetic
cd ~/msd700_noetic

# 2. Clone source packages into src/ on branch v2
git clone -b v2 git@github.com:itbdelaboprogramming/msd700_robot.git src/msd700_robot
git clone -b v2 git@github.com:itbdelaboprogramming/ros-web-ui.git src/ros-web-ui
git clone -b v2 git@github.com:itbdelaboprogramming/ROS-dashboard-next-ts.git src/ROS-dashboard-next-ts
```

::: tip なぜ `src/` に手動でクローンするのか
`msd700_noetic` は `.gitignore` で `src/*/` を無視しており、Git-in-Git の衝突を避け、各サブリポジトリをそれぞれ独立したブランチで管理できるようにしています。
:::

---

### ステップ 2: ホストの初回セットアップ

ホストセットアップスクリプトを実行し、Docker グループの権限とグラフィックスフォワーディングを設定します。

```bash
cd ~/msd700_noetic
./setup.sh
```

::: warning グループ権限を反映させる
スクリプトがユーザーを `docker` グループに追加した場合は、ログアウトして再ログインするか、以下を実行してください。
```bash
newgrp docker
```
:::

---

### ステップ 3: 環境設定(`docker/.env`)を確認する

初回起動時、`./scripts/docker-manager.sh` は `docker/.env.example` から `docker/.env` を自動生成し、安全でループバック専用のローカル MySQL パスワードを生成します(`ensure_local_secrets`)。

起動前に手動で設定を事前構成・確認したい場合:

```bash
cd ~/msd700_noetic
cp docker/.env.example docker/.env
nano docker/.env
```

`docker/.env` の主な設定項目:

```ini
# Storage path for map occupancy grids on the Jetson
MAPS_FOLDER_LOCAL=/home/ubuntu/ros_maps

# Local User UID/GID (leave blank to auto-detect from host `id -u` / `id -g`: Jetson=2002, dev=1000)
USER_UID=
USER_GID=

# Gazebo simulator support (set to true only for machines without MSD700 hardware)
WITH_SIMULATOR=false

# Leave UNIT_ID empty; assigned and cached automatically during cloud enrolment
UNIT_ID=

# Local Ports (Default settings for on-board local stack)
MYSQL_PORT_LOCAL=3306
MOSQUITTO_PORT_LOCAL=1883
BACKEND_PORT_LOCAL=5002
ROSBRIDGE_PORT_LOCAL=9090
FRONTEND_PORT_LOCAL=3000
MEDIA_SERVER_PORT_LOCAL=3003
SIGNALLING_PORT_WS_LOCAL=3001
SIGNALLING_PORT_HTTP_LOCAL=3002
NETWORK_AGENT_PORT_LOCAL=5011

# Optional: static IP hint (the dashboard dynamically adapts to operator browser address)
#LOCAL_IP=192.168.4.1
```

::: info クラウド接続のルーティング
クラウド接続パラメータ(本番クラウド `https://msd.nglobal.jp/services`、または `--dev` 経由の開発クラウド)は、起動時とエンロルメント時に `docker-manager.sh` が自動的に管理しており、`docker/.env` では設定しません。
:::

---

### ステップ 4: ロボットの Docker イメージをビルドする

ROS Noetic のロボットランタイムコンテナをビルドします。

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh build
```

これにより、ROS Noetic、ナビゲーションスタック、センサードライバ、Web ブリッジを含む `msd700:latest` イメージがビルドされます。

---

### ステップ 5: ロボットを起動しエンロルメントを完了する

detached モードでロボットスタックを起動します。

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh up -d
```

#### 自動エンロルメントフロー:
1. 初回起動時、ロボットはクラウドサーバーに接続し、6 文字の **Claim Code**(例: `K7M2QP`)を出力します。
2. 管理者が `https://msd.nglobal.jp/admin` を開いてログインします。
3. **Pending Units** の下で一致するクレームコードを見つけ、そのユニットをアクティブな **Rental Profile** に割り当て、**Approve** をクリックします。
4. ロボットは暗号署名された認証情報(`Certificates/robot/device.json`)を受け取り、TLS ポート 8883 経由で HiveMQ に接続し、フリートマップ上にライブで表示されます。

---

### ステップ 6: WiFi ホットスポットをプロビジョニングする

すべてのユニットは、オペレーターが直接接続できるよう独自の WiFi ホットスポットをブロードキャストします(オンボードの無線は通常の WiFi クライアントのまま維持されます)。検証済みの USB WiFi ドングルを接続し、対話型ターミナルから次の 2 つのコマンドを実行します。

```bash
cd ~/msd700_noetic

# 1. Install the dongle's driver (one-time, builds via DKMS so it survives kernel upgrades)
./scripts/install-wifi-dongle-driver.sh

# 2. Provision the hotspot
./setup.sh --provision-network
```

キーボードから直接実行すると(パイプ経由や非 TTY セッションではなく)、`--provision-network` は
create-next-app のようなスタイルで各設定項目を順番に案内します。インターフェース名、SSID、パスワード
は自動検出された `[デフォルト値]` として表示され、Enter を押せばそれぞれを受け入れ、あるいは新しい値を
入力できます。ホットスポットのパスワードは確認のため 2 回入力しますが、`docker/.env` やディスク上の
他のいかなるファイルにも書き込まれません。ホットスポットは、以降のすべての起動時に Docker や
`docker-manager.sh` とは無関係に自動的に立ち上がります。

::: info 無人・スクリプトによるプロビジョニング
TTY がない場合(または `MSD700_NONINTERACTIVE=1` が設定されている場合)、プロンプトはスキップされ、
`--provision-network` は `docker/.env` と環境変数をそのまま使用します。そのため、
`AP_PASSWORD_LOCAL='your-hotspot-password' ./setup.sh --provision-network` は自動化にもそのまま
使用できます。完全なプロビジョニング手順、検証済みドングルハードウェア、トラブルシューティングに
ついては [Wi-Fi ホットスポット + クライアント](/ja/setup/wifi-hotspot#ホットスポットのプロビジョニング-ユニットごとに一度)
を参照してください。
:::

---

## ユニットをローカルで操作する(オフラインモード)

ロボットがインターネット接続のない場所で稼働する場合は、ラップトップやタブレットをロボットのローカルネットワーク、またはステップ 6 でプロビジョニングした[ロボットの WiFi ホットスポット](/ja/setup/wifi-hotspot)に直接接続してください。

1. ブラウザを開き、`http://<jetson-ip>:3000` にアクセスします。
2. ローカルダッシュボードでは、完全な遠隔操作、SLAM マッピング、ルート作成、エリアカバレッジ清掃が可能です。
3. インターネット接続が復旧すると、ローカルで記録されたすべての地図は自動的に中央クラウドサーバーへ同期されます。

---

## 高度な設定

<details>
<summary><b>シミュレーションモード(Gazebo Warehouse)</b></summary>

物理ロボットハードウェアなしでラップトップ上でアルゴリズムをテストするには:

1. シミュレーター対応イメージをビルドする:
   ```bash
   ./scripts/docker-manager.sh build --simulator
   ```

2. シミュレーションスタックを起動する:
   ```bash
   ./scripts/docker-manager.sh up --simulator -d
   ```

</details>

<details>
<summary><b>開発クラウドへのルーティング(`--dev`)</b></summary>

ユニットを本番ではなく開発クラウドサーバーに向けるには:

```bash
./scripts/docker-manager.sh up --dev -d
```

これにより MQTT は開発用ポート `8884` に接続され、開発用データベースと同期します。

**開発クラウドでもブローカーのホスト名は `msd.nglobal.jp` のままです。** 開発環境と本番環境は同じ
マシンであり、公開されているポートのみで区別されています。ブローカーの TLS 証明書はそのホスト名に
対して発行されているため、MQTT を素の IP に向けると検証に失敗します。したがって、ログ行に
`mqtts://msd.nglobal.jp:8884` と表示されていれば、それは **開発用** ブローカーです。ホスト名ではなく
ポートを見てください。

| ピア | ブローカー | バックエンド | ROS マスター |
| --- | --- | --- | --- |
| 本番(フラグなし) | `msd.nglobal.jp:8883` | `https://msd.nglobal.jp/services/rosbackend` | `11321` |
| 開発(`--dev`) | `msd.nglobal.jp:8884` | `http://118.22.31.252:5001` | `11322` |

::: danger このユニットをクラウドの ROS マスターに絶対に到達させないこと
このロボットの roscore は `11321`/`11322` であり、クラウドサーバーの `11311`/`11312` とは意図的に
分離されています。以前はこれらの番号を共有していたため、`localhost:11312` が指すマスターはマシンに
よって異なっていました。VS Code Remote セッションや、サーバーのポートを転送する `ssh -L` だけで
十分に問題が発生しました。`roscore` はバインドできずに終了しましたが、トンネルが応答していたため
readiness プローブは通過してしまい、ユニットのスタック全体が**クラウド**側のマスターに登録されて
しまったのです。ROS は名前が二重に取得された場合、古い方のノードを強制終了するため、サーバー自身の
`/rosbridge_websocket` と `/backend_node` が追い出され、ライブトピックがクラウドダッシュボードから
消失しました(マッピング地図が最初に消えました)。一方ローカルダッシュボードは正常に見えていました。
これは 2026-09-10 に発生した事象です。

現在は 2 つの保護策があります。ポートはもはや重複せず、`run_msd.sh` は、そのポート上で自分自身の
`rosmaster` が稼働しており、かつそのマスターの `/msd700/stack_role` が `cloud` でない場合を除いて
起動を拒否します(すべての roscore はこのパラメータをスタンプします。`run_msd.sh` はさらに
`/msd700/stack_host` を追加します)。最後の保険として、クラウド側のノード名には `_cloud` という
サフィックスが付与されるため、誤って間違ったマスターに行き着いたスタックがあっても、もはや何も
追い出すことはありません。

```bash
ss -ltnp | grep :11322                     # who owns the port
rosparam get /msd700/stack_role            # whose master answers
src/ros-web-ui/scripts/ros_doctor.sh       # owner, foreign nodes, rosbridge, in one verdict
```

そのフォワーディングを閉じる(VS Code の場合: PORTS パネル)か、
`ROS_MASTER_PORT=11323 ./scripts/docker-manager.sh up --dev -d` でこのロボットを移動させてください。
:::

**このモードはリブートをまたいで記憶されます。** `up` は `msd700.service` を有効化し、2026 年 9 月の
修正以降、その `up` の `--dev` と `--simulator` フラグはユニットの `ExecStart` に書き込まれます。それ
以前は、起動ユニットは素の `up` を再実行していたため、`up --simulator --dev` で起動したロボットは
リブート後に**本番環境に対する実機ハードウェア**として復帰してしまっていました。何が設定されている
かは、以下で確認できます。

```bash
./scripts/docker-manager.sh print-autostart-unit --simulator --dev   # what would be written
grep ExecStart /etc/systemd/system/msd700.service                    # what is armed now
```

`up` はそれも出力します: `Boot autostart armed (DEV cloud, simulator)`。異なるフラグで `up` を再実行
するとユニットが書き換えられ、`down` は完全に無効化します。

</details>

<details>
<summary><b>非 Ubuntu / Arch ラップトップ向けのホストネットワーク修正</b></summary>

Arch Linux や非標準のディストリビューションで実行する場合:

1. **ホスト名の解決**:
   ```bash
   grep "$(hostname)" /etc/hosts || echo "127.0.0.1 $(hostname)" | sudo tee -a /etc/hosts
   ```

2. **IPv6 ループバックマッピングの無効化**:
   ```bash
   sudo sed -i 's/^::1[[:space:]].*/::1 ip6-localhost ip6-loopback/' /etc/hosts
   ```

3. **共有マップディレクトリの作成**:
   ```bash
   sudo mkdir -p /home/ubuntu/ros_maps
   sudo chown -R $(id -u):$(id -g) /home/ubuntu/ros_maps
   ```

</details>

---

## 検証と診断

以下の診断コマンドでロボットの健全性を確認します。

```bash
# 1. View overall container and service status
./scripts/docker-manager.sh status

# 2. Attach to the ROS tmux session inside the container
./scripts/docker-manager.sh shell
tmux attach -t robot_services

# 3. View real-time container logs
./scripts/docker-manager.sh logs -f
```

## 関連ドキュメント

- [サーバーセットアップ](/ja/setup/server-setup): クラウドバックエンドのインストール。
- [システムセットアップ](/ja/setup/system-setup): センサーのキャリブレーションと検証。
- [Docker コマンドリファレンス](/ja/setup/docker-reference): 網羅的な CLI 構文リファレンス。
- [Wi-Fi ホットスポット + クライアント](/ja/setup/wifi-hotspot): ホットスポットの全体アーキテクチャ、ドングルハードウェア、トラブルシューティング。
