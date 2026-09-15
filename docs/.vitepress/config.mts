import { defineConfig } from 'vitepress'
import mathjax3 from 'markdown-it-mathjax3'

// ==================== EN SIDEBARS ====================
const enSidebar = {
  '/user-guide/': [
    {
      text: 'ROS Web UI User Guide',
      items: [
        { text: 'Overview', link: '/user-guide/' },
        { text: 'Accounts & Access', link: '/user-guide/accounts' },
        { text: 'Navigation', link: '/user-guide/navigation' },
        { text: 'Mapping', link: '/user-guide/mapping' },
        { text: 'Maps & Database', link: '/user-guide/database' },
        { text: 'Routes & Coverage', link: '/user-guide/routes-coverage' },
        { text: 'Live Camera', link: '/user-guide/camera' },
        { text: 'Admin Console', link: '/user-guide/admin-console' },
      ]
    }
  ],
  '/getting-started/': [
    {
      text: 'Getting Started',
      items: [
        { text: 'Overview', link: '/getting-started/' },
        { text: 'Introduction', link: '/getting-started/introduction' },
        { text: 'Quick Start', link: '/getting-started/quick-start' },
        { text: 'Features', link: '/getting-started/features' },
        { text: 'How the Robot Behaves', link: '/getting-started/behavior' },
      ]
    },
    {
      text: 'Help & FAQ',
      items: [
        { text: 'FAQ', link: '/getting-started/faq' },
        { text: 'Operator Troubleshooting', link: '/getting-started/troubleshooting' },
      ]
    }
  ],
  '/setup/': [
    {
      text: 'Setup & Deployment',
      items: [
        { text: 'Overview', link: '/setup/' },
        { text: 'Prerequisites & Sizing', link: '/setup/prerequisites' },
      ]
    },
    {
      text: 'Installation',
      items: [
        { text: 'Server Setup', link: '/setup/server-setup' },
        { text: 'Unit Setup', link: '/setup/unit-setup' },
        { text: 'System Integration', link: '/setup/system-setup' },
      ]
    },
    {
      text: 'Reference & Networking',
      items: [
        { text: 'Docker Reference', link: '/setup/docker-reference' },
        { text: 'WiFi Hotspot + Client', link: '/setup/wifi-hotspot' },
      ]
    },
    {
      text: 'Operations',
      items: [
        { text: 'Maintenance', link: '/setup/maintenance' },
        { text: 'Troubleshooting', link: '/setup/troubleshooting' },
      ]
    }
  ],
  '/development/': [
    {
      text: 'Start Here',
      items: [
        { text: 'Overview', link: '/development/' },
        { text: 'System Architecture', link: '/development/architecture' },
        { text: 'Repository Structure', link: '/development/repository-structure' },
        { text: 'Message Contracts (MQTT)', link: '/development/message-contracts' },
      ]
    },
    {
      text: 'ROS (Robot Software)',
      link: '/development/ros/',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/development/ros/' },
        { text: 'ROS Package Registry', link: '/development/ros/ros-packages' },
        {
          text: 'Perception & Localization',
          items: [
            { text: 'Sensor Fusion & Control', link: '/development/ros/sensor-fusion-and-control' },
            { text: 'Coordinate Transforms (TF)', link: '/development/ros/tf-transforms' },
          ]
        },
        {
          text: 'Navigation & Planning',
          items: [
            { text: 'Costmaps & Planners', link: '/development/ros/costmaps-and-planners' },
            { text: 'Dynamic Mode Switching', link: '/development/ros/mode-switching' },
            { text: 'Safety Watchdog', link: '/development/ros/safety-watchdog' },
          ]
        },
        {
          text: 'Coverage Cleaning Algorithm',
          items: [
            { text: 'Boustrophedon Coverage', link: '/development/ros/boustrophedon-and-alignment' },
          ]
        },
        {
          text: 'Hardware & Firmware',
          items: [
            { text: 'Firmware & Hardware', link: '/development/ros/firmware-and-hardware' },
          ]
        },
        {
          text: 'Simulation & Testing',
          items: [
            { text: 'Simulation (Gazebo)', link: '/development/ros/simulation' },
          ]
        }
      ]
    },
    {
      text: 'ROS Web UI (Platform)',
      link: '/development/webui/',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/development/webui/' },
        {
          text: 'Navigation',
          items: [
            { text: 'Overview', link: '/development/webui/navigation/overview' },
            { text: 'Pinpoint & Routes', link: '/development/webui/navigation/pinpoint-and-routes' },
            { text: 'Manual Override & Autopilot', link: '/development/webui/navigation/manual-and-autopilot' },
            { text: 'Map Sync & Alignment', link: '/development/webui/navigation/map-sync-and-alignment' },
            { text: 'Coverage Cleaning', link: '/development/webui/navigation/coverage-cleaning' },
            { text: 'ROS Integration', link: '/development/webui/navigation/ros-integration' },
          ]
        },
        {
          text: 'Mapping',
          items: [
            { text: 'Overview', link: '/development/webui/mapping/overview' },
            { text: 'Manual Override & Autonomous', link: '/development/webui/mapping/manual-and-autonomous' },
            { text: 'ROS Integration', link: '/development/webui/mapping/ros-integration' },
          ]
        },
        {
          text: 'Database',
          items: [
            { text: 'Overview', link: '/development/webui/database/overview' },
            { text: 'Rename & Delete', link: '/development/webui/database/rename-and-delete' },
            { text: 'ROS Integration', link: '/development/webui/database/ros-integration' },
          ]
        },
        {
          text: 'Admin Console',
          items: [
            { text: 'Overview', link: '/development/webui/admin-console/overview' },
            { text: 'Operators', link: '/development/webui/admin-console/operators' },
            { text: 'Units & Fleet', link: '/development/webui/admin-console/units-and-fleet' },
            { text: 'Rentals', link: '/development/webui/admin-console/rentals' },
            { text: 'Backups', link: '/development/webui/admin-console/backups' },
            { text: 'ROS Integration', link: '/development/webui/admin-console/ros-integration' },
          ]
        },
        {
          text: 'Accounts & Access',
          items: [
            { text: 'Overview', link: '/development/webui/accounts/overview' },
            { text: 'Security & Tokens', link: '/development/webui/accounts/security-and-tokens' },
            { text: 'Hardware Enrolment', link: '/development/webui/accounts/enrolment' },
            { text: 'ROS Integration', link: '/development/webui/accounts/ros-integration' },
          ]
        },
        {
          text: 'Camera & Live View',
          items: [
            { text: 'Overview', link: '/development/webui/camera/overview' },
            { text: 'ROS Integration', link: '/development/webui/camera/ros-integration' },
          ]
        },
        {
          text: 'Platform Reference',
          items: [
            { text: 'REST API Reference', link: '/development/api-reference' },
            { text: 'rosbridge Protocol (WS)', link: '/development/rosbridge-protocol' },
            { text: 'Frontend Canvas & Web UI', link: '/development/frontend-canvas' },
            { text: 'Database Schema', link: '/development/database-schema' },
            { text: 'Data Sync (Offline First)', link: '/development/data-sync' },
            { text: 'Backup & Restore', link: '/development/backup-and-restore' },
            { text: 'Unit Container Lifecycle', link: '/development/unit-container-lifecycle' },
          ]
        }
      ]
    },
    {
      text: 'Reference & Process',
      items: [
        { text: 'Diagnostics & Troubleshooting', link: '/development/troubleshooting-guide' },
        { text: 'Contributing Guide', link: '/development/contributing' },
        { text: 'Changelog', link: '/development/changelog' },
      ]
    }
  ]
}

// ==================== ID SIDEBARS (BAHASA INDONESIA) ====================
const idSidebar = {
  '/id/user-guide/': [
    {
      text: 'Panduan Pengguna ROS Web UI',
      items: [
        { text: 'Ikhtisar', link: '/id/user-guide/' },
        { text: 'Akun & Akses', link: '/id/user-guide/accounts' },
        { text: 'Navigasi', link: '/id/user-guide/navigation' },
        { text: 'Pemetaan', link: '/id/user-guide/mapping' },
        { text: 'Peta & Database', link: '/id/user-guide/database' },
        { text: 'Rute & Cakupan', link: '/id/user-guide/routes-coverage' },
        { text: 'Kamera Langsung', link: '/id/user-guide/camera' },
        { text: 'Konsol Admin', link: '/id/user-guide/admin-console' },
      ]
    }
  ],
  '/id/getting-started/': [
    {
      text: 'Panduan Memulai',
      items: [
        { text: 'Ikhtisar', link: '/id/getting-started/' },
        { text: 'Pengenalan Sistem', link: '/id/getting-started/introduction' },
        { text: 'Panduan Cepat', link: '/id/getting-started/quick-start' },
        { text: 'Fitur Utama', link: '/id/getting-started/features' },
        { text: 'Perilaku Robot', link: '/id/getting-started/behavior' },
      ]
    },
    {
      text: 'Bantuan & FAQ',
      items: [
        { text: 'Tanya Jawab (FAQ)', link: '/id/getting-started/faq' },
        { text: 'Pemecahan Masalah Operator', link: '/id/getting-started/troubleshooting' },
      ]
    }
  ],
  '/id/setup/': [
    {
      text: 'Penyiapan & Penerapan',
      items: [
        { text: 'Ikhtisar Penyiapan', link: '/id/setup/' },
        { text: 'Prasyarat & Spesifikasi', link: '/id/setup/prerequisites' },
      ]
    },
    {
      text: 'Instalasi',
      items: [
        { text: 'Penyiapan Server', link: '/id/setup/server-setup' },
        { text: 'Penyiapan Unit Jetson', link: '/id/setup/unit-setup' },
        { text: 'Integrasi Sistem', link: '/id/setup/system-setup' },
      ]
    },
    {
      text: 'Referensi & Jaringan',
      items: [
        { text: 'Referensi Docker', link: '/id/setup/docker-reference' },
        { text: 'Hotspot Wi-Fi & Klien', link: '/id/setup/wifi-hotspot' },
      ]
    },
    {
      text: 'Operasional',
      items: [
        { text: 'Pemeliharaan', link: '/id/setup/maintenance' },
        { text: 'Pemecahan Masalah', link: '/id/setup/troubleshooting' },
      ]
    }
  ],
  '/id/development/': [
    {
      text: 'Mulai Dari Sini',
      items: [
        { text: 'Ikhtisar', link: '/id/development/' },
        { text: 'Arsitektur Sistem', link: '/id/development/architecture' },
        { text: 'Struktur Repositori', link: '/id/development/repository-structure' },
        { text: 'Kontrak Pesan (MQTT)', link: '/id/development/message-contracts' },
      ]
    },
    {
      text: 'ROS (Perangkat Lunak Robot)',
      link: '/id/development/ros/',
      collapsed: true,
      items: [
        { text: 'Ikhtisar', link: '/id/development/ros/' },
        { text: 'Daftar Paket ROS', link: '/id/development/ros/ros-packages' },
        {
          text: 'Persepsi & Lokalisasi',
          items: [
            { text: 'Sensor Fusion & Kontrol', link: '/id/development/ros/sensor-fusion-and-control' },
            { text: 'Transformasi Koordinat (TF)', link: '/id/development/ros/tf-transforms' },
          ]
        },
        {
          text: 'Navigasi & Perencanaan',
          items: [
            { text: 'Costmap & Planner', link: '/id/development/ros/costmaps-and-planners' },
            { text: 'Pergantian Mode Dinamis', link: '/id/development/ros/mode-switching' },
            { text: 'Pengawas Keselamatan', link: '/id/development/ros/safety-watchdog' },
          ]
        },
        {
          text: 'Algoritma Pembersihan Cakupan',
          items: [
            { text: 'Cakupan Boustrophedon', link: '/id/development/ros/boustrophedon-and-alignment' },
          ]
        },
        {
          text: 'Perangkat Keras & Firmware',
          items: [
            { text: 'Firmware & Perangkat Keras', link: '/id/development/ros/firmware-and-hardware' },
          ]
        },
        {
          text: 'Simulasi & Pengujian',
          items: [
            { text: 'Simulasi (Gazebo)', link: '/id/development/ros/simulation' },
          ]
        }
      ]
    },
    {
      text: 'ROS Web UI (Platform)',
      link: '/id/development/webui/',
      collapsed: true,
      items: [
        { text: 'Ikhtisar', link: '/id/development/webui/' },
        {
          text: 'Navigasi',
          items: [
            { text: 'Ikhtisar', link: '/id/development/webui/navigation/overview' },
            { text: 'Pinpoint & Rute', link: '/id/development/webui/navigation/pinpoint-and-routes' },
            { text: 'Override Manual & Autopilot', link: '/id/development/webui/navigation/manual-and-autopilot' },
            { text: 'Sinkronisasi & Penyelarasan Peta', link: '/id/development/webui/navigation/map-sync-and-alignment' },
            { text: 'Pembersihan Cakupan', link: '/id/development/webui/navigation/coverage-cleaning' },
            { text: 'Integrasi ROS', link: '/id/development/webui/navigation/ros-integration' },
          ]
        },
        {
          text: 'Pemetaan',
          items: [
            { text: 'Ikhtisar', link: '/id/development/webui/mapping/overview' },
            { text: 'Override Manual & Otonom', link: '/id/development/webui/mapping/manual-and-autonomous' },
            { text: 'Integrasi ROS', link: '/id/development/webui/mapping/ros-integration' },
          ]
        },
        {
          text: 'Basis Data',
          items: [
            { text: 'Ikhtisar', link: '/id/development/webui/database/overview' },
            { text: 'Ganti Nama & Hapus', link: '/id/development/webui/database/rename-and-delete' },
            { text: 'Integrasi ROS', link: '/id/development/webui/database/ros-integration' },
          ]
        },
        {
          text: 'Konsol Admin',
          items: [
            { text: 'Ikhtisar', link: '/id/development/webui/admin-console/overview' },
            { text: 'Operator', link: '/id/development/webui/admin-console/operators' },
            { text: 'Unit & Armada', link: '/id/development/webui/admin-console/units-and-fleet' },
            { text: 'Penyewaan', link: '/id/development/webui/admin-console/rentals' },
            { text: 'Cadangan', link: '/id/development/webui/admin-console/backups' },
            { text: 'Integrasi ROS', link: '/id/development/webui/admin-console/ros-integration' },
          ]
        },
        {
          text: 'Akun & Akses',
          items: [
            { text: 'Ikhtisar', link: '/id/development/webui/accounts/overview' },
            { text: 'Keamanan & Token', link: '/id/development/webui/accounts/security-and-tokens' },
            { text: 'Pendaftaran Perangkat Keras', link: '/id/development/webui/accounts/enrolment' },
            { text: 'Integrasi ROS', link: '/id/development/webui/accounts/ros-integration' },
          ]
        },
        {
          text: 'Kamera & Tampilan Langsung',
          items: [
            { text: 'Ikhtisar', link: '/id/development/webui/camera/overview' },
            { text: 'Integrasi ROS', link: '/id/development/webui/camera/ros-integration' },
          ]
        },
        {
          text: 'Referensi Platform',
          items: [
            { text: 'Referensi REST API', link: '/id/development/api-reference' },
            { text: 'Protokol rosbridge (WS)', link: '/id/development/rosbridge-protocol' },
            { text: 'Canvas Frontend & Web UI', link: '/id/development/frontend-canvas' },
            { text: 'Skema Database', link: '/id/development/database-schema' },
            { text: 'Sinkronisasi Data (Offline First)', link: '/id/development/data-sync' },
            { text: 'Cadangan & Pemulihan', link: '/id/development/backup-and-restore' },
            { text: 'Siklus Hidup Kontainer Unit', link: '/id/development/unit-container-lifecycle' },
          ]
        }
      ]
    },
    {
      text: 'Referensi & Proses',
      items: [
        { text: 'Diagnostik & Troubleshooting', link: '/id/development/troubleshooting-guide' },
        { text: 'Panduan Kontribusi', link: '/id/development/contributing' },
        { text: 'Catatan Rilis (Changelog)', link: '/id/development/changelog' },
      ]
    }
  ]
}

// ==================== JA SIDEBARS (JAPANESE) ====================
const jaSidebar = {
  '/ja/user-guide/': [
    {
      text: 'ROS Web UI ユーザーガイド',
      items: [
        { text: '概要', link: '/ja/user-guide/' },
        { text: 'アカウントとアクセス', link: '/ja/user-guide/accounts' },
        { text: 'ナビゲーション', link: '/ja/user-guide/navigation' },
        { text: 'マッピング', link: '/ja/user-guide/mapping' },
        { text: 'マップとデータベース', link: '/ja/user-guide/database' },
        { text: 'ルートとカバレッジ', link: '/ja/user-guide/routes-coverage' },
        { text: 'ライブカメラ', link: '/ja/user-guide/camera' },
        { text: '管理コンソール', link: '/ja/user-guide/admin-console' },
      ]
    }
  ],
  '/ja/getting-started/': [
    {
      text: '導入ガイド',
      items: [
        { text: '概要', link: '/ja/getting-started/' },
        { text: 'システム紹介', link: '/ja/getting-started/introduction' },
        { text: 'クイックスタート', link: '/ja/getting-started/quick-start' },
        { text: '主要機能', link: '/ja/getting-started/features' },
        { text: 'ロボットの動作仕様', link: '/ja/getting-started/behavior' },
      ]
    },
    {
      text: 'ヘルプ & FAQ',
      items: [
        { text: 'よくある質問 (FAQ)', link: '/ja/getting-started/faq' },
        { text: 'オペレーター向けトラブルシューティング', link: '/ja/getting-started/troubleshooting' },
      ]
    }
  ],
  '/ja/setup/': [
    {
      text: 'セットアップ & デプロイ',
      items: [
        { text: 'セットアップ概要', link: '/ja/setup/' },
        { text: '前提条件と構成仕様', link: '/ja/setup/prerequisites' },
      ]
    },
    {
      text: 'インストール手順',
      items: [
        { text: 'サーバーセットアップ', link: '/ja/setup/server-setup' },
        { text: 'Jetsonユニットセットアップ', link: '/ja/setup/unit-setup' },
        { text: 'システム統合手順', link: '/ja/setup/system-setup' },
      ]
    },
    {
      text: 'リファレンス & ネットワーク',
      items: [
        { text: 'Docker コマンドリファレンス', link: '/ja/setup/docker-reference' },
        { text: 'Wi-Fi ホットスポット & クライアント', link: '/ja/setup/wifi-hotspot' },
      ]
    },
    {
      text: '運用・保守',
      items: [
        { text: 'メンテナンス', link: '/ja/setup/maintenance' },
        { text: 'トラブルシューティング', link: '/ja/setup/troubleshooting' },
      ]
    }
  ],
  '/ja/development/': [
    {
      text: 'はじめに',
      items: [
        { text: '開発概要', link: '/ja/development/' },
        { text: 'システムアーキテクチャ', link: '/ja/development/architecture' },
        { text: 'リポジトリ構成', link: '/ja/development/repository-structure' },
        { text: 'メッセージ仕様 (MQTT)', link: '/ja/development/message-contracts' },
      ]
    },
    {
      text: 'ROS (ロボットソフトウェア)',
      link: '/ja/development/ros/',
      collapsed: true,
      items: [
        { text: '概要', link: '/ja/development/ros/' },
        { text: 'ROSパッケージ一覧', link: '/ja/development/ros/ros-packages' },
        {
          text: '知覚 & 自己位置推定',
          items: [
            { text: 'センサーフュージョン & 制御', link: '/ja/development/ros/sensor-fusion-and-control' },
            { text: '座標系変換 (TF)', link: '/ja/development/ros/tf-transforms' },
          ]
        },
        {
          text: 'ナビゲーション & 経路計画',
          items: [
            { text: 'コストマップ & プランナー', link: '/ja/development/ros/costmaps-and-planners' },
            { text: '動的モード切り替え', link: '/ja/development/ros/mode-switching' },
            { text: 'セーフティウォッチドッグ', link: '/ja/development/ros/safety-watchdog' },
          ]
        },
        {
          text: 'カバレッジ清掃アルゴリズム',
          items: [
            { text: 'ブストロフェドン網羅走行', link: '/ja/development/ros/boustrophedon-and-alignment' },
          ]
        },
        {
          text: 'ハードウェア & ファームウェア',
          items: [
            { text: 'ファームウェア & ハードウェア', link: '/ja/development/ros/firmware-and-hardware' },
          ]
        },
        {
          text: 'シミュレーション & テスト',
          items: [
            { text: 'シミュレーション (Gazebo)', link: '/ja/development/ros/simulation' },
          ]
        }
      ]
    },
    {
      text: 'ROS Web UI (Platform)',
      link: '/ja/development/webui/',
      collapsed: true,
      items: [
        { text: '概要', link: '/ja/development/webui/' },
        {
          text: 'ナビゲーション',
          items: [
            { text: '概要', link: '/ja/development/webui/navigation/overview' },
            { text: 'ピンポイント & ルート', link: '/ja/development/webui/navigation/pinpoint-and-routes' },
            { text: '手動操作 & オートパイロット', link: '/ja/development/webui/navigation/manual-and-autopilot' },
            { text: 'マップ同期 & アラインメント', link: '/ja/development/webui/navigation/map-sync-and-alignment' },
            { text: 'カバレッジ清掃', link: '/ja/development/webui/navigation/coverage-cleaning' },
            { text: 'ROS連携', link: '/ja/development/webui/navigation/ros-integration' },
          ]
        },
        {
          text: 'マッピング',
          items: [
            { text: '概要', link: '/ja/development/webui/mapping/overview' },
            { text: '手動操作 & 自律動作', link: '/ja/development/webui/mapping/manual-and-autonomous' },
            { text: 'ROS連携', link: '/ja/development/webui/mapping/ros-integration' },
          ]
        },
        {
          text: 'データベース',
          items: [
            { text: '概要', link: '/ja/development/webui/database/overview' },
            { text: '名前変更 & 削除', link: '/ja/development/webui/database/rename-and-delete' },
            { text: 'ROS連携', link: '/ja/development/webui/database/ros-integration' },
          ]
        },
        {
          text: '管理コンソール',
          items: [
            { text: '概要', link: '/ja/development/webui/admin-console/overview' },
            { text: 'オペレーター', link: '/ja/development/webui/admin-console/operators' },
            { text: 'ユニット & フリート', link: '/ja/development/webui/admin-console/units-and-fleet' },
            { text: 'レンタル', link: '/ja/development/webui/admin-console/rentals' },
            { text: 'バックアップ', link: '/ja/development/webui/admin-console/backups' },
            { text: 'ROS連携', link: '/ja/development/webui/admin-console/ros-integration' },
          ]
        },
        {
          text: 'アカウント & アクセス',
          items: [
            { text: '概要', link: '/ja/development/webui/accounts/overview' },
            { text: 'セキュリティ & トークン', link: '/ja/development/webui/accounts/security-and-tokens' },
            { text: 'ハードウェア登録', link: '/ja/development/webui/accounts/enrolment' },
            { text: 'ROS連携', link: '/ja/development/webui/accounts/ros-integration' },
          ]
        },
        {
          text: 'カメラ & ライブビュー',
          items: [
            { text: '概要', link: '/ja/development/webui/camera/overview' },
            { text: 'ROS連携', link: '/ja/development/webui/camera/ros-integration' },
          ]
        },
        {
          text: 'プラットフォームリファレンス',
          items: [
            { text: 'REST API リファレンス', link: '/ja/development/api-reference' },
            { text: 'rosbridge プロトコル (WS)', link: '/ja/development/rosbridge-protocol' },
            { text: 'フロントエンド Canvas & Web UI', link: '/ja/development/frontend-canvas' },
            { text: 'データベース設計', link: '/ja/development/database-schema' },
            { text: 'データ同期 (オフラインファースト)', link: '/ja/development/data-sync' },
            { text: 'バックアップ & リストア', link: '/ja/development/backup-and-restore' },
            { text: 'ユニットコンテナライフサイクル', link: '/ja/development/unit-container-lifecycle' },
          ]
        }
      ]
    },
    {
      text: 'リファレンス & プロセス',
      items: [
        { text: '診断 & トラブルシューティング', link: '/ja/development/troubleshooting-guide' },
        { text: 'コントリビューションガイド', link: '/ja/development/contributing' },
        { text: '変更履歴 (Changelog)', link: '/ja/development/changelog' },
      ]
    }
  ]
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "MSD700 System",
  description: "Complete Documentation of ITB de Labo MSD700 Development Project",
  base: '/itbdelabo/docs/',
  lastUpdated: true,
  cleanUrls: true,
  vite: {
    server: {
      port: 5700,
      strictPort: true
    }
  },
  markdown: {
    config(md) {
      md.use(mathjax3)
      const defaultFence = md.renderer.rules.fence!
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        if (token.info.trim().toLowerCase() === 'mermaid') {
          const encoded = Buffer.from(token.content, 'utf-8').toString('base64')
          return `<Mermaid code="${encoded}" />`
        }
        return defaultFence(tokens, idx, options, env, self)
      }
    }
  },

  // ==================== INTERNATIONALIZATION (i18n) ====================
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Getting Started', link: '/getting-started/' },
          { text: 'User Guide', link: '/user-guide/' },
          { text: 'Setup', link: '/setup/' },
          { text: 'Developer Docs', link: '/development/' }
        ],
        sidebar: enSidebar,
        outline: {
          level: [2, 3],
          label: 'On this page'
        },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page'
        },
        darkModeSwitchLabel: 'Appearance',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top'
      }
    },
    id: {
      label: 'Bahasa Indonesia',
      lang: 'id-ID',
      link: '/id/',
      themeConfig: {
        nav: [
          { text: 'Beranda', link: '/id/' },
          { text: 'Panduan Operator', link: '/id/getting-started/' },
          { text: 'Panduan Pengguna', link: '/id/user-guide/' },
          { text: 'Setup', link: '/id/setup/' },
          { text: 'Dokumentasi Developer', link: '/id/development/' }
        ],
        sidebar: idSidebar,
        outline: {
          level: [2, 3],
          label: 'Daftar Isi Halaman'
        },
        editLink: {
          pattern: 'https://github.com/itbdelaboprogramming/msd700_documentation/edit/main/docs/:path',
          text: 'Edit halaman ini di GitHub'
        },
        lastUpdated: {
          text: 'Terakhir diperbarui'
        },
        docFooter: {
          prev: 'Halaman Sebelumnya',
          next: 'Halaman Selanjutnya'
        },
        darkModeSwitchLabel: 'Tampilan',
        lightModeSwitchTitle: 'Beralih ke mode terang',
        darkModeSwitchTitle: 'Beralih ke mode gelap',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Kembali ke atas'
      }
    },
    ja: {
      label: '日本語',
      lang: 'ja-JP',
      link: '/ja/',
      themeConfig: {
        nav: [
          { text: 'ホーム', link: '/ja/' },
          { text: '導入ガイド', link: '/ja/getting-started/' },
          { text: 'ユーザーガイド', link: '/ja/user-guide/' },
          { text: 'セットアップ', link: '/ja/setup/' },
          { text: '開発ドキュメント', link: '/ja/development/' }
        ],
        sidebar: jaSidebar,
        outline: {
          level: [2, 3],
          label: '目次'
        },
        editLink: {
          pattern: 'https://github.com/itbdelaboprogramming/msd700_documentation/edit/main/docs/:path',
          text: 'GitHub でこのページを編集'
        },
        lastUpdated: {
          text: '最終更新日'
        },
        docFooter: {
          prev: '前のページ',
          next: '次のページ'
        },
        darkModeSwitchLabel: '外観',
        lightModeSwitchTitle: 'ライトモードに切り替え',
        darkModeSwitchTitle: 'ダークモードに切り替え',
        sidebarMenuLabel: 'メニュー',
        returnToTopLabel: 'トップに戻る'
      }
    }
  },

  themeConfig: {
    outline: {
      level: [2, 3],
      label: 'On this page'
    },
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: 'Search documentation',
                buttonAriaLabel: 'Search documentation'
              },
              modal: {
                displayDetails: 'Display detailed list',
                resetButtonTitle: 'Reset search',
                backButtonTitle: 'Close search',
                noResultsText: 'No results for',
                footer: {
                  selectText: 'to select',
                  navigateText: 'to navigate',
                  closeText: 'to close'
                }
              }
            }
          },
          id: {
            translations: {
              button: {
                buttonText: 'Cari dokumentasi',
                buttonAriaLabel: 'Cari dokumentasi'
              },
              modal: {
                displayDetails: 'Tampilkan daftar detail',
                resetButtonTitle: 'Reset pencarian',
                backButtonTitle: 'Tutup pencarian',
                noResultsText: 'Tidak ada hasil untuk',
                footer: {
                  selectText: 'untuk memilih',
                  navigateText: 'untuk berpindah',
                  closeText: 'untuk menutup'
                }
              }
            }
          },
          ja: {
            translations: {
              button: {
                buttonText: 'ドキュメントを検索',
                buttonAriaLabel: 'ドキュメントを検索'
              },
              modal: {
                displayDetails: '詳細リストを表示',
                resetButtonTitle: '検索をリセット',
                backButtonTitle: '検索を閉じる',
                noResultsText: '該当する結果がありません: ',
                footer: {
                  selectText: '選択',
                  navigateText: '移動',
                  closeText: '閉じる'
                }
              }
            }
          }
        }
      }
    },
    editLink: {
      pattern: 'https://github.com/itbdelaboprogramming/msd700_documentation/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },
    lastUpdated: {
      text: 'Last updated'
    },
    socialLinks: [
      {
        icon: {
          svg: '<svg width="96" height="92" viewBox="0 0 96 92" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M65 49.7164C80.0102 52.6676 90.5 59.4075 90.5 67.25C90.5 77.8124 71.4721 86.375 48 86.375C24.5279 86.375 5.5 77.8124 5.5 67.25C5.5 59.4075 15.9898 52.6676 31 49.7164M48 65.125V5.625L70.6003 19.5329C72.2488 20.5474 73.0731 21.0546 73.336 21.6936C73.5654 22.251 73.5472 22.8796 73.2861 23.4228C72.9868 24.0456 72.1346 24.5044 70.4303 25.4221L48 37.5" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        },
        link: 'https://msd.nglobal.jp',
        ariaLabel: 'MSD700 Web UI'
      },
      { icon: 'github', link: 'https://github.com/itbdelaboprogramming/msd700_documentation' }
    ]
  }
})
