---
outline: deep
search: false
---

# クイックスタートガイド

<RoleBadge role="user" />

本ガイドでは、MSD700ダッシュボードへのログイン、割り当てられたロボットユニットの制御権取得、マップの読み込み、最初のナビゲーションミッションの実行までの流れを説明します。

## 事前準備

開始する前に、以下を確認してください。
1. ダッシュボード上の有効なユーザーアカウントを持っていること。
2. 管理者によって、少なくとも1台のロボットがアカウントに割り当てられていること。
3. ノートPCまたはデスクトップPC上のGoogle ChromeまたはMicrosoft Edge。

---

## ステップ1: ダッシュボードにログイン

1. ブラウザを開き、`https://msd.nglobal.jp` にアクセスします。
2. ユーザー名とパスワードを入力し、**Sign In** をクリックします。

```mermaid
flowchart LR
  LOGIN["1. Sign In at msd.nglobal.jp"] --> FLEET["2. Fleet Overview Page"]
  FLEET --> SELECT["3. Select Assigned Unit"]
  SELECT --> NAV["4. Open Navigation Workspace"]
```

---

## ステップ2: ロボットユニットを選択

ログイン後、**Fleet Dashboard** にレンタルプロファイルへ割り当てられたすべてのロボットが表示されます。

| ステータスバッジ | 意味 | 実行可能な操作 |
| --- | --- | --- |
| <Badge type="tip" text="Online" /> | ロボットはアクティブで接続済み、コマンド受付可能です。 | ユニットカードをクリックしてダッシュボードを開きます。 |
| <Badge type="warning" text="In Use" /> | 他のオペレーターがアクティブに接続中です。 | 閲覧モードでユニットを開くか、制御権の引き継ぎをリクエストできます。 |
| <Badge type="danger" text="Offline" /> | ロボットの電源が切れているか、ネットワークから切断されています。 | ユニットが再接続するのを待つか、ハードウェアの電源を確認してください。 |

**Online** 状態のロボットカードをクリックすると、その制御ワークスペースに入ります。

---

## ステップ3: オペレーターワークスペースを理解する

オペレーターインターフェースは3つの主要な操作パネルに分かれています。

```mermaid
flowchart TD
  subgraph Workspace["MSD700 Operator Workspace Layout"]
    TOP["Top Header Bar<br/>Robot Status, Battery Voltage, Connection Quality, Emergency Stop"]
    LEFT["Left Panel: Map Canvas<br/>Live 2D Floorplan, Robot Icon, LiDAR Points, Planned Path"]
    RIGHT_TOP["Top Right Panel: Live Camera Feed<br/>Low-Latency Video Stream with Zoom/Pan"]
    RIGHT_BOT["Bottom Right Panel: Controls & Telemetry<br/>WASD Joystick, Mode Selector, Goal Dispatcher, Speed Sliders"]
  end
```

---

## ステップ4: マップを読み込む

1. 左パネルのヘッダーで **Select Map** ドロップダウンをクリックします。
2. リストから事前に記録済みのマップを選択します(例: `Warehouse_Floor_1`)。
3. 2D床図がキャンバスにレンダリングされ、ロボットの現在位置(方向矢印付きの青い円形アイコン)も表示されます。

::: tip 利用できるマップがない場合
ドロップダウンにマップが存在しない場合は、[マッピング](/ja/user-guide/mapping)を参照して最初のマップを作成してください。
:::

---

## ステップ5: 手動走行(テレオペレーション)

キーボードまたは画面上の仮想ジョイスティックを使ってロボットを手動で操作できます。

```mermaid
flowchart LR
  subgraph KeyboardControls["Keyboard Drive Controls"]
    W["W: Drive Forward"]
    S["S: Drive Backward"]
    A["A: Rotate Left (Counter-Clockwise)"]
    D["D: Rotate Right (Clockwise)"]
    SPACE["Spacebar: Immediate Stop"]
  end
```

### テレオペレーション操作:
- **直進速度スライダー**: 最大前進速度を調整します(デフォルト: `0.20 m/s`、範囲: `0.05`〜`0.40 m/s`)。
- **角速度スライダー**: 回転速度を調整します(デフォルト: `0.40 rad/s`)。
- **仮想ジョイスティック**: 画面上のジョイスティックハンドルをクリックし、目的の方向にドラッグします。

---

## ステップ6: ナビゲーションゴールを送信する(地点間移動)

ロボットを目標地点へ自律的に移動させるには、以下を行います。

1. キャンバスツールバーの **Navigate Goal** ボタンをクリックします。
2. マップ上で目的の目標地点をクリックします。
3. 外側にクリック&ドラッグして目標の向きの矢印を設定し、離します。
4. ロボットは衝突のないグローバル経路(青い線)を計算し、目標地点まで自律的にナビゲートします。

```mermaid
flowchart LR
  CLICK["1. Click Destination on Map"] --> PLAN["2. Robot Plans Collision-Free Path"]
  PLAN --> DRIVE["3. Robot Steers Around Obstacles"]
  DRIVE --> ARRIVE["4. Arrives at Goal with Target Heading"]
```

---

## ステップ7: 緊急停止(E-Stop)

**Emergency Stop** ボタンは、すべてのページの右上に目立つ形で配置されています。

- **E-Stopの作動**: 赤い **Emergency Stop** ボタンをクリックする(または `Escape` キーを押す)と、ロボットは即座にブレーキをかけ、すべての自律ルーチンを停止します。
- **E-Stopの解除**: 安全上の問題を解決した後、**Resume Operations** をクリックしてモーター電源を復帰させます。

---

## 次のステップ

- [ルートとカバレッジ](/ja/user-guide/routes-coverage)で体系的なエリアカバレッジの実行方法を学びましょう。
- [ロボットの動作仕様](/ja/user-guide/behavior)で安全タイマーとオートパイロットについて理解しましょう。
