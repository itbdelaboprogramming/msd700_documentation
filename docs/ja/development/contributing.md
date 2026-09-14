---
search: false
---

# コントリビューションガイド

<RoleBadge role="developer" />

このガイドは、**MSD700 コア製品**(`ros-web-ui`、`msd700_robot`、`msd700_noetic`、`ROS-dashboard-next-ts`)およびこの**ドキュメントサイト**への貢献に関する開発者ワークフローを扱います。

## 製品開発ワークフロー

本番環境のオペレーターに影響を与えることなくサーバーサイドの変更を安全にテストするには、分離された `server_dev` Docker Compose プロファイルを使用します。

```bash
cd ~/ros-web-ui
docker compose --profile server_dev up -d --build
```

### 開発スタックのポートオフセット:
開発スタックは、本番環境と並行して稼働できるように専用のポートオフセットを使用します。

| サービス | 本番ポート | 開発ポート | プロトコル |
| --- | --- | --- | --- |
| **ROS Master** | `11311` | `11312` | TCP (XML-RPC) |
| **rosbridge** | `9090` | `9091` | WebSocket |
| **HiveMQ MQTT** | `8883` | `8884` | TLS Encrypted MQTTS |
| **MySQL データベース** | `3307` | `3308` | TCP |
| **バックエンド REST API** | `5000` | `5001` | HTTP |
| **Next.js ダッシュボード**| `3000` | `3100` | HTTP |

物理ロボットまたはシミュレーションロボットは、`--dev` を渡すことで開発用クラウドピアに接続します。
```bash
./scripts/docker-manager.sh up --dev -d
```

### ロボット側の開発ワークフロー:
`msd700_noetic` では、`src/` ディレクトリがロボットランタイムコンテナに直接バインドマウントされています。launch ファイル、Python ノード、URDF モデルへの変更は、イメージの再ビルドなしに次回の launch から反映されます。イメージの再ビルド(`docker-manager.sh build`)が必要になるのは、C++ の catkin パッケージや基盤となるシステム依存関係が変更された場合のみです。

---

## このドキュメントサイトの作業

### ローカル開発サーバー:

```bash
cd ~/msd700_documentation
npm install
npm run docs:dev       # Starts local dev server at http://localhost:5700/itbdelabo/docs/
npm run docs:build     # Validates production build -> docs/.vitepress/dist
npm run docs:preview   # Serves production build preview
```

### 自動検証スクリプト:
ドキュメントの変更をコミットする前に、以下を実行してください。

```bash
# 1. Validate all Mermaid diagrams syntax
node scripts/check_parse.mjs

# 2. Build VitePress bundle and test broken links
npm run docs:build

# 3. Verify zero forbidden punctuation characters
grep -rn $'\xe2\x80\x94' docs/ scripts/
```

### カスタムグローバルコンポーネント:
このドキュメントテーマは、カスタムのグローバルコンポーネントで VitePress を拡張しています。
- `<RoleBadge role="user | technician | developer" />`: ページ上部に対象読者のバッジを表示します。
- `<LinkCards>` / `<LinkCard title="..." details="..." link="..." icon="..." />`: セクションのランディングページで使用されるインタラクティブなカードグリッド。
- `<Mermaid code="..." />`: レスポンシブなアーキテクチャのフローチャートやシーケンス図のためのクライアントサイド SVG レンダラー。

### コミットおよびプルリクエストの規約:
コミットは標準的な Conventional Commits 形式(`feat: ...`、`fix: ...`、`docs: ...`、`refactor: ...`)に従います。

## 関連ドキュメント

- [リポジトリ構成](/ja/development/repository-structure): マルチリポジトリの構成全体。
- [アーキテクチャ](/ja/development/architecture): 2マシンのシステムトポロジー。
- [変更履歴](/ja/development/changelog): プラットフォームのリリース履歴。
