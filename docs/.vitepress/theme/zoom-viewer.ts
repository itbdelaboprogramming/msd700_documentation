// Full-screen, view-only zoom/pan viewer for a diagram. Shared by the PNG mode (theme/index.ts,
// which hands it an <img>) and the direct draw.io mode (components/DrawioDiagram.vue, which hands it
// a cloned <svg>). The element is scaled with a CSS transform, so an SVG stays crisp at any zoom.
const MIN_SCALE = 0.05
const MAX_SCALE = 8
const ZOOM_STEP = 1.4
const PAN_MARGIN = 48 // keep at least this many pixels of the diagram on screen

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export interface ZoomContent {
  el: HTMLElement
  width: number
  height: number
  alt?: string
  href?: string
}

export function openZoomViewer(content: ZoomContent) {
  const { el, alt } = content
  const label = alt || 'Diagram'

  const box = document.createElement('div')
  box.className = 'diagram-lightbox'
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-label', label)

  const viewer = document.createElement('div')
  viewer.className = 'diagram-viewer'

  const toolbar = document.createElement('div')
  toolbar.className = 'diagram-toolbar'

  const button = (act: string, text: string, title: string) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'diagram-toolbar-button'
    b.dataset.act = act
    b.setAttribute('aria-label', title)
    b.title = title
    b.textContent = text
    return b
  }
  const zoomOut = button('out', '\u2212', 'Zoom out')
  const zoomLabel = button('fit', '', 'Fit to screen')
  zoomLabel.classList.add('diagram-toolbar-zoom')
  const zoomIn = button('in', '+', 'Zoom in')
  const actual = button('actual', '1:1', 'Actual size (100%)')
  const close = button('close', '\u00d7', 'Close')
  close.classList.add('diagram-toolbar-close')
  const parts = [zoomOut, zoomLabel, zoomIn, actual]
  if (content.href) {
    const link = document.createElement('a')
    link.className = 'diagram-toolbar-button diagram-toolbar-link'
    link.href = content.href
    link.target = '_blank'
    link.rel = 'noopener'
    link.setAttribute('aria-label', 'Open in a new tab')
    link.title = 'Open in a new tab'
    link.textContent = '\u2197'
    parts.push(link)
  }
  parts.push(close)
  toolbar.append(...parts)

  const stage = document.createElement('div')
  stage.className = 'diagram-stage'
  // Anchor the transform at the element's top-left. The zoom maths below (and dragging) assumes
  // this; without it an <svg> keeps its default 50% 50% origin and zooms drift toward a corner.
  Object.assign(el.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    transformOrigin: '0 0',
    userSelect: 'none',
    maxWidth: 'none',
    maxHeight: 'none'
  })
  stage.append(el)
  viewer.append(toolbar, stage)
  box.append(viewer)

  const overflow = document.body.style.overflow
  const W = content.width
  const H = content.height
  let scale = 1
  let tx = 0
  let ty = 0
  let fitScale = 1

  const size = () => ({ w: stage.clientWidth, h: stage.clientHeight })

  // Keep at least PAN_MARGIN of the diagram on screen, but never force an axis back to the centre:
  // a diagram narrower/shorter than the stage must still be draggable, and a cursor-anchored zoom
  // must not be overridden (that is what made the zoom drift to the right).
  const clampPan = () => {
    const { w, h } = size()
    const iw = W * scale
    const ih = H * scale
    tx = clamp(tx, PAN_MARGIN - iw, w - PAN_MARGIN)
    ty = clamp(ty, PAN_MARGIN - ih, h - PAN_MARGIN)
  }

  const apply = () => {
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
    zoomLabel.textContent = `${Math.round((scale / (fitScale || 1)) * 100)}%`
  }

  const fit = () => {
    const { w, h } = size()
    if (!W || !H || !w || !h) return
    fitScale = Math.min(1, w / W, h / H)
    scale = fitScale
    tx = (w - W * scale) / 2
    ty = (h - H * scale) / 2
    apply()
  }

  const zoomAt = (px: number, py: number, factor: number) => {
    const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE)
    if (next === scale) return
    tx = px - (px - tx) * (next / scale)
    ty = py - (py - ty) * (next / scale)
    scale = next
    clampPan()
    apply()
  }

  const zoomCenter = (factor: number) => {
    const { w, h } = size()
    zoomAt(w / 2, h / 2, factor)
  }

  const actualSize = () => {
    const { w, h } = size()
    scale = 1
    tx = (w - W) / 2
    ty = (h - H) / 2
    clampPan()
    apply()
  }

  let pinchDist = 0
  const pointers = new Map<number, { x: number; y: number }>()
  const distance = () => {
    const [a, b] = [...pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    stage.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) pinchDist = distance()
    stage.classList.add('is-grabbing')
  })
  stage.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) {
      const d = distance()
      if (pinchDist > 0) {
        const rect = stage.getBoundingClientRect()
        const [a, b] = [...pointers.values()]
        zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, d / pinchDist)
        pinchDist = d
      }
      return
    }
    if (pointers.size === 1) {
      tx += e.clientX - prev.x
      ty += e.clientY - prev.y
      clampPan()
      apply()
    }
  })
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchDist = 0
    if (!pointers.size) stage.classList.remove('is-grabbing')
  }
  stage.addEventListener('pointerup', release)
  stage.addEventListener('pointercancel', release)

  stage.addEventListener('wheel', (e) => {
    e.preventDefault()
    const rect = stage.getBoundingClientRect()
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015))
  }, { passive: false })

  stage.addEventListener('dblclick', () => {
    if (Math.abs(scale - fitScale) < 1e-6) actualSize()
    else fit()
  })

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') shut()
    else if (e.key === '+' || e.key === '=') zoomCenter(ZOOM_STEP)
    else if (e.key === '-' || e.key === '_') zoomCenter(1 / ZOOM_STEP)
    else if (e.key === '0') fit()
    else if (e.key === '1') actualSize()
    else if (e.key.startsWith('Arrow')) {
      const step = e.shiftKey ? 200 : 60
      if (e.key === 'ArrowLeft') tx += step
      else if (e.key === 'ArrowRight') tx -= step
      else if (e.key === 'ArrowUp') ty += step
      else if (e.key === 'ArrowDown') ty -= step
      clampPan()
      apply()
    } else return
    e.preventDefault()
  }

  let shut = () => {}
  const onResize = () => fit()
  shut = () => {
    box.remove()
    document.body.style.overflow = overflow
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', onResize)
  }

  toolbar.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement | null)?.closest?.('button')?.dataset.act
    if (act === 'in') zoomCenter(ZOOM_STEP)
    else if (act === 'out') zoomCenter(1 / ZOOM_STEP)
    else if (act === 'fit') fit()
    else if (act === 'actual') actualSize()
    else if (act === 'close') shut()
  })
  box.addEventListener('click', (e) => { if (e.target === box) shut() })
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)

  document.body.style.overflow = 'hidden'
  document.body.append(box)
  close.focus()
  requestAnimationFrame(fit)
}
