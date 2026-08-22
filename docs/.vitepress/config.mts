import { defineConfig } from 'vitepress'

// ==================== EN SIDEBARS ====================
const enSidebar = {
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
      text: 'System & Architecture',
      items: [
        { text: 'Overview', link: '/development/' },
        { text: 'System Architecture', link: '/development/architecture' },
        { text: 'Security & Authentication', link: '/development/security-and-auth' },
        { text: 'State & Behavior', link: '/development/state-and-behavior' },
        { text: 'Repository Structure', link: '/development/repository-structure' },
      ]
    },
    {
      text: 'ROS & Robot Subsystems',
      items: [
        { text: 'ROS Package Registry', link: '/development/ros-packages' },
        { text: 'Coordinate Transforms (TF)', link: '/development/tf-transforms' },
        { text: 'Sensor Fusion & Control', link: '/development/sensor-fusion-and-control' },
        { text: 'Firmware & Hardware Bus', link: '/development/firmware-and-hardware' },
        { text: 'Costmaps & Motion Planners', link: '/development/costmaps-and-planners' },
        { text: 'Dynamic Mode Switching', link: '/development/mode-switching' },
      ]
    },
    {
      text: 'Navigation & Simulation',
      items: [
        { text: 'Boustrophedon Coverage', link: '/development/boustrophedon-and-alignment' },
        { text: 'Gazebo Simulation', link: '/development/simulation' },
      ]
    },
    {
      text: 'Communications & Protocols',
      items: [
        { text: 'Message Contracts', link: '/development/message-contracts' },
        { text: 'API Reference', link: '/development/api-reference' },
        { text: 'rosbridge WebSocket Protocol', link: '/development/rosbridge-protocol' },
        { text: 'Frontend Canvas & Web UI', link: '/development/frontend-canvas' },
        { text: 'Camera Video Streaming', link: '/development/camera-streaming' },
      ]
    },
    {
      text: 'Data & Cloud Sync',
      items: [
        { text: 'Database Schema', link: '/development/database-schema' },
        { text: 'Data Sync (Offline First)', link: '/development/data-sync' },
        { text: 'Backup & Migration', link: '/development/backup-and-restore' },
      ]
    },
    {
      text: 'Operations & Diagnostics',
      items: [
        { text: 'Unit Container Lifecycle', link: '/development/unit-container-lifecycle' },
        { text: 'Diagnostics & Troubleshooting', link: '/development/troubleshooting-guide' },
      ]
    },
    {
      text: 'Contributing & Releases',
      items: [
        { text: 'Contributing Guide', link: '/development/contributing' },
        { text: 'Platform Changelog', link: '/development/changelog' },
      ]
    }
  ]
};

// ==================== ID SIDEBARS ====================
const idSidebar = {
  '/id/getting-started/': [
    {
      text: 'Panduan Operator',
      items: [
        { text: 'Ringkasan', link: '/id/getting-started/' },
        { text: 'Pengenalan', link: '/id/getting-started/introduction' },
        { text: 'Panduan Cepat', link: '/id/getting-started/quick-start' },
        { text: 'Fitur Utama', link: '/id/getting-started/features' },
        { text: 'Perilaku Robot', link: '/id/getting-started/behavior' },
      ]
    },
    {
      text: 'Bantuan & FAQ',
      items: [
        { text: 'FAQ', link: '/id/getting-started/faq' },
        { text: 'Troubleshooting Operator', link: '/id/getting-started/troubleshooting' },
      ]
    }
  ],
  '/id/setup/': [
    {
      text: 'Setup & Deployment',
      items: [
        { text: 'Ringkasan', link: '/id/setup/' },
        { text: 'Prasyarat & Sizing', link: '/id/setup/prerequisites' },
      ]
    },
    {
      text: 'Instalasi',
      items: [
        { text: 'Setup Server', link: '/id/setup/server-setup' },
        { text: 'Setup Unit Jetson', link: '/id/setup/unit-setup' },
        { text: 'Integrasi Sistem', link: '/id/setup/system-setup' },
      ]
    },
    {
      text: 'Referensi & Jaringan',
      items: [
        { text: 'Referensi Docker', link: '/id/setup/docker-reference' },
        { text: 'WiFi Hotspot + Client', link: '/id/setup/wifi-hotspot' },
      ]
    },
    {
      text: 'Operasional',
      items: [
        { text: 'Pemeliharaan', link: '/id/setup/maintenance' },
        { text: 'Troubleshooting Teknisi', link: '/id/setup/troubleshooting' },
      ]
    }
  ],
  '/id/development/': [
    {
      text: 'Sistem & Arsitektur',
      items: [
        { text: 'Ringkasan', link: '/id/development/' },
        { text: 'Arsitektur Sistem', link: '/id/development/architecture' },
        { text: 'Keamanan & Autentikasi', link: '/id/development/security-and-auth' },
        { text: 'Status & Perilaku', link: '/id/development/state-and-behavior' },
        { text: 'Struktur Repositori', link: '/id/development/repository-structure' },
      ]
    },
    {
      text: 'ROS & Subsistem Robot',
      items: [
        { text: 'Daftar Paket ROS', link: '/id/development/ros-packages' },
        { text: 'Transformasi Koordinat (TF)', link: '/id/development/tf-transforms' },
        { text: 'Sensor Fusion & Kontrol', link: '/id/development/sensor-fusion-and-control' },
        { text: 'Firmware & Bus Hardware', link: '/id/development/firmware-and-hardware' },
        { text: 'Costmap & Motion Planner', link: '/id/development/costmaps-and-planners' },
        { text: 'Mode Switching Dinamis', link: '/id/development/mode-switching' },
      ]
    },
    {
      text: 'Navigasi & Simulasi',
      items: [
        { text: 'Sapuan Boustrophedon', link: '/id/development/boustrophedon-and-alignment' },
        { text: 'Simulasi Gazebo', link: '/id/development/simulation' },
      ]
    },
    {
      text: 'Komunikasi & Protokol',
      items: [
        { text: 'Kontrak Pesan MQTT', link: '/id/development/message-contracts' },
        { text: 'Referensi REST API', link: '/id/development/api-reference' },
        { text: 'Protokol WebSocket rosbridge', link: '/id/development/rosbridge-protocol' },
        { text: 'Kanvas Frontend & Web UI', link: '/id/development/frontend-canvas' },
        { text: 'Streaming Video Kamera', link: '/id/development/camera-streaming' },
      ]
    },
    {
      text: 'Data & Sinkronisasi Cloud',
      items: [
        { text: 'Skema Database', link: '/id/development/database-schema' },
        { text: 'Sinkronisasi Data Offline-First', link: '/id/development/data-sync' },
        { text: 'Backup & Migrasi', link: '/id/development/backup-and-restore' },
      ]
    },
    {
      text: 'Operasi & Diagnostik',
      items: [
        { text: 'Lifecycle Kontainer Unit', link: '/id/development/unit-container-lifecycle' },
        { text: 'Diagnostik & Debugging', link: '/id/development/troubleshooting-guide' },
      ]
    },
    {
      text: 'Kontribusi & Rilis',
      items: [
        { text: 'Panduan Kontribusi', link: '/id/development/contributing' },
        { text: 'Changelog Platform', link: '/id/development/changelog' },
      ]
    }
  ]
};

// ==================== JA SIDEBARS ====================
const jaSidebar = {
  '/ja/getting-started/': [
    {
      text: 'オペレーターガイド',
      items: [
        { text: '概要', link: '/ja/getting-started/' },
        { text: 'はじめに', link: '/ja/getting-started/introduction' },
        { text: 'クイックスタート', link: '/ja/getting-started/quick-start' },
        { text: '機能一覧', link: '/ja/getting-started/features' },
        { text: 'ロボットの動作仕様', link: '/ja/getting-started/behavior' },
      ]
    },
    {
      text: 'ヘルプとFAQ',
      items: [
        { text: 'よくある質問 (FAQ)', link: '/ja/getting-started/faq' },
        { text: 'トラブルシューティング', link: '/ja/getting-started/troubleshooting' },
      ]
    }
  ],
  '/ja/setup/': [
    {
      text: 'セットアップと展開',
      items: [
        { text: '概要', link: '/ja/setup/' },
        { text: '前提条件とサイジング', link: '/ja/setup/prerequisites' },
      ]
    },
    {
      text: 'インストール',
      items: [
        { text: 'サーバー構築', link: '/ja/setup/server-setup' },
        { text: 'ロボット本体セットアップ', link: '/ja/setup/unit-setup' },
        { text: 'システム統合確認', link: '/ja/setup/system-setup' },
      ]
    },
    {
      text: 'リファレンスとネットワーク',
      items: [
        { text: 'Docker リファレンス', link: '/ja/setup/docker-reference' },
        { text: 'WiFi ホットスポット設定', link: '/ja/setup/wifi-hotspot' },
      ]
    },
    {
      text: '運用管理',
      items: [
        { text: '保守メンテナンス', link: '/ja/setup/maintenance' },
        { text: '技術トラブルシューティング', link: '/ja/setup/troubleshooting' },
      ]
    }
  ],
  '/ja/development/': [
    {
      text: 'システムとアーキテクチャ',
      items: [
        { text: '概要', link: '/ja/development/' },
        { text: 'システム構造', link: '/ja/development/architecture' },
        { text: 'セキュリティと認証', link: '/ja/development/security-and-auth' },
        { text: '状態管理と振る舞い', link: '/ja/development/state-and-behavior' },
        { text: 'リポジトリ構成', link: '/ja/development/repository-structure' },
      ]
    },
    {
      text: 'ROS およびロボットサブシステム',
      items: [
        { text: 'ROS パッケージ一覧', link: '/ja/development/ros-packages' },
        { text: '座標変換 (TF)', link: '/ja/development/tf-transforms' },
        { text: 'センサフュージョンと制御', link: '/ja/development/sensor-fusion-and-control' },
        { text: 'ファームウェアとハードウェア', link: '/ja/development/firmware-and-hardware' },
        { text: 'コストマップとプランナー', link: '/ja/development/costmaps-and-planners' },
        { text: '動的モード切り替え', link: '/ja/development/mode-switching' },
      ]
    },
    {
      text: 'ナビゲーションとシミュレーション',
      items: [
        { text: '牛耕式エリアカバレッジ', link: '/ja/development/boustrophedon-and-alignment' },
        { text: 'Gazebo シミュレーション', link: '/ja/development/simulation' },
      ]
    },
    {
      text: '通信とプロトコル',
      items: [
        { text: 'MQTT メッセージ仕様', link: '/ja/development/message-contracts' },
        { text: 'REST API リファレンス', link: '/ja/development/api-reference' },
        { text: 'rosbridge WebSocket 仕様', link: '/ja/development/rosbridge-protocol' },
        { text: 'フロントエンド描画パイプライン', link: '/ja/development/frontend-canvas' },
        { text: 'WebRTC カメラ配信', link: '/ja/development/camera-streaming' },
      ]
    },
    {
      text: 'データとクラウド同期',
      items: [
        { text: 'データベース構造', link: '/ja/development/database-schema' },
        { text: 'オフライン優先データ同期', link: '/ja/development/data-sync' },
        { text: 'バックアップと復元', link: '/ja/development/backup-and-restore' },
      ]
    },
    {
      text: '運用と診断',
      items: [
        { text: 'ユニットコンテナ管理', link: '/ja/development/unit-container-lifecycle' },
        { text: '開発者向け障害診断', link: '/ja/development/troubleshooting-guide' },
      ]
    },
    {
      text: '開発貢献とリリース',
      items: [
        { text: 'コントリビューションガイド', link: '/ja/development/contributing' },
        { text: '更新履歴 (Changelog)', link: '/ja/development/changelog' },
      ]
    }
  ]
};

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "MSD700 System",
  description: "Complete Documentation of ITB de Labo MSD700 Development Project",
  // Served by Apache at https://msd.nglobal.jp/itbdelabo/docs/ (must match the Alias path).
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
          { text: 'Setup', link: '/setup/' },
          { text: 'Developer Docs', link: '/development/' }
        ],
        sidebar: enSidebar
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
        }
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
        }
      }
    }
  },

  themeConfig: {
    outline: {
      level: [2, 3],
      label: 'On this page'
    },
    search: {
      provider: 'local'
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
