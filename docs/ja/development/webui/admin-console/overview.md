---
outline: deep
search: false
---

# 管理コンソール

<RoleBadge role="developer" />

MSD700 のバックオフィス側であり、Accounts & Access で説明されている別の
[管理者ログイン](/ja/development/webui/accounts/overview#管理者ログイン-admin) からアクセスする。
5つのタブを持つシェル（`admin/dashboard.tsx`、`src/components/admin/` 以下にタブごとの
`*Panel.tsx` コンポーネント）で、1台のロボットを操縦するのではなくフリート全体を運用するスタッフ
向けである。このページでは、シェル自体、そこにサービスされる2つの管理者ロール、すべてのタブで
共有されるアカウントメニューを紹介する。各タブにはそれぞれ独自のページがある:
[オペレーター](/ja/development/webui/admin-console/operators)、
[ユニット & フリート](/ja/development/webui/admin-console/units-and-fleet)、
[レンタル](/ja/development/webui/admin-console/rentals)、
[バックアップ](/ja/development/webui/admin-console/backups)。コンソールのアクションを、その下に
あるロボットとコンテナフリートに結び付けているのが
[ROS連携](/ja/development/webui/admin-console/ros-integration) である。

## 5つのタブ

| タブ | コンポーネント | 表示対象 | 管理対象 |
| --- | --- | --- | --- |
| オペレーター | `UsersPanel.tsx` | admin, superadmin | `users`: ログインしてロボットを操縦するアカウント |
| ユニット | `UnitsPanel.tsx` | admin, superadmin | `units`: 存在する物理ロボット、フリートと保留中 |
| レンタル | `ProfilesPanel.tsx` | admin, superadmin | `rental_profiles`: ユニットが誰にレンタルされているか |
| バックアップ | `BackupsPanel.tsx` | admin, superadmin | レンタルプロファイル全体のアーカイブ |
| 管理者 | `AdminsPanel.tsx` | superadmin のみ | `admin_accounts`: バックオフィススタッフ自身 |

最初の4つのタブは*オペレーター向け*のフリート、すなわち操縦する人、操縦されるロボット、両者を
つなぐレンタル関係を管理する。5番目のタブはコンソール自身のオペレーターを管理する。この非対称性
は意図的なものであり見落としではない。管理者は、他のバックオフィスアカウントを作成したり削除
したりすることは一切できないまま、テナントとロボットを日常的に運用するために必要なことをすべて
行える。

## 両側で強制される2つの管理者ロール

`admin_accounts.role` は `admin` または `superadmin` のいずれかである（
[データベーススキーマ § アイデンティティとアクセス](/ja/development/database-schema#識別とアクセス)
を参照）。管理者タブは、単に一般の `admin` に対してスタイルで隠されているだけではない。タブ一覧
から完全に省かれており、そこで公開されるアクションもサーバー側で同様にゲートされている。

::: warning 管理者タブは UI 上の便宜であり、セキュリティ境界ではない
一般の `admin` に対してタブを隠すことは、タブがクリックされるのを止めるだけであり、実際にアクション
を止めているものではない。superadmin 専用ルールを実際に強制しているのはサーバー側のチェックであり、
それは `admin_accounts` が1つの共有テーブル上のロールフラグではなく `users` から完全に分離された
テーブルとして保たれているのと同じ理由による（
[Accounts & Access § オペレーターアカウントと管理者アカウントは別々のシステムである](/ja/development/webui/accounts/overview#オペレーターアカウントと管理者アカウントは別系統のシステム)
を参照）。UI を迂回して一般の管理者が管理者タブのアクションに直接アクセスした場合、ボタンが見え
ないだけでなく、バックエンドによって拒否されることが期待される。
:::

## 3つのアイデンティティ空間、3つのタブ

このコンソールは、3つの問いを意図的に分離して保っており、それぞれ独自のタブと独自のテーブルを
持つ。

- **そもそも誰が操縦できるか**：オペレーターアカウント。
  [オペレーター](/ja/development/webui/admin-console/operators) で管理される。
- **どのロボットが存在するか**：ユニットの行。
  [ユニット & フリート](/ja/development/webui/admin-console/units-and-fleet) で管理される。
- **誰がどのロボットをレンタルしているか**：レンタルプロファイルとその割り当て。
  [レンタル](/ja/development/webui/admin-console/rentals) で管理される。

オペレーターアカウントを作成しただけでは何のアクセスも付与されず、ユニットを登録しただけでも
誰もそれを操縦できるようにはならない。両者は、オペレーターをメンバーとして、ユニットを割り当て
として持つレンタルプロファイルがそれらを接続して初めて意味を持つ。この接続のそれぞれの側の仕組み
については [ユニット & フリート](/ja/development/webui/admin-console/units-and-fleet) と
[レンタル](/ja/development/webui/admin-console/rentals) を参照。

## 管理者タブ（superadmin のみ）

`AdminsPanel.tsx` は `admin_accounts` テーブルを直接管理する。一般の `admin` が決して目にすることの
ない唯一のタブである。

- バックオフィス管理者アカウントの**作成**。ロール（`admin` または `superadmin`）を選択する。
- 管理者アカウントの**停止 / 再有効化**。
- 管理者のパスワードの**リセット**。
- 管理者アカウントの**削除**。

オペレーターアカウント（[オペレーター](/ja/development/webui/admin-console/operators) を参照）とは
異なり、管理者アカウントは完全に削除できる。オペレーターのマップ、ルート、エリア、プレイリストが
`users` にぶら下がっているのとは違い、`admin_accounts` にぶら下がっているものはスキーマ上何もない。
管理者による `rental_profiles`、`units`、`profile_backups`、`pending_units`、
`unit_enrollment_codes` への `created_by` / `modified_by` のスタンプは帰属情報にすぎないため、
アカウントを削除しても、それが触れたものを孤立させたり破壊したりすることはない（
[データベーススキーマ § 外部キー一覧](/ja/development/database-schema#外部キー、完全版) を参照）。

## アカウントメニュー

`AccountMenu.tsx` はヘッダーに配置され、一般・superadmin を問わずログイン中のすべての管理者が利用
できる。ログイン中の管理者自身のアイデンティティのみにスコープされ、他のアカウントには決して及ば
ない。以下の3つをカバーする。

- ログイン中の管理者自身のアイデンティティ(ユーザー名、ロール)を確認する。
- その管理者自身のプロファイル(ユーザー名、フルネーム)を編集する。
- 自分自身のパスワード変更画面へ移動する。これは
  [Accounts & Access § 管理者のパスワード変更](/ja/development/webui/accounts/overview#管理者パスワード変更-admin-change-password)
  で説明されているのと同じ任意のモードである。

*他の*アカウントのパスワードをリセットするのは、タブ固有の別のアクションである。同じバックオフィス
アカウントに対しては上記の管理者タブ、オペレーターアカウントに対しては
[オペレーター](/ja/development/webui/admin-console/operators) を使う。このメニューから到達できる
ものではない。

## 関連

- [オペレーター](/ja/development/webui/admin-console/operators): オペレーターアカウントの登録、検索、停止/再有効化、パスワードリセット。
- [ユニット & フリート](/ja/development/webui/admin-console/units-and-fleet): ロボット一覧の Fleet と Pending のサブビュー。
- [レンタル](/ja/development/webui/admin-console/rentals): レンタルプロファイルの CRUD、メンバーシップ、ユニット割り当て。
- [バックアップ](/ja/development/webui/admin-console/backups): レンタルプロファイル全体のアーカイブと復元。
- [ROS連携](/ja/development/webui/admin-console/ros-integration): これらのアクションがロボットとコンテナフリートに到達する仕組み。
- [アーキテクチャ](/ja/development/architecture): システム全体の構造と2マシンモデル。
- [データベーススキーマ](/ja/development/database-schema): すべてのタブの背後にある完全なスキーマリファレンス。
- [ユニットコンテナライフサイクル](/ja/development/unit-container-lifecycle): `unit_manager.js` とフリートリレーの単独リファレンス。
- [バックアップ、リストア、データ移行](/ja/development/backup-and-restore): アーカイブ形式と REST 操作の単独リファレンス。
