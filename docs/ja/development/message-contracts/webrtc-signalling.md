---
outline: deep
search: false
---

# WebRTC シグナリング

<RoleBadge role="developer" />

ライブカメラの表示は、`signalling_server`(`wss://<host>/services/signalling`、`NEXT_PUBLIC_SIGNALLING_URL`)への
WebSocket でネゴシエーションします。このサーバーはブラウザのピアとロボット上のカメラのピア(`camera_client.py`)
の間で WebRTC のネゴシエーションを中継します。ここを通るのは SDP と ICE だけで、映像は SRTP でピア間を直接
流れます(直接の経路がなければ `coturn` 経由)。

## メッセージ {#messages}

クライアントはまず認証し、その後のメッセージはすべて `target` のピアを指定し、サーバーはそのままそのピアに転送します。

| `type` | 方向 | ペイロード | 用途 |
| --- | --- | --- | --- |
| `authenticate` | クライアント → サーバー | `{ type, token }` | 最初のメッセージ。サーバーは JWT を検証し、`auth_success`(`userId` 付き)または `auth_error` を返します。 |
| `offer` | ピア → target | `{ type, target, offer }` | SDP offer |
| `answer` | ピア → target | `{ type, target, answer }` | SDP answer |
| `candidate` | ピア → target | `{ type, target, candidate }` | ICE 候補 |
| `client_ready` | ピア → target | `{ type, target, ... }` | 準備完了の合図。target に転送 |
| `ping` | クライアント → サーバー | `{ type }` | キープアライブ。サーバーは `{ type: "pong" }` を返す |
| `error` | サーバー → クライアント | `{ type, message }` | 中継または検証のエラー |
| `server_shutdown` | サーバー → 全員 | `{ type, message }` | 正常終了の通知 |

```json
{ "type": "authenticate", "token": "eyJhbGciOiJIUzI1NiIs..." }
{ "type": "offer", "target": "<カメラのピア id>", "offer": { "type": "offer", "sdp": "v=0..." } }
{ "type": "candidate", "target": "<ブラウザのピア id>", "candidate": { "candidate": "candidate:...", "sdpMid": "0", "sdpMLineIndex": 0 } }
```

カメラのピアは `offer` にロボットのカメラの映像トラックで応答します。サーバーを失ったカメラクライアントは、
最大 60 秒まで伸びるランダム化した間隔で再接続するので、1 台のクラウドシグナリングサーバーを共有する多数の
ユニットが一斉に再試行することはありません。

## 関連ドキュメント

- [カメラ: 概要](/ja/development/webui/camera/overview): ページ、デバイス、ビットレートの振る舞い。
- [カメラ: ROS 連携](/ja/development/webui/camera/ros-integration): `camera_client.py` と TURN の設定。
