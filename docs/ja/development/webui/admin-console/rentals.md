---
outline: deep
search: false
---

# 管理コンソール: レンタル

<RoleBadge role="developer" />

レンタルタブ(`ProfilesPanel.tsx`)は `rental_profiles` を管理する。**ロボットが誰にレンタルされて
いるか**という問いは、**誰がそれを操縦するか**を扱う `users` とは意図的に区別されている。オペレー
ターアカウントとレンタルプロファイルが別々のテーブルであるのには理由がある。
[概要 § 3つのアイデンティティ空間、3つのタブ](/ja/development/webui/admin-console/overview#_3つのアイデンティティ空間、3つのタブ)
を参照。このタブは、両者に加えてユニットが実際に結び付けられる場所である。オペレーターアカウント
側については [オペレーター](/ja/development/webui/admin-console/operators) を、ユニット側に
ついては [ユニット](/ja/development/webui/admin-console/units) を参照。

## このタブの背後にあるテーブル

[データベーススキーマ § アイデンティティとアクセス](/ja/development/database-schema#識別とアクセス)
より:

| テーブル | 目的 | 主要な列 |
| --- | --- | --- |
| `rental_profiles` | レンタル1件につき1行 | `id`(ULID、PK)、`profile_name`(一意)、`tenant_name`、`status` |
| `profile_members` | どのアカウントがどのプロファイルに属するか | `UNIQUE(profile_id, user_id)`、両方とも `ON DELETE CASCADE` |
| `profile_units` | プロファイルがアクセスできるユニット | `UNIQUE(unit_id)`、`(profile_id, unit_id)` では**ない** |

## レンタルプロファイルの作成 / 編集 / 削除

プロファイルは `tenant_name` と自由記述のメモを持つ。プロファイルの削除は一様に破壊的という
わけではない。
[データベーススキーマ § 外部キー一覧](/ja/development/database-schema#外部キー、完全版)
によれば、`rental_profiles` はその従属先と3つの異なる方法で関係しており、そのうち削除を実際に
ブロックするのは1つだけである。

- `maps_data` 上の `profile_id RESTRICT`：何らかのマップを所有するプロファイルは、それらの
  マップが処理される(例えば、まずプロファイルをアーカイブする; [バックアップ](/ja/development/webui/admin-console/backups)
  を参照)まで**削除できない**。
- `profile_members` と `profile_units` 上の `profile_id CASCADE`：メンバーシップ行とユニット
  割り当ては、プロファイルとともに自動的に消える。
- `profile_backups` 上の `profile_id SET NULL`：このプロファイルの既存のアーカイブは、
  [データベーススキーマ § バックアップと同期](/ja/development/database-schema#バックアップと同期)
  で説明されているのと同じ「アーカイブはアーカイブされたものより長生きしなければならない」という
  ルールに従い、プロファイル自体の削除後も存続する。

削除ではなくプロファイルを停止することは、より緩やかなレバーである。
[データベーススキーマ § アイデンティティとアクセス](/ja/development/database-schema#識別とアクセス)
によれば、「これを停止すると、どちらにも触れることなく、ユニットとそのデータの両方をメンバーから
隠す」。何も削除されたり再割り当てされたりせず、プロファイルを再有効化するとそこにあったものが
そのまま復元される。これは*オペレーター*アカウントの停止(
[オペレーター](/ja/development/webui/admin-console/operators) を参照)とは異なるメカニズムであり、
オペレーターアカウントの停止は現在ログイン時には強制されていないのに対し、レンタルプロファイルの
停止はすべてのメンバーに対して即座に有効になる。

## メンバーの追加 / 削除

`profile_members` は `users` の行を `rental_profiles` の行に結び付け、`UNIQUE(profile_id,
user_id)` によって同じオペレーターが1つのプロファイルに二重に追加されることはない。両方の外部
キーはカスケードする。オペレーターのアカウントを削除すると、そのメンバーシップはどこからでも
削除され、プロファイルを削除すると、それを指していたすべてのメンバーシップ行が削除される。
プロファイルのメンバーであることこそが、オペレーターアカウントがログインしてそのプロファイルの
ユニットとデータを見ることを実際に可能にするのであり、
[オペレーター](/ja/development/webui/admin-console/operators) でのアカウント作成はそれ自体では
何も付与しない。

## ユニットの割り当て / 解放

`profile_units` は `units` の行を `rental_profiles` の行に結び付ける。一意インデックスは
`(profile_id, unit_id)` のペアではなく `unit_id` 単体にある。

::: warning ユニットは一度に1つのプロファイルにのみ割り当て可能
`profile_units.unique_rented_unit (unit_id)` は、「二重割り当てが既存の割り当てを黙って上書き
するのではなく、明確に失敗する」ようにするために存在する(
[データベーススキーマ § 理由を知っておく価値のあるインデックス](/ja/development/database-schema#知っておく価値のあるインデックス)
を参照)。すでに別のプロファイルに割り当てられているユニットを再割り当てしようとすると完全に
拒否される。現在のテナントからユニットを黙って移動させることはない。ユニットを現在のプロファイル
から先に解放することが、それを他の場所に割り当て可能にする方法である。
:::

## このタブからのワンクリックバックアップ

[バックアップ](/ja/development/webui/admin-console/backups) フローへのショートカットである。
レンタルタブを離れることなく、選択したプロファイルのプロファイルスコープのアーカイブを作成する。
そこで説明されているのと同じアーカイブ、すなわちプロファイルが所有するすべてを生成し、その
メンバーであるオペレーターアカウントは決して含めない。

## 関連

- [メッセージ仕様: HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api): `GET/POST /admin/api/profiles`、`GET/PATCH/DELETE /admin/api/profiles/:id`、`POST/DELETE /admin/api/profiles/:id/members`、`POST/DELETE /admin/api/profiles/:id/units`。
- [概要](/ja/development/webui/admin-console/overview): 5タブのシェル、admin と superadmin のロール、アカウントメニュー。
- [オペレーター](/ja/development/webui/admin-console/operators): オペレーターアカウントの登録、検索、停止/再有効化、パスワードリセット。
- [ユニット](/ja/development/webui/admin-console/units): このタブが割り当てるユニットの登録、名前変更、削除。
- [バックアップ](/ja/development/webui/admin-console/backups): このタブのショートカットが導く完全なアーカイブと復元フロー。
- [ROS連携](/ja/development/webui/admin-console/ros-integration): 管理者のアクションがロボットとユニットリレーコンテナに到達する仕組み。
- [アーキテクチャ](/ja/development/architecture): システム全体の構造と2マシンモデル。
- [データベーススキーマ](/ja/development/database-schema): `rental_profiles`、`profile_members`、`profile_units` の完全なスキーマリファレンス。
- [ユニットコンテナライフサイクル](/ja/development/unit-container-lifecycle): `unit_manager.js` とユニットリレーの単独リファレンス。
- [バックアップ、リストア、データ移行](/ja/development/backup-and-restore): アーカイブ形式と REST 操作の単独リファレンス。
