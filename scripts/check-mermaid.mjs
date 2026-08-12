#!/usr/bin/env node
//
// Renders every ```mermaid fence in the docs tree and fails on any that does not produce an SVG.
//
// Why this exists: VitePress never parses diagram source. The markdown hook in
// docs/.vitepress/config.mts just base64s the fence into a <Mermaid> element, so a broken diagram
// builds perfectly and only shows up as a red block of raw source on the published page. This is
// the check that turns that into a non-zero exit code.
//
// It RENDERS rather than only calling mermaid.parse(), because parse accepts several things the
// renderer then rejects. jsdom has no SVG layout engine, so the measurement APIs are stubbed with
// a crude character-count estimate: this proves the render path works and the output is an SVG.
// It says nothing about whether the finished layout looks good, which still needs a browser.
//
//   npm run docs:check-diagrams
//   node scripts/check-mermaid.mjs docs
//
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })

globalThis.window = dom.window
globalThis.document = dom.window.document
// navigator is getter-only on modern Node globals, so it has to be redefined rather than assigned.
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.Element = dom.window.Element
globalThis.SVGElement = dom.window.SVGElement
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Node = dom.window.Node
globalThis.CSSStyleSheet = dom.window.CSSStyleSheet
globalThis.DOMParser = dom.window.DOMParser
globalThis.XMLSerializer = dom.window.XMLSerializer
globalThis.getComputedStyle = dom.window.getComputedStyle
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)

// The stubs. jsdom implements the SVG DOM but measures nothing, and d3 (which mermaid lays out
// with) calls all three of these on every label.
const svgProto = dom.window.SVGElement.prototype
svgProto.getBBox = function () {
  const text = this.textContent || ''
  return { x: 0, y: 0, width: Math.max(20, text.length * 7), height: 18 }
}
svgProto.getComputedTextLength = function () {
  return Math.max(20, (this.textContent || '').length * 7)
}
svgProto.getScreenCTM = function () {
  const m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  m.inverse = () => m
  return m
}
svgProto.createSVGMatrix = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })

const mermaid = (await import('mermaid')).default
// Must match theme/components/Mermaid.vue. A stricter setting here would pass diagrams the site
// then refuses; a looser one would miss the failures this exists to catch.
mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' })

const root = resolve(process.argv[2] || 'docs')

const files = []
;(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    // .vitepress holds the build output, which carries the same diagrams already encoded.
    if (entry === 'node_modules' || entry === '.vitepress') continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.md')) files.push(p)
  }
})(root)

let total = 0
let failed = 0
let seq = 0

for (const file of files) {
  const text = readFileSync(file, 'utf-8')
  const fence = /```mermaid\n([\s\S]*?)```/g
  let match
  let n = 0
  while ((match = fence.exec(text))) {
    n += 1
    total += 1
    try {
      const { svg } = await mermaid.render(`check-${seq++}`, match[1])
      if (!svg.includes('<svg')) {
        failed += 1
        console.error(`FAIL  ${file}  diagram #${n}: rendered no <svg>`)
      }
    } catch (err) {
      failed += 1
      console.error(`FAIL  ${file}  diagram #${n}: ${String(err.message).split('\n')[0]}`)
    }
  }
}

console.log(`rendered ${total - failed}/${total} diagram(s) across ${files.length} file(s)`)
process.exit(failed ? 1 : 0)
