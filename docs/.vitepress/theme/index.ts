// https://vitepress.dev/guide/custom-theme
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import LinkCards from './components/LinkCards.vue'
import LinkCard from './components/LinkCard.vue'
import RoleBadge from './components/RoleBadge.vue'
import Mermaid from './components/Mermaid.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LinkCards', LinkCards)
    app.component('LinkCard', LinkCard)
    app.component('RoleBadge', RoleBadge)
    // Registered globally because the markdown hook in config.mts rewrites every ```mermaid
    // fence into this element, on any page, without the page importing anything.
    app.component('Mermaid', Mermaid)
  }
} satisfies Theme
