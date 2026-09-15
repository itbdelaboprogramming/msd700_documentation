---
search: false
---

# ROS Web UI ユーザーガイド

<RoleBadge role="user" />

## MSD700 について

**MSD700** は、産業環境における自律的なマッピングとナビゲーションのために**Nakayama Iron Works Ltd.** が設計・製造した自律移動ロボットです。

**ROS Web UI** ダッシュボードは、MSD700 プラットフォームのオペレーター向けインターフェースであり、**ITB de Labo** が開発しています。このWebベースの操作センターにより、Webブラウザを持つあらゆるデバイスからロボットの動作を監視・指示・管理できます。

## できること

ROS Web UI では、以下のことが可能です。

- **マップ作成**。新しいエリアでロボットを走行させ、デジタルフロアプランを自動生成(SLAM)
- **ナビゲーション**。マップ上の任意の場所をクリックすると、障害物を回避しながらその場所へロボットを送る
- **エリアカバレッジ**。ゾーンを描画し、部屋や通路全体を体系的に清掃・巡回するよう指示
- **ライブ監視**。超低遅延のストリーミングでロボットのカメラ映像をリアルタイムに視聴
- **ルート管理**。よく使う経路を保存し、複数をつなげて自動ミッションのプレイリストを作成
- **フリート管理**。管理者であれば、複数のロボット、オペレーター、レンタルプロファイルを一括管理
- **オフライン運用**。インターネットなしでロボットのローカルWi-Fiに直接接続し、ダッシュボード全機能を利用

## 本ガイドの使い方

以下の各セクションでは、開発者向けではなく日常利用者向けに、各機能をステップバイステップで解説しています。必要な機能から読んでも構いませんし、初めて利用する場合は推奨される読む順序に従ってください。

<LinkCards>
  <LinkCard icon="👥" title="アカウントとアクセス" details="ログイン、アカウント作成、オペレーターと管理者の権限の違いを理解する。" link="/ja/user-guide/accounts" />
  <LinkCard icon="🧭" title="ナビゲーション" details="ジョイスティックによる手動操作、地点への送信、Autopilot ミッション。" link="/ja/user-guide/navigation" />
  <LinkCard icon="🗺️" title="マッピング" details="ロボットをエリア内で走行させて新しいマップを作成。再生・一時停止・保存。" link="/ja/user-guide/mapping" />
  <LinkCard icon="🗄️" title="マップとデータベース" details="保存済みマップの表示、検索、名前変更、削除。" link="/ja/user-guide/database" />
  <LinkCard icon="📍" title="ルートとカバレッジ" details="地点間ルートの保存と、体系的な清掃のためのエリア描画。" link="/ja/user-guide/routes-coverage" />
  <LinkCard icon="📷" title="ライブカメラ" details="どこからでもロボットの視点をリアルタイムに確認。" link="/ja/user-guide/camera" />
  <LinkCard icon="🛠️" title="管理コンソール" details="フリート管理者向け:オペレーターの追加、レンタル管理、フリート状況の監視。" link="/ja/user-guide/admin-console" />
</LinkCards>

## 推奨される読む順序

1. **[アカウントとアクセス](/ja/user-guide/accounts)**。ログインを設定し、システムの仕組みを理解する
2. **[ナビゲーション](/ja/user-guide/navigation)**。ロボットの操作方法を学ぶ
3. **[マッピング](/ja/user-guide/mapping)**。最初のマップを作成する
4. **[マップとデータベース](/ja/user-guide/database)**。保存済みマップを管理する
5. **[ライブカメラ](/ja/user-guide/camera)**。ロボットを遠隔監視する
6. **[ルートとカバレッジ](/ja/user-guide/routes-coverage)**。自動ミッションを計画する
7. **[管理コンソール](/ja/user-guide/admin-console)**。(フリート管理者のみ)オペレーターとユニットを管理する

## お困りの場合

- 各ガイド末尾の**トラブルシューティング**セクションを確認してください
- [よくある質問(FAQ)](/ja/getting-started/faq) を参照してください
- システム管理者、または ITB de Labo サポートにお問い合わせください

---

**MSD700** は **Nakayama Iron Works Ltd.** の製品です
**ROS Web UI** は **ITB de Labo** が開発しています
