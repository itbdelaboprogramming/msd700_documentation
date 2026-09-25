---
outline: deep
search: false
---

# アカウント & アクセス

<RoleBadge role="developer" />

人とロボットの間に立つ画面群: オペレーターのログインとそのユニット選択画面、オペレーターのサインアップ
フォーム、別立てになっている管理コンソールのログイン、そして管理者のパスワード変更画面。このページでは
各画面と、それらがどう関係し合っているかを紹介する。各画面が発行するトークンの背後にある暗号技術の仕組み
は[セキュリティ & トークン](/ja/development/webui/accounts/security-and-tokens)に、物理ロボットが自身の
認証情報をどのように取得するかは[ハードウェア登録](/ja/development/webui/accounts/enrolment)に、そしてそ
れらのトークンと運用リースが実際にどのようにロボットへ届くかは
[ROS連携](/ja/development/webui/accounts/ros-integration)にある。

## オペレーターログイン (`/`)

ルートページはオペレーターの入り口である。`POST /user/login` へ送信するログインフォームと、ログイン後に
どのロボットを操縦するかを選ぶユニット選択画面がある。ここには以下で説明するサインアップへの入り口も含ま
れるが、そのリンクはユニットビルドやローカルビルドでは完全に非表示になる。ユニットは自身のアカウントを持
たないため、そこで登録すべきものが何もないからだ。その一つのリンクを除けば、このページは純粋にオペレー
ターとしてログインするためのものである。

**メッセージ仕様:** [`POST /user/login`](/ja/development/message-contracts/http-api#user-login)、続いてユニット選択用の
[`GET /unit/all`](/ja/development/message-contracts/http-api#unit-list) と、各ユニットの状態を得る読み取り専用(`claim: false`)の
[`POST /api/hardware/ping`](/ja/development/message-contracts/http-api#hardware-ping)。トークンは [`POST /user/refresh`](/ja/development/message-contracts/http-api#user-refresh) で更新する。

## オペレーターサインアップ (`/signup`)

新規オペレーターアカウントのセルフ登録フォームである。ユーザー名とメールアドレスの一意性チェック、パス
ワードと確認用フィールド、アカウント作成後に表示される `ConfirmRegister` 成功ダイアログを含む。ログイン
ページのサインアップリンクと同様、この画面はローカルビルドやユニットビルドにはまったく存在しない。

::: warning サインアップだけではどのロボットへのアクセスも得られない
ここでアカウントを作成しても、作られるのは素のオペレーターIDにすぎない。それ自体では、いかなるユニット
を操縦する権限も付与されない。管理者が別途、新しいオペレーターをレンタルプロファイルに割り当てて初めて、
ロボットを見たり操作したりできるようになる。サインアップはID作成であって、認可ではない。
:::

**メッセージ仕様:** [`POST /user/check-username`、`/user/check-email`、`/user/register`](/ja/development/message-contracts/http-api#user-register)。

## 管理者ログイン (`/admin`)

`/admin` に直接アクセスすることでのみ到達できる、リストには載らない第二のログイン画面であり、ルートペ
ージで使われるオペレーター用の `/user/login` ではなく、独立した `adminLogin()` を呼び出す。これは、オペ
レーターが目にするものとは切り離された、ユニットとテナントを管理するスタッフ向けのバックオフィスの入
り口である。

**メッセージ仕様:** `POST /admin/api/login`。発行される `admin` トークンは
[`/admin/api/*`](/ja/development/message-contracts/http-api#admin-api) でのみ受け付けられる。

## 管理者パスワード変更 (`/admin/change-password`)

この画面には二つの異なるモードがある。

- **強制 (Forced)**: シードされた、またはリセットされたばかりの管理者アカウントは、管理者ダッシュボード
  に到達する前にこの画面へリダイレクトされ、パスワードを変更するまで戻る手段はない。
- **任意 (Voluntary)**: いつでもアカウントメニューから到達でき、何も変更せずに離脱するための `Back` オ
  プションがある。

## オペレーターアカウントと管理者アカウントは別系統のシステム

上記のオペレーターログインと管理者ログインは、一つのID空間に対する二つのビューではなく、まったく別個の
認証情報システムである。[セキュリティ & トークン](/ja/development/webui/accounts/security-and-tokens)で
詳述するこのプラットフォームのセキュリティモデルは、単一の共有ログインではなく、認証を独立した信頼ドメ
インへと組織化している。オペレーターログインページが認証の拠り所とするのは、クラウドバックエンドが発行
する**Operator Domain**であり、これは人間のオペレーターがWebダッシュボードにアクセスすることに明示的に
限定されている。管理者ログインは、独自の別個のアカウントストアとログイン経路(オペレーター用の
`/user/login` ではなく `adminLogin()`)から取得する。両画面はログインフォームもセッションも、互いへのリ
ダイレクト経路も共有していない。

## 関連項目

- [メッセージ仕様 § セッションとユニット一覧](/ja/development/message-contracts/#trace-session): ログイン、ping、ログアウトのメッセージ。
- [セキュリティ & トークン](/ja/development/webui/accounts/security-and-tokens): JWTキーリング、信頼ド
  メイン、TLS終端。
- [ハードウェア登録](/ja/development/webui/accounts/enrolment): ロボットが自身を登録する際に使うnonceプ
  ロトコル。
- [ROS連携](/ja/development/webui/accounts/ros-integration): トークンと運用リースがどのようにロボットへ
  届くか。
- [アーキテクチャ](/ja/development/architecture): プラットフォーム全体のトポロジーと信頼ドメイン。
- [State & Behavior](/ja/development/state-and-behavior): リースの強制を含む、ロボット側のステートマシン。
