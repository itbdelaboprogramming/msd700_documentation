// https://vitepress.dev/guide/custom-theme
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import LinkCards from './components/LinkCards.vue'
import LinkCard from './components/LinkCard.vue'
import RoleBadge from './components/RoleBadge.vue'
import DrawioDiagram from './components/DrawioDiagram.vue'
import './custom.css'

// Diagrams are drawn client-side by <DrawioDiagram> from the .drawio file itself; a click opens the
// shared view-only zoom viewer (components/DrawioDiagram.vue → zoom-viewer.ts). There is no image
// asset and no edit path.
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LinkCards', LinkCards)
    app.component('LinkCard', LinkCard)
    app.component('RoleBadge', RoleBadge)
    app.component('DrawioDiagram', DrawioDiagram)
  }
} satisfies Theme
