---
search: false
---
# プラットフォームの変更履歴とリリースのマイルストーン

<RoleBadge role="developer" />

この変更ログには、MSD700 ロボット エコシステム全体にわたる主要なアーキテクチャのマイルストーン、プラットフォームの見直し、プロトコルの進歩がまとめられています。

## 建築上のマイルストーン

### 2026 年 8 月: ドキュメントの見直しと精密運動学
- **モジュール式ドキュメント アーキテクチャ**: レスポンシブな Mermaid SVG 図、数式、ダウンタイムなしの操作を使用して、すべてのドキュメント ページを徹底的に書き直しました。
- **True-Scale Gazebo Simulation**: AWS RoboMaker Small Warehouse で動作する `msd700_field` (キャスター 4 個付きの本体設置面積 $0.90 \times 0.70\text{ m}$) にアップグレードされたシミュレーター モデル。
- **相関スキャン マッチング (自動位置合わせ)**: 狭い廊下での 360 度の回転を排除するために、ゼロスピン初期ポーズ位置合わせ (< 50 ミリ秒) を実装しました。
- **32 バイト ナンス暗号登録**: ロボット デバイス認証用に強制された CSPRNG ノンス ハッシュ プロトコル。

### 2026 年 7 月: マルチテナントのレンタル セキュリティと ULID の移行
- **レンタル プロファイル認証**: マップとユニット間でテナントを厳密に分離するための `attachUnit` Express ミドルウェアを追加しました。
- **ULID アーキテクチャ**: システム アドレス指定を生のハードウェア文字列から汎用的に一意な辞書順ソート可能な識別子 (`/unit_<ULID>/...`) に移行しました。
- **均一なデータベース タイムスタンプ**: 15 のデータベース テーブルにわたって自動 `ON UPDATE CURRENT_TIMESTAMP` トリガーを備えた標準化された `created_at` 列と `modified_at` 列。

### 2026 年 6 月: オフラインファーストレプリケーションとローカルモードスタック
- **双方向データ同期エージェント**: `sync_agent.js` および `sync_engine.js` を展開し、行ごとの最終書き込み優先の競合解決と削除トゥームストーンを備えました。
- **2 層マップ ストレージ**: ベストエフォート型クラウド同期 (`media-server :3003`) を使用した必須のローカル アップロード (`media_local :3003`) を実装しました。
- **Jetson ローカル ダッシュボード**: 自律的なオフライン フィールド操作用にバンドルされたオンボード `frontend_local` および `backend_local` スタック。

### 2026 年 5 月: 超低遅延 WebRTC ビデオ パイプライン
- **mDNS 候補フィルタ**: オフライン LAN での RFC 8445 ネットワーク解決エラーを防ぐために、`camera_client.py` に `_strip_mdns_candidates()` が導入されました。
- **coturn TURN Relay**: 対称 NAT 間で中継する統合プロダクション WebRTC メディア。

---

## リポジトリのコミット履歴

行ごとのコミット ログについては、各 GitHub リポジトリを参照してください。

- [msd700_documentation コミット](https://github.com/itbdelaboprogramming/msd700_documentation/commits/main)
- [ros-web-ui コミット](https://github.com/itbdelaboprogramming/ros-web-ui/commits/v2)
- [msd700_robot コミット](https://github.com/itbdelaboprogramming/msd700_robot/commits/v2)
- [ROS-dashboard-next-ts コミット](https://github.com/itbdelaboprogramming/ROS-dashboard-next-ts/commits/v2)
- [msd700_noetic コミット](https://github.com/itbdelaboprogramming/msd700_noetic/commits/master)