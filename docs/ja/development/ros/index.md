---
search: false
---

# ROS: ロボットソフトウェア

<RoleBadge role="developer" />

ロボット側のROS 1 Noeticスタック、MSD700実機を動かし、センシングし、清掃させるパッケージ、アルゴリズム、制御ループ群。このセクション自体にはオペレーター向けUIはない。これらのサブシステムがダッシュボード上でオペレーターに見える機能としてどう現れるかについては、[ROS Web UI](/ja/development/webui/)を参照。

## コアロボットパッケージ

<LinkCards>
  <LinkCard icon="📦" title="ROSパッケージ一覧" details="ROS 1 NoeticのノードとLaunchファイル、Topicの完全なディレクトリ。" link="/ja/development/ros/ros-packages" />
</LinkCards>

## 知覚 & 位置推定

<LinkCards>
  <LinkCard icon="👁️" title="知覚 & ハザードスキャン" details="SLAM用/scan、コストマップ用/scan_hazard、MSD700_HAZARD_SCAN切替。" link="/ja/development/ros/perception-and-hazard-scan" />
  <LinkCard icon="📡" title="センサーフュージョン & 制御" details="Velodyne VLP-16 LiDAR、IMUフィルタリング、EKF状態推定。" link="/ja/development/ros/sensor-fusion-and-control" />
  <LinkCard icon="📐" title="座標系変換 (TF)" details="REP-103/105変換ツリー、センサーオフセット、BoundaryPublisherによる再スタンプ。" link="/ja/development/ros/tf-transforms" />
</LinkCards>

## ナビゲーション & プランニング

<LinkCards>
  <LinkCard icon="🗺️" title="コストマップ & プランナー" details="Move base、navfnグローバルプランナー、TEBローカル軌道最適化。" link="/ja/development/ros/costmaps-and-planners" />
  <LinkCard icon="🔄" title="動的モード切り替え" details="switch_mode.py、subprocessによるプロセス起動、Autopilotシーケンサー。" link="/ja/development/ros/mode-switching" />
</LinkCards>

## 網羅走行清掃アルゴリズム

<LinkCards>
  <LinkCard icon="📐" title="ブストロフェドン網羅走行" details="2種類のジオメトリモデル、セル分解、ゼロスピンアライメント。" link="/ja/development/ros/boustrophedon-and-alignment" />
</LinkCards>

## ハードウェア & ファームウェア

<LinkCards>
  <LinkCard icon="⚡" title="ファームウェア & ハードウェア" details="マイコンのシリアルリンク(/dev/stm32、57600ボー)、モーター制御、センサートピック。" link="/ja/development/ros/firmware-and-hardware" />
</LinkCards>

## シミュレーション & テスト

<LinkCards>
  <LinkCard icon="🏭" title="シミュレーション (Gazebo)" details="実寸スケールのGazeboシミュレーション、AWS Small Warehouseワールド、クリアランステスト。" link="/ja/development/ros/simulation" />
</LinkCards>
