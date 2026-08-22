---
outline: deep
search: false
---
# セキュリティと認証

<RoleBadge role="developer" />

このドキュメントでは、MSD700 ロボット プラットフォーム全体に実装されるセキュリティ モデル、暗号化認証メカニズム、信頼ドメインの分離、およびアクセス制御ポリシーについて詳しく説明します。

## セキュリティ アーキテクチャの概要

MSD700 は、Web フロントエンド、クラウド バックエンド、メッセージ ブローカー、および物理的な Jetson シングルボード コンピューター (SBC) 全体に多層防御を適用します。

```mermaid
flowchart TB
  subgraph Public["Public Internet Ingress"]
    HTTPS["HTTPS / WSS (:443)<br/>Apache TLS Termination"]
    MQTTS["MQTT TLS (:8883)<br/>HiveMQ CE Encrypted Ingress"]
  end

  subgraph CloudDomain["Cloud Server Trust Domain"]
    KEYRING["JWT Secret Keyring<br/>/srv/msd/secrets/jwt_keyring"]
    AUTH_MW["Express verifyToken Middleware"]
    ATTACH_MW["attachUnit Authorization Middleware"]
    MYSQL[("Central MySQL DB (:3307)<br/>Bcrypt Passwords")]
  end

  subgraph RobotDomain["Physical Robot Trust Domain (Jetson)"]
    DEV_SECRET["Device Secret (HMAC-SHA256)<br/>Certificates/robot/device.json"]
    ROBOT_TOKEN["Onboard Token Cache (12h TTL)<br/>Certificates/robot/token.cred"]
    LOCAL_KEYRING["Unit Local Keyring<br/>Isolated from Cloud Secrets"]
  end

  HTTPS --> AUTH_MW
  AUTH_MW --> ATTACH_MW
  ATTACH_MW --> MYSQL
  KEYRING -.-> AUTH_MW

  MQTTS <--> ROBOT_TOKEN
  DEV_SECRET --> ROBOT_TOKEN
  LOCAL_KEYRING -.->|"Local Auth Only"| RobotDomain
```

## 3 つの独立した信頼ドメイン

セキュリティ境界は、交換不可能な 3 つの信頼ドメインに分割されます。

|信頼ドメイン |発行者当局 |トークンの目的 |検証エンドポイント |分離ルール |
| --- | --- | --- | --- | --- |
| **オペレーター ドメイン** |クラウド サーバー バックエンド (`backend_node`) | Web ダッシュボードにアクセスする人間のオペレーターを認証します。 | `verifyToken` すべての `/api/*` ルート |ロボットが直接使用することはできません。 `/local/*` ルートで拒否されました。 |
| **ロボット クラウド ドメイン** |クラウド登録サービス (`/enroll/token`) | HiveMQ およびクラウド メディア サーバーに接続する物理ロボットを認証します。 | HiveMQ TLS + クラウド `media-server` |ロボットに割り当てられた ULID を厳密にスコープします。 12時間有効です。 |
| **ユニットローカルドメイン** |オンボード ローカル バックエンド (`backend_local`) |ローカル LAN オペレーターとオンボード ビデオ ストリーミング クライアントを認証します。 | `/local/*` エンドポイント |ローカルのオフライン主権を確保するために、クラウド トークンは厳密に拒否されます。 |

## 暗号化ハードウェア登録 (Nonce プロトコル)

未登録のロボットは、3 段階の暗号化ハンドシェイクを通じてクラウド サーバーに自身を登録します。

```mermaid
sequenceDiagram
  autonumber
  participant Robot as Physical Robot (enroll.py)
  participant Backend as Cloud Server (/enroll)
  participant Admin as Admin Web Console

  Note over Robot: Stage 1: Registration Claim
  Robot->>Robot: Generate 32 cryptographically random bytes (nonce)<br/>Compute nonce_hash = sha256(nonce)<br/>Compute fingerprint = sha256(hardware_serial)
  Robot->>Backend: POST /enroll/claim { fingerprint, nonce_hash, hostname, mac }
  Backend->>Backend: Store in pending_units table (status: pending)
  Backend-->>Robot: HTTP 202 Accepted { claim_code: "K7M2QP" }
  Note over Robot: Displays 6-character claim code on screen

  Note over Admin: Stage 2: Administrator Authorization
  Admin->>Backend: Approve claim code "K7M2QP" for Unit ULID
  Backend->>Backend: Update pending_units (status: approved)

  Note over Robot: Stage 3: Secret Handover Verification
  loop Polling /enroll/status
    Robot->>Backend: POST /enroll/status { fingerprint, nonce }
  end
  Backend->>Backend: Validate sha256(nonce) == stored nonce_hash
  Backend->>Backend: Mint device_secret (random 64-byte token)
  Backend->>Backend: Store bcrypt(device_secret) in unit_devices table
  Backend-->>Robot: HTTP 200 OK { unit_id, device_secret, initial_token }
  Robot->>Robot: Write Certificates/robot/device.json (mode 0600)
```

### 32 バイトの Nonce プロトコルが重要な理由:
- **MAC / 指紋スプーフィング保護**: ハードウェアの MAC アドレスとシリアル番号がローカル ネットワーク上にブロードキャストされ、管理コンソールに表示されます。秘密のノンスがないと、物理ロボットの電源がオフのときに、攻撃者が MAC アドレスをスプーフィングして資格情報を要求する可能性があります。
- **シングルユース検証**: 平文の nonce は、最終的な資格情報のハンドオーバー中に TLS 経由で 1 回だけ送信されます。検証されると、サーバーは保留中の nonce をクリアします。
- **生の秘密ストレージがゼロ**: クラウド データベースには、`device_secret` の `bcrypt` ハッシュのみが保存されます。データベースが完全に漏洩しても、アクティブなロボット デバイスの秘密は侵害されません。

## JWT キーリングとダウンタイムゼロのシークレットローテーション

認証トークンは、単一の静的環境変数ではなく、`/srv/msd/secrets/jwt_keyring` に保存されている **JWT キーリング** に対して検証されます。

```json
{
  "active_kid": "key_2026_08_a",
  "keys": {
    "key_2026_08_a": {
      "secret": "9a8b7c6d5e4f3a2b1c0d...",
      "created_at": "2026-08-01T00:00:00Z"
    },
    "key_2026_07_b": {
      "secret": "1f2e3d4c5b6a7f8e9d0c...",
      "created_at": "2026-07-01T00:00:00Z"
    }
  }
}
```

### キーリングのローテーション ルール:
1. **アクティブな署名キー**: 新しく作成されたすべてのアクセス トークンとリフレッシュ トークンは、`active_kid` で識別されるキーで署名されます。
2. **猶予期間の検証**: 受信トークンが到着すると、`verifyToken` はその署名を `active_kid` と照合してチェックします。検証が失敗した場合は、HTTP 401 で拒否する前に、キーリング内の以前のキーをテストします。
3. **セッション中断ゼロ**: 運用環境でシークレットをローテーションしても、すべてのアクティブなオペレーターが同時に再ログインする必要はありません。

## オペレーティング リースのセキュリティ: 複数のオペレーターによる乗っ取りの防止

同時ユーザーまたはブラウザ タブからのコマンドの競合を防ぐために、モーターの作動へのアクセスは、物理ロボットのメモリに保持されている**排他的オペレーティング リース**によって管理されます。

```mermaid
flowchart LR
  OP1["Operator 1 (Active Session)"] -->|"Heartbeat Ping (claim: true)"| ROBOT["Robot Lease Manager<br/>(system_command.py)"]
  OP2["Operator 2 (Different User)"] -.->|"Rejected: In Use"| ROBOT
  OP1_TAB2["Operator 1 (Second Tab)"] -.->|"Origin Conflict (Prompt Takeover)"| ROBOT
```

- **ハートビートの有効期限**: リースは 15 秒間有効であり、定期的な ping によって更新する必要があります。
- **アカウントとセッションの分離**:
  - `in_use`: 別のユーザー アカウントがリースを保持している場合、コマンドの実行はブロックされます。
  - `origin_conflict`: 同じユーザー アカウントが 2 番目のタブを開いたり、クラウドからローカル ネットワークに切り替えたりすると、UI はアクティブなタブをサイレントに中断するのではなく、明示的な引き継ぎを要求します。

## ネットワーク セキュリティと TLS 終端

1. **Apache リバース プロキシ**: すべての外部 HTTP、SSE、および WebSocket トラフィックは、Let's Encrypt (`/etc/letsencrypt/live/`) からの証明書を使用して、Apache ポート 443 で TLS を終了します。
2. **HiveMQ 相互トランスポート セキュリティ**: ロボットは TLS 経由でポート 8883 の HiveMQ に接続します。キーストア PKCS#12 証明書は `/srv/msd/secrets/hivemq/keystore.p12` にあります。
3. **コンテナの分離**: バックエンド コンテナは内部 Docker ブリッジ ネットワーク (`ros_backend_net`) を介して通信し、内部データベースやロスブリッジ ポートをパブリック インターネットに直接公開しません。

## 関連ドキュメント

- [アーキテクチャ](/ja/development/architecture): 完全なプラットフォーム トポロジと信頼ドメイン。
- [メッセージ コントラクト](/ja/development/message-contracts): ハードウェア登録ペイロード定義。
- [API リファレンス](/ja/development/api-reference): ユーザー認証とセッション更新のエンドポイント。