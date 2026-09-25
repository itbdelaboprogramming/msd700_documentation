---
outline: deep
search: false
---

# メディアサーバーリファレンス

<RoleBadge role="developer" />

`media-server` はマップアセット(PGM/YAML/PNG)とルート画像を保存し、サムネイルを生成し、移行済み環境向けのレガシーIDマップを保持する。2か所で動く:クラウドの `nakayama_media` とユニットの `media_local`(`DEPLOYMENT_MODE` cloud/local、ポートは両方 `3003`)。アップロードディレクトリ `/srv/msd/media/map`、データベースは `DB_PORT`(クラウドは3307)。

## エンドポイント

注記なき限り全てJWT Bearer。エラーは一律 `{ success: false, msg }`。レート制限:一般100 req/15 min/IP、アップロード10回/15 min/IP(コード側はより広い一般上限で動く。文書値が契約である)。

| Method + path | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | Liveness (`success/msg/timestamp/version`) |
| `POST /api/media/uploadMap` | JWT | Multipart: `id, map_name, created_by, unit_id` (ULID) + 任意の `homebase_*` + ちょうど2ファイル(`.yaml/.yml` + `.pgm`)、50 MB/ファイル、合計100 MB。PGM→PNG自動変換、DB行を書込 |
| `PUT /api/media/updateMap/:id` | JWT | YAML+PGM+PNGを上書き、バックアップ+ロールバック付き原子性、所有者のみ、名前はユーザー毎一意 |
| `GET /api/media/maps` | JWT | ページ付き一覧(`user_id` クエリまたはJWT、`page=1`、`limit=10`) |
| `GET /api/media/maps/:id/download` | JWT | マップバンドルのダウンロード |
| `GET /api/media/checkMapName` | JWT | 保存前の名前可用性チェック |
| `DELETE /api/media/maps/:id` | JWT | マップ+PGM/YAML/PNG削除(`user_id` クエリまたはJWT) |
| `GET /api/media/images/:filename` | **コード上none** | PNGバイナリ配信、1年immutableキャッシュ。API文書はJWTと書くが、当該ルートに `verifyToken` なし(`Tidak perlu cek user_id dan JWT`)。マップPNGは公開物として扱うこと |
| `POST /api/media/uploadRouteImage` | JWT | 単一 `imageFile` + `id`、`<UPLOAD_DIR>/images/{id}.jpg` に保存(ログ行は `.png` と書くがファイルは `.jpg`) |
| `GET/POST/PUT/DELETE /api/legacy-id-mapper` | JWT | レガシー整数ID ↔ ULID行の参照/作成/変更/削除(`entity_type` + `legacy_int_id`/`new_ulid`) |

::: warning マップPNGは公開
`GET /api/media/images/:filename` はトークンなしで応答し、キャッシュに1年保持を指示する。マップ一覧を持つ誰にでも既に見える物以外をマップPNGに入れてはならない。
:::

## サムネイルとローカルモード

アップロード時はPGMヘッダを解析し `sharp` でPNG描画(quality 80、progressive)。失敗時はアップロードなら部分ファイルを掃除、更新ならバックアップから復元。ルート画像は `sharp` を通さない(生バッファ書込)。

ユニット上(`DEPLOYMENT_MODE=local`)ではブラウザ `Origin` を無条件信頼し `credentials: false`。クラウドは静的 `ALLOWED_ORIGINS` 一覧。他と同じキーリング(`shared/jwt_keyring`)。

## 関連ドキュメント

- [データベース](/ja/development/webui/database/overview):このAPIを読むMap DB画面。
- [マッピング: ROS連携](/ja/development/webui/mapping/ros-integration):アップロードで終わる保存経路。
- [HTTP API](/ja/development/message-contracts/http-api):バックエンドREST API(別サービス)。
