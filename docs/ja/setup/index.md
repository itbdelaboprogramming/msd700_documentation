---
search: false
---

# セットアップおよびデプロイガイド

<RoleBadge role="technician" />

このセクションには、MSD700 のハードウェアとソフトウェアを構成する**技術者、システムエンジニア、現場設置担当者**向けの技術文書が含まれています。

各手順には、ステップバイステップのシェルコマンド、期待される出力、設定テンプレート、およびアーキテクチャの説明が含まれます。

<LinkCards>
  <LinkCard icon="✅" title="前提条件" details="ハードウェアの構成規模、コンピューティング要件、OSバージョン、ネットワークポートのファイアウォールルール。" link="/ja/setup/prerequisites" />
  <LinkCard icon="🖥️" title="サーバーセットアップ" details="本番クラウドデプロイのステップバイステップ手順: Docker Compose、Apache リバースプロキシ、SSL。" link="/ja/setup/server-setup" />
  <LinkCard icon="📡" title="ユニットセットアップ" details="NVIDIA Jetson SBC 上での物理ロボットのインストールと設定、ランタイムのビルド、登録(enrol)。" link="/ja/setup/unit-setup" />
  <LinkCard icon="🔗" title="システムセットアップ" details="エンドツーエンドの統合チェックリスト、ネットワーク検証、オペレーターへの引き渡し。" link="/ja/setup/system-setup" />
  <LinkCard icon="🐳" title="Docker コマンドリファレンス" details="Docker Compose プロファイル、環境変数、ボリュームマウントの網羅的なリファレンス。" link="/ja/setup/docker-reference" />
  <LinkCard icon="📶" title="Wi-Fi ホットスポット + クライアント" details="オンボード Wi-Fi ホットスポット、アクセスポイントモード、ローカルネットワーククライアントブリッジの設定。" link="/ja/setup/wifi-hotspot" />
  <LinkCard icon="🧰" title="メンテナンス" details="定期的なログローテーション、JWT キーリングのローテーション、Certbot Let's Encrypt の更新、バックアップ。" link="/ja/setup/maintenance" />
  <LinkCard icon="🛠️" title="技術者向けトラブルシューティング" details="ハードウェア、コンテナ、MQTT ブローカー、センサーの問題を診断・解決。" link="/ja/setup/troubleshooting" />
</LinkCards>

## 推奨デプロイ手順

MSD700 プラットフォームは 2 台構成モデル(サーバー + 物理ユニット)を採用しています。新規インストールでは以下の順序に従ってください。

![Setup Pipeline](/images/MSD700-SetupFlow.jpg)

1. [前提条件](/ja/setup/prerequisites): コンピューティング規模、Jetson ハードウェア周辺機器、ネットワークファイアウォールルールを確認します。
2. [サーバーセットアップ](/ja/setup/server-setup): 物理ユニットが登録先とする中央エンドポイントを用意するため、最初にクラウドサーバースタックを起動します。
3. [ユニットセットアップ](/ja/setup/unit-setup): Jetson SBC 上でロボットコンテナをビルドし、自動暗号化登録(enrolment)ハンドシェイクを完了します。
4. [システムセットアップ](/ja/setup/system-setup): 10 項目のエンドツーエンド運用検証チェックリストを実行します。

初期インストールの後は、継続的なフリート維持管理のために [メンテナンス](/ja/setup/maintenance) と [トラブルシューティング](/ja/setup/troubleshooting) を参照してください。
