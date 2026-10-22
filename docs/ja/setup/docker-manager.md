---
outline: deep
---

# docker-manager.sh ガイド

<RoleBadge role="technician" />

`scripts/docker-manager.sh`はユニットを動かすための唯一のコマンドです。イメージのビルド、ロボットコンテナとユニット自身のサーバースタックの起動と停止、ロボットの登録、起動時自動起動の設定を行います。**ユニット上で**、ワークスペースのルートから実行します:

```bash
cd ~/msd700_noetic
./scripts/docker-manager.sh <コマンド> [フラグ]
```

- フラグはコマンドの前後どちらでも、順不同で置けます。`up -d --dev`は`--dev up -d`と同じです。
- 引数なしではヘルプを表示します。コマンドなしのフラグは`up`を意味します。
- `build up`は`up --build`と同じです。
- このスクリプトが知らないフラグは、コンテナ内のROS 1セッション起動スクリプト`run_msd.sh`にそのまま渡されます。
- `./scripts/docker-manager.sh help`で組み込みヘルプを表示します。

これらのコマンドの背後にあるcomposeファイル、イメージ、ボリュームは[Dockerリファレンス](/ja/setup/docker-reference#ユニット-docker-manager-sh)にあります。

## よく使う操作

| 操作 | コマンド |
| --- | --- |
| 本番クラウドでロボットを起動し、端末を返す | `up -d` |
| 開発クラウドで起動する | `up --dev -d` |
| ROS 2ロボット(msd_system)を起動する | `up --ros2 -d` |
| Gazeboシミュレーターを起動する(ハードウェアなしのPC) | `up --simulator -d` |
| ROS 2ロボットをGazeboで起動する | `up --ros2 --simulator -d` |
| すべて停止する | `down` |
| `git pull`後に新しいコードを使う | `build`のあと`down`と`up -d`([リビルドが必要なもの](/ja/setup/docker-reference#リビルドが必要な変更)) |
| ロボットコンテナでシェルを開く | `shell`(ROS 2: `shell --ros2`) |
| ロボットコンテナの出力を追う | `logs` |
| コンテナが動いているか確認する | `status`と`local-status` |
| Webスタックだけ再起動する(ロボットはそのまま) | `local-down`のあと`local-up` |
| ロボットをクラウドに再登録する | `reenroll` |
| 再起動時に何が起動するか確認する | `print-autostart-unit` |

## コマンド

### `up`

ロボットコンテナとユニットのローカルスタックを起動し、コンテナ内でロボットセッションを実行します(ROS 1は`run_msd.sh`、`--ros2`では`run_ros2.sh`)。

- **何もビルドしません。** `--build`を付けるか、イメージがまったく存在しない場合だけビルドするため、オフラインで動きます。古いイメージは`[WARN] ... is OUT OF DATE`を表示するだけで、そのまま起動します。
- **登録します。** IDを持たないロボットは、管理者が承認するクレームコードを表示します([ユニット構築 Step 5](/ja/setup/unit-setup#step-5-ロボットの起動と登録))。
- **端末を保持します**(`-d`なしの場合)。Ctrl-Cやセッション終了で、`down`と同じくすべて停止します。
- **起動時自動起動を設定します。** この実行のモードフラグ(`--dev`、`--simulator`、`--ros2`)付きで`msd700.service`を導入・有効化するため、再起動後も同じロボットが同じクラウドで起動します。`--no-autostart`で省略します。
- **拒否します。** 別のロボットコンテナ(`msd700`、`msd700_simulator`、`msd_system`、`msd_system_simulator`)が稼働中の場合です。先に`down`を実行します。
- **稼働中のコンテナは作り直しません**(ビルド後でも)。新しいイメージで起動するには`down`のあと`up`します。

### `down` / `stop`

すべてのロボットコンテナ(`msd700`、`msd700_simulator`、`msd_system`、`msd_system_simulator`)とローカルスタックを停止・削除し、`msd700.service`を無効化します。地図、ローカルデータベース、認証情報、ROS 2のビルドボリュームは残ります。`--no-autostart`でサービスを有効のまま残します。

### `build`

オンラインのうちにユニットに必要なものをすべてビルドし、以降の`up`をインターネットなしで動けるようにします:

- ROS 1: ロボットイメージ`msd700:latest`(`--simulator`では`msd700-simulator:latest`)とその`catkin build`、ローカルスタックのイメージ`ros-noetic-webui-app-local:latest`と`ros-dashboard-next-local:latest`、さらにMySQLとMosquittoを取得します。3つのイメージは並列にビルドされます。メモリが少ないユニットでは`BUILD_PARALLEL=false`で1つずつビルドします。
- ROS 2(`--ros2`): `src/msd_system/Docker/Dockerfile.pc`から`msd_system:pc`、その上に`msd_system:robot`層をビルドし、Mosquittoを取得します。

Python、launch、Nodeの変更はビルド不要です。`src/`と`ros-web-ui/source`はコンテナにマウントされているため、`up`でそのまま動きます。

### `build-clean`

`build`と同じですが、Dockerのレイヤーキャッシュを使いません。apt、pip、npm、ccacheのダウンロードキャッシュは残ります。`--ros2`ではROS 2のビルドボリュームも削除し、次回起動でゼロからコンパイルします。`msd_system`コンテナがない場合のみ有効なので、先に`down`を実行します。

### `shell`

ロボットコンテナでbashログインシェルを開きます。コンテナが動いていなければ起動します。そのコンテナに入るには`up`と同じモードフラグを付けます: `shell --simulator`、`shell --ros2`。

### `logs`

ロボットコンテナの出力を追います。Ctrl-Cで追跡をやめても、ロボットは動き続けます。tmuxウィンドウごとのセッションログは`logs/`にあります([run_msd.shのウィンドウ](/ja/setup/docker-reference#ユニット-run-msd-sh))。

### `status`

ロボットコンテナの`docker compose ps`です。そのコンテナを見るにはモードフラグ(`--ros2`、`--simulator`)を付けます。ローカルスタックは`local-status`で表示します。

### `reenroll`

クラウドがロボットを認識しなくなったとき(コンソールでユニットが削除された、認証情報が失われた)に、ロボットを再登録します。ユニットがまだコンソールにある場合は、代わりに管理者に**Unbind**を押してもらいます。そうすればユニットのULIDとクラウド上のすべての地図が残ります。

現在のユニットIDと同期状態を表示したあと、次を行います:

1. ユニットの地図と認証情報を`unit_backups_local/`にバックアップします。ローカルスタックの稼働が必要です(`local-up`)。
2. `device.json`、`identities/`内のそのコピー、`token.cred`を削除します。
3. 確認のためユニットIDの入力を求めます。

次の`up`でクレームコードが表示されます。オプション: `--fresh`、`--no-archive`、`-y`(下記)。

### `print-autostart-unit`

指定したフラグで`up`が導入する`msd700.service`を、導入せずに表示します。`up`がsudoを実行できないユニットや、設定前のモード確認に使います:

```bash
./scripts/docker-manager.sh print-autostart-unit --ros2 --dev   # 書き込まれる内容
grep ExecStart /etc/systemd/system/msd700.service               # 現在設定されている内容
```

### `local-up`、`local-down`、`local-build`、`local-logs`、`local-status`

ユニットのサーバースタック(データベース、MQTTブローカー、バックエンドとrosbridge、ネットワークエージェント、メディア、シグナリング、ダッシュボード)だけを操作し、ロボットには触れません。`up`がこのスタックを起動済みなので、Web側だけを再起動・リビルドするときに使います。`--ros2`ではバックエンドとダッシュボードがROS 2用のものになります(`--ros2`参照)。

### `help`

組み込みヘルプを表示します(`-h`、`--help`、引数なしでも同じ)。

## フラグ

### `--ros2`

ROS 1ロボット(`msd700_robot`、Noetic)の代わりにROS 2ロボット([msd_system](/ros2-msd-system/)、Jazzy)を動かします。

- **使えるコマンド:** `build`、`build-clean`、`up`、`shell`、`logs`、`status`、`local-up`、`print-autostart-unit`。
- **変わる点:** イメージ`msd_system:robot`、コンテナ`msd_system`、セッション起動スクリプト`run_ros2.sh`。
- **ローカルスタック:** ROS 1と同じサービスですが、2つだけ異なります。`backend_local_ros2`はbackend_nodeをROSなしで動かし、ゲートウェイからライブリンクを提供します(rosbridgeなし)。`frontend_local_ros2`はそのリンク用にビルドしたダッシュボードです(イメージ`ros-dashboard-next-local-ros2`)。ROS 1のイメージは残るため、ROS 1に戻すときにリビルドは不要です。
- **映像:** ROS 1と同様に`camera_client.py`をロボットコンテナで動かします。`--camera_device <path>`も同じように使えます。
- **初回起動**でコンテナ内のワークスペースをコンパイルします(`colcon build`、オフライン)。結果はボリュームに保持され、以降の起動で再利用されます。
- **IDは同じ:** ROS 1と同じ認証情報を使うため、ユニットはULIDを維持します。
- **`--simulator`と併用:** 同じロボットをGazeboで動かします(下記`--simulator`参照)。

```bash
./scripts/docker-manager.sh build --ros2
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up --ros2 -d
```

詳しい手順: [ユニット構築 § ROS 2スタックへの切り替え](/ja/setup/unit-setup#ros2-stack)。

### `--simulator`、`-s`

ハードウェアロボットの代わりにGazeboシミュレーターのイメージ(`msd700-simulator:latest`、コンテナ`msd700_simulator`)を動かします。ロボットが接続されていないPC向けです。先に`build --simulator`でビルドします。シミュレーター用のワールドもダウンロードされます。`docker/.env`で`MSD700_SIM_HEADLESS=true`にするとGazeboをウィンドウなしで動かします。

`--ros2`と併用すると、msd_system自身のシミュレーション(`msd_sim`)を動かします:

- **イメージは同じです。** `msd_system:pc`にはGazeboが含まれているため、`build --ros2`だけで足ります。違うのはコンテナだけです: `msd_system_simulator`。
- **起動するもの。** `bringup`ウィンドウが`msd_bringup.launch.xml`経由で`msd_sim`を起動します。ナビゲーションは含めず、実機と同様にブリッジがモードごとに起動します。ブリッジは`sim`プロファイルを使います。
- **ワールド。** `MSD_ROS2_SIM_WORLD`で`msd_sim/worlds/`内のファイル(例: `campus_hall.sdf`)または絶対パスを選びます。空の場合はmsd_bringupの既定です。
- **常にウィンドウ付きです。** `MSD700_SIM_HEADLESS`は効きません。`msd_sim`にはまだヘッドレスのオプションがありません。

```bash
./scripts/docker-manager.sh build --ros2
./scripts/docker-manager.sh up --ros2 --simulator -d
```

- **使えるコマンド:** `build`、`build-clean`、`up`、`shell`、`logs`、`status`、`print-autostart-unit`。
- `msd700.service`に焼き込まれるため、再起動後にハードウェアロボットとして起動することはありません。

### `--dev`

本番ではなく**開発クラウド**に接続します:

| | 本番(フラグなし) | 開発(`--dev`) |
| --- | --- | --- |
| バックエンド | `https://msd.nglobal.jp/services/rosbackend` | `http://118.22.31.252:5001` |
| MQTTブローカー | `msd.nglobal.jp:8883` | `msd.nglobal.jp:8884` |
| ロボット自身のROSマスター(ROS 1) | `11321` | `11322` |

- ユニットはクラウドごとに別のIDを持ちます。本番に登録済みのユニットで初めて`up --dev`を実行すると、クレームコードを表示して開発側の管理者の承認を待ちます([1台のロボット、2つのクラウド](/ja/development/webui/accounts/enrolment#one-robot-two-clouds))。
- ローカルスタックとローカルダッシュボードはどちらのモードでも動きます。
- `msd700.service`に焼き込まれるため、再起動後も開発クラウドで起動します。
- `DEV_SERVER_HOST`と`DEV_BACKEND_PORT`で開発バックエンドの場所を変えます。

### `--build`

`up`と併用: 先にイメージをリビルドし、次にコンテナ内でワークスペースをコンパイルします(ROS 1は`catkin build`、ROS 2は`colcon build`)。インターネットが必要です。稼働中のコンテナは古いイメージのままなので、先に`down`を実行します:

```bash
./scripts/docker-manager.sh down
./scripts/docker-manager.sh up --build -d
```

### `-d`、`--detach`

`up`専用です。起動処理はフォアグラウンドのままなので、ビルド出力、クレームコード、エラーは表示され、ロボットが立ち上がる前のCtrl-Cは中止して後片付けします。すべて動き出すと端末が返り、端末(やsshセッション)を閉じてもロボットは止まりません。

`-d`なしでは端末に接続したままで、Ctrl-Cですべて停止します。デタッチしたセッションをあとで見るには:

```bash
docker exec -it msd700 tmux attach -t robot_services       # ROS 1(シミュレーターはmsd700_simulator)
docker exec -it msd_system tmux attach -t robot_services   # ROS 2
# 動かしたまま離れる: Ctrl-b、次にd
```

`-d`はデバッグでは**ありません**。デバッグには`--debug`を省略せずに書きます。

### `--no-autostart`

`up`または`down`と併用: `msd700.service`をそのままにします。`up --no-autostart`はサービスを設定せず、`down --no-autostart`は無効化しません(サービス自身がこの形で`down`を呼びます)。再起動後に残ってはいけない試験実行に使います。以前に設定したサービスは古いフラグのまま有効です。

### `--debug`

`run_msd.sh`(ROS 1)に渡されます: 詳細出力。省略せずに書きます。ここでの`-d`はデタッチです。

### `--dry-run`

セッション起動スクリプトに渡され、セッションを起動せずに実行予定のコマンドを表示します。**安全な事前確認ではありません:** コンテナは起動し、`msd700.service`も設定され(`--no-autostart`を付けます)、ROS 1では稼働中のセッションを止めたり登録サーバーに接続したりすることがあります。ROS 2では登録を省略し、必要ならワークスペースをコンパイルし、3つのウィンドウのコマンドを表示して終了します。

### `--kill`

セッション起動スクリプトに渡され、コンテナ内のロボットのtmuxセッションを停止して終了します。すべて止めるには`down`を使います。

### `--fresh`

`reenroll`専用です。ローカルキャッシュ(`mysql_data_local`、`media_data_local`、`mosquitto_data_local`)も消去します。**新しい**レンタルに出すロボット向けです。付けない場合、キャッシュは残り、フル同期で整合されます。

### `--no-archive`

`reenroll`専用です。バックアップを省略します。ユニットがすべて同期済みの場合だけ安全です。そうでなければオフラインで記録した地図が失われます。

### `-y`、`--yes`

`reenroll`専用です。ユニットIDの確認を含め何も尋ねず、バックアップが失敗してもバックアップなしで続行します。

### `--local`(非推奨)

受け付けますが無視されます。ローカルスタックはどちらにしても起動します。古いスクリプトを壊さないために残しています。

### `--unit_id`(拒否)

意図的に削除されており、説明付きでエラーになります。IDはクラウドの管理コンソールから割り当てます。新しいロボットはクレームコードを表示し、管理者が登録するか既存のULIDに採用(adopt)します。

### その他のフラグ

上記以外は`run_msd.sh`にそのまま渡されます。例: `--camera_device /dev/video2`、`--no-build`。一覧は[Dockerリファレンス § run_msd.sh](/ja/setup/docker-reference#ユニット-run-msd-sh)にあります。`--ros2`では警告付きで破棄されます。`run_ros2.sh`が知っているのは`--dry-run`と`--kill`だけです。

## ルール

- **ロボットスタックは同時に1つだけ。** ROS 1、シミュレーター、ROS 2はホストネットワーク、`/dev`、ユニットIDを共有します。
- **モードフラグがロボットを決めます。** `--dev`、`--simulator`、`--ros2`で、どのロボットをどこで動かすかが決まります。`shell`、`logs`、`status`にも同じフラグを付けます。`up`はこれらを`msd700.service`に焼き込みます。
- **場所違いのフラグは警告して無視されます。** 例: `up`以外での`-d`、`reenroll`以外での`--fresh`。

## 環境変数

コマンドの前に付けるか(`VAR=value ./scripts/docker-manager.sh up -d`)、スクリプトが読む`docker/.env`に書きます。よく使うもの:

| 変数 | 既定 | 用途 |
| --- | --- | --- |
| `CLOUD_BASE_URL` | 本番または開発のバックエンド | ユニットを別のクラウドに向ける |
| `DEV_SERVER_HOST`、`DEV_BACKEND_PORT` | `118.22.31.252`、`5001` | `--dev`の接続先 |
| `ROS_MASTER_PORT` | `11321`、`--dev`では`11322` | ロボット自身のROSマスター。クラウドの`11311`/`11312`は使わない |
| `BUILD_PARALLEL` | `true` | `false`でイメージを1つずつビルド |
| `ENROLL_CODE` | 未設定 | 1回限りの登録コード。保留リストを経由しない |
| `MSD_ROS2_PROFILE` | `prototype`(`--simulator`では`sim`) | ROS 2ブリッジのプロファイル: `prototype`または`sim` |
| `MSD_ROS2_BRINGUP_CMD` | 空 | ROS 2: `bringup`ウィンドウのコマンド(例: ナビゲーション) |
| `MSD_ROS2_WEBUI_ARGS` | 空 | ROS 2: `webui.launch.py`への追加引数 |
| `MSD_ROS2_CAMERA_DEVICE` | 空 | ROS 2: 映像に使うカメラ(`--camera_device`と同じ) |
| `MSD_ROS2_SIM_WORLD` | 空 | ROS 2シミュレーター: `msd_sim/worlds/`内のワールドファイルまたは絶対パス |

すべての変数: [Dockerリファレンス § 転送する環境変数](/ja/setup/docker-reference#転送する環境変数)と[ユニット`.env`リファレンス](/ja/setup/docker-reference#ユニット-env-リファレンス)。
