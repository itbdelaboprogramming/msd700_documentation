---
outline: deep
---

# ユニット構築

<RoleBadge role="technician" />

**MSD700ユニット**(NVIDIA Jetson上の実機ロボット)のインストールと設定方法です。

稼働中の[サーバー](/ja/setup/server-setup)が先に必要です。以下のコマンドは全て**ユニット上**で実行します。クラウドサーバーではありません。

::: info 本番優先
このページは実機ロボットを**本番クラウド**に接続します。シミュレーター(`--simulator`)と開発クラウド(`--dev`)は[高度な設定](#高度な設定)にあります。
:::

## システム構成

![MSD700システム図](/images/MSD700-System-Diagram.jpg)

## フォルダ構成

Jetsonワークスペースはロボットパッケージ、Webブリッジ、オンボードWeb UIを`src/`下の通常クローンとして保持します(サブモジュールではありません):

```
~/msd700_noetic/
├── setup.sh
├── scripts/
│   └── docker-manager.sh
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env
└── src/
    ├── msd700_robot/
    ├── ros-web-ui/
    └── ROS-dashboard-next-ts/
```

---

## 構築手順

Step 1〜4、次にStep 6(ホットスポットプロビジョニング)、最後にStep 5(起動)の順です。ホットスポット用ファイルは初回起動前に必要です。

### Step 1: ワークスペースとソースのクローン

```bash
# 1. オーケストレーションワークスペース
git clone git@github.com:itbdelaboprogramming/msd700_noetic.git ~/msd700_noetic
cd ~/msd700_noetic

# 2. ソースリポジトリをsrc/へ、ブランチv2
git clone --recurse-submodules -b v2 git@github.com:itbdelaboprogramming/msd700_robot.git src/msd700_robot
git clone -b v2 git@github.com:itbdelaboprogramming/ros-web-ui.git src/ros-web-ui
git clone -b v2 git@github.com:itbdelaboprogramming/ROS-dashboard-next-ts.git src/ROS-dashboard-next-ts
```

::: tip なぜ手動で`src/`へクローンするのか?
`msd700_noetic`は`src/*/`を無視するため、各リポジトリがGit-in-Gitの競合なく独自ブランチを保持できます。
:::

---

### Step 2: ホストの初期設定(初回のみ)

```bash
cd ~/msd700_noetic
./setup.sh
```

Dockerの導入(未導入時)、グループ権限と`xhost`の設定、スクリプトの実行権限付与、Velodyne有線リンク設定、STM32/RealSenseのudevルールとRealSense復旧サービス、シミュレーターワールドのダウンロードを行います。ホストを変更します。読み取り専用チェックではありません。

::: warning Dockerグループ
スクリプトがユーザーを`docker`グループに追加した場合、ログアウト・ログインし直すか、`newgrp docker`を実行します(現在のシェルのみ有効)。
:::

ここで`DISPLAY`がない(ヘッドレスのSSHセッション)ことは警告にすぎません。X11はRVizまたはGazeboにのみ必要です。

::: details Velodyne VLP-16の有線接続(VLP-16搭載ユニットのみ)
VLP-16はDHCPなしで固定ホストIPのポート2368へUDPを送信します。そのサブネットに静的なホストIPがないと、
ROSドライバーは何も表示せずにタイムアウトし、点群が現れません。

`./setup.sh`(または単独で`./setup.sh --configure-lidar`)がNetworkManagerプロファイル`msd700-velodyne`を
作成します: 静的`192.168.103.100/24`、IPv6無効、自動接続優先度100、デフォルトルートにはしません。有線
インターフェースは自動検出されます(キャリアあり、IP未設定、デフォルトルートでないもの)。候補が0個または
2個以上の場合は推測せず、警告を出してスキップします。

| 変数(`docker/.env`) | 既定値 | 用途 |
| --- | --- | --- |
| `VELODYNE_IFACE` | 自動検出 | センサー側の有線NIC(例: `end0`) |
| `VELODYNE_HOST_CIDR` | `192.168.103.100/24` | ホストの静的IP |
| `VELODYNE_SENSOR_IP` | `192.168.103.231` | センサーIP(検証用) |
| `VELODYNE_CONNECTION_NAME` | `msd700-velodyne` | NetworkManagerプロファイル名 |

`VELODYNE_SENSOR_IP`は`VELODYNE_HOST_CIDR`の範囲内にあり、
`src/msd700_robot/msd700_hardware/launch/velodyne_scanner.launch`の`device_ip`と一致している必要があります。

確認: `ping 192.168.103.231`が応答し、コンテナ内で`rostopic list | grep velodyne`に点群トピックが表示されること。
:::

---

### Step 3: `docker/.env`の確認

起動スクリプトは`docker/.env`を`docker/.env.example`から作成します(**存在しない場合のみ**)。プレースホルダーのMySQLパスワードはローカルDB未初期化時のみ置換されます。既存パスワードのローテーションではありません。

::: warning このファイルの認証情報
`docker/.env`はgit管理下です。初回使用前にユニット別の値を自分で確認します。表示・コミット・他ユニットへのコピーは禁止です。既存DBのパスワード変更はファイル編集だけでなく対応するSQLローテーションが必要です。
:::

起動前に手動確認する場合:

```bash
cd ~/msd700_noetic
test -e docker/.env || cp docker/.env.example docker/.env
nano docker/.env
```

主な設定:

```ini
# Jetson上の地図保存先
MAPS_FOLDER_LOCAL=/home/ubuntu/ros_maps

# ローカルユーザーのUID/GID (空=自動検出: Jetson 2002、開発PC 1000)
USER_UID=
USER_GID=

# Gazeboシミュレーター (ロボットハードなしのマシンのみtrue)
WITH_SIMULATOR=false

# 空のままにします。クラウド登録時に自動設定されます
UNIT_ID=

# ローカルポート (オンボードスタックのデフォルト)
MYSQL_PORT_LOCAL=3306
MOSQUITTO_PORT_LOCAL=1883
BACKEND_PORT_LOCAL=5002
ROSBRIDGE_PORT_LOCAL=9090
FRONTEND_PORT_LOCAL=3000
MEDIA_SERVER_PORT_LOCAL=3003
SIGNALLING_PORT_WS_LOCAL=3001
SIGNALLING_PORT_HTTP_LOCAL=3002
NETWORK_AGENT_PORT_LOCAL=5011

# 任意: 固定IPヒント (ダッシュボードはブラウザのアドレスに追従します)
#LOCAL_IP=192.168.4.1
```

::: info どのクラウドに接続するか?
デフォルトは`https://msd.nglobal.jp/services/rosbackend`、`--dev`で開発バックエンドです。`CLOUD_BASE_URL`で上書きできます。登録と同期は同じクラウドに向けてください。この設定だけではMQTTブローカーは移動しません。
:::

---

### Step 4: ロボットイメージのビルド

インターネットがあるうちにビルドします。ロボットのベースは`ros:noetic-robot`です。Dockerfileが`src/`をコピーして`catkin build`を実行します。

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh build
```

`msd700:latest`、`ros-noetic-webui-app-local:latest`、`ros-dashboard-next-local:latest`をビルドし、MySQLとMosquittoをpullします。pull失敗は警告のみです。オフライン前に上流イメージに届くことを確認します。通常の`up`はイメージを再利用し、古い場合も警告のみです。ソース変更後は意図的にリビルドします。

先に地図フォルダを作成し、自分のUID/GIDの所有にします。Dockerは存在しないバインド元をrootで作ってしまいます:

```bash
sudo install -d -o "$(id -u)" -g "$(id -g)" /home/ubuntu/ros_maps
```

**ホットスポットを使うユニットはStep 5の前にStep 6を済ませます。** スタックは`/run/msd700-hotspot-active`をバインドマウントします。そのファイルがない状態でDockerを起動するとフォルダが代わりに作られる場合があります。

---

### Step 5: ロボットの起動と登録

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh up -d
```

ロボットコンテナと常時起動の`local_dev`スタック(データベース、MQTT、バックエンド/rosbridge、ネットワークエージェント、メディア、シグナリング、ダッシュボード)を起動します。名前に関わらず`local_dev`はどちらのクラウドにも使います。`-d`は起動と登録完了後に戻ります。`up`は起動時自動起動用の`msd700.service`も導入します。除外は`--no-autostart`です。

**登録(初回起動のみ):**

1. ロボットがクラウドに接続し、8文字の**クレームコード**を表示します(例`K7M2QP4R`)。表示用ラベルであり、秘密ではありません。
2. 管理者がクラウド管理コンソール(`https://msd.nglobal.jp/admin`、`--dev`時はポート5001の開発バックエンド)を開きログインします。
3. **Pending Units**でコードを探し、有効な**レンタルプロファイル**に新規ユニットとして登録するか、既存ユニットのULIDに**引き継ぎ(Adopt)**ます(ハード交換用パス。クラウドの地図は残ります)。
4. ユニットはIDを`src/ros-web-ui/Certificates/robot/device.json`に、トークンを`token.cred`に保存します。両方とも秘密として扱います。次回以降の起動は再利用します。
5. 本番ブリッジはHiveMQ TLSポート`8883`を指します。承認だけでは接続を証明しません。クラウドとローカルのダッシュボードを別々に確認します。

---

### Step 6: WiFiホットスポットのプロビジョニング

プロビジョニング済みユニットはホットスポットを提供し、ドライバーが同時使用に対応していれば同じオンボード無線でWiFiクライアント接続も維持できます。チップ名ではなく実際のドライバーを確認します。初回`up`の**前に**、ローカルコンソールか有線接続から行います:NetworkManagerが再起動しWiFiが切れる場合があります。

```bash
cd ~/msd700_noetic

# 任意: 予備ドングルドライバー (初回のみ、DKMS)。オンボード無線単独でホットスポット運用なら不要
./scripts/install-wifi-dongle-driver.sh

# ホットスポットをプロビジョニング (udevルール、PolicyKitルール、hostapd/dnsmasqサービス)
./setup.sh --provision-network
```

`--provision-network`は端末で実行し、インターフェース名とSSIDを聞きます(検出済みデフォルト付き)。パスワード入力は非表示で、既存パスワードは`[keep current]`と表示され、中身は出ません。新パスワードは2回入力します。`/etc/hostapd/`下のhostapd設定(モード0600)に保存され、`docker/.env`には**書き戻されません**。上流クライアントネットワークはNetworkManagerプロファイルに入ります。以降ホットスポットはDockerなしで毎回起動時に自動で上がります。

::: info 無人プロビジョニング
TTYなし(または`MSD700_NONINTERACTIVE=1`)ではプロンプトをスキップします。既存hostapdパスワードが環境値より優先されます。インラインのパスワード指定はシェル履歴に漏れる場合があります。非表示の対話入力を使ってください。安全な無人パスワードローテーションは未解決です。詳細手順は[WiFiホットスポット](/ja/setup/wifi-hotspot#ホットスポットのプロビジョニング-ユニット毎に一度)。
:::

---

## ローカル運用 (オフライン)

インターネットがない場所では、ロボットのローカルネットワークかStep 6の[ホットスポット](/ja/setup/wifi-hotspot)に直接接続します:

1. `http://<jetson-ip>:3000`を開きます。
2. クラウド登録と初回同期(レンタル割当+オペレーターアカウント)済みなら、ローカルダッシュボードで操縦・地図作成・ルート実行がオフラインで使えます。未登録ユニットはオフライン起動できません。
3. インターネット復帰時、設定済みクラウドと地図・ルート・エリア・DB行を同期します。対象はこのユニットと有効レンタルプロファイルに限定されます。同期状態を確認します。全て送信済みと決め付けないでください。

---

## 高度な設定

<details>
<summary><b>シミュレーションモード (Gazebo倉庫)</b></summary>

ロボットハードなしのPCでのテスト用です。`build --simulator`で`WITH_SIMULATOR=true`を設定し`msd700-simulator:latest`を選択します。`fetch_sim_worlds.sh`がオンライン中に倉庫ワールドをダウンロードします。選択ワールドのスポーン位置を使います。

```bash
./scripts/docker-manager.sh build --simulator
./scripts/docker-manager.sh up --simulator -d
```

`docker/.env`の`MSD700_SIM_HEADLESS=true`でGazeboをウィンドウなしで実行します。

</details>

<details>
<summary><b>開発クラウド (`--dev`)</b></summary>

本番ではなく開発クラウドに向けます:

```bash
./scripts/docker-manager.sh up --dev -d
```

クラウドブリッジが開発バックエンド(ポート5001)、MQTTが`8884`、このロボットのroscoreが`11322`に移動します。

**ブローカーのホスト名は開発でも`msd.nglobal.jp`のままです。** 開発と本番は同マシンでポートのみ分離され、TLS証明書はその名前で発行されます。IP直指定では検証失敗します。ホスト名ではなくポートを見てください:

| 相手 | ブローカー | バックエンド | ROSマスター |
| --- | --- | --- | --- |
| 本番 (フラグなし) | `msd.nglobal.jp:8883` | `https://msd.nglobal.jp/services/rosbackend` | `11321` |
| 開発 (`--dev`) | `msd.nglobal.jp:8884` | `http://118.22.31.252:5001` | `11322` |

::: danger このユニットをクラウドのROSマスターに接続させないでください
このロボットのroscoreは`11321`/`11322`で、クラウドの`11311`/`11312`とは意図的に別です。サーバーのROSポートをユニットへ転送しないでください(`ssh -L`やVS Codeの11311/11312転送を含む):ユニットスタックが**クラウド**マスターに登録され、サーバー自身のノードを追い出します。症状:ローカルダッシュボードは正常なのにクラウドダッシュボードが空になります(マッピング地図から先に消えます)。

```bash
ss -ltnp | grep :11322
docker exec -e ROS_MASTER_URI=http://localhost:11322 msd700 bash -lc 'source /opt/ros/noetic/setup.bash; bash /workspace/src/ros-web-ui/scripts/ros_doctor.sh'
```

転送を閉じるか(VS Code: PORTSパネル)、`ROS_MASTER_PORT=11323 ./scripts/docker-manager.sh up --dev -d`でこのロボットを移動します。
:::

**モードは再起動後も保持されます。** `up`は`--dev` / `--simulator`フラグを`msd700.service`に書き込むため、再起動後も同モードで戻ります。設定内容の確認:

```bash
./scripts/docker-manager.sh print-autostart-unit --simulator --dev   # 書き込まれる内容
grep ExecStart /etc/systemd/system/msd700.service                    # 現在の設定
```

異なるフラグで`up`再実行すると書き換えられます。`down`で自動起動は解除されます。

</details>

<details>
<summary><b>非Ubuntu PC (sim/devのみ)</b></summary>

`docker/.env`の`MAPS_FOLDER_LOCAL`をJetson風`/home/ubuntu`ではなく実在の書込可能フォルダにします。イメージのUID/GIDに合わせます。`backend_local`が同じパスでバインドマウントし(`docker/docker-compose.yml`)、`run_msd.sh`が起動前に書き込み可能かを確認するため、誤ったパスはマップ保存時ではなく起動時に失敗します。

</details>

---

## ロボットのヘルスチェック

```bash
# 1. ロボット+ローカルスタックの状態
./scripts/docker-manager.sh status

# 2. コンテナ内のROSセッション
./scripts/docker-manager.sh shell
tmux attach -t robot_services

# 3. ロボットログ (追跡)。ローカルスタック: local-logs
./scripts/docker-manager.sh logs -f

# 4. スタックの健康状態 (マスター、外部ノード、rosbridge)
docker exec -e ROS_MASTER_URI=http://localhost:11321 msd700 bash -lc 'source /opt/ros/noetic/setup.bash; bash /workspace/src/ros-web-ui/scripts/ros_doctor.sh'

# 5. ユニット上の同期状態
curl -s http://localhost:5002/local/status
```

## 関連

- [サーバー構築](/ja/setup/server-setup):クラウドバックエンド。
- [システム構築](/ja/setup/system-setup):サーバー+ユニットの連携確認。
- [Dockerリファレンス](/ja/setup/docker-reference):CLI完全リファレンス。
- [WiFiホットスポット](/ja/setup/wifi-hotspot):ホットスポットの設定と対処。
- [MT7922 Wi-Fi](/ja/setup/wifi-mt7922):オンボード無線のファームウェア修正。
- [トラブル対処](/ja/setup/troubleshooting):広範な診断。
