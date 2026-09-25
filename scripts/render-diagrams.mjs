#!/usr/bin/env node
//
// Renders every ```mermaid fence in the docs tree to a static PNG in docs/public/diagrams/.
//
// Why static images: rendering in the reader's browser meant mermaid measured labels with
// whatever font that browser resolved (a CSS variable it cannot read), so boxes came out the
// wrong size, labels were clipped and the layout changed per machine and per theme. Here every
// diagram is laid out once, in one Chrome, with one known font, and shipped as a picture.
//
// The markdown hook in docs/.vitepress/config.mts turns each fence into an <img> pointing at
// diagrams/<hash>.png, where <hash> is diagramHash() of the fence body. Edit the fence, rerun
// this script, commit the PNGs. Images no fence refers to any more are deleted.
//
//   npm run docs:diagrams            render new / changed diagrams
//   npm run docs:diagrams -- --all   re-render everything (after changing the style below)
//   npm run docs:diagrams -- --check exit 1 if any fence has no image (no browser needed)
//   npm run docs:diagrams -- --audit also list every line crossing text, a group title or a label
//
// Needs a local Chrome/Chromium. Set CHROME_PATH if it is not in a standard location.
//
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { diagramHash, extractMermaidFences } from './diagram-hash.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const DOCS = join(ROOT, 'docs')
const OUT = join(DOCS, 'public', 'diagrams')
const args = new Set(process.argv.slice(2))

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.vitepress' || name === 'public' || name === 'node_modules') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (name.endsWith('.md')) out.push(p)
  }
  return out
}

// hash -> { code, sources[] }
const diagrams = new Map()
for (const file of walk(DOCS)) {
  for (const { code, line } of extractMermaidFences(readFileSync(file, 'utf8'))) {
    const hash = diagramHash(code)
    if (!diagrams.has(hash)) diagrams.set(hash, { code, sources: [] })
    diagrams.get(hash).sources.push(`${relative(ROOT, file)}:${line}`)
  }
}

mkdirSync(OUT, { recursive: true })
const pngPath = (hash) => join(OUT, `${hash}.png`)
const match = process.argv.find((a) => a.startsWith('--match='))?.slice(8)
const todo = [...diagrams].filter(([hash, d]) =>
  (match ? d.sources.some((s) => s.includes(match)) : args.has('--all') || !existsSync(pngPath(hash))))

if (args.has('--check')) {
  for (const [, d] of todo) console.error(`missing image: ${d.sources.join(', ')}`)
  console.log(`${diagrams.size} diagrams, ${todo.length} without an image`)
  process.exit(todo.length ? 1 : 0)
}

// ---------------------------------------------------------------------------------------------
// Style. Modelled on the hand-drawn draw.io figures in docs/public/images: white boxes, 1px black
// strokes, Helvetica, orthogonal connectors, group titles in a tab at the top-left corner.
// ---------------------------------------------------------------------------------------------
const FONT = 'Helvetica, Arial, "Liberation Sans", "Noto Sans CJK JP", "Noto Sans JP", sans-serif'
const INK = '#000000'
const MUTED = '#333333'

const mermaidConfig = {
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'strict',
  fontFamily: FONT,
  // sequence diagrams take all their text sizes from this top-level key, not their own settings
  fontSize: 13,
  layout: 'elk',
  elk: { mergeEdges: false, nodePlacementStrategy: 'NETWORK_SIMPLEX', cycleBreakingStrategy: 'GREEDY' },
  flowchart: {
    curve: 'linear',
    htmlLabels: true,
    useMaxWidth: false,
    padding: 14,
    nodeSpacing: 40,
    rankSpacing: 50,
    wrappingWidth: 190
  },
  state: { useMaxWidth: false, padding: 10 },
  sequence: {
    useMaxWidth: false,
    wrap: true,
    width: 170,
    height: 60,
    bottomMarginAdj: 4,
    actorMargin: 60,
    messageMargin: 32,
    boxMargin: 10,
    noteMargin: 10,
    mirrorActors: false,
    showSequenceNumbers: false,
    actorFontFamily: FONT,
    messageFontFamily: FONT,
    noteFontFamily: FONT
  },
  timeline: { useMaxWidth: false, disableMulticolor: true, padding: 10 },
  themeVariables: {
    fontFamily: FONT,
    fontSize: '12px',
    background: '#ffffff',
    primaryColor: '#ffffff',
    primaryTextColor: INK,
    primaryBorderColor: INK,
    secondaryColor: '#ffffff',
    secondaryBorderColor: INK,
    secondaryTextColor: INK,
    tertiaryColor: '#ffffff',
    tertiaryBorderColor: INK,
    tertiaryTextColor: INK,
    lineColor: INK,
    textColor: INK,
    mainBkg: '#ffffff',
    nodeBorder: INK,
    clusterBkg: '#ffffff',
    clusterBorder: INK,
    titleColor: INK,
    edgeLabelBackground: '#ffffff',
    actorBkg: '#ffffff',
    actorBorder: INK,
    actorTextColor: INK,
    actorLineColor: '#555555',
    signalColor: INK,
    signalTextColor: INK,
    labelBoxBkgColor: '#ffffff',
    labelBoxBorderColor: INK,
    labelTextColor: INK,
    loopTextColor: INK,
    activationBkgColor: '#f2f2f2',
    activationBorderColor: INK,
    noteBkgColor: '#fff2cc',
    noteBorderColor: '#d6b656',
    noteTextColor: INK,
    sequenceNumberColor: '#ffffff',
    // timeline sections (cScale*) all white
    ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [
      [`cScale${i}`, '#ffffff'], [`cScaleLabel${i}`, INK], [`cScaleInv${i}`, INK]
    ]).flat()),
    // state diagrams
    stateBkg: '#ffffff',
    stateBorder: INK,
    compositeBackground: '#ffffff',
    compositeTitleBackground: '#ffffff',
    altBackground: '#ffffff',
    transitionColor: INK,
    transitionLabelColor: INK,
    specialStateColor: INK,
    innerEndBackground: INK
  },
  themeCSS: `
    * { font-family: ${FONT} !important; }
    .node rect, .node polygon, .node circle, .node ellipse, .node path { stroke-width: 1px !important; }
    .cluster rect { stroke-width: 1px !important; rx: 0; ry: 0; }
    .flowchart-link, .edgePath .path, .transition { stroke-width: 1px !important; }
    .edgeLabel, .edgeLabel p, .edgeLabel span { background: #fff !important; color: ${INK} !important; font-size: 11px !important; }
    .labelBkg { background: #fff !important; }
    .nodeLabel, .nodeLabel p { color: ${INK} !important; line-height: 1.3; }
    .cluster-label .nodeLabel, .cluster-label p { font-size: 12px !important; }
    .actor { stroke-width: 1px !important; rx: 0; ry: 0; }
    .actor-line { stroke-dasharray: 4 3; }
    .messageLine0, .messageLine1 { stroke-width: 1px !important; }
    .messageText { fill: ${INK} !important; }
    .loopText, .loopText > tspan, .labelText, .labelText > tspan { font-size: 12px !important; }
    .note { stroke-width: 1px !important; }
    .loopLine { stroke: ${MUTED} !important; stroke-width: 1px !important; }
    .labelBox { fill: #f2f2f2 !important; stroke: ${MUTED} !important; }
    .timeline-node rect, .section-edge, .node-bkg { fill: #fff !important; stroke: ${INK} !important; }
    .statediagram-cluster rect, .statediagram-state rect { rx: 4; ry: 4; }
    .statediagram-state .divider { stroke: ${INK} !important; }
  `
}

// Runs in the page after mermaid has produced the SVG: squares off flowchart group frames and
// moves their titles into a draw.io-style tab at the top-left corner of the frame.
function postProcess(svg) {
  const NS = 'http://www.w3.org/2000/svg'
  // Sequence diagrams: mermaid draws lifelines to a height estimated before wrapping, leaving a
  // long empty tail. Cut them just below the last message / note / block.
  const lifelines = svg.querySelectorAll('line.actor-line, line[class*="actor-line"]')
  if (lifelines.length) {
    let bottom = 0
    for (const el of svg.querySelectorAll('.messageLine0, .messageLine1, .note, rect.rect, .loopLine, .messageText, .noteText, .sequenceNumber')) {
      const b = el.getBBox(); bottom = Math.max(bottom, b.y + b.height)
    }
    for (const l of lifelines) if (+l.getAttribute('y2') > bottom + 24) l.setAttribute('y2', bottom + 24)
    // Wrapping has no break opportunities in Japanese, so mermaid splits mid-word and adds a
    // hyphen. Japanese doesn't hyphenate; drop it when it follows a CJK/kana character.
    for (const t of svg.querySelectorAll('text.messageText, text.noteText, text.actor, text.labelText, text.loopText, tspan')) {
      if (t.children.length) continue
      const v = t.textContent
      if (/[\u3000-\u9fff\uff00-\uffef]-$/.test(v)) t.textContent = v.slice(0, -1)
    }
    // Self-messages: mermaid centres the label on the lifeline, right on top of the number badge.
    // Move it beside the loop instead, left-aligned, vertically centred on it.
    for (const loop of svg.querySelectorAll('path.messageLine0, path.messageLine1')) {
      if (loop.dataset.from !== loop.dataset.to) continue
      const m = /M\s*([-\d.]+),([-\d.]+)/.exec(loop.getAttribute('d') || '')
      if (!m) continue
      const lx = +m[1], ly = +m[2]
      const texts = []
      for (let el = loop.previousElementSibling; el && el.matches('text.messageText'); el = el.previousElementSibling) texts.unshift(el)
      if (!texts.length) continue
      const top = Math.min(...texts.map((t) => t.getBBox().y))
      const bottom = Math.max(...texts.map((t) => { const b = t.getBBox(); return b.y + b.height }))
      const dy = ly + 10 - (top + bottom) / 2
      for (const t of texts) {
        t.setAttribute('x', lx + 70)
        t.setAttribute('y', +t.getAttribute('y') + dy)
        t.setAttribute('text-anchor', 'start')
        t.style.textAnchor = 'start'
      }
    }
    // A label wider than its arrow runs into the number badge at the arrow's start. Slide it
    // sideways, away from the badge, until it clears.
    for (const ln of svg.querySelectorAll('line.messageLine0, line.messageLine1')) {
      // the badge number follows the arrow, after an invisible line that carries the circle marker
      let badge = null
      for (let el = ln.nextElementSibling, n = 0; el && n < 3 && !el.matches('text.messageText'); el = el.nextElementSibling, n++) {
        if (el.matches('text.sequenceNumber')) { badge = el; break }
      }
      const texts = []
      for (let el = ln.previousElementSibling; el && el.matches('text.messageText'); el = el.previousElementSibling) texts.unshift(el)
      if (!badge || !texts.length) continue
      const bb = badge.getBBox()
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2, r = 11
      const boxes = texts.map((t) => t.getBBox())
      const x0 = Math.min(...boxes.map((b) => b.x)), x1 = Math.max(...boxes.map((b) => b.x + b.width))
      const y0 = Math.min(...boxes.map((b) => b.y)), y1 = Math.max(...boxes.map((b) => b.y + b.height))
      if (!(x0 < cx + r && x1 > cx - r && y0 < cy + r && y1 > cy - r)) continue
      const leftToRight = +ln.getAttribute('x1') < +ln.getAttribute('x2')
      const dx = leftToRight ? cx + r - x0 : cx - r - x1
      for (const t of texts) t.setAttribute('x', +t.getAttribute('x') + dx)
    }
    // White plate behind each message label so lifelines don't strike through the text
    for (const t of svg.querySelectorAll('text.messageText')) {
      const b = t.getBBox()
      const bg = document.createElementNS(NS, 'rect')
      bg.setAttribute('x', b.x - 3); bg.setAttribute('y', b.y - 1)
      bg.setAttribute('width', b.width + 6); bg.setAttribute('height', b.height + 2)
      bg.setAttribute('fill', '#fff')
      t.parentNode.insertBefore(bg, t)
    }
    // Grow notes that the wrapped text still overflows
    for (const note of svg.querySelectorAll('rect.note')) {
      const g = note.parentNode
      const texts = [...g.querySelectorAll('text.noteText')]
      if (!texts.length) continue
      let x0 = Infinity, x1 = -Infinity
      for (const t of texts) { const b = t.getBBox(); x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.width) }
      const nx = +note.getAttribute('x'), nw = +note.getAttribute('width')
      if (x0 - 8 < nx || x1 + 8 > nx + nw) {
        const l = Math.min(nx, x0 - 8), r = Math.max(nx + nw, x1 + 8)
        note.setAttribute('x', l); note.setAttribute('width', r - l)
      }
    }
  }
  // Everything a group title must not sit on: connector points and boxes, in the svg's own space
  const root = svg.getScreenCTM().inverse()
  const toRoot = (el) => root.multiply(el.getScreenCTM())
  const edgePts = []
  for (const path of svg.querySelectorAll('path[data-edge="true"], path.transition, path.flowchart-link')) {
    const m = toRoot(path), len = path.getTotalLength()
    for (let d = 0; d <= len; d += 2) edgePts.push(path.getPointAtLength(d).matrixTransform(m))
  }
  const nodeBoxes = [...svg.querySelectorAll('g.node')].map((g) => {
    const b = g.getBBox(), m = toRoot(g)
    const p0 = new DOMPoint(b.x, b.y).matrixTransform(m), p1 = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(m)
    return { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y }
  })
  for (const cluster of svg.querySelectorAll('g.cluster')) {
    const rect = cluster.querySelector(':scope > rect')
    const label = cluster.querySelector(':scope > .cluster-label')
    if (!rect || !label) continue
    const rx = +rect.getAttribute('x'), y = +rect.getAttribute('y'), rw = +rect.getAttribute('width')
    const lb = label.getBBox()
    if (!lb.width) continue
    const padX = 8, padY = 4
    const tw = lb.width + padX * 2, th = lb.height + padY * 2
    // The tab goes top-left like draw.io, unless a connector entering the group runs through
    // that spot: then slide it right along the top edge to the first clear position.
    const cm = toRoot(cluster)
    // cost of a tab at tx: connector points under it (a box underneath rules the spot out)
    const cost = (tx) => {
      const p0 = new DOMPoint(tx - 3, y - 1).matrixTransform(cm), p1 = new DOMPoint(tx + tw + 3, y + th + 2).matrixTransform(cm)
      const b = { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y }
      if (nodeBoxes.some((n) => n.x0 < b.x1 && b.x0 < n.x1 && n.y0 < b.y1 && b.y0 < n.y1)) return Infinity
      return edgePts.filter((p) => p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1).length
    }
    let x = rx, best = cost(rx)
    for (let tx = rx + 4; best > 0 && tx <= rx + rw - tw; tx += 4) {
      const c = cost(tx)
      if (c < best) { best = c; x = tx }
    }
    // No clear spot (every stretch of the top edge has a connector entering): the tab is lifted
    // above the connectors below, so a line passes behind the title instead of through its text.
    const raised = best > 0
    const tab = document.createElementNS(NS, 'rect')
    tab.setAttribute('x', x); tab.setAttribute('y', y)
    tab.setAttribute('width', tw); tab.setAttribute('height', th)
    tab.setAttribute('class', 'cluster-tab')
    tab.setAttribute('style', 'fill:#fff;stroke:#000;stroke-width:1px')
    cluster.insertBefore(tab, label)
    // label's translate() positions its own origin; shift it so its box lands inside the tab
    const m = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(label.getAttribute('transform') || '')
    const tx = m ? +m[1] : 0, ty = m ? +m[2] : 0
    label.setAttribute('transform', `translate(${tx + (x + padX - (tx + lb.x))}, ${ty + (y + padY - (ty + lb.y))})`)
    if (raised) {
      const top = document.createElementNS(NS, 'g')
      top.setAttribute('class', 'cluster-tab-raised')
      top.setAttribute('transform', `matrix(${cm.a} ${cm.b} ${cm.c} ${cm.d} ${cm.e} ${cm.f})`)
      top.append(tab, label)
      svg.append(top)
    }
  }
}

// Runs in the page after postProcess: lists every place a connector runs through text or a box it
// does not belong to, or two labels overlap. `--audit` prints these; rendering itself uses the
// count to pick the best of several layouts (see LAYOUT_VARIANTS).
function audit(svg) {
  const out = []
  const root = svg.getScreenCTM().inverse()
  const mat = (el) => root.multiply(el.getScreenCTM())
  const box = (el, shrink = 0) => {
    const b = el.getBBox(), m = mat(el)
    const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
      .map(([x, y]) => new DOMPoint(x, y).matrixTransform(m))
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    return { x0: Math.min(...xs) + shrink, y0: Math.min(...ys) + shrink, x1: Math.max(...xs) - shrink, y1: Math.max(...ys) - shrink }
  }
  const valid = (b) => b.x1 - b.x0 > 1 && b.y1 - b.y0 > 1
  const inside = (p, b) => p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1
  const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
  const key = (id) => (id || '').replace(/^d[0-9a-f]{16}-/, '').replace(/^(flowchart|state)-/, '').replace(/-\d+$/, '')
  const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)

  const nodes = [...svg.querySelectorAll('g.node')].map((g) => {
    const shape = g.querySelector(':scope > rect, :scope > polygon, :scope > path, :scope > circle, :scope > g.label-container, :scope > .basic, :scope > .outer-path') || g
    const label = g.querySelector(':scope > g.label, :scope > .label')
    return { id: key(g.id), name: txt(g) || key(g.id), shape: box(shape, 2), text: label ? box(label, 1) : null }
  })
  const nodeIds = new Set(nodes.map((n) => n.id))
  const clusterIds = new Set([...svg.querySelectorAll('g.cluster')].map((c) => key(c.id)))
  // (tabs lifted into .cluster-tab-raised sit above the lines, so they are skipped here)
  const titles = [...svg.querySelectorAll('g.cluster')].map((c) => {
    const t = c.querySelector(':scope > rect.cluster-tab') || c.querySelector(':scope > .cluster-label')
    return t ? { name: txt(c.querySelector(':scope > .cluster-label') || c), b: box(t, 1) } : null
  }).filter((t) => t && valid(t.b))
  const labels = [...svg.querySelectorAll('g.edgeLabel g.label[data-id], g.edgeLabel .label[data-id]')]
    .map((l) => ({ edge: l.dataset.id, name: txt(l), b: box(l, 1) })).filter((l) => valid(l.b) && l.name)
  const ends = (id) => {
    const body = id.replace(/^L_/, '').replace(/_\d+$/, '')
    const known = (x) => nodeIds.has(x) || clusterIds.has(x)
    for (let i = 1; i < body.length; i++) {
      if (body[i] !== '_') continue
      const a = body.slice(0, i), b = body.slice(i + 1)
      if (known(a) && known(b)) return [a, b]
    }
    return []
  }
  for (const path of svg.querySelectorAll('path[data-edge="true"], path.transition, path.flowchart-link')) {
    const id = path.dataset.id || key(path.id)
    const [from, to] = ends(id)
    const m = mat(path)
    const len = path.getTotalLength()
    const pts = []
    for (let d = 0; d <= len; d += 2) pts.push(path.getPointAtLength(d).matrixTransform(m))
    const hit = (b) => pts.some((p) => inside(p, b))
    const edgeName = `${from || '?'} -> ${to || '?'}`
    for (const t of titles) if (hit(t.b)) out.push(`line ${edgeName} crosses group title "${t.name}"`)
    for (const n of nodes) {
      if (n.id !== from && n.id !== to && hit(n.shape)) out.push(`line ${edgeName} crosses box "${n.name}"`)
      else if (n.text && hit(n.text) && n.id !== from && n.id !== to) out.push(`line ${edgeName} crosses text "${n.name}"`)
    }
    for (const l of labels) if (l.edge !== id && hit(l.b)) out.push(`line ${edgeName} crosses label "${l.name}"`)
  }
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) if (overlap(labels[i].b, labels[j].b)) out.push(`label "${labels[i].name}" overlaps label "${labels[j].name}"`)
    for (const n of nodes) if (overlap(labels[i].b, n.shape)) out.push(`label "${labels[i].name}" overlaps box "${n.name}"`)
    for (const t of titles) if (overlap(labels[i].b, t.b)) out.push(`label "${labels[i].name}" overlaps group title "${t.name}"`)
  }
  // Sequence diagrams: text blocks colliding with each other or with notes / number badges
  const seqText = [...svg.querySelectorAll('text.messageText, text.noteText, text.loopText, text.labelText')]
  if (seqText.length) {
    const items = [
      ...seqText.map((t) => ({ kind: 'text', name: txt(t), b: box(t, 1), el: t })),
      ...[...svg.querySelectorAll('rect.note')].map((r) => ({ kind: 'note', name: txt(r.parentNode), b: box(r, 1), el: r })),
      // the badge circle lives in a <marker>; its number text sits at the circle's centre (r = 8)
      ...[...svg.querySelectorAll('text.sequenceNumber')].map((t) => {
        const c = box(t)
        const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2
        return { kind: 'badge', name: `#${txt(t)}`, b: { x0: cx - 7, y0: cy - 7, x1: cx + 7, y1: cy + 7 }, el: t }
      })
    ].filter((x) => valid(x.b))
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]
      if (a.kind !== 'text' && b.kind !== 'text') continue
      if (a.kind === 'note' && a.el.parentNode.contains(b.el)) continue
      if (b.kind === 'note' && b.el.parentNode.contains(a.el)) continue
      if (a.kind === 'text' && b.kind === 'text' && a.el.parentNode === b.el.parentNode && a.el.classList.value === b.el.classList.value) continue
      if (overlap(a.b, b.b)) out.push(`${a.kind} "${a.name}" overlaps ${b.kind} "${b.name}"`)
    }
  }
  if (window.__auditDebug) out.push(`DEBUG nodes=${nodes.length} titles=${titles.length} labels=${labels.length} edges=${svg.querySelectorAll('path[data-edge="true"], path.transition, path.flowchart-link').length} ends=${[...svg.querySelectorAll('path[data-edge="true"]')].map((p) => ends(p.dataset.id).length).join("")}`)
  return [...new Set(out)]
}

// ---------------------------------------------------------------------------------------------

const MIME = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.html': 'text/html', '.map': 'application/json' }
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff} #stage{display:inline-block;padding:20px;background:#fff}</style>
</head><body><div id="stage"></div>
<script type="module">
  import mermaid from '/node_modules/mermaid/dist/mermaid.esm.min.mjs'
  import elk from '/node_modules/@mermaid-js/layout-elk/dist/mermaid-layout-elk.esm.min.mjs'
  mermaid.registerLayoutLoaders(elk)
  window.__mermaid = mermaid
  window.__ready = true
</script></body></html>`

const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE) }
  const file = join(ROOT, url)
  if (!file.startsWith(join(ROOT, 'node_modules')) || !existsSync(file)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
    '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ]
  const hit = candidates.find((p) => p && existsSync(p))
  if (!hit) throw new Error('No Chrome/Chromium found. Set CHROME_PATH.')
  return hit
}

let failed = 0
let totalIssues = 0
if (todo.length) {
  const puppeteer = (await import('puppeteer-core')).default
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.waitForFunction('window.__ready === true')
  if (process.env.AUDIT_DEBUG) await page.evaluate(() => { window.__auditDebug = true })
  await page.evaluate((cfg) => window.__mermaid.initialize(cfg), mermaidConfig)

  let i = 0
  for (const [hash, d] of todo) {
    i++
    try {
      const code = d.code
      // stateDiagram / sequence / timeline ignore ELK or break with it; only flowcharts use it
      const isFlow = /^\s*(flowchart|graph|stateDiagram)/m.test(code.split('\n').find((l) => l.trim() && !l.trim().startsWith('%%')) || '')
      const issues = await page.evaluate(async ({ code, hash, isFlow, cfg, post, check }) => {
        const m = window.__mermaid
        m.initialize({ ...cfg, layout: isFlow ? 'elk' : 'dagre' })
        const stage = document.getElementById('stage')
        stage.innerHTML = ''
        const { svg } = await m.render(`d${hash}`, code)
        stage.innerHTML = svg
        const el = stage.querySelector('svg')
        // eslint-disable-next-line no-new-func
        new Function('svg', `(${post})(svg)`)(el)
        // Re-fit the viewBox to the drawn content so nothing is clipped after post-processing
        const bb = el.getBBox()
        const pad = 4
        el.setAttribute('viewBox', `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`)
        el.setAttribute('width', Math.ceil(bb.width + pad * 2))
        el.setAttribute('height', Math.ceil(bb.height + pad * 2))
        el.style.maxWidth = 'none'
        // eslint-disable-next-line no-new-func
        return new Function('svg', `return (${check})(svg)`)(el)
      }, { code, hash, isFlow, cfg: mermaidConfig, post: postProcess.toString(), check: audit.toString() })
      await page.evaluate(() => document.fonts.ready)
      const stage = await page.$('#stage')
      if (process.env.DIAGRAM_SVG_DIR) writeFileSync(join(process.env.DIAGRAM_SVG_DIR, `${hash}.svg`), await page.$eval('#stage', (e) => e.innerHTML))
      writeFileSync(pngPath(hash), await stage.screenshot({ type: 'png', omitBackground: false }))
      process.stdout.write(`[${i}/${todo.length}] ${hash}  ${d.sources[0]}${issues.length ? `  (${issues.length} collisions)` : ''}\n`)
      if (args.has('--audit')) for (const x of issues) process.stdout.write(`    - ${x}\n`)
      totalIssues += issues.length
    } catch (err) {
      failed++
      console.error(`[${i}/${todo.length}] FAILED ${d.sources.join(', ')}\n  ${String(err?.message || err).split('\n')[0]}`)
    }
  }
  await browser.close()
}
server.close()

// Drop images that no fence refers to any more
let pruned = 0
if (!match) for (const name of readdirSync(OUT)) {
  if (name.endsWith('.png') && !diagrams.has(name.slice(0, -4))) { unlinkSync(join(OUT, name)); pruned++ }
}

console.log(`${diagrams.size} diagrams, ${todo.length - failed} rendered, ${failed} failed, ${pruned} stale images removed, ${totalIssues} collisions`)
process.exit(failed ? 1 : 0)
