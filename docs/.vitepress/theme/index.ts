// https://vitepress.dev/guide/custom-theme
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import LinkCards from './components/LinkCards.vue'
import LinkCard from './components/LinkCard.vue'
import RoleBadge from './components/RoleBadge.vue'
import './custom.css'

// Diagrams are fitted to the column, so small text can get small: a click opens the PNG in a
// pop-up that fits the screen, and a click on the image there shows it at 1:1 to scroll around.
// The link underneath still opens the PNG in a new tab (middle-click, or without JavaScript).
function openDiagram(src: string, alt: string) {
  const box = document.createElement('div')
  box.className = 'diagram-lightbox'
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  const img = document.createElement('img')
  img.src = src
  img.alt = alt
  const close = document.createElement('button')
  close.className = 'diagram-lightbox-close'
  close.setAttribute('aria-label', 'Close')
  close.textContent = '×'
  const overflow = document.body.style.overflow
  const shut = () => {
    box.remove()
    document.body.style.overflow = overflow
    document.removeEventListener('keydown', onKey)
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') shut() }
  img.addEventListener('click', (e) => { e.stopPropagation(); box.classList.toggle('zoomed') })
  box.addEventListener('click', shut)
  close.addEventListener('click', shut)
  document.addEventListener('keydown', onKey)
  box.append(img, close)
  document.body.style.overflow = 'hidden'
  document.body.append(box)
  close.focus()
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    if (typeof window !== 'undefined') {
      document.addEventListener('click', (e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        const a = (e.target as Element | null)?.closest?.('a.diagram-open') as HTMLAnchorElement | null
        if (!a) return
        e.preventDefault()
        openDiagram(a.href, a.querySelector('img')?.alt || 'Diagram')
      })
    }
    app.component('LinkCards', LinkCards)
    app.component('LinkCard', LinkCard)
    app.component('RoleBadge', RoleBadge)
  }
} satisfies Theme
