#!/usr/bin/env node
//
// Renders every draw.io diagram the docs reference to a static PNG in docs/public/diagrams/.
//
// Diagrams are .drawio files kept next to the pages that use them (docs/<section>/diagrams/) and
// edited in draw.io: the desktop app, app.diagrams.net, or the "Draw.io Integration" extension in
// VS Code. A page embeds one with plain image syntax:
//
//   ![How it fits together](./diagrams/wifi-hotspot-how-it-fits-together.drawio)
//
// Readers never get the .drawio file or an in-browser editor: the markdown hook in
// docs/.vitepress/config.mts turns that reference into an <img> of diagrams/<hash>.png, where
// <hash> is diagramHash() of the file. This script draws each file once with the official draw.io
// viewer in headless Chrome, so the PNG looks exactly like the diagram does in the editor.
//
// Edit a .drawio file, rerun this script, commit both. Images nothing refers to any more are deleted.
//
//   npm run docs:diagrams             render new / changed diagrams
//   npm run docs:diagrams -- --all    re-render everything (after changing RENDER_VERSION)
//   npm run docs:diagrams -- --check  exit 1 if a reference is broken or has no image (no browser)
//
// Needs a local Chrome/Chromium (set CHROME_PATH if it is not in a standard location). The first
// run downloads the pinned draw.io viewer into node_modules/.cache and checks its hash.
//
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { diagramHash, extractDrawioRefs } from './diagram-hash.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const DOCS = join(ROOT, 'docs')
const OUT = join(DOCS, 'public', 'diagrams')
const args = new Set(process.argv.slice(2))

const VIEWER_VERSION = '31.5.2'
const VIEWER_URL = `https://cdn.jsdelivr.net/gh/jgraph/drawio@${VIEWER_VERSION}/src/main/webapp/js/viewer-static.min.js`
const VIEWER_SHA256 = 'ee0c444be46c95dc1842999f133c92598fe43e7cdf279f7095d0f057c48771b1'
const VIEWER_CACHE = join(ROOT, 'node_modules', '.cache', 'drawio-viewer', VIEWER_VERSION, 'viewer-static.min.js')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.vitepress' || name === 'public' || name === 'node_modules') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// hash -> { file, sources[] }
const diagrams = new Map()
const broken = []
const mermaid = []
const all = walk(DOCS)
for (const md of all.filter((f) => f.endsWith('.md'))) {
  const src = readFileSync(md, 'utf8')
  src.split('\n').forEach((l, i) => { if (/^\s*(`{3,}|~{3,})\s*mermaid\s*$/i.test(l)) mermaid.push(`${relative(ROOT, md)}:${i + 1}`) })
  for (const { ref, line } of extractDrawioRefs(src)) {
    const file = resolve(dirname(md), decodeURI(ref))
    const where = `${relative(ROOT, md)}:${line}`
    if (!existsSync(file)) { broken.push(`${where} -> ${ref}`); continue }
    const hash = diagramHash(readFileSync(file, 'utf8'))
    if (!diagrams.has(hash)) diagrams.set(hash, { file, sources: [] })
    diagrams.get(hash).sources.push(where)
  }
}
const referenced = new Set([...diagrams.values()].map((d) => d.file))
const orphans = all.filter((f) => f.endsWith('.drawio') && !referenced.has(f))

mkdirSync(OUT, { recursive: true })
const pngPath = (hash) => join(OUT, `${hash}.png`)
const match = process.argv.find((a) => a.startsWith('--match='))?.slice(8)
const todo = [...diagrams].filter(([hash, d]) =>
  (match ? relative(ROOT, d.file).includes(match) || d.sources.some((s) => s.includes(match)) : args.has('--all') || !existsSync(pngPath(hash))))

for (const b of broken) console.error(`broken diagram reference: ${b}`)
for (const m of mermaid) console.error(`mermaid fence (diagrams are .drawio files now): ${m}`)
for (const o of orphans) console.warn(`not used by any page: ${relative(ROOT, o)}`)

if (args.has('--check')) {
  for (const [, d] of todo) console.error(`missing image: ${relative(ROOT, d.file)} (${d.sources.join(', ')})`)
  console.log(`${diagrams.size} diagrams, ${todo.length} without an image, ${broken.length} broken references`)
  process.exit(todo.length || broken.length || mermaid.length ? 1 : 0)
}

async function viewerScript() {
  if (!existsSync(VIEWER_CACHE)) {
    console.log(`downloading draw.io viewer ${VIEWER_VERSION}`)
    const res = await fetch(VIEWER_URL)
    if (!res.ok) throw new Error(`draw.io viewer download failed: HTTP ${res.status}`)
    const body = Buffer.from(await res.arrayBuffer())
    mkdirSync(dirname(VIEWER_CACHE), { recursive: true })
    writeFileSync(VIEWER_CACHE, body)
  }
  const js = readFileSync(VIEWER_CACHE)
  const sum = createHash('sha256').update(js).digest('hex')
  if (sum !== VIEWER_SHA256) { unlinkSync(VIEWER_CACHE); throw new Error(`draw.io viewer hash mismatch (${sum}); deleted the cached copy, run again`) }
  return js
}

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
if (todo.length) {
  const viewer = await viewerScript()
  const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff} #stage{display:block;width:6000px;background:#fff} #stage > div{display:inline-block}</style>
<script src="/viewer.js"></script></head><body><div id="stage"></div></body></html>`
  const server = createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE) }
    if (req.url === '/viewer.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(viewer) }
    res.writeHead(404); res.end()
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const puppeteer = (await import('puppeteer-core')).default
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.waitForFunction('typeof GraphViewer !== "undefined"')

  let i = 0
  for (const [hash, d] of todo) {
    i++
    const name = relative(ROOT, d.file)
    try {
      const ok = await page.evaluate((xml) => new Promise((done) => {
        const stage = document.getElementById('stage')
        stage.innerHTML = ''
        const div = document.createElement('div')
        stage.append(div)
        // check-visible-state off: the viewer otherwise waits for the element to scroll into view
        new GraphViewer(div, mxUtils.parseXml(xml).documentElement, {
          toolbar: null, nav: false, resize: true, border: 8, highlight: 'none', lightbox: false,
          'check-visible-state': false, 'auto-fit': false, zoom: 1
        })
        const t0 = Date.now()
        const poll = () => {
          const svg = stage.querySelector('svg')
          if (svg && svg.getBoundingClientRect().width > 0) done(true)
          else if (Date.now() - t0 > 15000) done(false)
          else setTimeout(poll, 50)
        }
        poll()
      }), readFileSync(d.file, 'utf8'))
      if (!ok) throw new Error('the draw.io viewer drew nothing (is the file a valid, uncompressed or compressed .drawio?)')
      await page.evaluate(() => document.fonts.ready)
      const svg = await page.$('#stage svg')
      writeFileSync(pngPath(hash), await svg.screenshot({ type: 'png', omitBackground: false }))
      process.stdout.write(`[${i}/${todo.length}] ${hash}  ${name}\n`)
    } catch (err) {
      failed++
      console.error(`[${i}/${todo.length}] FAILED ${name}\n  ${String(err?.message || err).split('\n')[0]}`)
    }
  }
  await browser.close()
  server.close()
}

// Drop images that nothing refers to any more
let pruned = 0
if (!match) for (const name of readdirSync(OUT)) {
  if (name.endsWith('.png') && !diagrams.has(name.slice(0, -4))) { unlinkSync(join(OUT, name)); pruned++ }
}

console.log(`${diagrams.size} diagrams, ${todo.length - failed} rendered, ${failed} failed, ${pruned} stale images removed`)
process.exit(failed || broken.length || mermaid.length ? 1 : 0)
