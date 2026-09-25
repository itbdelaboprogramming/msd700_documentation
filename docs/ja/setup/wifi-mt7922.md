---
outline: deep
---

# MediaTek MT7922 Wi-Fi設定 (Tegraカーネル)

<RoleBadge role="technician" />

[WiFiホットスポット手順](/ja/setup/wifi-hotspot#セットアップの流れ)の**Step 1**です:先にオンボード無線のファームウェアを直し、戻ってホットスポットをプロビジョニングします。

MT7922は想定オンボード無線であり、必須要件ではありません。ホットスポットは先にオンボード無線の仮想APを試します。USBドングル省略前に実際のドライバーのAP+クライアント対応を確認します。旧RTL8822CEユニットも同様です。phyが1つだけでは何も証明しません。[プライマリ無線と予備ドングル](/ja/setup/wifi-hotspot#プライマリ無線と予備ドングル)参照。

Jetson (Tegra)カーネルでは`mt7921e`ドライバーが存在しますが、Ubuntuのファームウェアパッケージが圧縮`.zst`のみを運び、そのカーネルビルドが素の`.bin`を要求する場合があります。カードは検出されるが起動せず、ホットスポットは黙って予備ドングルにフォールバックします。

## 報告環境

以前のガイドからの引継ぎであり、本監査でJetson実機の再テストはしていません。リポジトリのプリフライトは`linux-firmware`導入とudev発火のみで、展開やドライバーリロードはしません。カーネル・モジュール・ファームウェアの格納形態は自機で確認してください。

| 項目 | 値 |
| --- | --- |
| OS | Ubuntu 24.04.4 LTS |
| アーキテクチャ | arm64 |
| カーネル | `6.8.12-1021-tegra` |
| Wi-Fiカード | MediaTek MT7922 |
| PCI ID | `14c3:0616` |
| ドライバー | `mt7921e` |

::: warning カーネル固有の修正であり万能ではありません
Ubuntu 24.04のカーネル`6.8.12-1021-tegra`に合致します。新カーネルはロード時に`.zst`展開済みの場合があり、その場合は本修正不要です。適用前に必ずStep 1とStep 2で症状を確認してください。
:::

## 1. ハードウェアとドライバーの確認

```bash
lspci -nnk | grep -A3 -iE 'network|wireless'
```

期待値:

```
MEDIATEK Corp. MT7922 802.11ax PCI Express Wireless Network Adapter [14c3:0616]
Kernel driver in use: mt7921e
Kernel modules: mt7921e
```

`mt7921e`が表示され動作していれば他ドライバーを入れないでください。インツリードライバーが正解です。問題(あれば)はドライバーではなくファームウェアです。

::: warning カード欠落かドライバー欠落か?
ファームウェア問題とは別の稀な故障が2つあります:

- **カードが`lspci`に全く出ない。** 装着・電源・PCIe/BSP設定を確認します。ファームウェアでは直りません。抜き差し前に電源を切ります。
- **カードは出るが`Kernel driver in use`行がない、または別ドライバー。** このカーネルにモジュールがあるか確認します:`modinfo mt7921e`。Tegraのパッケージ名は必ずしも`linux-modules-$(uname -r)`ではありません。モジュールがあるのにバインドしない場合、カーネルログとモジュールポリシーを確認します。本リポジトリにカーネル修復手順はありません。
:::

## 2. MT7922ファームウェアの確認

```bash
ls -l /lib/firmware/mediatek/ | grep -i MT7922
```

報告例ではフォルダに圧縮ファイルのみありました:

```
WIFI_RAM_CODE_MT7922_1.bin.zst
WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst
```

一方カーネルは素の名前を要求します:

```
WIFI_RAM_CODE_MT7922_1.bin
WIFI_MT7922_patch_mcu_1_1_hdr.bin
```

確認:

```bash
sudo dmesg | grep -iE 'mt792|firmware'
```

症状は次のように見えます:

```
Direct firmware load for mediatek/WIFI_RAM_CODE_MT7922_1.bin failed with error -2
Direct firmware load for mediatek/WIFI_MT7922_patch_mcu_1_1_hdr.bin failed with error -2
mt7921e ... hardware init failed
```

`error -2`は「ファイルなし」です。修正前に要求名・導入済みファイル・このカーネルのローダー対応を確認します。

::: warning フォルダ自体がない、またはファイル皆無の場合?
別の問題です:圧縮形式の問題ではなくファームウェアパッケージ未導入です:

```bash
sudo apt update
sudo apt install --reinstall linux-firmware
ls -l /lib/firmware/mediatek/ | grep -i MT7922
```

`./setup.sh --provision-network`はSTAインターフェース設定済み・不在時のみ素の`apt-get install -y linux-firmware`を試します。展開もドライバーリロードもしません。`.zst`で戻ってきたら下のStep 3〜4へ進みます。フォルダが空のまま、または導入自体が失敗する場合は`apt-cache policy linux-firmware`と`sudo apt update`を確認します。パッケージミラー破損であり、このカードの問題ではありません。
:::

## 3. `zstd`の確認

```bash
which zstd
```

なければ:

```bash
sudo apt update
sudo apt install zstd
```

## 4. `.zst`ファームウェアを`.bin`に展開

圧縮のみと確定した場合に限ります。下のコマンドは強制上書きしません。`.bin`が既存なら止めて調べます。ファームウェアパッケージ更新後は手展開コピーを確認し、古いファイルが新パッケージを隠さないようにします。

```bash
cd /lib/firmware/mediatek

sudo zstd -d WIFI_RAM_CODE_MT7922_1.bin.zst \
    -o WIFI_RAM_CODE_MT7922_1.bin

sudo zstd -d WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst \
    -o WIFI_MT7922_patch_mcu_1_1_hdr.bin
```

両形式が並ぶはずです:

```bash
ls -lh /lib/firmware/mediatek/*MT7922*
```

```
WIFI_RAM_CODE_MT7922_1.bin
WIFI_RAM_CODE_MT7922_1.bin.zst
WIFI_MT7922_patch_mcu_1_1_hdr.bin
WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst
```

::: info `.zst`ファイルは残します
削除しないでください。`.bin`コピーを横に追加するだけです。原本はパッケージ管理のために残します。
:::

## 5. ドライバーのリロード

ローカルコンソールか有線接続からのみリロードします:アンロードはその無線のクライアントとAPの両方を落とします。使用中なら強制せず、再起動が必要な場合があります。

```bash
sudo modprobe -r mt7921e
sudo modprobe mt7921e
```

その後:

```bash
sudo dmesg | grep -iE 'mt792|firmware' | tail -50
```

新しい初期化メッセージが出るはずです。古いエラーはログに残ります。タイムスタンプで比較します。成功例:

```
ASIC revision: 79220010
HW/SW Version: ...
WM Firmware Version: ...
wlP1p1s0: renamed from wlan0
```

## 6. NetworkManagerの確認

```bash
nmcli device
```

動作中の無線はWiFiデバイスとして表示されます。ネットワーク参加までは`disconnected`が正常です。ファームウェア修復だけではどこにも参加しません。ホットスポット同時使用は`iw phy <phy> info`の全出力で別途確認します。

インターフェース名は`wlP1p1s0`でなくても構いません。機種により異なります。

## 診断

![診断](./diagrams/wifi-mt7922-diagnosis.drawio)

## 次ユニット用の一括手順

圧縮のみと確定し、`.bin`コピーがまだない別マシン用です。ローカルコンソールか有線アクセスを使い、上の確認を先に適用します。全MT7922ユニットに盲目的に実行しないでください。

```bash
sudo apt update
sudo apt install zstd

cd /lib/firmware/mediatek

sudo zstd -d WIFI_RAM_CODE_MT7922_1.bin.zst \
    -o WIFI_RAM_CODE_MT7922_1.bin

sudo zstd -d WIFI_MT7922_patch_mcu_1_1_hdr.bin.zst \
    -o WIFI_MT7922_patch_mcu_1_1_hdr.bin

sudo modprobe -r mt7921e
sudo modprobe mt7921e

nmcli device
```

## 関連

- [WiFiホットスポット手順](/ja/setup/wifi-hotspot#セットアップの流れ):このページの後に続けます(プロビジョニング、検証。予備ドングルは任意)。
- [プライマリ無線と予備ドングル](/ja/setup/wifi-hotspot#プライマリ無線と予備ドングル):ドングルなし運用可否の確認。
- [トラブル対処](/ja/setup/troubleshooting):一般的な診断。
