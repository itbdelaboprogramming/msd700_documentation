---
search: false
---
# 貢献ガイド

<RoleBadge role="developer" />

このガイドでは、**MSD700 コア製品** (`ros-web-ui`、`msd700_robot`、`msd700_noetic`、`ROS-dashboard-next-ts`) およびこの **ドキュメント サイト** に貢献するための開発者のワークフローについて説明します。

## 製品開発ワークフロー

運用オペレーターに影響を与えずにサーバー側の変更を安全にテストするには、分離された `server_dev` Docker Compose プロファイルを使用します。

```bash
cd ~/ros-web-ui
docker compose --profile server_dev up -d --build
```

### 開発スタック ポート オフセット:
開発スタックは専用のポート オフセットを使用して、本番環境との並行操作を可能にします。

|サービス |生産ポート |開発港 |プロトコル |
| --- | --- | --- | --- |
| **ROS マスター** | `11311` | `11312` | TCP (XML-RPC) |
| **ロズブリッジ** | `9090` | `9091` |ウェブソケット |
| **HiveMQ MQTT** | `8883` | `8884` | TLS 暗号化 MQTTS |
| **MySQL データベース** | `3307` | `3308` | TCP |
| **バックエンド REST API** | `5000` | `5001` | HTTP |
| **Next.js ダッシュボード**| `3000` | `3100` | HTTP |

物理ロボットまたはシミュレートされたロボットは、`--dev` を渡すことで開発クラウド ピアに接続します。
```bash
./scripts/docker-manager.sh up --dev -d
```

### ロボット側の開発ワークフロー:
`msd700_noetic` では、`src/` ディレクトリはロボット ランタイム コンテナーに直接バインド マウントされます。起動ファイル、Python ノード、または URDF モデルへの変更は、イメージの再構築を必要とせずに、次回の起動時に有効になります。イメージの再構築 (`docker-manager.sh build`) は、C++ catkin パッケージまたは基本システムの依存関係が変更された場合にのみ必要です。

---

## このドキュメント サイトでの作業

### ローカル開発サーバー:

```bash
cd ~/msd700_documentation
npm install
npm run docs:dev       # Starts local dev server at http://localhost:5700/itbdelabo/docs/
npm run docs:build     # Validates production build -> docs/.vitepress/dist
npm run docs:preview   # Serves production build preview
```

### 自動検証スクリプト:
ドキュメントの変更をコミットする前に、以下を実行します。

```bash
# 1. Validate all Mermaid diagrams syntax
node scripts/check_parse.mjs

# 2. Build VitePress bundle and test broken links
npm run docs:build

# 3. Verify zero forbidden punctuation characters
grep -rn $'\xe2\x80\x94' docs/ scripts/
```

### カスタム グローバル コンポーネント:
このドキュメント テーマは、カスタム グローバル コンポーネントを使用して VitePress を拡張します。
- `<RoleBadge role="user | technician | developer" />`: ページの上部に対象読者のバッジを表示します。
- `<LinkCards>` / `<LinkCard icon="..." title="..." details="..." link="..." />`: セクションのランディング ページで使用されるインタラクティブ カード グリッド。
- `<Mermaid code="..." />`: レスポンシブ アーキテクチャのフローチャートおよびシーケンス図用のクライアント側 SVG レンダラー。

### コミット リクエストとプル リクエストの規則:
コミットは、標準的な従来のコミット形式 (`feat: ...`、`fix: ...`、`docs: ...`、`refactor: ...`) に従います。

## 関連ドキュメント

- [リポジトリ構造](/ja/development/repository-structure): 完全なマルチリポジトリ レイアウト。
- [アーキテクチャ](/ja/development/architecture): 2 マシン システム トポロジ。
- [変更履歴](/ja/development/changelog): プラットフォームのリリース履歴。