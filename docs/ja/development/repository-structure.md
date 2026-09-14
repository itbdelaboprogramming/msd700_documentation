---
search: false
---

# リポジトリ構成

<RoleBadge role="developer" />

MSD700 は4つのリポジトリにまたがっています。このリポジトリ(`msd700_documentation`)はドキュメントサイトのみであり、製品
本体は他の3つのリポジトリにあります。これらは Server のチェックアウトでは兄弟リポジトリとして存在し、Unit のチェックアウトでは
`msd700_noetic` のサブモジュールとして存在します。同じコードを、2通りの異なる方法で組み立てています。

## `ros-web-ui`: Web 向けパッケージ、バックエンド、フロントエンドのビルドコンテキスト

```
ros-web-ui/
├── docker-compose.yml          # Server-side services (see Architecture)
├── docker-compose.robot.yml    # Robot-side container (used when this repo runs the robot half alone)
├── Docker/                     # Dockerfile, HiveMQ config, coturn config, patches
├── Certificates/                # Robot credential cache (device.json, token.cred), MQTT/SQL certs
├── run_msd.sh                  # Launches roscore + ROS bringup + camera client + switch_mode in tmux
├── scripts/
│   ├── docker-manager.sh        # Runs the robot half in a container (Ubuntu 24/ARM64 hosts)
│   ├── enroll.py                 # Talks to /enroll on the backend; prints the claim code
│   ├── secrets.sh                # JWT keyring management (see Setup > Maintenance)
│   └── ros_log_janitor.sh        # Caps ~/.ros/log growth
├── source/                      # Catkin workspace source, this is what actually builds
│   ├── msd700_webui_bringup/     # Top-level launch files (bringup_msd.launch, bringup_cloud.launch)
│   ├── msd700_webui_control/     # switch_mode and related control nodes
│   ├── msd700_webui_msg/         # Custom messages for the web-facing layer
│   ├── msd700_webui_utils/
│   ├── msd700_robot/              # msd700_robot, present here too (see below)
│   └── dependencies/
│       ├── ROS-dashboard-backend/  # backend_node, see API Reference
│       ├── ROS-dashboard-next-ts/  # frontend build context (own git repo, gitignored here)
│       ├── media-server/
│       ├── signalling_server/
│       ├── camera_client/
│       ├── aws_mqtt/               # MQTT bridge launch files (local + cloud)
│       ├── topic2string/           # Geometric topics ↔ MQTT string bridge
│       ├── robot_pose_publisher/
│       └── ssl_update/             # Certbot renewal + HiveMQ keystore rebuild
└── logs/
```

`ros-web-ui` は**3つの異なるコンテキスト**で使われる唯一のリポジトリです。Server のバックエンド/rosbridge として
ビルドされる場合(`docker-compose.yml`)、Unit のワークスペースにロボットの Web 向けノードとして取り込まれる場合
(`msd700_noetic/src/ros-web-ui`)、そして非 Jetson ホスト(開発用ラップトップや、シミュレーターをテストする際の
このドキュメントサーバー自身)上で `docker-compose.robot.yml` によりロボット側単体として実行される場合です。
どれになるかは、どの compose ファイル/スクリプトがそれを呼び出すかに完全に依存し、リポジトリ自体の中身には依存しません。

## `msd700_robot`: ロボットを動かす ROS パッケージ群

```
msd700_robot/
├── msd700_movement/
│   ├── msd700_bringup/       # Launch files for primitive robot tasks
│   ├── msd700_control/       # Sensor fusion (robot_localization)
│   ├── msd700_firmware/      # Arduino firmware for the motor controller
│   ├── msd700_msg/           # Robot-level messages
│   └── msd700_navigations/   # SLAM, autonomous mapping, autonomous navigation, coverage
├── msd700_simulation/        # Gazebo worlds and sim launches
│   ├── worlds/               #   small, TurtleBot-scale worlds, committed
│   ├── scripts/               #   fetch_sim_worlds.sh: pulls the AWS warehouse
│   └── vendor/                #   fetched third-party worlds, gitignored
├── msd700_visual/            # RViz/Gazebo robot visuals
├── msd700_hardware/          # Hardware drivers
├── msd700_description/       # URDF, including msd700_field.urdf.xacro (real size)
└── ros_msd700_msgs/
```

実サイズのロボット(0.90 x 0.70 m)であるのは `msd700_field.urdf.xacro` だけです。ここにある他のモデルはすべて
0.266 m の TurtleBot3 Waffle 派生モデルであり、コミットされているワールドもそれに合わせたサイズです。カバレッジ
ジオメトリを検証できる組み合わせについては、[シミュレーション](/ja/development/ros/simulation) を参照してください。

`msd700_noetic`(サブモジュールとして、`src/msd700_robot`)と `ros-web-ui` 自身の `source/msd700_robot`
の両方にソースとして取り込まれています。ビルドのロボット側では、このリポジトリのナビゲーションスタックと
`ros-web-ui` の Web 向けパッケージの両方が、同じ catkin ワークスペース内に必要です。

## `msd700_noetic`: Jetson/ロボットのオーケストレーション

```
msd700_noetic/
├── setup.sh                  # One-time host setup (Docker, xhost, script permissions)
├── scripts/docker-manager.sh # build / up / down / shell / logs / local-* commands
├── docker/
│   ├── Dockerfile             # osrf/ros:noetic-desktop-full based image
│   ├── docker-compose.yml     # The single `msd700` robot container
│   ├── .env.example           # Copied to .env on first run
│   └── mosquitto/             # This unit's own local MQTT broker config
└── src/                       # Populated via git submodules:
    ├── msd700_robot/
    ├── ros-web-ui/
    └── ROS-dashboard-next-ts/
```

これが実際に Unit が実行しているものです。`src/` はコンテナにバインドマウントされており(イメージに焼き込まれる
のではなく)、ホスト上で launch ファイルや Python ノードを編集すると、リビルド不要で次回の launch から反映されます。
`docker-manager.sh build` が必要になるのは、依存関係やベースイメージが変更された場合のみです。Server マシン上
(このドキュメントサイト自身のホストなど)では、ここでロボット側を特にテストしていない限り、`src/` は正当に
空または存在しません。Server は代わりに `ros-web-ui` 自身の `docker-compose.yml` を実行しており、これらは
一切必要としません。

## `ROS-dashboard-next-ts`: オペレーターダッシュボード

独自の Next.js アプリで、同じソースから異なる URL を焼き込んで2回ビルドされます。

- **Server ビルド**(`ros-web-ui/docker-compose.yml` の `frontend_prod`/`frontend_dev`): Apache がプロキシする
  公開 HTTPS/WSS パス経由で、Server 自身のバックエンド/rosbridge/media/signalling と通信します。
- **Unit ビルド**(`msd700_noetic` のコンテナ内、または `ros-web-ui` の `docker-compose.yml` でロボット側を
  単体実行する場合): そのユニット自身のローカルサービスと通信し、ユニット自身の IP を指す `NEXT_PUBLIC_*`
  ビルド引数によって焼き込まれます。

これらの URL は実行時に読み込まれるのではなく JS バンドルに**コンパイルされて焼き込まれる**ため、ビルドが
どのサーバーを指すかを変更するには、単なる再起動ではなく常にイメージの再ビルドが必要です。

## このリポジトリ(`msd700_documentation`)

製品コードは含まれない、VitePress ドキュメントサイトのみです。

```
msd700_documentation/
├── docs/                        # VitePress site source
│   ├── .vitepress/
│   │   ├── config.mts           # site config: nav, sidebar, search, markdown hooks
│   │   └── theme/                # custom theme (extends the default theme)
│   │       ├── index.ts          # registers global components
│   │       ├── custom.css        # site-wide style overrides
│   │       └── components/       # LinkCard(s), RoleBadge, Mermaid
│   ├── index.md                 # homepage
│   ├── getting-started/         # end-user docs
│   ├── setup/                   # technician / deployment docs
│   └── development/             # developer docs (this section)
├── scripts/
│   ├── deploy.sh                 # builds the site and swaps it into docs/.vitepress/dist
│   ├── webhook-listener.mjs      # GitHub webhook receiver that triggers deploy.sh on push to main
│   ├── check-mermaid.mjs         # syntax-checks every diagram in the tree
│   ├── apache-snippet.conf       # ProxyPass rules for the Apache front end
│   └── systemd/                  # systemd unit for the webhook listener
├── package.json
└── package-lock.json
```

### 図

図は markdown 内の ```` ```mermaid ```` フェンスとして記述され、ブラウザ上で実際の SVG としてレンダリングされます。
これを実現している要素は2つあります。

| 要素 | 役割 |
| --- | --- |
| `docs/.vitepress/config.mts`、`markdown.config` | すべての `mermaid` フェンスを `<Mermaid code="<base64>" />` に書き換えます。Base64 を使うのは、図のソースが引用符・改行・山括弧を大量に含んでおり、フェンスが要素の属性になった時点で Vue がそれらをテンプレート構文として解釈してしまうためです |
| `docs/.vitepress/theme/components/Mermaid.vue` | それをデコードし、マウント時にレンダリングします。クライアントサイド限定です。mermaid はグラフをレイアウトする前にテキストを計測するために DOM を必要とし、動的な `import('mermaid')` によって、図を持たないすべてのページからレイアウトエンジンを排除しています |

このコンポーネントは読者のライト/ダークテーマに追従し、テーマが切り替わると再レンダリングします。mermaid は
レンダリング時にパレットを SVG に焼き込むためです。図のパースに失敗した場合は、空白の代わりに生のソースが
表示されます。

```bash
npm run docs:check-diagrams    # parse every diagram; exits non-zero on a syntax error
```

::: warning 壊れた図はビルドを失敗させない
VitePress は図のソースを一切パースせず、そのまま通過させるだけです。構文エラーは公開ページ上で赤いソースの
ブロックとして表面化します。図を編集した後はチェッカーを実行してください。
:::

::: info state-diagram の遷移ラベルに `<br/>` を使わない
このタグは `flowchart` のノードラベルや sequence-diagram のノート内では機能し、このサイトでもそこで
使用しています。state-diagram のエッジラベルはプレーンテキストであるため、そこに書いた `<br/>` は
文字どおりに表示されてしまいます。
:::

### このドキュメントサイトのデプロイ方法

::: details デプロイパイプライン(クリックで展開)
1. `main` への push が GitHub webhook をトリガーします。
2. `scripts/webhook-listener.mjs` が webhook の署名(HMAC SHA-256)を検証し、`refs/heads/main` への `push`
   イベントであれば `scripts/deploy.sh` を起動します。
3. `deploy.sh` の処理:
   - ワーキングツリーにローカルの変更がある場合、またはデプロイが既に進行中の場合(`flock` による)は実行を拒否する
   - `origin/main` に対して fetch とハードリセットを行う
   - `npm ci` を実行する
   - 新しい `docs/.vitepress/dist_new` ディレクトリにサイトをビルドする
   - それを `docs/.vitepress/dist` にアトミックに入れ替える(単純な `mv`)
4. 本番環境では、Apache が `Alias` 経由で `docs/.vitepress/dist` を**ディスクから直接**配信します
   (`000-default-le-ssl.conf` vhost を参照)。リクエストパス上に稼働中の `vitepress preview` プロセスはなく、
   そのための systemd unit もありません。`npm run docs:preview` はローカルでのスポットチェック専用です。
5. `webhook-listener.mjs` 自体は `msd700-docs-webhook` systemd unit の下で `127.0.0.1:4701` で稼働します。
:::

::: danger 本番環境で `vitepress preview` を Apache の裏に置いてはならない
かつてはこれがサイトの配信方法でした(port 4700 上の長寿命 `vitepress preview` プロセスへの `ProxyPass`)。
そしてこれはデプロイのたびに静かに壊れていました。`preview` の静的サーバー(本番モードの `sirv`)は起動時に
一度だけ出力ディレクトリをスキャンし、各ファイルの名前とサイズをキャッシュします。ハッシュ化されたアセット
ファイル名を変更するリビルドを行うと、そのキャッシュは既に存在しないファイルを指したままになり、すべての
CSS/JS が 404 になり、`index.html` は古い `Content-Length` に切り詰められた状態で配信されていました。
`dist/` を Apache 自身の `Alias` 経由で直接配信する現在のセットアップ(下記参照)にはそのようなキャッシュが
存在しません。Apache はリクエストごとに各ファイルを stat するため、`dist/` の入れ替えは再起動なしに即座に
反映されます。
:::

## 関連ドキュメント

- [コントリビューション](/ja/development/contributing) - ローカル開発ワークフロー
- [アーキテクチャ](/ja/development/architecture)
