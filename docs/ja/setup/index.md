---
search: false
---

# セットアップ・デプロイガイド

<RoleBadge role="technician" />

MSD700のハードウェアとソフトウェアのインストール・設定方法です。技術者、システムエンジニア、現場インストーラー向けです。

各ページに、必要なシェルコマンド、実行結果の例、設定テンプレートを記載しています。

<LinkCards>
  <LinkCard icon="✅" title="前提条件" details="ハードウェア、OSバージョン、ファイアウォールポートを先に準備します。" link="/ja/setup/prerequisites" />
  <LinkCard icon="🖥️" title="サーバー構築" details="本番クラウドのデプロイ:Docker Compose、Apacheリバースプロキシ、SSL。" link="/ja/setup/server-setup" />
  <LinkCard icon="📡" title="ユニット構築" details="NVIDIA Jetson上で実機ロボットをインストールし、ビルドして登録します。" link="/ja/setup/unit-setup" />
  <LinkCard icon="🔗" title="システム構築" details="サーバーとユニットの連携を確認し、オペレーターに引き渡します。" link="/ja/setup/system-setup" />
  <LinkCard icon="📋" title="コミッショニングチェックリスト" details="新規ユニット1台の受け入れシート。開梱からサインオフまで。" link="/ja/setup/commissioning-checklist" />
  <LinkCard icon="🐳" title="Dockerリファレンス" details="Docker Composeプロファイル、コマンド、環境変数、ボリュームの一覧。" link="/ja/setup/docker-reference" />
  <LinkCard icon="📶" title="WiFiホットスポット+クライアント" details="ユニット独自のWi-Fiホットスポットと、インターネット用クライアント接続。" link="/ja/setup/wifi-hotspot" />
  <LinkCard icon="📡" title="MT7922 Wi-Fi設定" details="Tegraカーネル上のオンボードMediaTek MT7922ファームウェア修正。" link="/ja/setup/wifi-mt7922" />
  <LinkCard icon="🧰" title="メンテナンス" details="ログローテーション、鍵ローテーション、証明書更新、バックアップ。" link="/ja/setup/maintenance" />
  <LinkCard icon="🛠️" title="技術者向けトラブル対処" details="ハードウェア、コンテナ、MQTTブローカー、センサーの問題対処。" link="/ja/setup/troubleshooting" />
</LinkCards>

## インストール順序

MSD700は常に2種類のマシンで構成されます:サーバー1台とユニット1台以上です。次の順序でインストールしてください。

![インストール順序](./diagrams/setup-install-order.drawio)

1. [前提条件](/ja/setup/prerequisites):ハードウェアを確認し、ファイアウォールポートを開けます。
2. [サーバー構築](/ja/setup/server-setup):先にクラウドサーバーを起動します。ユニットの登録先になります。
3. [ユニット構築](/ja/setup/unit-setup):Jetson上でロボットコンテナをビルドし、サーバーに登録します。
4. [システム構築](/ja/setup/system-setup):エンドツーエンドのチェックリスト(10項目)を実行します。
5. [コミッショニングチェックリスト](/ja/setup/commissioning-checklist):新規ユニット1台を1項目ずつ受け入れます。

その後は、[メンテナンス](/ja/setup/maintenance)と[トラブル対処](/ja/setup/troubleshooting)を参照してください。
