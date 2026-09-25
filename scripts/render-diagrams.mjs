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
  // Connectors: ELK sometimes leaves a 1-2 px step where a line should be straight (ports a hair
  // apart), and mermaid rounds every bend, so the step shows as a visible kink. Snap near-straight
  // segments onto their neighbour, working back from the arrowhead so the tip stays exact, then
  // redraw the path with the same small rounded corners.
  for (const path of svg.querySelectorAll('path[data-edge="true"][data-points]')) {
    let pts
    try { pts = JSON.parse(atob(path.dataset.points)) } catch { continue }
    if (!Array.isArray(pts) || pts.length < 3) continue
    const orig = pts.map((p) => ({ ...p }))
    for (let i = pts.length - 2; i >= 0; i--) {
      const a = pts[i], b = pts[i + 1]
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y)
      if (dy > 0 && dy < 7 && dx > dy * 2) a.y = b.y
      else if (dx > 0 && dx < 7 && dy > dx * 2) a.x = b.x
    }
    // A short perpendicular step between two parallel runs (_|- shape): lift the earlier run onto
    // the later one so the step disappears
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i + 2 < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], c = pts[i + 1], d = pts[i + 2]
        const step = Math.hypot(c.x - b.x, c.y - b.y)
        if (step === 0 || step >= 8) continue
        if (Math.abs(a.y - b.y) < 0.5 && Math.abs(c.y - d.y) < 0.5 && Math.abs(b.x - c.x) < 0.5) { a.y = b.y = c.y }
        else if (Math.abs(a.x - b.x) < 0.5 && Math.abs(c.x - d.x) < 0.5 && Math.abs(b.y - c.y) < 0.5) { a.x = b.x = c.x }
      }
    }
    if (pts.every((p, i) => p.x === orig[i].x && p.y === orig[i].y)) continue
    // drop points that are now on a straight line with their neighbours
    const clean = [pts[0]]
    for (let i = 1; i < pts.length - 1; i++) {
      const a = clean[clean.length - 1], b = pts[i], c = pts[i + 1]
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
      if (Math.abs(cross) > 0.01 && (a.x !== b.x || a.y !== b.y)) clean.push(b)
    }
    clean.push(pts[pts.length - 1])
    // the drawn path stops short of the raw points where a marker sits; keep those gaps
    const len = path.getTotalLength()
    const s0 = path.getPointAtLength(0), s1 = path.getPointAtLength(len)
    const first = orig[0], last = orig[orig.length - 1]
    const gapStart = Math.hypot(s0.x - first.x, s0.y - first.y), gapEnd = Math.hypot(s1.x - last.x, s1.y - last.y)
    const pull = (p, q, d) => { const l = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: p.x + (q.x - p.x) * d / l, y: p.y + (q.y - p.y) * d / l } }
    const P = clean.map((p) => ({ ...p }))
    P[0] = pull(P[0], P[1], gapStart)
    P[P.length - 1] = pull(P[P.length - 1], P[P.length - 2], gapEnd)
    const R = 5
    let d = `M${P[0].x},${P[0].y}`
    for (let i = 1; i < P.length - 1; i++) {
      const a = P[i - 1], b = P[i], c = P[i + 1]
      const r = Math.min(R, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2)
      const p1 = pull(b, a, r), p2 = pull(b, c, r)
      d += `L${p1.x},${p1.y}Q${b.x},${b.y} ${p2.x},${p2.y}`
    }
    d += `L${P[P.length - 1].x},${P[P.length - 1].y}`
    path.setAttribute('d', d)
  }
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
    const rx = +rect.getAttribute('x'), ry = +rect.getAttribute('y')
    const rw = +rect.getAttribute('width'), rh = +rect.getAttribute('height')
    if (!label.getBBox().width) continue
    const padX = 8, padY = 4
    const cm = toRoot(cluster)
    // The tab goes top-left like draw.io. Every other spot along the top edge, then along the
    // bottom edge, is scored too: a connector under the tab is ruled out, a connector within
    // CLEAR px (or a box within 4 px) is penalised as cramped, and distance from top-left costs a
    // little so the tab only moves when it has to.
    const CLEAR = 10
    const over = (n, q) => n.x0 < q.x1 && q.x0 < n.x1 && n.y0 < q.y1 && q.y0 < n.y1
    const inB = (p, q) => p.x > q.x0 && p.x < q.x1 && p.y > q.y0 && p.y < q.y1
    const search = (tw, th) => {
      const cost = (tx, ty) => {
        const p0 = new DOMPoint(tx, ty).matrixTransform(cm), p1 = new DOMPoint(tx + tw, ty + th).matrixTransform(cm)
        const b = { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y }
        const grow = (m) => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m })
        if (nodeBoxes.some((n) => over(n, grow(1)))) return { hard: 1e6, soft: 0 }
        let soft = nodeBoxes.filter((n) => over(n, grow(4))).length * 20
        const g = grow(CLEAR), h = grow(2)
        let hard = 0
        for (const p of edgePts) { if (inB(p, h)) hard++; else if (inB(p, g)) soft++ }
        return { hard, soft }
      }
      let best = null
      for (const [edge, ty] of [[0, ry], [1, ry + rh - th]]) {
        if (edge && rh < th * 3) break
        for (let tx = rx; tx <= rx + rw - tw + 0.1; tx += 4) {
          const c = cost(tx, ty)
          const score = c.hard * 1000 + c.soft * 4 + (tx - rx) / 40 + edge * 120
          if (!best || score < best.score) best = { score, hard: c.hard, soft: c.soft, x: tx, y: ty }
        }
      }
      // A title wider than its group: no position fits, so it simply sits at the top-left corner
      if (!best) { const c = cost(rx, ry); best = { score: c.hard * 1000 + c.soft * 4, hard: c.hard, soft: c.soft, x: rx, y: ry } }
      return best
    }
    // If the one-line title has nowhere clear to go, try it wrapped onto more lines: a narrower
    // tab often fits between the connectors that enter the group.
    const fo = label.querySelector('foreignObject'), div = fo?.querySelector('div')
    const natural = fo ? { w: fo.getAttribute('width'), h: fo.getAttribute('height'), style: div.getAttribute('style') } : null
    const wrapTo = (w) => {
      if (!fo || !div) return
      if (w == null) { fo.setAttribute('width', natural.w); fo.setAttribute('height', natural.h); div.setAttribute('style', natural.style); return }
      div.setAttribute('style', `${natural.style}; display: block; white-space: normal; width: ${w}px; text-align: left`)
      fo.setAttribute('width', w); fo.setAttribute('height', 400)
      const unit = fo.getBoundingClientRect().width / w || 1
      // shrink to the widest wrapped line, then fit the height to the text
      const range = document.createRange(); range.selectNodeContents(div)
      const lines = [...range.getClientRects()]
      const lw = Math.ceil(Math.max(...lines.map((r) => r.width)) / unit)
      const lh = Math.ceil(div.getBoundingClientRect().height / unit)
      fo.setAttribute('width', lw); fo.setAttribute('height', lh)
      div.style.width = `${lw}px`
    }
    const measure = () => { const lb = label.getBBox(); return { lb, tw: lb.width + padX * 2, th: lb.height + padY * 2 } }
    let pick = { wrap: null, ...measure() }
    let best = search(pick.tw, pick.th)
    const naturalW = pick.lb.width
    // A title wider than its own group always wraps, to the group's width at most
    const fitW = Math.round(rw * 0.75) - padX * 2
    const tooWide = pick.tw > rw - 12
    if (tooWide) best.score += 1e5
    if ((best.hard > 0 || best.soft > 0 || tooWide) && fo && div) {
      const widths = [0.7, 0.55, 0.4].map((f) => Math.max(60, Math.round(naturalW * f)))
      if (tooWide) widths.unshift(fitW)
      for (const w0 of widths) {
        const w = Math.min(w0, fitW)
        wrapTo(w)
        const mm = measure()
        const b2 = search(mm.tw, mm.th)
        b2.score += 6 // a wrapped title costs a little: only worth it when it buys real clearance
        if (b2.score < best.score) { best = b2; pick = { wrap: w, ...mm } }
      }
      wrapTo(pick.wrap)
    }
    const { lb, tw, th } = measure()
    let x = best.x, y = best.y
    // A wrapped title is taller than the band the layout reserved for one line. If nothing enters
    // through the top edge and nothing sits just above, grow the group upward by the difference so
    // the tab keeps its breathing room above the first box.
    if (pick.wrap != null && y === ry) {
      const oneLine = +natural.h + padY * 2
      const extra = Math.ceil(th - oneLine)
      if (extra > 0) {
        const t0 = new DOMPoint(rx, ry - extra - 4).matrixTransform(cm), t1 = new DOMPoint(rx + rw, ry + 4).matrixTransform(cm)
        const band = { x0: t0.x, y0: t0.y, x1: t1.x, y1: t1.y }
        const clear = !edgePts.some((p) => inB(p, band)) && !nodeBoxes.some((n) => over(n, band))
        if (clear) {
          rect.setAttribute('y', ry - extra)
          rect.setAttribute('height', rh + extra)
          y = ry - extra
        }
      }
    }
    // Nowhere clear (connectors enter along both edges): the tab is lifted above the connectors,
    // so a line passes behind the title instead of through its text.
    const raised = best.hard > 0
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

// Layout variants tried per flowchart, in order of preference (see the render loop)
const LAYOUT_VARIANTS = [
  {},
  { elk: { nodePlacementStrategy: 'BRANDES_KOEPF' } },
  { flowchart: { nodeSpacing: 60, rankSpacing: 70 } },
  { elk: { nodePlacementStrategy: 'BRANDES_KOEPF' }, flowchart: { nodeSpacing: 60, rankSpacing: 70 } },
  { elk: { nodePlacementStrategy: 'LINEAR_SEGMENTS' }, flowchart: { nodeSpacing: 60, rankSpacing: 70 } },
]
const withVariant = (base, v) => ({ ...base, elk: { ...base.elk, ...v.elk }, flowchart: { ...base.flowchart, ...v.flowchart } })

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
  const titles = [...svg.querySelectorAll('g.cluster')].map((c) => {
    const t = c.querySelector(':scope > rect.cluster-tab') || c.querySelector(':scope > .cluster-label')
    return t ? { name: txt(c.querySelector(':scope > .cluster-label') || c), b: box(t, 1) } : null
  }).filter((t) => t && valid(t.b))
  // Tabs lifted above the lines (no clear spot on the group's edges): the text is readable, but a
  // connector disappears under it, which is the next worst thing.
  const raisedTitles = [...svg.querySelectorAll('g.cluster-tab-raised')].map((g) => ({ name: txt(g), b: box(g.querySelector('rect'), 1) }))
  const grow = (b, m) => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m })
  const groupRects = [...svg.querySelectorAll('g.cluster')].map((c) => {
    const r = c.querySelector(':scope > rect:not(.cluster-tab)')
    return r ? { name: txt(c.querySelector('.cluster-label') || c), ...box(r) } : null
  }).filter(Boolean)
  const edgeSamples = []
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
    const m = mat(path)
    const len = path.getTotalLength()
    const pts = []
    for (let d = 0; d <= len; d += 2) pts.push(path.getPointAtLength(d).matrixTransform(m))
    let [from, to] = ends(id)
    // State diagram transitions carry no node ids: take the boxes the line starts and ends at
    const at = (p) => nodes.filter((n) => inside(p, grow(n.shape, 10)))
      .sort((a, b) => (a.shape.x1 - a.shape.x0) * (a.shape.y1 - a.shape.y0) - (b.shape.x1 - b.shape.x0) * (b.shape.y1 - b.shape.y0))[0]?.id
    if (!from && pts.length) from = at(pts[0])
    if (!to && pts.length) to = at(pts[pts.length - 1])
    const hit = (b) => pts.some((p) => inside(p, b))
    const edgeName = `${from || '?'} -> ${to || '?'}`
    edgeSamples.push({ name: edgeName, pts })
    // "~" marks a soft finding: legible, but cramped or hidden
    for (const t of titles) {
      if (hit(t.b)) out.push(`line ${edgeName} crosses group title "${t.name}"`)
      else if (hit(grow(t.b, 6))) out.push(`~ line ${edgeName} runs within 6px of group title "${t.name}"`)
    }
    for (const t of raisedTitles) if (hit(t.b)) out.push(`~ line ${edgeName} is hidden under group title "${t.name}"`)
    // A connector running along a group's border for a stretch reads as part of the border
    for (const g of groupRects) {
      let run = 0, longest = 0
      for (const p of pts) {
        const onV = (Math.abs(p.x - g.x0) < 3 || Math.abs(p.x - g.x1) < 3) && p.y > g.y0 - 3 && p.y < g.y1 + 3
        const onH = (Math.abs(p.y - g.y0) < 3 || Math.abs(p.y - g.y1) < 3) && p.x > g.x0 - 3 && p.x < g.x1 + 3
        run = onV || onH ? run + 2 : 0
        longest = Math.max(longest, run)
      }
      if (longest > 16) out.push(`~ line ${edgeName} runs along the border of group "${g.name}" for ${longest}px`)
    }
    for (const n of nodes) {
      if (n.id !== from && n.id !== to && hit(n.shape)) out.push(`line ${edgeName} crosses box "${n.name}"`)
      else if (n.text && hit(n.text) && n.id !== from && n.id !== to) out.push(`line ${edgeName} crosses text "${n.name}"`)
      else if (n.id !== from && n.id !== to && hit(grow(n.shape, 5))) out.push(`~ line ${edgeName} runs within 5px of box "${n.name}"`)
    }
    for (const l of labels) if (l.edge !== id && hit(l.b)) out.push(`line ${edgeName} crosses label "${l.name}"`)
  }
  // Arrowheads landing right next to each other read as one blurred arrow
  for (let i = 0; i < edgeSamples.length; i++) for (let j = i + 1; j < edgeSamples.length; j++) {
    const a = edgeSamples[i].pts.at(-1), b = edgeSamples[j].pts.at(-1)
    if (a && b && Math.hypot(a.x - b.x, a.y - b.y) < 12) out.push(`~ arrowheads of ${edgeSamples[i].name} and ${edgeSamples[j].name} are ${Math.round(Math.hypot(a.x - b.x, a.y - b.y))}px apart`)
  }
  // Two connectors drawn on top of each other for more than a few px read as one line
  for (let i = 0; i < edgeSamples.length; i++) {
    const a = edgeSamples[i]
    const trimA = a.pts.slice(6, -6)
    for (let j = i + 1; j < edgeSamples.length; j++) {
      const b = edgeSamples[j]
      const trimB = b.pts.slice(6, -6)
      let shared = 0
      for (const p of trimA) if (trimB.some((q) => Math.abs(p.x - q.x) < 1.5 && Math.abs(p.y - q.y) < 1.5)) shared++
      if (shared * 2 > 16) out.push(`~ line ${a.name} overlaps line ${b.name} for ${shared * 2}px`)
    }
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
      const renderOnce = (cfg) => page.evaluate(async ({ code, hash, isFlow, cfg, post, check }) => {
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
      }, { code, hash, isFlow, cfg, post: postProcess.toString(), check: audit.toString() })
      // Flowcharts: try each layout variant and keep the one the audit likes best (a hard finding
      // costs 10, a "~" one 1). Ties keep the earlier variant, so the default wins when it is clean.
      const variants = isFlow ? LAYOUT_VARIANTS : [{}]
      let best = null
      for (let v = 0; v < variants.length; v++) {
        const cfg = withVariant(mermaidConfig, variants[v])
        const found = await renderOnce(cfg)
        const score = found.reduce((n, x) => n + (x.startsWith('~') ? 1 : 10), 0)
        if (!best || score < best.score) best = { score, v, cfg, found }
        if (score === 0) break
      }
      if (best.v !== variants.length - 1 || best.score !== 0) await renderOnce(best.cfg)
      const issues = best.found
      await page.evaluate(() => document.fonts.ready)
      const stage = await page.$('#stage')
      if (process.env.DIAGRAM_SVG_DIR) writeFileSync(join(process.env.DIAGRAM_SVG_DIR, `${hash}.svg`), await page.$eval('#stage', (e) => e.innerHTML))
      writeFileSync(pngPath(hash), await stage.screenshot({ type: 'png', omitBackground: false }))
      process.stdout.write(`[${i}/${todo.length}] ${hash}  ${d.sources[0]}${best.v ? `  [layout ${best.v}]` : ''}${issues.length ? `  (${issues.length} findings)` : ''}\n`)
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

console.log(`${diagrams.size} diagrams, ${todo.length - failed} rendered, ${failed} failed, ${pruned} stale images removed, ${totalIssues} findings`)
process.exit(failed ? 1 : 0)
