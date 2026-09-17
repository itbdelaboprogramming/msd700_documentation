---
outline: deep
search: false
---

# データベース概要

<RoleBadge role="developer" />

データベース機能は、ダッシュボードの `unit/database`（`pages/unit/database/index.tsx`、コンポーネント
`DatabaseComponent.tsx`）にある Map DB 画面である。オペレーターが現在のユニットに記録されているすべての
マップを確認し、ナビゲーションに読み込むマップを選ぶ、あるいは古いマップを整理するための場所だ。このペー
ジでは、この画面を担当するフロントエンドエンジニア向けに画面の挙動を説明する。エンドユーザー向けのチュー
トリアルではない。名前変更と削除のフローについては
[名前変更 & 削除](/ja/development/webui/database/rename-and-delete) を参照。この画面を支えるスキーマと
REST エンドポイントについては [ROS連携](/ja/development/webui/database/ros-integration) を参照。

## スコープ

この画面はマップのみを第一級の行として一覧表示する。ルート、保存済みの cover/no-cover エリア、操作
プレイリストは、それ自体の行を持つのではなく、マップに付随する属性である。マップの
`modified_by_username` は「マップ自体、そのルート、保存済みエリア、またはプレイリスト」への変更を
1つの値としてカバーしており、これら3つはマップとともにカスケード削除される
（[名前変更 & 削除 § カスケード削除](/ja/development/webui/database/rename-and-delete#カスケード削除)
を参照）が、この画面ではいずれも独自の一覧、検索ボックス、名前変更コントロールを持たない。レンタル
プロファイルもここでは扱わない。

## マップ一覧

`DatabaseTable.tsx` はマップごとに1行をレンダリングし、以下の列を持つ。

| 列 | 備考 |
| --- | --- |
| 名前 | `map_name` |
| 最終更新 | `modified_at` |
| 最終更新者 | `modified_by_username`。マップ自体、またはそれに付随するルート、エリア、プレイリストへの編集をカバーする |
| ファイルサイズ | マップの保存済みアセットのサイズ |
| ホームベースの姿勢 | `homebase_x`、`homebase_y` |

マップ名はグローバルにではなく `(unit_id, profile_id)` ごとにのみ一意であるため、同一レンタルの2台の
ロボットがそれぞれ同名で異なる `id` のマップを持つことがある。テーブルは `unit_id` でスコープし、常に
`id` ですべてをキー付けする必要があり、名前で行を重複排除してはならない。この背後にあるスキーマ制約に
ついては
[ROS連携 § テーブル](/ja/development/webui/database/ros-integration#テーブル) を参照。

## 検索、並べ替え、ページネーション

`DatabaseSearch.tsx` は表示される行を絞り込む。並べ替えは名前または日付、昇順または降順で、一度に
アクティブになるのは1つのソートのみである。新しいソートキーを選ぶ、あるいは方向を反転させると、以前
アクティブだったものを置き換えるのであり、副次的なソートを追加するのではない。`DatabasePagination.tsx`
は検索フィルターと並べ替えの後に残ったものをページ分けする。

## マップの選択

各行のラジオボタンまたはチェックボックスコントロールが、アプリ全体の「選択中マップ」コンテキストを
設定する。行を選択しただけではナビゲーションに何かが読み込まれるわけではなく、単に
[名前変更 & 削除](/ja/development/webui/database/rename-and-delete) で説明する名前変更・削除アクション
の現在の対象がどのマップかを示すだけである。

## マップをナビゲーションで開く

マップを開くと `/unit/navigation?index=<id>` にルーティングされる。マッピングセッションがユニット上で
現在実行中または一時停止中で、オペレーターが記録中のものとは*別の*マップを開いた場合、この画面は
進行中のマップを黙って破棄しない。詳細は
[名前変更 & 削除 § セッション競合ガード](/ja/development/webui/database/rename-and-delete#セッション競合ガード)
を参照。

## 空状態とロード状態

`LoadingOverlay` は、マップ一覧を取得している間テーブルを覆う。`NoDataOverlay` は、ユニットにまだ記録
されたマップがない場合、または現在の検索フィルターを通過する行が1つもない場合にテーブルを置き換える。

## 関連

- [名前変更 & 削除](/ja/development/webui/database/rename-and-delete): この画面上の2つの変更アクションの詳細
- [ROS連携](/ja/development/webui/database/ros-integration): この機能を支えるスキーマと REST エンドポイント
- [メディアサーバーリファレンス](/ja/development/webui/database/media-server-reference): マップアセット API(アップロード、サムネイル、レガシーIDマッパー)
- [アーキテクチャ](/ja/development/architecture)
- [データベーススキーマ](/ja/development/database-schema): `ROS_DB` の完全なスキーマリファレンス
