---
outline: deep
search: false
---

# ファームウェア & エンロール

<RoleBadge role="developer" />

システムの端にある 2 つの仕様です: STM32 ファームウェアと Jetson の間のシリアルリンク、そして新しいロボットが
ユニットになるための HTTPS ハンドシェイク。

## ファームウェアリンク (rosserial) {#firmware-link}

STM32H7 のファームウェア(`firmware-msd700`)は、USB シリアルリンク上の rosserial で Jetson と通信します
(プロトタイプロボットでは `/dev/stm32`)。トピックは 2 つで、どちらも `msd700_msgs` で定義されています:

| トピック | 方向 | 型 | 内容 |
| --- | --- | --- | --- |
| `/hardware_state` | STM32 → Jetson | `msd700_msgs/HardwareState` | 超音波距離 8 つ、左右モーターのパルス差分、heading/pitch/roll、加速度・ジャイロ・地磁気の 3 軸値、UWB の距離/偏差/rho/theta |
| `/hardware_command` | Jetson → STM32 | `msd700_msgs/HardwareCommand` | `movement_command`、`cam_angle_command`、`right_motor_speed`、`left_motor_speed` |

これは [`hardware`](/ja/development/message-contracts/mqtt-commands#hardware) コマンドハンドラーの下端です。
`hardware.check`、`init`、`stop` は `hardware_node` を通じてこのリンクに作用し、`/hardware_state` はオドメトリと
センサーフュージョンに使われます。詳細: [ファームウェア & ハードウェア](/ja/development/ros/firmware-and-hardware)。

## エンロール {#enrolment}

資格情報のないロボットは、`backend_node` の `/enroll` ルーターで自身を登録します。トークンは不要で、証明は
ロボットだけが知る 32 バイトの nonce です。

![ロボット登録ハンドシェイク](../../../development/message-contracts/diagrams/message-contracts-robot-enrolment-handshake.drawio)

### `POST /enroll/claim` {#enroll-claim}

```json
{
  "fingerprint": "<ハードウェア識別子の sha256 hex>",
  "nonce_hash": "<32 バイト nonce の sha256 hex>",
  "nonce": "<nonce そのもの。自己修復時のみ>",
  "hostname": "msd700-jetson",
  "mac": "aa:bb:cc:dd:ee:ff",
  "agent_version": "2.4.0",
  "bootstrap_key": "<任意>",
  "enrollment_code": "<任意の 10 文字のバウチャー>"
}
```

`fingerprint` と `nonce_hash` は 64 文字の小文字 hex でなければなりません(そうでなければ `400`)。

| 結果 | ステータス | `data` |
| --- | --- | --- |
| 新規または既知のハードウェア、管理者の対応待ち | `202` | `{ claim_code: "K7M2QP4R", status: "pending" }` |
| 有効なバウチャー(`enrollment_code`) | `200` | [資格情報](#credential) |
| 自己修復: 既に claim 済み、生の nonce が一致、紐づけが有効 | `200` | [資格情報](#credential) |
| 無効・使用済み・期限切れのバウチャー | `404` | |

### `POST /enroll/status` {#enroll-status}

ボディ `{ fingerprint, nonce, agent_version }`。管理者が [管理コンソール](/ja/development/webui/admin-console/units) で
登録または adopt するまでロボットがポーリングします。待機中は `{ claim_code, status }` 付きの `202`。承認後は、
`sha256(nonce)` が保存済みの `nonce_hash` と一致した場合だけ資格情報が渡されます。

### 資格情報 {#credential}

```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "unit_name": "Unit 01",
  "topic_root": "/unit_01JZ8P9WZ0UNIT00000000000",
  "device_secret": "<ランダム 32 バイト、一度だけ表示>",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": "12h",
  "key_id": "k2026-09"
}
```

ロボットはこれを `device.json` として保存します。クラウドは `device_secret` の bcrypt ハッシュだけを保持します。

### `POST /enroll/token` {#enroll-token}

ボディ `{ unit_id, device_secret, agent_version, reason }`。`reason` は `boot`、`refresh`、`recovery` のいずれか。
`{ unit_id, unit_name, topic_root, access_token, expires_in, key_id }` を返します。このアクセストークンは
`role: "robot"` で、ロボットが `/sync` とメディアサーバーに使います。現在の secret を提示すると、1 つ前の
secret(`secret_prev_hash`)は無効になります。

::: tip なぜ nonce か
MAC アドレスやシリアルはネットワーク上や管理コンソールで見えます。nonce は呼び出し元が要求した本人の機体で
あることを証明するので、本物のロボットの電源が切れている間に偽装 MAC が承認済みの資格情報を受け取ることは
できません。プロトコル全体、バウチャー、自己修復: [ハードウェア登録](/ja/development/webui/accounts/enrolment)。
:::

## 関連ドキュメント

- [ハードウェア登録](/ja/development/webui/accounts/enrolment): プロトコルの詳細。
- [管理コンソール: ユニット](/ja/development/webui/admin-console/units): claim を承認する Pending ビュー。
- [セキュリティと認証](/ja/development/security-and-auth): トークンの種類とキーリング。
