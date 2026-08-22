---
search: false
---
# 開発者向けドキュメント

<RoleBadge role="developer" />

MSD700 プラットフォームに取り組むソフトウェア エンジニア、ロボット開発者、システム アーキテクト向けの包括的な技術ドキュメント。

## アーキテクチャとコア システム

<LinkCards>
  <LinkCard icon="🏗️" title="Architecture" details="Two-machine peer model, system topology, trust domains, and seams." link="/development/architecture" />
  <LinkCard icon="🛡️" title="Security & Authentication" details="JWT keyring, 3-stage cryptographic enrolment nonce, and trust isolation." link="/development/security-and-auth" />
  <LinkCard icon="🔁" title="State and Behavior" details="Robot activities, safety watchdog tiers, Autopilot mode, and session recovery." link="/development/state-and-behavior" />
  <LinkCard icon="🗂️" title="Repository Structure" details="Codebase layout across msd700_robot, ros-web-ui, and msd700_noetic." link="/development/repository-structure" />
</LinkCards>

## ROS とロボット サブシステム

<LinkCards>
  <LinkCard icon="📦" title="ROS Package Registry" details="Complete directory of ROS 1 Noetic nodes, launch files, and topics." link="/development/ros-packages" />
  <LinkCard icon="📐" title="Coordinate Transforms (TF)" details="REP-103/105 transform tree, sensor offsets, and BoundaryPublisher restamping." link="/development/tf-transforms" />
  <LinkCard icon="📡" title="Sensor Fusion & Control" details="Velodyne VLP-16 LiDAR, IMU filtering, and EKF state estimation." link="/development/sensor-fusion-and-control" />
  <LinkCard icon="⚡" title="Firmware & Hardware" details="Microcontroller serial UART protocol, PID velocity loops, and battery telemetry." link="/development/firmware-and-hardware" />
  <LinkCard icon="🗺️" title="Costmaps & Planners" details="Move base, navfn global planner, and TEB local trajectory optimization." link="/development/costmaps-and-planners" />
  <LinkCard icon="🔄" title="Dynamic Mode Switching" details="switch_mode.py, roslaunch Python API process spawning, and Autopilot sequencer." link="/development/mode-switching" />
</LinkCards>

## ナビゲーション、カバレッジ、シミュレーション

<LinkCards>
  <LinkCard icon="📐" title="Boustrophedon Coverage" details="Dual geometry models, cellular decomposition, and zero-spin alignment." link="/development/boustrophedon-and-alignment" />
  <LinkCard icon="🏭" title="Simulation" details="True-scale Gazebo simulation, AWS Small Warehouse world, and clearance testing." link="/development/simulation" />
</LinkCards>

## 通信とインターフェース

<LinkCards>
  <LinkCard icon="📨" title="Message Contracts" details="MQTT command envelopes, feedback schemas, and ARQ ACK protocols." link="/development/message-contracts" />
  <LinkCard icon="🔌" title="API Reference" details="Exhaustive REST API endpoints, request parameters, and response bodies." link="/development/api-reference" />
  <LinkCard icon="🌐" title="rosbridge Protocol" details="WebSocket JSON streaming protocol, topic subscriptions, and canvas rendering." link="/development/rosbridge-protocol" />
  <LinkCard icon="🎨" title="Frontend Canvas & Web UI" details="EaselJS stage rendering, metric-to-pixel math, and createjs prototype patches." link="/development/frontend-canvas" />
  <LinkCard icon="📷" title="Camera Streaming" details="WebRTC video pipeline, STUN/TURN relays, and mDNS candidate filtering." link="/development/camera-streaming" />
</LinkCards>

## データ、ストレージ、クラウド同期

<LinkCards>
  <LinkCard icon="🗄️" title="Database Schema" details="MySQL 8.0 tables, uniform timestamps, and rental profile foreign keys." link="/development/database-schema" />
  <LinkCard icon="🔄" title="Data Sync" details="Offline-first database reconciliation, conflict resolution, and Local badge." link="/development/data-sync" />
  <LinkCard icon="💾" title="Backup & Migration" details="Profile and unit scoped backups, tar.gz manifests, and schema migrations." link="/development/backup-and-restore" />
</LinkCards>

## 操作と診断

<LinkCards>
  <LinkCard icon="🐳" title="Unit Container Lifecycle" details="unit_manager.js, Docker socket proxying, and idle reaper sweeps." link="/development/unit-container-lifecycle" />
  <LinkCard icon="🔧" title="Diagnostics & Troubleshooting" details="Developer failure decision trees, root cause mappings, and recovery." link="/development/troubleshooting-guide" />
  <LinkCard icon="🤝" title="Contributing Guide" details="Development workflow, commit conventions, and pull request procedures." link="/development/contributing" />
  <LinkCard icon="📝" title="Changelog" details="Historical platform changelog and release notes." link="/development/changelog" />
</LinkCards>

## 推奨される読む順序

MSD700 に新しくオンボーディングするエンジニアに推奨される基本的な進行は次のとおりです。

1. [アーキテクチャ](/ja/development/architecture): 2 マシン モデルと MQTT と rosbridge の分離を理解します。
2. [セキュリティと認証](/ja/development/security-and-auth): 3 つの信頼ドメインと暗号化デバイスの登録について学びます。
3. [ROS パッケージ レジストリ](/ja/development/ros-packages): ROS ノードとパッケージ バインディングを調べます。
4. [座標変換 (TF)](/ja/development/tf-transforms): 空間参照ツリーとクロック ドメインのリスタンプについて理解します。
5. [メッセージ コントラクト](/ja/development/message-contracts): マシンの境界を越える正確なワイヤ形式をマスターします。
6. [状態と動作](/ja/development/state-and-behavior): 有限状態マシンの遷移と安全ウォッチドッグをトレースします。
7. [API リファレンス](/ja/development/api-reference): Web コントローラーと外部クライアント コントローラーを統合します。