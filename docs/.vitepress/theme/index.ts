// https://vitepress.dev/guide/custom-theme
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import LinkCards from './components/LinkCards.vue'
import LinkCard from './components/LinkCard.vue'
import RoleBadge from './components/RoleBadge.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LinkCards', LinkCards)
    app.component('LinkCard', LinkCard)
    app.component('RoleBadge', RoleBadge)
  }
} satisfies Theme
