---
outline: deep
search: false
---

# 名前変更 & 削除

<RoleBadge role="developer" />

データベース画面（`DatabaseComponent.tsx`）から直接利用できる2つの変更アクション、すなわちマップの
その場での名前変更と削除について説明する。マップ一覧自体の挙動については
[概要](/ja/development/webui/database/overview) を、これらのアクションが触れるスキーマとエンドポイント
については [ROS連携](/ja/development/webui/database/ros-integration) を参照。

## インライン名前変更

テーブル内のマップ名をダブルクリックするとインライン編集用に開き、コミット時に `updateMapName`
（`services.ts`）が呼び出される。

重複した名前は黙って受理されるのではなく、完全に拒否される。これはダッシュボードの他の場所、すなわち
ルート、エリア、プレイリストで使われている名前変更の挙動とは異なり、それらは重複した名前を拒否する
代わりに自動的にサフィックスを付加する。マップはスキーマ上 `(unit_id, profile_id)` にスコープされて
いるため
（[ROS連携 § テーブル](/ja/development/webui/database/ros-integration#テーブル) を参照）、ここで拒否
される重複は、自然な衝突というより本物の命名ミスである可能性が高い。

**メッセージ仕様:** `{ new_map_name }` を付けた [`PUT /api/maps_data/rename/:mapId`](/ja/development/message-contracts/http-api#map-rename)。
使用済みの名前は `409`。バックエンドのみで、ユニットは [データ同期](/ja/development/data-sync) で新しい名前を受け取る。

## カスケード削除

マップを削除すると、何かが送信される前に `ConfirmDelete` 確認ダイアログを経由する。確認すると、
マップの行が削除され、`maps_data` の外部キーに従って、それに付随するすべてのルート、エリア、
プレイリスト、およびマップの保存済みファイルへとカスケードする。どのテーブルがカスケードし、どれが
null 化されるだけかについては
[ROS連携 § 外部キー](/ja/development/webui/database/ros-integration#外部キー) を参照。

元に戻す操作はない。ルート、エリア、プレイリストはこの画面で個別に一覧表示されないため
（[概要 § スコープ](/ja/development/webui/database/overview#スコープ) を参照）、マップを削除する
オペレーターには、確認プロンプト自体を超えて、一緒に失われるものの詳細な一覧は示されない。

**メッセージ仕様:** ボディに `{ map_id }` を付けた [`DELETE /api/maps_data`](/ja/development/message-contracts/http-api#map-delete)。応答は削除した
ファイルを列挙し(`data.files`)、削除のトゥームストーンは [データ同期](/ja/development/data-sync) でユニットに届く。

## セッション競合ガード

マップを開く操作（
[概要 § マップをナビゲーションで開く](/ja/development/webui/database/overview#マップをナビゲーションで開く)
を参照）は、マッピングセッションがユニット上で現在実行中または一時停止中である間、開こうとしている
マップによって扱いが異なる。

- 現在記録中のマップを開く場合は通常どおり進行する。
- *別の*マップを開くと `ConfirmSaving` と `MapSaving` が表示され、進行中のマップを黙って破棄する
  のではなく、オペレーターに選択肢を提示する。
  - **保存**: 新しいマップが読み込まれる前に、進行中のマップが保存される。これは
    [HTTP API § `POST /api/mapping`](/ja/development/message-contracts/http-api#mapping-control)
    (`stop: true` の `POST /api/mapping`)に記載されているものと同じ停止・保存パスをたどる。
  - **破棄**: 進行中のマップは保存されずに破棄される。
  - **キャンセル**: オペレーターは現在のマップにとどまり、マッピングセッションは変更されずに続行
    される。

**メッセージ仕様:** 保存は `{ stop: true, map_name }` の [`POST /api/mapping`](/ja/development/message-contracts/http-api#mapping-control) と、
続く [進捗ストリーム](/ja/development/message-contracts/http-api#mapping-progress)。破棄は [`POST /api/mapping/discard`](/ja/development/message-contracts/http-api#mapping-discard) →
[`mapping.discard`](/ja/development/message-contracts/mqtt-commands#mapping)。その後、新しいマップは [`POST /api/navigation/init`](/ja/development/message-contracts/http-api#navigation-init) で開く。

## 関連

- [メッセージ仕様 § データベースページ](/ja/development/message-contracts/#trace-database): これらの操作のすべての呼び出し
- [概要](/ja/development/webui/database/overview): この機能の土台となるマップ一覧、検索/並べ替え/ページネーション、各状態
- [ROS連携](/ja/development/webui/database/ros-integration): これらのアクションを支えるスキーマと REST エンドポイント
- [アーキテクチャ](/ja/development/architecture)
- [データベーススキーマ](/ja/development/database-schema): `ROS_DB` の完全なスキーマリファレンス
