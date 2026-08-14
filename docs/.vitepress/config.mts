import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "MSD700 System",
  description: "Complete Documentation of ITB de Labo MSD700 Development Project",
  // Served by Apache at https://msd.nglobal.jp/itbdelabo/docs/ - must match the Alias path.
  base: '/itbdelabo/docs/',
  lastUpdated: true,
  cleanUrls: true,
  // Note: `npm run docs:preview` is for local spot-checks only - it must never
  // be used to serve production. Its static server (sirv) caches the file list
  // and sizes at startup, so it serves a stale build after any rebuild. In
  // production Apache serves docs/.vitepress/dist directly (scripts/apache-snippet.conf).
  // That command also does not honor vite.preview.port, hence --port on the script.
  vite: {
    server: {
      port: 5700,
      strictPort: true
    }
  },
  markdown: {
    config(md) {
      // Turn ```mermaid fences into <Mermaid code="..." /> so they render as diagrams instead
      // of as syntax-highlighted text. Base64 because the diagram source is full of quotes,
      // newlines and angle brackets that Vue would otherwise try to parse once the fence is an
      // element attribute. See theme/components/Mermaid.vue for the other half.
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
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Setup', link: '/setup/' },
      { text: 'Documentation', link: '/development/' }
    ],

    sidebar: {
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
          text: 'Help',
          items: [
            { text: 'FAQ', link: '/getting-started/faq' },
            { text: 'Troubleshooting', link: '/getting-started/troubleshooting' },
          ]
        }
      ],
      '/setup/': [
        {
          text: 'Setup',
          items: [
            { text: 'Overview', link: '/setup/' },
            { text: 'Prerequisites', link: '/setup/prerequisites' },
          ]
        },
        {
          text: 'Installation',
          items: [
            { text: 'Server Setup', link: '/setup/server-setup' },
            { text: 'Unit Setup', link: '/setup/unit-setup' },
            { text: 'System Setup', link: '/setup/system-setup' },
          ]
        },
        {
          text: 'Reference',
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
          text: 'Documentation',
          items: [
            { text: 'Overview', link: '/development/' },
            { text: 'Architecture', link: '/development/architecture' },
            { text: 'State and Behavior', link: '/development/state-and-behavior' },
            { text: 'Repository Structure', link: '/development/repository-structure' },
          ]
        },
        {
          text: 'Reference',
          items: [
            { text: 'API Reference', link: '/development/api-reference' },
            { text: 'Message Contracts', link: '/development/message-contracts' },
            { text: 'Database Schema', link: '/development/database-schema' },
            { text: 'Camera Streaming', link: '/development/camera-streaming' },
            { text: 'Data Sync', link: '/development/data-sync' },
          ]
        },
        {
          text: 'Contributing',
          items: [
            { text: 'Contributing Guide', link: '/development/contributing' },
            { text: 'Changelog', link: '/development/changelog' },
          ]
        }
      ],
    },

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

    // footer: {
    //   message: 'Released under the MIT License.',
    //   copyright: 'Copyright © ITB de Labo Research Lab'
    // },

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
