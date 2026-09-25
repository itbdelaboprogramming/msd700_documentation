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
├── Certificates/                # Robot credential cache (token.cred always; device.json written here by scripts/enroll.py at enrolment), MQTT/SQL certs
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
│       ├── ssl_update/             # Certbot renewal + HiveMQ keystore rebuild
│       ├── network-agent/          # Unit network helper
│       └── shared/                 # Shared JS (jwt_keyring.js et al.)
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
├── msd700_bringup/           # Launch files for primitive robot tasks
├── msd700_control/           # Sensor fusion (robot_localization), twist_mux
├── msd700_coverage/          # Boustrophedon sweep planner (path_coverage_node)
├── msd700_description/       # URDF, including msd700_field.urdf.xacro (real size)
├── msd700_firmware/          # Legacy Arduino firmware (reference only; the unit runs the STM32 firmware from firmware-msd700)
├── msd700_hardware/          # Hardware drivers (serial, Velodyne, odometry)
├── msd700_movement/          # Vendored third_party only
├── msd700_msgs/              # Robot-level messages
├── msd700_navigation/        # move_base, TEB, SLAM, costmaps
├── msd700_perception/        # Velodyne pipelines (scan, hazard)
├── msd700_simulation/        # Gazebo worlds and sim launches
│   ├── worlds/               #   small, TurtleBot-scale worlds, committed
│   ├── scripts/              #   fetch_sim_worlds.sh: pulls the AWS warehouse
│   └── vendor/               #   fetched third-party worlds, gitignored
└── third_party/              # ira_laser_tools et al.
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
│   ├── Dockerfile.webui-local # Unit local-stack image (COPYs ros-web-ui source in)
│   ├── docker-compose.yml     # The single `msd700` robot container
│   ├── entrypoint.sh          # Container entrypoint
│   ├── .env.example           # Copied to .env on first run
│   ├── mosquitto/             # This unit's own local MQTT broker config
│   └── networkmanager/        # Unit NetworkManager dispatcher scripts
└── src/                       # Populated via git submodules:
    ├── msd700_robot/
    ├── ros-web-ui/
    └── ROS-dashboard-next-ts/
    # NOTE: on a Server checkout (like this one) the submodules are NOT
    # initialized、src/ holds only CMakeLists.txt. The robot code lives in
    # the sibling directories /msd700_robot and /ros-web-ui instead.
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
│   │       └── components/       # LinkCard(s), RoleBadge
│   ├── index.md                 # homepage
│   ├── user-guide/              # end-user docs
│   ├── setup/                   # technician / deployment docs
│   └── development/             # developer docs (this section)
├── scripts/
│   ├── deploy.sh                 # builds the site and swaps it into docs/.vitepress/dist
│   ├── webhook-listener.mjs      # GitHub webhook receiver that triggers deploy.sh on push to main
│   ├── render-diagrams.mjs       # pre-renders every diagram to docs/public/diagrams/*.png
│   ├── diagram-hash.mjs          # fence-body hash shared by the renderer and config.mts
│   ├── check-mermaid.mjs         # syntax-checks every diagram in the tree
│   ├── apache-snippet.conf       # ProxyPass rules for the Apache front end
│   └── systemd/                  # systemd unit for the webhook listener
├── package.json
└── package-lock.json
```

### 図

図は markdown 内の ```` ```mermaid ```` フェンスとして記述しますが、読者に届くのは静的な PNG です。
`docs/public/images/` の手描き図と同じ draw.io 風の見た目(白いボックス、細い黒線、Helvetica、直角コネクタ、
角のタブに置いたグループ名)で事前にレンダリングされます。

| 要素 | 役割 |
| --- | --- |
| `scripts/render-diagrams.mjs` | すべてのフェンスをヘッドレス Chrome で一度だけレイアウトし(mermaid + フローチャートと状態図には ELK レイアウトエンジン)、`docs/public/diagrams/<hash>.png` を 2 倍解像度で書き出します。どのフェンスからも使われなくなった画像は削除します |
| `scripts/diagram-hash.mjs` | フェンス本文と `RENDER_VERSION` のハッシュ。レンダラーとビルドで共有し、両者が同じファイル名を指すようにします。スタイル変更後は `RENDER_VERSION` を上げ、キャッシュされた古い画像ではなく新しい URL が配信されるようにします |
| `docs/.vitepress/config.mts`、`markdown.config` | すべての `mermaid` フェンスを、その PNG の `<img>`(原寸ファイルへのリンク付き)に置き換えます。図がブラウザ内で描画されることはありません。PNG が無い場合、`npm run docs:diagrams` が生成するまでページには壊れた画像が表示され、ビルドは `[diagrams]` 警告を出します |

読者のブラウザでのレンダリングをやめたのは、mermaid がそのブラウザで解決されたフォントでラベルを計測するため、
ボックスの大きさがずれ、文字が切れ、マシンごとにレイアウトが変わっていたからです。
フォントを固定した単一のレンダラーなら、どこでも同じ図になります。

```bash
npm run docs:diagrams          # 新規・変更された図をレンダリング(ローカルの Chrome/Chromium が必要)
npm run docs:diagrams -- --all # スタイル変更後などに全図を再レンダリング
npm run docs:diagrams -- --all --audit # 図ごとのレイアウト上の指摘も一覧表示
npm run docs:check-diagrams    # 全図の構文を確認し、PNG の無い図があれば失敗
```

PNG は markdown の変更と一緒にコミットしてください。Chrome が標準の場所に無い場合は `CHROME_PATH` を設定します。

::: warning 図を編集したら再レンダリング
画像はフェンス本文のハッシュで引くため、1 文字の変更でも `npm run docs:diagrams` が必要です。
実行しないと、そのページには壊れた画像が表示されます(図がブラウザ内で描画されることはありません)。
:::

各フローチャートは複数の ELK バリアントでレイアウトされ、監査の指摘が最も少ないものが採用されます。`--audit` は残った指摘を表示します: 重大な指摘(線がボックス・グループ名・ラベルを貫通)と、`~` 付きの軽微な指摘(線がグループ名やボックスに近すぎる、グループ名の下に隠れる、グループの枠線に沿って走る、他の線と重なる、矢印の先端が密集している)です。グループ名は線を避けるように辺に沿って移動するか、複数行に折り返されます。ほぼ直線の線はまっすぐに補正されます。それでも窮屈に見える場合はソース側で並べ替えます: `~~~`(不可視リンク)でボックスやグループの順序を固定し、`subgraph` 内の `direction TB`/`LR` でその中の向きを指定します。

::: info 山括弧のプレースホルダーはエスケープする
図の中の `<unit>` のようなプレースホルダーは `#lt;unit#gt;` と書きます。そのまま書くと HTML タグとして
扱われ、何も言わずに消えます(`<u>` はラベルの残りを下線付きにしてしまいます)。
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
