---
outline: deep
search: false
---

# ROS連携

<RoleBadge role="developer" />

名前はそうなっているものの、これは他の ROS Web UI 機能グループとの一貫性のために維持されているだけで
あり、データベース機能自体には独自の ROS 側コンポーネントは存在しない。ロボットは Mapping 機能を通じて
マップを生成するが、記録済みマップの閲覧、名前変更、削除は純粋に MySQL と REST の話である。このページ
では、データベース画面の背後にあるスキーマとワイヤーコントラクトを説明する。画面自体の挙動については
[概要](/ja/development/webui/database/overview) と
[名前変更 & 削除](/ja/development/webui/database/rename-and-delete) を参照。

## テーブル

完全なスキーマは [データベーススキーマ](/ja/development/database-schema) にある。ここではマップ、
またはマップに付随するもののサブセットを扱う。

| テーブル | 目的 | 主要な列 |
| --- | --- | --- |
| `maps_data` | 記録されたマップ | `unit_id` → `units`（`ON DELETE CASCADE`、どのロボットが記録したか）、`profile_id` → `rental_profiles`（`ON DELETE RESTRICT`、どのレンタルが所有するか）、`UNIQUE(map_name, unit_id, profile_id)` |
| `routes_data` | 保存されたマルチピンポイントルート | `map_id` → `maps_data`（`ON DELETE CASCADE`）、`route_points`（JSON）、`UNIQUE(route_name, map_id)` |
| `areas_data` | 保存されたカバレッジエリア | `map_id` → `maps_data`（`ON DELETE CASCADE`）、`area_type`（`cover`/`no_cover`）、`polygon_points`（JSON）、`UNIQUE(area_name, map_id)` |
| `playlists_data` | 順番にスイープするエリアの順序リスト | `map_id` → `maps_data`（`ON DELETE CASCADE`）、`items`（JSON。参照ではなく各エリアのジオメトリのスナップショット）、`UNIQUE(playlist_name, map_id)` |

`unit_operation_state` も `map_id` 外部キーを持つが、`CASCADE` ではなく `ON DELETE SET NULL` である。
ユニットが現在読み込んでいるマップを削除すると、ブロックされる代わりにそのポインターがクリアされる。
このレコードの由来については
[データベーススキーマ § 運用データ（マップごと）](/ja/development/database-schema#運用データ-マップごと)
を参照。

`users`、`units`、`rental_profiles` は、それ自体のページでカバーされるアイデンティティ/アクセス
テーブルであるため、ここでは繰り返さない。
[データベーススキーマ § アイデンティティとアクセス](/ja/development/database-schema#識別とアクセス)
を参照。

`maps_data.unique_map_unit (map_name, unit_id, profile_id)` があるからこそ、1つのレンタル上の2台の
ロボットがそれぞれ同名のマップを衝突なく持つことができ、またデータベース画面が名前ではなく `unit_id`
でスコープし `id` で重複排除しなければならない理由でもある（
[概要 § マップ一覧](/ja/development/webui/database/overview#マップ一覧) を参照）。

上記4つのテーブルはすべて、共通の `created_at` / `modified_at` 規約に従っており、その `created_by` /
`modified_by` 列はユーザーの ULID を帰属のためだけに記録するのであって、アクセス制御のためではない。
マップへのアクセスは完全に所有レンタルプロファイルを通じて行われる。規約については
[データベーススキーマ § created_at / modified_at](/ja/development/database-schema#created-at-modified-at)
を、帰属に関する注記については [データベーススキーマ](/ja/development/database-schema) を参照。

## 外部キー

[データベーススキーマ § 外部キー一覧](/ja/development/database-schema#外部キー、完全版)
のうち、この機能に関連するサブセット:

![外部キー](../../../../development/webui/database/diagrams/ros-integration-foreign-keys.drawio)

これが
[名前変更 & 削除 § カスケード削除](/ja/development/webui/database/rename-and-delete#カスケード削除)
を支えている仕組みである。`maps_data` の行を削除すると、そのルート、エリア、プレイリストへとカスケード
し、それを指す操作状態はブロックされるのではなくクリアされる。

## REST エンドポイント

[HTTP API § マップ](/ja/development/message-contracts/http-api#maps)
より:

### マップ一覧の取得

`GET /api/maps_data?unit_id=<unit ULID>`

`unit_id` はワイヤー上はオプションだが、データベース画面では実質的に必須である。指定しない場合、
レスポンスは呼び出し元のレンタルスコープ内のすべてのマップとなる（アーカイブビューや管理ビューが
求めるもの）。指定すると、リストは1台のロボットが記録したマップに絞られる（この画面が必要とするもの。
1つのレンタルが複数のロボットを持つことがあり、兄弟ユニットのマップはこのロボットでナビゲートでき
ないため）。呼び出し元がアクティブなレンタルを持たないユニットを渡すと `403` になり、空のリストには
ならない。

`GET /api/maps/:mapId` も同じ `unit_id` パラメーターを取り、同じスコープを適用する。

::: warning マップ名は(ユニット、レンタル)ごとにのみ一意
レスポンスを `map_name` で重複排除してはならない。1つのレンタル上の2台のロボットがそれぞれ同名で
異なる `id` 値のマップを持つことがある。「重複」を落とすと本物のマップが失われる。`id` で重複排除し、
常に `unit_id` でスコープすること。
:::

### 名前変更と削除

名前変更は [`PUT /api/maps_data/rename/:mapId`](/ja/development/message-contracts/http-api#map-rename)(`services.ts` の `updateMapName`)、削除は
`{ map_id }` を付けた [`DELETE /api/maps_data`](/ja/development/message-contracts/http-api#map-delete)(`ConfirmDelete` で確認する呼び出し)である。
ページ上の振る舞い: [名前変更と削除](/ja/development/webui/database/rename-and-delete)。

### 対象外: カスタムウェイポイントルートの保存

[HTTP API § ルート](/ja/development/message-contracts/http-api#routes) は、ウェイポイントルートを保存するための `POST /api/routes` も記載して
いる。そのエンドポイントは Database 機能ではなく Navigation 機能に属する。ルートはこの画面から一覧
表示も管理もされないため（[概要 § スコープ](/ja/development/webui/database/overview#スコープ) を参照）、
ここでは繰り返さない。

## 関連

- [概要](/ja/development/webui/database/overview): このデータの上に構築されたマップ一覧、検索/並べ替え/ページネーション、各状態
- [名前変更 & 削除](/ja/development/webui/database/rename-and-delete): このスキーマと API サーフェスの上に構築された変更アクション
- [アーキテクチャ](/ja/development/architecture)
- [データベーススキーマ](/ja/development/database-schema): `ROS_DB` の完全なスキーマリファレンス
