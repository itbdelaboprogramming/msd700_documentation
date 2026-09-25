---
outline: deep
search: false
---

# 管理コンソール: オペレーター

<RoleBadge role="developer" />

オペレータータブ（`UsersPanel.tsx`）は、管理者が `users` を管理する場所である。`users` とは、
[オペレーターログイン](/ja/development/webui/accounts/overview#オペレーターログイン) でログインし
ロボットを操縦するアカウントのことだ。タブのシェルとそこにアクセスできるロールについては
[概要](/ja/development/webui/admin-console/overview) を、アカウント作成後にオペレーターが実際の
ロボットへのアクセスをどう得るかについては
[レンタル](/ja/development/webui/admin-console/rentals) を参照。

## このタブが行うこと

- 新しいオペレーターアカウントの**登録**。
- オペレーターアカウントの**検索 / 一覧表示**。
- オペレーターアカウントの**停止 / 再有効化**。
- オペレーターのパスワードの**リセット**。

削除機能はない。オペレーターアカウントを完全に削除することは、このタブのどこにも意図的に用意
されていない。オペレーターのマップ、ルート、エリア、プレイリストは、同じレンタルプロファイルと
ユニット上の他のオペレーターと頻繁に共有されており、アカウントを削除するとそのデータがカスケード
的に破壊され、まだそれに依存している人々の足元から失われてしまう。もはやシステムを使うべきでない
オペレーターを締め出す唯一の方法は、アカウントを削除するのではなく停止することである。

## 停止 / 再有効化

`PATCH /admin/api/users/:id/status` が `users.status`（`active` または `suspended`）を書き込む。
[データベーススキーマ § アイデンティティとアクセス](/ja/development/database-schema#識別とアクセス)
に準拠する。

::: warning 停止は書き込まれるが、ログイン時にはまだ強制されない
`/user/login` は `users.status` を読み取らない。停止されたオペレーターの既存セッションは機能し
続け、また再ログインすることもできる。これは UI の微妙な仕様ではなく、既知の現在のギャップである。
コンソール自体がコントロールの隣に `NotYetWiredNote` を直接表示してこれを示しており、停止ボタンが
すでにアカウントをロックしているかのように示唆することはない。この2つは意図的に分離されている。
管理コンソールを立ち上げること自体によって、稼働中のデプロイメントが自身のロボットから締め出され
ることが決してないようにするためである。ログイン境界での停止の強制は、まだ完了していない別の作業
である。
:::

これは*レンタルプロファイル*の停止とは異なるメカニズムである。プロファイルの停止は、メンバー
アカウント自体はアクティブでログイン可能なままであっても、ユニットとそのデータをすべてのメンバー
のビューから即座に取り除く。その違いについては
[レンタル](/ja/development/webui/admin-console/rentals) と
[データベーススキーマ § アイデンティティとアクセス](/ja/development/database-schema#識別とアクセス)
を参照。もし今日実際にオペレーターをロボットから切り離すことが目的であれば、有効なレバーはプロ
ファイルメンバーシップまたはユニット割り当ての停止であり、オペレーターアカウント自体の停止は今の
ところ記録目的のアクションにすぎない。

## パスワードのリセット

管理者が設定した新しい値にオペレーターのパスワードをリセットする。これは、オペレーターまたは
管理者が自分自身のアカウントに対してトリガーできる自己パスワード変更フロー（
[概要 § アカウントメニュー](/ja/development/webui/admin-console/overview#アカウントメニュー) を参照）
とは別のものである。ここでは、管理者が他人のアカウントにパスワードを設定しているのであり、自分
自身のアカウントではない。

## 関連

- [メッセージ仕様: HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api): `GET/POST /admin/api/users`、`PATCH /admin/api/users/:id/status`、`PATCH /admin/api/users/:id/password`。
- [概要](/ja/development/webui/admin-console/overview): 5タブのシェル、admin と superadmin のロール、アカウントメニュー。
- [ユニット](/ja/development/webui/admin-console/units): ロボット一覧の 登録済みユニット と Pending のサブビュー。
- [レンタル](/ja/development/webui/admin-console/rentals): オペレーターアカウントが実際にロボットへのアクセスを得る場所。
- [バックアップ](/ja/development/webui/admin-console/backups): レンタルプロファイル全体のアーカイブと復元。
- [ROS連携](/ja/development/webui/admin-console/ros-integration): 管理者のアクションがロボットとユニットリレーコンテナに到達する仕組み。
- [アーキテクチャ](/ja/development/architecture): システム全体の構造と2マシンモデル。
- [データベーススキーマ](/ja/development/database-schema): `users.status` の注意点を含む完全なスキーマリファレンス。
- [ユニットコンテナライフサイクル](/ja/development/unit-container-lifecycle): `unit_manager.js` とユニットリレーの単独リファレンス。
- [バックアップ、リストア、データ移行](/ja/development/backup-and-restore): アーカイブ形式と REST 操作の単独リファレンス。
