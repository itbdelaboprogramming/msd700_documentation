---
search: false
---
# 開発者向けドキュメント

<RoleBadge role="developer" />

MSD700 プラットフォームに取り組むソフトウェア エンジニア、ロボット開発者、システム アーキテクト向けの包括的な技術ドキュメント。

## アーキテクチャとコア システム

<LinkCards>
  <LinkCard icon="🏗️" title="建築" details="2 マシンのピア モデル、システム トポロジ、信頼ドメイン、およびシーム。" link="/ja/development/architecture" />
  <LinkCard icon="🛡️" title="セキュリティと認証" details="JWT キーリング、3 段階の暗号登録ノンス、および信頼分離。" link="/ja/development/security-and-auth" />
  <LinkCard icon="🔁" title="状態と動作" details="ロボットのアクティビティ、安全ウォッチドッグ層、自動操縦モード、およびセッションの回復。" link="/ja/development/state-and-behavior" />
  <LinkCard icon="🗂️" title="リポジトリ構造" details="msd700_robot、ros-web-ui、および msd700_noetic にわたるコードベースのレイアウト。" link="/ja/development/repository-structure" />
</LinkCards>

## ROS とロボット サブシステム

<LinkCards>
  <LinkCard icon="📦" title="ROS パッケージ レジストリ" details="ROS 1 Noetic ノード、起動ファイル、トピックの完全なディレクトリ。" link="/ja/development/ros-packages" />
  <LinkCard icon="📐" title="座標変換 (TF)" details="REP-103/105 変換ツリー、センサー オフセット、および BoundaryPublisher の再スタンプ。" link="/ja/development/tf-transforms" />
  <LinkCard icon="📡" title="センサーの融合と制御" details="Velodyne VLP-16 LiDAR、IMU フィルタリング、EKF 状態推定。" link="/ja/development/sensor-fusion-and-control" />
  <LinkCard icon="⚡" title="ファームウェアとハ​​ードウェア" details="マイクロコントローラーのシリアル UART プロトコル、PID 速度ループ、バッテリー テレメトリ。" link="/ja/development/firmware-and-hardware" />
  <LinkCard icon="🗺️" title="コストマップとプランナー" details="Move Base、navfn global planner、および TEB ローカル軌道最適化。" link="/ja/development/costmaps-and-planners" />
  <LinkCard icon="🔄" title="動的モード切り替え" details="switch_mode.py、roslaunch Python API プロセスの生成、および Autopilot シーケンサー。" link="/ja/development/mode-switching" />
</LinkCards>

## ナビゲーション、カバレッジ、シミュレーション

<LinkCards>
  <LinkCard icon="📐" title="ボストロフェドンの報道" details="デュアルジオメトリモデル、セル分解、ゼロスピンアライメント。" link="/ja/development/boustrophedon-and-alignment" />
  <LinkCard icon="🏭" title="シミュレーション" details="実物大の Gazebo シミュレーション、AWS Small Warehouse の世界、およびクリアランス テスト。" link="/ja/development/simulation" />
</LinkCards>

## 通信とインターフェース

<LinkCards>
  <LinkCard icon="📨" title="メッセージコントラクト" details="MQTT コマンド エンベロープ、フィードバック スキーマ、および ARQ ACK プロトコル。" link="/ja/development/message-contracts" />
  <LinkCard icon="🔌" title="APIリファレンス" details="徹底的な REST API エンドポイント、リクエスト パラメーター、および応答本文。" link="/ja/development/api-reference" />
  <LinkCard icon="🌐" title="ロスブリッジプロトコル" details="WebSocket JSON ストリーミング プロトコル、トピック サブスクリプション、およびキャンバス レンダリング。" link="/ja/development/rosbridge-protocol" />
  <LinkCard icon="🎨" title="フロントエンド キャンバスと Web UI" details="EaselJS ステージ レンダリング、メトリックからピクセルへの計算、createjs プロトタイプ パッチ。" link="/ja/development/frontend-canvas" />
  <LinkCard icon="📷" title="カメラストリーミング" details="WebRTC ビデオ パイプライン、STUN/TURN リレー、mDNS 候補フィルタリング。" link="/ja/development/camera-streaming" />
</LinkCards>

## データ、ストレージ、クラウド同期

<LinkCards>
  <LinkCard icon="🗄️" title="データベーススキーマ" details="MySQL 8.0 テーブル、統一タイムスタンプ、およびレンタル プロファイル外部キー。" link="/ja/development/database-schema" />
  <LinkCard icon="🔄" title="データ同期" details="オフラインファーストのデータベース調整、競合解決、ローカルバッジ。" link="/ja/development/data-sync" />
  <LinkCard icon="💾" title="バックアップと移行" details="プロファイルおよびユニットを対象としたバックアップ、tar.gz マニフェスト、およびスキーマの移行。" link="/ja/development/backup-and-restore" />
</LinkCards>

## 操作と診断

<LinkCards>
  <LinkCard icon="🐳" title="ユニットコンテナのライフサイクル" details="Unit_manager.js、Docker ソケット プロキシ、アイドル リーパー スイープ。" link="/ja/development/unit-container-lifecycle" />
  <LinkCard icon="🔧" title="診断とトラブルシューティング" details="開発者の障害デシジョン ツリー、根本原因のマッピング、および回復。" link="/ja/development/troubleshooting-guide" />
  <LinkCard icon="🤝" title="貢献ガイド" details="開発ワークフロー、コミット規約、プル リクエスト手順。" link="/ja/development/contributing" />
  <LinkCard icon="📝" title="変更履歴" details="過去のプラットフォームの変更履歴とリリース ノート。" link="/ja/development/changelog" />
</LinkCards>

## 推奨される読む順序

MSD700 に新しくオンボーディングするエンジニアに推奨される基本的な進行は次のとおりです。

1. [アーキテクチャ](/ja/development/architecture): 2 マシン モデルと MQTT と rosbridge の分離を理解します。
2. [セキュリティと認証](/ja/development/security-and-auth): 3 つの信頼ドメインと暗号化デバイスの登録について学びます。
3. [ROS パッケージ レジストリ](/ja/development/ros-packages): ROS ノードとパッケージ バインディングを調べます。
4. [座標変換 (TF)](/ja/development/tf-transforms): 空間参照ツリーとクロック ドメインのリスタンプについて理解します。
5. [メッセージ コントラクト](/ja/development/message-contracts): マシンの境界を越える正確なワイヤ形式をマスターします。
6. [状態と動作](/ja/development/state-and-behavior): 有限状態マシンの遷移と安全ウォッチドッグをトレースします。
7. [API リファレンス](/ja/development/api-reference): Web コントローラーと外部クライアント コントローラーを統合します。