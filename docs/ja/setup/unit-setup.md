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

::: info 既定はROS 1
Step 1〜6はROS 1ロボット(`msd700_robot`、Noetic)を構築します。同じユニットでROS 2ロボット(`msd_system`、Jazzy)を動かすには、先にこれらを済ませてから[ROS 2スタックへの切り替え](#ros2-stack)に従います。
:::

## システム構成

![MSD700システム図](../../development/diagrams/msd700-system-diagram.drawio)

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
    ├── ROS-dashboard-next-ts/
    └── msd_system/          # ROS 2スタック用のみ
```

---

## 構築手順

Step 1〜4、次にStep 6(ホットスポットプロビジョニング)、最後にStep 5(起動)の順です。ホットスポット用ファイルは初回起動前に必要です。

### Step 1: ワークスペースとソースのクローン

```bash
# 1. オーケストレーションワークスペース
git clone -b master git@github.com:itbdelaboprogramming/msd700_noetic.git ~/msd700_noetic
cd ~/msd700_noetic

# 2. ソースリポジトリをsrc/へ (msd700_robotはmaster、他はmain)
git clone --recurse-submodules -b master git@github.com:itbdelaboprogramming/msd700_robot.git src/msd700_robot
git clone -b main git@github.com:itbdelaboprogramming/ros-web-ui.git src/ros-web-ui
git clone -b main git@github.com:itbdelaboprogramming/ROS-dashboard-next-ts.git src/ROS-dashboard-next-ts
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

ここで使うコマンドとフラグはすべて[docker-manager.sh ガイド](/ja/setup/docker-manager)で説明しています。

ロボットコンテナと常時起動の`local_dev`スタック(データベース、MQTT、バックエンド/rosbridge、ネットワークエージェント、メディア、シグナリング、ダッシュボード)を起動します。名前に関わらず`local_dev`はどちらのクラウドにも使います。`-d`は起動と登録完了後に戻ります。`up`は起動時自動起動用の`msd700.service`も導入します。除外は`--no-autostart`です。

**登録(初回起動のみ):**

1. ロボットがクラウドに接続し、8文字の**クレームコード**を表示します(例`K7M2QP4R`)。表示用ラベルであり、秘密ではありません。
2. 管理者がクラウド管理コンソール(`https://msd.nglobal.jp/admin`、`--dev`時はポート5001の開発バックエンド)を開きログインします。
3. **Pending Units**でコードを探し、有効な**レンタルプロファイル**に新規ユニットとして登録するか、既存ユニットのULIDに**引き継ぎ(Adopt)**ます(ハード交換用パス。クラウドの地図は残ります)。
4. ユニットはIDを`src/ros-web-ui/Certificates/robot/device.json`に、トークンを`token.cred`に保存します。両方とも秘密として扱います。次回以降の起動は再利用します。
5. 本番ブリッジはHiveMQ TLSポート`8883`を指します。承認だけでは接続を証明しません。クラウドとローカルのダッシュボードを別々に確認します。

::: info 1台のユニットで本番と開発を使う
ユニットはクラウドごとに別々に登録され、ユニットはクラウドごとに1つのIDを保持します。本番に登録済みのユニットで初めて`up --dev`を実行するとき(または開発に登録済みのユニットで初めてフラグなしの`up`を実行するとき)は、そのクラウドへの最初の登録になります。クレームコードが表示され、そのクラウドの管理者が承認するまでユニットは待機し、新しいIDで起動します。後で戻すときは承認不要です。[ハードウェア登録 § 1台のロボット、2つのクラウド](/ja/development/webui/accounts/enrolment#one-robot-two-clouds)を参照してください。
:::

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

## ROS 2スタックへの切り替え (msd_system) {#ros2-stack}

ROS 1からROS 2への移行期間中、ユニットはどちらかのロボットスタックを実行できます。`docker-manager.sh`の`--ros2`フラグでROS 2側を選びます:ROS 2 Jazzy上の[msd_system](/ros2-msd-system/)と、そのWeb UIブリッジ(`msd_webui_bridge`)です。ブリッジはROS 1ユニットと同じMQTT契約で通信するため、サーバーとダッシュボードの変更は不要です。

| | ROS 1(既定) | ROS 2(`--ros2`) |
| --- | --- | --- |
| ロボットのソース | `src/msd700_robot` | `src/msd_system` |
| イメージ | `msd700:latest` | `msd_system:robot`(`msd_system:pc`の上に構築) |
| コンテナ | `msd700` | `msd_system` |
| セッション起動スクリプト | `run_msd.sh` | `run_ros2.sh`(`docker/ros2/`) |
| ローカルスタック | 全体(ダッシュボードは`:3000`) | 全体(ダッシュボードは`:3000`)、ROSなしのバックエンド |

同時に動かせるスタックは1つだけです。どちらもホストネットワーク、`/dev`、同じユニットIDを使います。`msd700`または`msd700_simulator`が稼働中だと`up --ros2`は起動を拒否します。

::: warning 現時点でROS 2で使える機能
- **使える:** 登録、ハードウェアのInitialize/Stop、手動操縦、非常停止、GPS、フォロワー、帰還(return to home)、そして2026-10-21からは地図作成(保存とアップロード)、保存地図でのナビゲーション、オートパイロット、カバレッジ、自動アライン。ブリッジがモードごとに`msd_bringup.launch.xml`でCMUナビゲーションスタックを起動します。いずれもブリッジ済みでコンテナ内のみで試験済み、実機や実際のダッシュボードでは未検証です。
- **保存地図:** ROS 2ユニットで作った地図はpgm/yaml(通常どおりアップロード)と、ユニットの地図フォルダに残りロボットの位置推定に使う`.pcd`として保存されます。ROS 1ユニットで作った地図も開けますが、壁から作った3D地図を使うため位置推定の信頼性は下がります。
- **ローカルダッシュボードと映像。** ローカルスタックはROS 1と同様に動きますが、2つのサービスが入れ替わります。バックエンドはクラウドサーバーと同じくROSなしで動き、ライブリンクを自分で提供します。ダッシュボードはそのリンク用にビルドされます。映像はROS 1と同じ`camera_client.py`から送られます。
- **シミュレーター。** `up --ros2 --simulator`で同じスタックをPC上のGazeboで動かせます([下記](#ros2-simulator)参照)。現時点ではドライランでのみ確認済みです。
- **VLP-16のみ。** ROS 2のハードウェア層の既定はVelodyneです。`MSD700_LIDAR_TYPE`(Livox Mid-360)をコンテナへ渡す変更は`msd700_noetic`のブランチ`ros2-lidar-type`にあり、未マージです。
:::

### Step 1: msd_systemのクローン

```bash
cd ~/msd700_noetic
git clone -b web-ui-bridge git@github.com:itbdelaboprogramming/msd_system.git src/msd_system
```

Web UIブリッジ(`src/msd_webui/`)は`web-ui-bridge`ブランチにあり、`develop`にはまだありません。リポジトリには`CATKIN_IGNORE`があるため、ROS 1の`catkin build`はこれを対象外にします。

### Step 2: ROS 2イメージのビルド

```bash
./scripts/docker-manager.sh build --ros2
```

`src/msd_system/Docker/Dockerfile.pc`から`msd_system:pc`(Jazzy、rosdep依存関係、Livox-SDK2)をビルドし、次に薄い`msd_system:robot`層(`docker/Dockerfile.ros2`:tmuxとセッション起動スクリプト)をビルドし、Mosquittoイメージを取得します。インターネットが必要で、Jetsonでの初回は時間がかかります。ROS 1のイメージは残るため、ROS 1に戻すときにリビルドは不要です。

### Step 3: ROS 1を停止し、ROS 2を起動

```bash
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up --ros2 -d
```

- **初回起動でワークスペースをコンパイルします。** `msd_system:pc`は依存関係のみを含むため、`run_ros2.sh`がコンテナ内で`colcon build`を実行します。インターネットは不要ですが、Jetsonでは時間がかかるため、初回は再起動経由ではなく手動で起動します(`msd700.service`は15分でタイムアウトします)。
- ビルド結果は名前付きボリューム(`msd_system_build`、`msd_system_install`、`msd_system_log`)に保存されるため、以降の起動、`down`、再起動ではビルドを省略します。
- `up --ros2`は`--simulator`と同様に`--ros2`を`msd700.service`に焼き込むため、再起動後もROS 2で起動します。
- `--dev`はROS 1と同じく使えます(開発クラウド、MQTT `8884`)。

**ID。** ROS 2コンテナは同じ`src/ros-web-ui/Certificates/robot/`をマウントするため、ユニットはULIDを維持し、新しいクレームコードは出ません。一度も登録していないユニットは[Step 5](#step-5-ロボットの起動と登録)と同じくクレームコードを表示します。

### Step 4: ハードウェアの起動

クラウドダッシュボードでユニットを開き、**Initialize**を押します。ブリッジが`msd_webui_bridge/hardware_prototype.launch.py`を起動します:MCU(`hardware_interface_node`)、`twist_mux`、オドメトリ、センサーを、`motion_guard`に必要なWeb UI配線付きで起動します。**Stop**で再び停止します。

`msd_hardware.launch.xml`や`run_robot:=hardware`付きの`msd_bringup`を横で手動起動しないでください。そのハードウェアにはWeb UI配線がなく、ブリッジは2つ目を起動しません。

### セッションと確認

`run_ros2.sh`はtmuxセッション`robot_services`を開きます。ROS 1と同じ名前です:

| ウィンドウ | 実行内容 |
| --- | --- |
| `bringup` | `MSD_ROS2_BRINGUP_CMD`、空の場合(既定)はお知らせのみ |
| `webui` | `ros2 launch msd_webui_bridge webui.launch.py profile:=prototype ...` |
| `camera` | `camera_client.py`(クラウドとローカルダッシュボードへの映像) |
| `token_refresh` | `token.cred`を更新 |

```bash
./scripts/docker-manager.sh status --ros2                    # コンテナの状態
docker exec -it msd_system tmux attach -t robot_services     # セッション(Ctrl-b dで離脱)
./scripts/docker-manager.sh shell --ros2                     # コンテナ内のbash
```

ロボットコンテナを対象にするコマンド(`status`、`shell`、`logs`)にも`--ros2`が必要です。付けないとROS 1側を見ます。

**オプション**(環境変数または`docker/.env`):

| 変数 | 既定 | 用途 |
| --- | --- | --- |
| `MSD_ROS2_PROFILE` | `prototype` | ブリッジのプロファイル:`prototype`(実機)または`sim`(`--simulator`での既定) |
| `MSD_ROS2_BRINGUP_CMD` | 空 | `bringup`ウィンドウのコマンド。ハードウェアとナビゲーションは含めません(ブリッジが起動します。Step 4参照)。ここで起動したナビゲーションスタックはそのまま使いますが、その場合保存地図での位置推定は行いません |
| `MSD_ROS2_WEBUI_ARGS` | 空 | `webui.launch.py`への追加起動引数 |
| `MSD_ROS2_CAMERA_DEVICE` | 空 | 映像に使うカメラ。ROS 1の`--camera_device`と同じです。空の場合は既定のWebカメラ、なければRealSenseのカラーノード |

### シミュレーターで動かす {#ros2-simulator}

ロボットのないPCでは、`--simulator`でROS 2スタックをGazebo(`msd_sim`)で動かします。イメージは同じなので、Step 2の`build --ros2`だけで足ります:

```bash
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up --ros2 --simulator -d
```

- コンテナは`msd_system_simulator`です(アタッチ: `docker exec -it msd_system_simulator tmux attach -t robot_services`)。`status`、`shell`、`logs`にも`--ros2 --simulator`を付けます。
- GazeboのウィンドウがPCの画面に開きます。Initializeの手順はありません。シミュレーションがハードウェアの役割を果たします。
- ワールドは`MSD_ROS2_SIM_WORLD`で選びます(例: `MSD_ROS2_SIM_WORLD=campus_hall.sdf`)。既定は`yayat_gudang.sdf`です。
- ROS 1のシミュレーターと同様にPCがユニットとして登録されるため、本番に載せないよう`--dev`を使います。

**msd_systemをpullしたあと:** `src/`はコンテナにマウントされているため、`up --ros2 --build`で再コンパイルされます。`Docker/Dockerfile.pc`やパッケージの依存関係が変わった場合は、先に`build --ros2`を実行します。ワークスペースは古いイメージでビルドされているため、次の起動で自動的に再ビルドされます。ゼロからビルドするには、`down`のあと`build-clean --ros2`を実行します。3つのボリュームも削除されます。

### ROS 1に戻す

```bash
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up -d
```

`--ros2`なしの`up`はROS 1ロボットとローカルスタック全体を起動し、`msd700.service`を再びROS 1用に設定します。

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
- [docker-manager.sh ガイド](/ja/setup/docker-manager):全コマンドとフラグの説明。
- [Dockerリファレンス](/ja/setup/docker-reference):CLI完全リファレンス。
- [WiFiホットスポット](/ja/setup/wifi-hotspot):ホットスポットの設定と対処。
- [MT7922 Wi-Fi](/ja/setup/wifi-mt7922):オンボード無線のファームウェア修正。
- [トラブル対処](/ja/setup/troubleshooting):広範な診断。
