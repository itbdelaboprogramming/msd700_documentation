---
outline: deep
search: false
---

# 管理コンソール: ユニット

<RoleBadge role="developer" />

ユニットタブ（`UnitsPanel.tsx`）は、管理者が `units` を管理する場所である。`units` は、
[データベーススキーマ § アイデンティティとアクセス](/ja/development/database-schema#識別とアクセス)
で説明されている、物理ロボット1台につき1行のテーブルだ。**登録済みユニット** と **Pending** の2つのサブビュー
があり、加えて保留中ロボット数のライブバッジがある。このページでは各ビューが何を行うか、そして
ソース資料が裏付ける限りにおいて、あるアクションが実際に変更している
[ユニットコンテナライフサイクル](/ja/development/unit-container-lifecycle) や
[データベーススキーマ](/ja/development/database-schema) のバックエンドメカニズムを正確に説明する。
登録済みユニットが誰にでも操縦可能になる仕組みについては
[レンタル](/ja/development/webui/admin-console/rentals) を、これらのアクションの背後にある
エンロールメントプロトコルとコンテナオーケストレーションをさらに深く知るには
[ROS連携](/ja/development/webui/admin-console/ros-integration) を参照。

::: info ユニットを登録しても操縦アクセスは付与されない
`units` の1行は、そのロボットがユニットとして登録されていることのみを意味する。誰かがそれを操縦できるか
どうかは、そのユニットがどのレンタルプロファイル（もしあれば）に割り当てられているかによって、
完全に [レンタル](/ja/development/webui/admin-console/rentals) タブ上で決定される。
[データベーススキーマ § アイデンティティとアクセス](/ja/development/database-schema#識別とアクセス)
の `profile_units` を参照。
:::

## 登録済みユニット ビュー

### ユニットを手動で登録する

物理ロボットがクラウドに接続するよりも前に、`units` の行を直接作成する(新しい ULID と
`unit_name`)。これは、
[データベーススキーマ § エンロールメント](/ja/development/database-schema#登録) で説明
されている `unit_enrollment_codes` テーブルの管理者側の対になるものである。「ロボットが存在する
より前に特定のユニットをクレームするための使い捨てバウチャー」だ。手動で登録されたユニットは、
まさにその種のユニットである。ロボットが後でクレームするプレースホルダーのアイデンティティであり、
以下の Pending ビューですでに自身の存在を通知したものではない。

**メッセージ仕様:** `POST /admin/api/units`。[HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api) を参照。

### ユニットの名前を変更する

`unit_name` のみを編集する。
[データベーススキーマ § アイデンティティとアクセス](/ja/development/database-schema#識別とアクセス)
によれば、`unit_name` は「名前変更可能な表示ラベルであり、アイデンティティではない」。その行の
`id`(ULID)こそが、あらゆる ROS トピックと MQTT サブスクリプション上でのロボットの実際のアドレス
（`/unit_<id>/...`）である。ユニットの名前を変更しても、ルーティング、ユニットリレーのロスター、
ロボットが発行するどのトピックについても何も変わらない。

**メッセージ仕様:** `PATCH /admin/api/units/:id` (`unit_name`)。[HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api) を参照。

### ユニットを削除する

`units` の行を削除する。この変更がまだ実行中のシステムに反映されていない可能性を明示的に認識
した確認によってゲートされる。その古さは実在するものであり、防御的な UI 文言ではない。ユニット
リレーはロスターをメモリに保持し、`FLEET_ROSTER_POLL_MS`(デフォルト 60秒)ごとのポーリング時
にのみ `units` テーブルを再読み込みする。詳細は
[ユニットコンテナライフサイクル § ロスターはデータベースに由来する](/ja/development/unit-container-lifecycle#ロスターはデータベースから来る)
を参照。削除は、もともとリコンサイラーが捕捉するために構築されたエンロールメントエンドポイントを
経由せずにロスターが変化する方法の1つとして、そこで明示的に言及されている。

> エンロールメントエンドポイントにフックするのではなくポーリングするのは、エンロールメントが
> テーブルが変化する唯一の方法ではないからである。削除、プロファイルの復元、あるいは管理者が
> 手動で行を修正することも、すべてこれに該当する。

したがって、削除されたユニットのリレーサブスクリプションはクリックされた瞬間に消えるわけでは
なく、1ポーリング間隔以内に期限切れになる。これが確認ダイアログの古さに関する文言が警告している
ことである。`units` の外部キー(
[データベーススキーマ § 外部キー一覧](/ja/development/database-schema#外部キー、完全版))
に従い、その行を削除するとレンタル割り当て(`profile_units`)とデバイスバインディング
(`unit_devices`)、および記録済みマップへもカスケードする。ユニットのマップに具体的に何が
起こるかについては [データベース](/ja/development/webui/database/ros-integration) を参照。
ここでは対象外である。

**メッセージ仕様:** `DELETE /admin/api/units/:id`。[HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api) を参照。

### このユニットのレンタルスコープデータをバックアップする

**ユニットスコープ**のアーカイブ(`scope: 'unit'`)を作成する。これは
[バックアップとリストア](/ja/development/backup-and-restore#_2軸バックアップアーキテクチャ)
のデュアルスコープバックアップアーキテクチャの2番目の軸である。「特定の物理ロボットによって
記録された運用履歴の完全な記録」を「キャプチャ」する。`maps_data` はそれを記録したユニットでは
なくレンタルプロファイルに固定されているため(
[データベーススキーマ § 運用データ(マップごと)](/ja/development/database-schema#運用データ-マップごと)
を参照)、「このユニットのデータ」とは実質的に、そのユニットが現在割り当てられているレンタルに
属するデータを意味する。同じ出典によれば、このスコープの典型的な用途は「工場でのハードウェア
サービスやリファービッシュの前にロボットをアーカイブすること」である。

**メッセージ仕様:** `{ profile_id }` または `{ all_profiles: true }` を付けた `POST /admin/api/units/:id/backups`。[HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api) を参照。

### 2つのユニット間でデータを入れ替える

上で定義したのと同じ「特定の物理ロボットによって記録された運用履歴の完全な記録」であるユニット
スコープのデータセットを、アーカイブに持ち出すのではなく、既存の2つのユニット間で交換する。これは
[バックアップ](/ja/development/webui/admin-console/backups)で説明されているバックアップと
リストア操作の双方向版である。ロボット自身の履歴は、稼働中のシステムを離れることなく、別のユニット
アイデンティティへと移動する。

**メッセージ仕様:** `target_unit_id` とレンタルスコープを付けた `POST /admin/api/units/:id/swap`。[HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api) を参照。

### ユニット/レンタルの全データを消去する

2つのスコープのいずれかで保持されているマップ、ルート、エリア、プレイリストを消去する。特定の
ユニットがこれまでに記録したすべて、あるいは特定のレンタルがそのユニット上で所有するすべての
いずれかである。これはバックアップで使われているプロファイル対ユニットのスコープ分割を反映して
おり(
[バックアップとリストア § デュアルスコープバックアップアーキテクチャ](/ja/development/backup-and-restore#_2軸バックアップアーキテクチャ)
を参照)、アーカイブではなく削除として適用される。

**メッセージ仕様:** レンタルスコープを付けた `DELETE /admin/api/units/:id/data`。[HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api) を参照。

### 別の登録済みロボットへユニットデータを転送する

これは、デュアルスコープの表に直接記載されているプロファイルスコープバックアップの正規の
ユースケースである。「顧客のマップとルートを交換用ロボットへ移行する」ことだ。**プロファイル**
スコープのリストアは追加的であり、失われたロボットを再マッピングできるため(
[バックアップ](/ja/development/webui/admin-console/backups) を参照)、テナントのデータを別の
物理ユニットへ転送することは、プロファイルのバックアップとリストアと同じ基盤メカニズムであり、
2段階のエクスポート/インポートではなく、ここでは直接的なアクションとして提供されている。

**メッセージ仕様:** `target_unit_id` と `profile_id` または `all_profiles` を付けた `POST /admin/api/units/:id/transfer`。[HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api) を参照。

### ユニットのエンロール済みデバイスのバインドを解除する

そのユニットの稼働中の `unit_devices` バインディングを削除し、再エンロールメントを強制する。
これによってロボット側で何が壊れるか、そしてなぜロボットが後で古いアイデンティティを黙って
回復できないのかについては
[ROS連携 § ユニットのエンロールメントとバインド解除](/ja/development/webui/admin-console/ros-integration#ユニットのエンロールメントとバインド解除)
を参照。

**メッセージ仕様:** `DELETE /admin/api/units/:id/device`。[HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api) を参照。

## Pending ビュー

nonce プロトコルの「hello」段階(`POST /enroll/claim`)を完了したが、まだ `units` の行として
クレームされていないロボットは `pending_units`(
[データベーススキーマ § エンロールメント](/ja/development/database-schema#登録))に存在し、
`status` は `pending`、`approved`、`claimed`、`rejected` のいずれかである。Pending タブの
隣にあるバッジ数は、現在 `pending` にある行の数である。ロボットがこのテーブルに到達するまでに
経る完全な3段階のハンドシェイクは
[ハードウェアエンロールメント § 暗号学的ハードウェアエンロールメント(nonce プロトコル)](/ja/development/webui/accounts/enrolment#暗号によるハードウェア登録-nonceプロトコル)
で文書化されている。このページでは、行がここに存在するようになった後に管理者が何を行うかのみを
扱う。

- **全く新しいユニットとして登録**: pending のロボットを、そのための新しい `units` 行を作成
  することで承認する。これは nonce プロトコルの管理者認可段階であり、誰も見たことのない
  ハードウェアのハンドシェイクを完了させるものだ。
- **既存のユニットレコードに採用**: pending のロボットを新規作成するのではなく*既存の*
  `units` 行に承認する。これは、ハードウェアが下で変わったユニットを説明するために
  [ハードウェアエンロールメント § セルフヒールリカバリー](/ja/development/webui/accounts/enrolment#self-heal復旧-承認をやり直さずに失われたdevice-jsonを復旧する)
  で使われているのと同じ「別のユニットに...採用された」という表現である。これは、交換用
  ハードウェアが新しいロボットとして最初からやり直すのではなく、ユニットの既存の履歴、レンタル
  割り当て、マップを保持する方法である。
- **拒否**: `status` を `rejected` に設定し、それ以上先へは進まない。

**メッセージ仕様:** `GET /admin/api/pending-units`、`POST /admin/api/pending-units/:id/register` (`unit_name`) または `/adopt` (`unit_id`)、`DELETE /admin/api/pending-units/:id`。ハンドシェイクのロボット側: [ファームウェア & エンロール § エンロール](/ja/development/message-contracts/firmware-and-enrolment#enrolment)。[HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api) を参照。

## 関連

- [メッセージ仕様: HTTP API § 管理 API](/ja/development/message-contracts/http-api#admin-api): このタブが呼ぶ全エンドポイント。
- [概要](/ja/development/webui/admin-console/overview): 5タブのシェル、admin と superadmin のロール、アカウントメニュー。
- [オペレーター](/ja/development/webui/admin-console/operators): オペレーターアカウントの登録、検索、停止/再有効化、パスワードリセット。
- [レンタル](/ja/development/webui/admin-console/rentals): 登録済みユニットが実際に誰にレンタルされているか、そして誰がそれを操縦できるか。
- [バックアップ](/ja/development/webui/admin-console/backups): レンタルプロファイル全体のアーカイブと復元。
- [ROS連携](/ja/development/webui/admin-console/ros-integration): このタブの背後にあるエンロールメントの仕組みとコンテナオーケストレーション。
- [アーキテクチャ](/ja/development/architecture): システム全体の構造と2マシンモデル。
- [データベーススキーマ](/ja/development/database-schema): `units`、`profile_units`、`unit_devices` を含む完全なスキーマリファレンス。
- [ユニットコンテナライフサイクル](/ja/development/unit-container-lifecycle): `unit_manager.js`、ロスター、ユニットリレーの単独リファレンス。
- [バックアップ、リストア、データ移行](/ja/development/backup-and-restore): アーカイブ形式と REST 操作の単独リファレンス。
