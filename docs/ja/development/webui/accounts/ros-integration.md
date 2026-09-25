---
outline: deep
search: false
---

# アカウント & アクセス: ROS連携

<RoleBadge role="developer" />

Accounts & Accessの画面群と物理ロボットとの境界: 登録プロトコルが発行したトークンが実際にどのようにロ
ボットホストへ届くか、そしてロボット自身が二人のオペレーターに同時に操縦されることからどう自分を守るか
について説明する。この一連の流れの起点となる画面については[概要](/ja/development/webui/accounts/overview)
を、nonceハンドシェイクの全体像については[ハードウェア登録](/ja/development/webui/accounts/enrolment)
を、トークンと信頼ドメインの仕組みについては
[セキュリティ & トークン](/ja/development/webui/accounts/security-and-tokens)を参照のこと。

## 登録からロボットホストまで

nonceプロトコルのロボット側は、ロボットのJetson SBC上で動作する `enroll.py` によって実装されている。
それはnonceを生成し、[ハードウェア登録](/ja/development/webui/accounts/enrolment)で説明した
`POST /enroll/claim` と `POST /enroll/status` の呼び出しを行い、成功するとその結果をロボットホストのデ
ィスクに書き込む。

- `Certificates/robot/device.json` (モード `0600`): クラウド登録サービスが発行したデバイスシークレット。
- `Certificates/robot/token.cred`: オンボードのトークンキャッシュ。そのデバイスシークレットから発行さ
  れる、TTL12時間のトークンで、HiveMQとクラウドメディアサーバーへの認証に使われる。

これらの認証情報は、[セキュリティ & トークン](/ja/development/webui/accounts/security-and-tokens)で説
明した**Robot Cloud Domain**に属するものであり、このロボットに割り当てられたユニットULIDに厳密に限定
され、オペレーター向けの `/api/*` ルートでは決して有効にならない。ロボットは自身のローカルネットワー
ク上でも、これらのクラウドの秘密情報から分離された、別立ての**Unit Local Domain**キーリングを保持して
おり、ロボットがクラウドにまったく到達できない場合でも、ローカルLANでの運用が引き続き機能するようにな
っている。

## 運用リースのセキュリティ: 複数オペレーターによる乗っ取りの防止

同時に存在する複数のユーザーやブラウザタブからの相反する命令を防ぐため、モーター駆動へのアクセスは、
物理ロボット上のメモリに保持される**排他的な運用リース**によって管理されている。

![運用リースのセキュリティ: 複数オペレーターによる乗っ取りの防止](../../../../development/webui/accounts/diagrams/ros-integration-operating-lease-security-preventing-mult.drawio)

- **ハートビートの有効期限**: リースの有効期間は15秒で、定期的なpingによって更新されなければならない。
- **アカウントとセッションの分離**:
  - `in_use`: 別のユーザーアカウントがリースを保持している場合、コマンドの実行はブロックされる。
  - `origin_conflict`: 同じユーザーアカウントが二つ目のタブを開いた場合、またはクラウドネットワークか
    らローカルネットワークへ切り替えた場合、UIはアクティブなタブを黙って中断させるのではなく、明示的な
    乗っ取りを促す。

リースそのものはロボット上で完全に強制される。`system_command.py` がそれをメモリ上に保持し、コマンド
を実行するかどうかを決める唯一の存在である。ダッシュボードの役割は、セッションとpingのUXを通じてこれ
を駆動することに限られる。ハートビートを送り、乗っ取りプロンプトを表示するのみで、リース自体を保持し
たり調停したりはしない。このリースを中心にロボットが実行するステートマシンの全体像については、
[State & Behavior](/ja/development/state-and-behavior)を参照のこと。

## 関連項目

- [概要](/ja/development/webui/accounts/overview): Accounts & Accessの4画面とその関係。
- [セキュリティ & トークン](/ja/development/webui/accounts/security-and-tokens): JWTキーリング、信頼ド
  メイン、TLS終端。
- [ハードウェア登録](/ja/development/webui/accounts/enrolment): ロボットが自身を登録する際に使うnonce
  プロトコル。
- [アーキテクチャ](/ja/development/architecture): プラットフォーム全体のトポロジーと信頼ドメイン。
- [State & Behavior](/ja/development/state-and-behavior): リースの強制を含む、ロボット側のステートマシン。
