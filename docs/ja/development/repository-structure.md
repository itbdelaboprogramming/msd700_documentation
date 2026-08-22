---
search: false
---
# リポジトリ構造

<RoleBadge role="developer" />

MSD700 は 4 つのリポジトリにまたがります。これ (`msd700_documentation`) は単なるドキュメント サイトです。製品
それ自体は他の 3 つの中に存在します。これらはサーバー チェックアウト上の兄弟であり、
ユニット チェックアウトの `msd700_noetic`: 同じコードで、2 つの異なる方法で組み立てます。

## `ros-web-ui`: Web 対応パッケージ、バックエンド、フロントエンドのビルド コンテキスト

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

`ros-web-ui` は **3 つの異なるコンテキスト**で使用される 1 つのリポジトリです。サーバーのとして構築されます。
バックエンド/ロスブリッジ (`docker-compose.yml`)、ロボットの Web 接続用にユニットのワークスペースにソースされます
ノード (`msd700_noetic/src/ros-web-ui`) を介してロボット半分としてスタンドアロンで実行します。
Jetson 以外のホスト (開発用ラップトップ、またはこのドキュメント サーバー、テスト) 上の `docker-compose.robot.yml`
シミュレーター）。どちらを取得できるかは、それを呼び出す構成ファイル/スクリプトによってではなく、完全に依存します。
リポジトリ自体にあるもの。

## `msd700_robot`: ロボットを動かすための ROS パッケージ

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
│   ├── scripts/              #   fetch_sim_worlds.sh: pulls the AWS warehouse
│   └── vendor/               #   fetched third-party worlds, gitignored
├── msd700_visual/            # RViz/Gazebo robot visuals
├── msd700_hardware/          # Hardware drivers
├── msd700_description/       # URDF, including msd700_field.urdf.xacro (real size)
└── ros_msd700_msgs/
```

`msd700_field.urdf.xacro` のみが実際の 0.90 x 0.70 m ロボットです。ここにある他のモデルはすべて
TurtleBot3 ワッフルの派生サイズは 0.266 m で、コミットされたワールドはそれに一致するサイズになっています。参照
[シミュレーション](/ja/development/simulation) どの組み合わせでカバレッジ ジオメトリを検証できるか。

`msd700_noetic` (サブモジュール `src/msd700_robot` として) の両方によってソースされ、`ros-web-ui` にコピーされます
自分の`source/msd700_robot`。ロボットのビルドの半分には、このリポジトリのナビゲーション スタックと
同じ catkin ワークスペース内の `ros-web-ui` の Web 向けパッケージ。

## `msd700_noetic`: Jetson/ロボット オーケストレーション

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

これが実際にユニットが動作する様子です。 `src/` はコンテナにバインドマウントされている (ベイクインされていない) ため、
ホスト上の起動ファイルまたは Python ノードの編集は、再構築せずに次回の起動時に有効になります。
`docker-manager.sh build` が必要なのは、依存関係またはベースイメージの変更のみです。サーバー マシン上 (次のように)
ドキュメント サイト自身のホスト)、`src/` は、特に指定しない限り、正当に存在しないか空です。
ここで半分ロボットをテストしています。サーバーは代わりに `ros-web-ui` 自身の `docker-compose.yml` を実行します。
これは何も必要ありません。

## `ROS-dashboard-next-ts`: オペレーター ダッシュボード

独自の Next.js アプリ。異なる焼き付けられた URL を使用して同じソースから 2 回ビルドされます。

- **サーバー ビルド** (`frontend_prod`/`frontend_dev`、`ros-web-ui/docker-compose.yml`):
  サーバー独自のバックエンド/rosbridge/media/signalling、パブリック HTTPS/WSS パス、Apache プロキシ経由。
- **ユニット ビルド** (`msd700_noetic` のコンテナ内、または `ros-web-ui` の `docker-compose.yml` の場合
  ロボットを半分スタンドアロンで実行): 経由で組み込まれた、同じユニット自体のローカル サービスと通信します。
  `NEXT_PUBLIC_*` ビルド引数はユニット自身の IP を指します。

これらの URL は実行時に読み取られるのではなく、JS バンドルに**コンパイルされ、変更されるためです。
ビルドポイントのサーバーでは、再起動だけではなく、常にイメージの再構築が必要です。

## このリポジトリ (`msd700_documentation`)

VitePress ドキュメント サイトのみで、製品コードはありません。

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

### 図表

図は ```` ```mermaid ```` fences in markdown and rendered as real SVG in the
browser. Two pieces make that work:

| Piece | Job |
| --- | --- |
| `docs/.vitepress/config.mts`, `markdown.config` | Rewrites every `mermaid` fence into `<Mermaid code="<base64>" />`. Base64 because the diagram source is full of quotes, newlines and angle brackets that Vue would parse as template syntax once the fence became an element attribute |
| `docs/.vitepress/theme/components/Mermaid.vue` | Decodes it and renders on mount. Client-side only: mermaid needs a DOM to measure text before it can lay a graph out, and the dynamic `import('mermaid')` keeps the layout engine out of every page with no diagram on it |

The component follows the reader's light or dark theme and re-renders on a theme flip, because
mermaid bakes its palette into the SVG at render time. If a diagram fails to parse, the raw source is
shown instead of an empty gap.

```bash として作成されています
npm run docs:check-diagrams # すべての図を解析します。構文エラーが発生するとゼロ以外で終了します
「」

::: warning A broken diagram does not fail the build
VitePress は図のソースを解析しません。それを通過させるだけです。構文エラーは次のように表面化します。
公開されたページのソースの赤いブロック。図を編集した後にチェッカーを実行します。
:::

::: info Keep `<br/>` out of state-diagram transition labels
これは、`flowchart` ノード ラベルとシーケンス図のメモで機能し、このサイトで使用されています。
状態図のエッジ ラベルはプレーン テキストであるため、そこにある `<br/>` は文字通りレンダリングされます。
:::

### ドキュメント サイトの展開方法

::: details Deployment pipeline (click to expand)
1. `main` へのプッシュにより、GitHub Webhook がトリガーされます。
2. `scripts/webhook-listener.mjs` は Webhook 署名 (HMAC SHA-256) を検証し、`refs/heads/main` への `push` イベントで `scripts/deploy.sh` を生成します。
3. `deploy.sh`:
   - 作業ツリーにローカルな変更がある場合、またはデプロイが既に進行中の場合 (`flock` 経由) は実行を拒否します。
   - `origin/main` へのフェッチとハード リセット
   - `npm ci` を実行します
   - サイトを新しい `docs/.vitepress/dist_new` ディレクトリに構築します
   - `docs/.vitepress/dist` (プレーンな `mv`) にアトミックにスワップします
4. 運用環境では、Apache は `Alias` 経由で `docs/.vitepress/dist` **ディスクから直接** サービスを提供します (
   `000-default-le-ssl.conf` vhost);リクエスト内に実行中の `vitepress preview` プロセスがありません
   パスがあり、systemd ユニットがありません。 `npm run docs:preview` はローカルのスポットチェック専用です。
5. `webhook-listener.mjs` 自体は、`127.0.0.1:4701` 上の `msd700-docs-webhook` systemd ユニットの下で実行されます。
:::

::: danger Never put `vitepress preview` behind Apache in production
以前は、これがサイトの提供方法でした (`ProxyPass` から長期存続する `vitepress preview` プロセスまで)
ポート 4700)、デプロイのたびに静かに壊れました: `preview` の静的サーバー (`sirv`、
プロダクション モード) は、起動時に出力ディレクトリを 1 回スキャンし、各ファイルの名前とサイズをキャッシュします。あ
ハッシュ化されたアセットのファイル名を変更する再構築では、キャッシュが存在しないファイルを指したままになります。
そのため、すべての CSS/JS 404 が実行され、`index.html` は古い `Content-Length` に切り詰められて提供されました。給仕
`dist/` Apache 自身の `Alias` (現在のセットアップ、以下を参照) 経由で直接そのようなキャッシュはありません: Apache stats
各ファイルはリクエストごとに処理されるため、`dist/` スワップは再起動せずにすぐに取得されます。
:::

## 関連

- [寄稿](/ja/development/contributing) - ローカル開発ワークフロー
- [建築](/ja/development/architecture)