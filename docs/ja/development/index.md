---
search: false
---

# 開発者ドキュメント

<RoleBadge role="developer" />

MSD700 プラットフォームに携わるソフトウェアエンジニア、ロボティクス開発者、システムアーキテクト向けの包括的な技術ドキュメント。ロボット自体のソフトウェアと、それを運用するプラットフォームの2領域に分かれています。

## ROS: ロボットソフトウェア

物理ユニット上で動作する ROS 1 Noetic スタック: パッケージ、アルゴリズム、センサー、制御ループ。この側には独自のオペレーター向け UI がないため、サブシステムごとに整理されています。

<LinkCards>
  <LinkCard icon="🤖" title="ROS セクション" details="パッケージレジストリ、知覚&ローカリゼーション、ナビゲーション&プランニング、ボウストロフェドン・カバレッジアルゴリズム、ファームウェア&ハードウェア、セーフティウォッチドッグ、シミュレーション。" link="/ja/development/ros/" />
</LinkCards>

## ROS Web UI: プラットフォーム

オペレーターダッシュボード、管理コンソール、そしてそれらをロボットに接続するバックエンド/ブリッジサービス。プロトコル層ではなく、実際の機能画面ごとに整理されています。

<LinkCards>
  <LinkCard icon="🧭" title="ナビゲーション" details="手動操作、Autopilot、ピンポイント/ルート、マップ同期&アライメント、カバレッジクリーニング。" link="/ja/development/webui/navigation/overview" />
  <LinkCard icon="🗺️" title="マッピング" details="新しいマップの構築: Play/Pause/Stop、手動 vs 自律探索、save-on-stop。" link="/ja/development/webui/mapping/overview" />
  <LinkCard icon="🗄️" title="データベース" details="マップDB画面: 記録済みマップの一覧表示、検索、リネーム、削除。" link="/ja/development/webui/database/overview" />
  <LinkCard icon="🛠️" title="管理コンソール" details="Operators、Units & Fleet、Rentals、Backups、そしてスーパー管理者専用の Admins タブ。" link="/ja/development/webui/admin-console/overview" />
  <LinkCard icon="🔑" title="アカウント & アクセス" details="オペレーターのログイン/サインアップ、管理者ログイン、JWT キーリング、ハードウェア登録。" link="/ja/development/webui/accounts/overview" />
  <LinkCard icon="📷" title="カメラ & ライブビュー" details="ダッシュボードのライブフィードを支える WebRTC 映像パイプライン。" link="/ja/development/webui/camera/overview" />
</LinkCards>

## まずはここから & リファレンス

両領域に共通して適用される横断的な資料であり、どちらのセクションにも重複させていません。

<LinkCards>
  <LinkCard icon="🏗️" title="アーキテクチャ" details="2マシン・ピアモデル、システムトポロジー、トラストドメイン、状態の所有権。" link="/ja/development/architecture" />
  <LinkCard icon="🗂️" title="リポジトリ構成" details="msd700_robot、ros-web-ui、msd700_noetic 間のコードベース構成。" link="/ja/development/repository-structure" />
  <LinkCard icon="📨" title="メッセージ仕様" details="MQTT ワイヤーフォーマット全体: コマンドエンベロープ、フィードバックスキーマ、ARQ ACK プロトコル。" link="/ja/development/message-contracts" />
  <LinkCard icon="🔧" title="診断 & トラブルシューティング" details="スタック全体の障害判断ツリーと根本原因のマッピング。" link="/ja/development/troubleshooting-guide" />
  <LinkCard icon="🤝" title="コントリビューションガイド" details="開発ワークフロー、コミット規約、プルリクエスト手順。" link="/ja/development/contributing" />
  <LinkCard icon="📝" title="変更履歴" details="プラットフォームの変更履歴とリリースノート。" link="/ja/development/changelog" />
</LinkCards>

## 推奨される読み進め方

MSD700 に新しく参加するエンジニアには、次の基礎的な進行順序を推奨します。

1. [アーキテクチャ](/ja/development/architecture): 2マシンモデルと MQTT / rosbridge の分離を理解する。
2. [アカウント & アクセス: セキュリティ & トークン](/ja/development/webui/accounts/security-and-tokens): 3つのトラストドメインと暗号学的デバイス登録を学ぶ。
3. [ROS パッケージレジストリ](/ja/development/ros/ros-packages): ROS ノードとパッケージバインディングを探る。
4. [座標変換 (TF)](/ja/development/ros/tf-transforms): 空間参照ツリーとクロックドメインの再スタンプを理解する。
5. [メッセージ仕様](/ja/development/message-contracts): マシン境界を越える正確なワイヤーフォーマットを習得する。
6. [ナビゲーション: 手動オーバーライド & Autopilot](/ja/development/webui/navigation/manual-and-autopilot): ロボットのアクティビティステートマシンとセッション復旧を追跡する。
7. [REST API リファレンス](/ja/development/api-reference): Web および外部クライアントコントローラーを統合する。
