---
outline: deep
search: false
---

# コミッショニングチェックリスト(新規ユニット)

<RoleBadge role="technician" />

1台の新規ロボットのエンドツーエンド受け入れです。開梱からサインオフまで。方法はリンク先ページに従い、各ボックスは記載の合格基準でチェックします。全ボックス合格までそのユニットは**コミッショニング完了ではありません**。

## 1. ホスト準備

- [ ] `setup.sh` 実行(Docker、グループ、xhost)。合格: `--check` がクリーン。
- [ ] Velodyneリンク(`--configure-lidar`、`192.168.103.231` 到達可)。合格: pingに応答。
- [ ] 有線コンソールから `setup.sh --provision-network`、ホットスポット+クライアントを `/etc/hostapd/*.conf` (0600)に保存、隠しパスワードを2回入力。合格: SSIDが放送される。

[ユニット構築](/ja/setup/unit-setup)参照。

## 2. ビルドと起動

- [ ] `docker/.env` 確認(Velodyne IPがlaunchファイルと一致、`AP_SSID`、8文字以上の `AP_PASSWORD`)。合格: 要所に `change_me` が残っていない。
- [ ] `docker-manager.sh build` の後に `up`。合格: `status` でコンテナ起動、ビルドエラーなし。
- [ ] 初回起動でCLAIM CODEが表示され、Pendingで採用/登録する。合格: ユニットがULIDで表示され、pending行の重複なし。

[ユニット構築](/ja/setup/unit-setup)、[Dockerリファレンス § ユニット `docker-manager.sh`](/ja/setup/docker-reference#ユニット-docker-manager-sh)参照。

## 3. Identityとネットワーク

- [ ] `Certificates/robot/device.json` + `token.cred` が存在し、モード0600。合格: `token_refresh` ログに6時間ごとの更新があり、再登録ループなし。
- [ ] ホットスポットがオペレーター向けに提供され、クライアント上りが参加済み。合格: オペレーターPCにSSIDが見えてユニットダッシュボードに届き、ユニットからクラウドバックエンドに届く。
- [ ] `msd700.service` が正しいフラグで導入済み(`--dev`/`--simulator` 保持)。合格: `print-autostart-unit` に期待の `ExecStart` が表示される。

[WiFiホットスポット](/ja/setup/wifi-hotspot)、[ハードウェア登録](/ja/development/webui/accounts/enrolment)参照。

## 4. ロボットスタック

- [ ] `tmux attach -t robot_services`: `roscore`、`ros_webui`、`camera_client`、`switch_mode`、`log_janitor`、`token_refresh` が全て生存。合格: 5分時点で死んだウィンドウなし。
- [ ] `ros_doctor.sh` がクリーン。合格: `OK master answers`、スタック刻印あり、rosbridgeがlisten、外部ノードなし。
- [ ] `curl http://localhost:5002/local/status` に応答。合格: 当該ユニットのステータスでHTTP 200。

[Dockerリファレンス § ユニット `run_msd.sh`](/ja/setup/docker-reference#ユニット-run-msd-sh)参照。

## 5. 機能

- [ ] 手動運転(テレオペ)で5 m往復。合格: 戻り、ライブリンクでウォッチドッグ停止なし。
- [ ] 部屋をマッピングし、停止、保存。合格: 当該ユニットのULIDでクラウドDatabaseにマップ表示。
- [ ] そのマップ上のピンへナビゲーション。合格: ゴール受理され到達。
- [ ] クラウドダッシュボードとユニットローカルダッシュボードの両方でカメラがライブ。合格: 両方で映像あり、15秒スタールループなし。
- [ ] 1ポリゴンのAutopilotカバレッジ。合格: スイープ完了、タブ再開後もスナップショット残存。

オペレーター操作は[ユーザーガイド](/ja/user-guide/)参照。

## 6. サインオフ

- [ ] `docker/.env` をユニット外にバックアップ(ホスト固有であり、git追跡は `.env.example` のみ)。
- [ ] 管理コンソールでユニット行、名前、レンタル割当を確認。
- [ ] 日付、技術者、ユニットULID、ソフトウェアバージョンを記録。

失敗はtmuxウィンドウとログファイルを添えて[セットアップのトラブル対処](/ja/setup/troubleshooting)へ。
