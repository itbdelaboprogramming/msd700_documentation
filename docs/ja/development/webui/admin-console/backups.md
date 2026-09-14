---
outline: deep
search: false
---

# 管理コンソール: バックアップ

<RoleBadge role="developer" />

バックアップタブ(`BackupsPanel.tsx`)は、
[バックアップ、リストア、データ移行](/ja/development/backup-and-restore)で完全に文書化されている
アーカイブ機構に対する管理コンソールのフロントエンドであり、**レンタルプロファイル全体**の
アーカイブを扱う。ユニットタブには、同じアーキテクチャのユニットスコープ半分へのより狭い独自の
入口がある(
[ユニット & フリート § このユニットのレンタルスコープデータをバックアップする](/ja/development/webui/admin-console/units-and-fleet#backup-this-units-rental-scoped-data)
を参照)。しかしこのタブは、管理者がアーカイブを第一級オブジェクトとして管理する場所である。
作成、削除、ダウンロード、アップロード、復元だ。

## 2つのスコープ、プロファイル側の1つのタブ

[バックアップとリストア § デュアルスコープバックアップアーキテクチャ](/ja/development/backup-and-restore#dual-scope-backup-architecture)
は、`scope: 'profile'` または `scope: 'unit'` でキー付けされた2つの独立したバックアップスコープを
定義している。このタブはプロファイルスコープ側を扱う。テナント中心のアーカイブであり、「レンタル
プロファイルが所有するすべてのマップ、ルート、エリア、プレイリスト」を、そのプロファイルが使用した
あらゆるロボットにわたって捕捉し、失われたロボットを再マッピング可能な形で対象プロファイルへ追加的
に復元する。ユニットスコープ側、すなわち1台の物理ユニットがこれまでに記録したすべての履歴を扱う
ロボット中心のアーカイブは、代わりにユニットタブから到達する(上記参照)。

## プロファイルのアーカイブを作成する

[バックアップとリストア § アーカイブ構造](/ja/development/backup-and-restore#archive-structure-tar-gz)
で文書化されている構造を持つ `.tar.gz` アーカイブを生成する。すなわち `manifest.json`、スコープ
された SQL insert 文の `database_dump.sql`、そしてそれらに紐づくバイナリマップファイル(`.pgm`、
`.yaml`、`.png`)の `maps/` ディレクトリである。

::: info アーカイブに含まれるもの、含まれないもの
含まれるもの: プロファイル自体、そのユニット割り当て、そしてそれが所有するすべてのマップ、
ルート、エリア、プレイリスト、加えてそれらの行が指すマップ画像ファイル。**決して含まれないもの:
オペレーターアカウント。** マニフェストと `database_dump.sql` は個々の行に帰属のための
`created_by` ユーザー ULID をスタンプする(Backup and Restore にある同じ `manifest.json` の例では
トップレベルの `created_by` フィールドが示されている)が、それは
[データベーススキーマ § 外部キー一覧](/ja/development/database-schema#foreign-keys-in-full)
で言及されているのと同じ「帰属は決して認可ではない」というルールに従った帰属情報にすぎない。
アーカイブの復元が `users` テーブルの何かを作成、変更、削除することは決してない。
:::

## アーカイブを削除する

そのアーカイブを削除する。
[データベーススキーマ § バックアップと同期](/ja/development/database-schema#backup-and-sync)
によれば、`profile_backups` の行は、それが取られた元のプロファイルから独立している(`profile_id`
は `ON DELETE SET NULL` であり、「アーカイブはアーカイブされたものより長生きしなければならない」)。
しかしその逆は真ではない。アーカイブ自体を削除することは単にアーカイブを削除するだけであり、
それが取られた元の稼働中プロファイルには何の影響もない。

## ダウンロード / アップロード

- **ダウンロード**は
  [バックアップとリストア § アーカイブのエクスポート](/ja/development/backup-and-restore#_1-export-archive)、
  `POST /api/backup/export` に対応し、指定された `{ scope, profile_id }` に対する `.tar.gz` を
  生成してダウンロードする。
- **アップロード**は
  [バックアップとリストア § アーカイブのインポートと復元](/ja/development/backup-and-restore#_2-import-and-restore-archive)、
  `POST /api/backup/import` に対応する。アーカイブファイルと対象の `profile_id` を運ぶ
  マルチパートリクエストである。

## リストアを計画する

上記のインポート呼び出しの前段階のプレビューステップであり、対象プロファイルに何がマージされ、
何が新規作成される必要があるかを示し、何も書き込まれる前に管理者がアーカイブのテナントやロボット
を稼働中のシステムの別のものへ再マッピングできるようにする。これは、アーカイブがそれがアーカイブ
したものより長生きするように設計されているために重要である。ダンプ内で参照されている `unit_id`
は、アーカイブが復元される時点で登録済みユニットにもはや対応していない可能性がある(そのユニット
が削除された、またはアーカイブが完全に異なるフリートへ復元されようとしている)。そして「失われた
ロボットは再マッピングできる」ことこそが、デュアルスコープの表のプロファイルスコープ行が約束する
リストアの挙動そのものである。Backup and Restore で文書化されている REST API は、コミットステップ
(`POST /api/backup/import`)を単一の呼び出しとしてカバーしている。計画/プレビューステップは、
そのコミットの前に重ねられた管理コンソールの UX であり、別途文書化されたエンドポイントではない。

## リストアを実行する

::: warning リストアは常に追加的である
[バックアップとリストア § デュアルスコープバックアップアーキテクチャ](/ja/development/backup-and-restore#dual-scope-backup-architecture)
によれば、プロファイルスコープのリストアは「対象プロファイルへの追加的なリストア」であり、
インポートエンドポイント自体が「それを追加的に適用する」。リストアの実行が既存プロファイルの
データを上書きすることは決してない。最悪の場合でも、すでにそこにあるものの横に行が追加される
だけである。破壊的な「置換」モードは存在しない。
:::

バックアップが触れるテーブル(`profile_backups.scope`、同期テーブルなど)のスキーマ進化は、
[バックアップとリストア § スキーマ移行スクリプト](/ja/development/backup-and-restore#schema-migration-scripts)
にある移行スクリプトによって処理され、このタブの何かによるものではない。それらはデータベースに
対して直接実行され、`BackupsPanel.tsx` の対象外である。

## 関連

- [概要](/ja/development/webui/admin-console/overview): 5タブのシェル、admin と superadmin のロール、アカウントメニュー。
- [オペレーター](/ja/development/webui/admin-console/operators): オペレーターアカウントの登録、検索、停止/再有効化、パスワードリセット。
- [ユニット & フリート](/ja/development/webui/admin-console/units-and-fleet): Fleet ビューから到達できるユニットスコープバックアップの入口。
- [レンタル](/ja/development/webui/admin-console/rentals): このタブへのワンクリックバックアップショートカット、そしてこのアーカイブが属するプロファイル。
- [ROS連携](/ja/development/webui/admin-console/ros-integration): 管理者のアクションがロボットとコンテナフリートに到達する仕組み。
- [アーキテクチャ](/ja/development/architecture): システム全体の構造と2マシンモデル。
- [データベーススキーマ](/ja/development/database-schema): `profile_backups` を含む完全なスキーマリファレンス。
- [ユニットコンテナライフサイクル](/ja/development/unit-container-lifecycle): `unit_manager.js` とフリートリレーの単独リファレンス。
- [バックアップ、リストア、データ移行](/ja/development/backup-and-restore): このタブが基づく完全なリファレンス。
