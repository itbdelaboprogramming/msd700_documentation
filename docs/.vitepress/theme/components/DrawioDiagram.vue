<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { openZoomViewer } from '../zoom-viewer'

// Direct draw.io mode: this fetches the real .drawio file and draws it with the official draw.io
// viewer, read-only, instead of showing a pre-rendered PNG. There is no second copy of the drawing
// to keep in sync. The viewer script is fetched once per page and each diagram is rendered lazily
// when it approaches the viewport, so a page with many diagrams is not blocked up front. Clicking
// opens the shared full-screen zoom/pan viewer (zoom-viewer.ts).
const props = defineProps<{ src: string; viewer: string; alt?: string }>()

const root = ref<HTMLElement>()
const stage = ref<HTMLElement>()
const render = ref<HTMLElement>()
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

let gv: any = null
let viewerPromise: Promise<void> | null = null

function loadViewer(src: string) {
  if ((window as any).GraphViewer) return Promise.resolve()
  if (!viewerPromise) {
    // Keep the viewer offline and self-contained:
    //  - mxLoadResources=false stops stencil/theme fetches from viewer.diagrams.net;
    //  - a defined (stub) MathJax makes the viewer skip loading its MathJax bundle from
    //    viewer.diagrams.net (Editor.initMath only fetches it when window.MathJax is undefined).
    //    Our .drawio files contain no math, so nothing is lost by not typesetting it.
    ;(window as any).mxLoadResources = false
    ;(window as any).DRAWIO_LIGHTBOX_URL = ''
    ;(window as any).MathJax = (window as any).MathJax || {}
    viewerPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.onload = () => resolve()
      s.onerror = () => { viewerPromise = null; reject(new Error('draw.io viewer failed to load')) }
      document.head.append(s)
    })
  }
  return viewerPromise
}

const waitFor = async (fn: () => unknown, ms = 15000) => {
  const t = performance.now()
  while (!fn()) {
    if (performance.now() - t > ms) return false
    await new Promise((r) => setTimeout(r, 25))
  }
  return true
}

// Give the stage the diagram's aspect ratio (so there is little letterboxing), then fit and centre.
function sizeToAspect() {
  const graph = gv?.editor?.graph
  const box = stage.value
  if (!graph || !box) return
  const m = modelBounds(graph)
  if (!m) return
  const width = box.clientWidth || box.parentElement?.clientWidth || 0
  if (!width) return
  const want = Math.round((width * m.height) / m.width) + 2 * PAD
  box.style.height = `${Math.max(180, Math.min(want, Math.round(window.innerHeight * 0.82)))}px`
  fitCenter()
}

const PAD = 8

// Drawing bounds in model units (independent of the current zoom and pan).
function modelBounds(graph: any) {
  const view = graph.view
  const b = graph.getGraphBounds()
  if (!b?.width || !b?.height) return null
  const s = view.scale
  return { x: b.x / s - view.translate.x, y: b.y / s - view.translate.y, width: b.width / s, height: b.height / s }
}

// draw.io's own fitGraph anchors the drawing to the top-left corner, so a drawing that is limited
// by the stage height (or by the 180 px minimum) was left-aligned with empty space on the right.
// Fit it to both sides ourselves and centre it in the stage.
function fitCenter() {
  const graph = gv?.editor?.graph
  const box = stage.value
  if (!graph || !box) return
  const m = modelBounds(graph)
  const W = box.clientWidth
  const H = box.clientHeight
  if (!m || !W || !H) return
  const s = Math.min((W - 2 * PAD) / m.width, (H - 2 * PAD) / m.height)
  graph.view.scaleAndTranslate(s, (W / s - m.width) / 2 - m.x, (H / s - m.height) / 2 - m.y)
  const svg = render.value?.querySelector('svg') as SVGElement | null
  if (svg) {
    svg.style.width = `${W}px`
    svg.style.height = `${H}px`
    svg.style.minWidth = ''
    svg.style.minHeight = ''
  }
}

let resizeObserver: ResizeObserver | null = null
let lastWidth = 0

async function init() {
  if (status.value !== 'idle') return
  status.value = 'loading'
  try {
    const [xml] = await Promise.all([
      fetch(props.src).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      }),
      loadViewer(props.viewer)
    ])
    const w = window as any
    gv = new w.GraphViewer(render.value!, w.mxUtils.parseXml(xml).documentElement, {
      toolbar: null,
      nav: false,
      resize: true,
      border: 8,
      lightbox: false,
      'check-visible-state': false,
      'auto-fit': true,
      // Always draw black-on-white, like the saved .drawio, regardless of the OS/site dark mode.
      'dark-mode': false,
      zoom: 1
    })
    if (!(await waitFor(() => gv.editor?.graph && render.value?.querySelector('svg')))) {
      throw new Error('the diagram did not render')
    }
    sizeToAspect()
    status.value = 'ready'
    lastWidth = stage.value?.clientWidth || 0
    resizeObserver = new ResizeObserver(() => {
      const w = stage.value?.clientWidth || 0
      if (w && w !== lastWidth) {
        lastWidth = w
        sizeToAspect()
      }
    })
    resizeObserver.observe(stage.value!)
  } catch {
    status.value = 'error'
  }
}

function open() {
  if (status.value !== 'ready') return
  const svg = render.value?.querySelector('svg')
  const graph = gv?.editor?.graph
  if (!svg || !graph) return
  // Crop the pop up to the drawing itself, not the letterboxed stage.
  const b = graph.getGraphBounds()
  const x = Math.floor(b.x - PAD)
  const y = Math.floor(b.y - PAD)
  const width = Math.ceil(b.width + 2 * PAD)
  const height = Math.ceil(b.height + 2 * PAD)
  const clone = svg.cloneNode(true) as SVGElement
  clone.removeAttribute('style')
  clone.setAttribute('viewBox', `${x} ${y} ${width} ${height}`)
  clone.style.width = `${width}px`
  clone.style.height = `${height}px`
  clone.style.display = 'block'
  clone.style.background = '#fff'
  openZoomViewer({
    el: clone,
    width,
    height,
    alt: props.alt,
    href: props.src
  })
}

onMounted(() => {
  // Render shortly after the page becomes interactive: the viewer script is fetched once and then
  // each diagram is cheap (~15-40 ms). We do not gate this on IntersectionObserver: it failed to
  // ever report the last diagram on a page as visible, so a diagram far down a page never loaded.
  const start = () => init()
  const idle = (window as any).requestIdleCallback
  if (typeof idle === 'function') idle(start, { timeout: 1500 })
  else setTimeout(start, 0)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  try { gv?.editor?.destroy?.() } catch { /* already gone */ }
})

defineExpose({ open })
</script>

<template>
  <figure ref="root" class="diagram-figure drawio-figure">
    <button
      type="button"
      class="drawio-stage"
      ref="stage"
      :class="{ 'is-ready': status === 'ready' }"
      :aria-label="alt || 'Diagram'"
      :disabled="status !== 'ready'"
      :title="status === 'ready' ? 'Click to zoom' : undefined"
      @click.capture="open"
    >
      <span class="drawio-render" ref="render" />
      <span v-if="status !== 'ready'" class="drawio-status" aria-hidden="true">
        <span v-if="status === 'error'">&#9888;</span>
        <span v-else class="drawio-spinner" />
      </span>
    </button>
  </figure>
</template>
