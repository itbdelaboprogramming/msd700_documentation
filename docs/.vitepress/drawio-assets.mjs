// Vite plugin for the "direct draw.io" mode: the docs embed a live read-only draw.io viewer that
// fetches the .drawio file itself, so there is no PNG and no second copy of anything to keep in
// sync. The .drawio bytes stay the single source of truth.
//
// Diagrams are addressed by a content hash (scripts/diagram-hash.mjs), so a URL always names exact
// bytes. In dev we serve them (and the pinned viewer) from the real files on disk; in a build we
// emit them into the output next to the other public assets. Nothing is written into docs/public,
// so `vitepress dev` can never serve a stale copy.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { diagramHash } from '../../scripts/diagram-hash.mjs'
import { VIEWER_VERSION, viewerBytes } from '../../scripts/drawio-viewer.mjs'

const DOCS_DIR = fileURLToPath(new URL('..', import.meta.url))
// The pinned viewer build is part of the file name, so a new pin is a new URL and browsers can
// cache this large file forever instead of revalidating it (see the Content-* headers below).
export const VIEWER_ASSET = `diagrams/viewer-${VIEWER_VERSION}.min.js`
const SKIP = new Set(['.vitepress', 'public', 'node_modules'])

export function drawioAssets() {
  // hash -> absolute path, rebuilt on scan(). Reading ~100 small files is cheap; we only do it at
  // startup, once more if a hashed URL is unknown (a diagram added while the dev server runs), and
  // before a build emits them.
  let diagrams = new Map()
  const scan = () => {
    const next = new Map()
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (SKIP.has(name) || name.startsWith('dist')) continue
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (name.endsWith('.drawio')) next.set(diagramHash(readFileSync(p, 'utf8')), p)
      }
    }
    walk(DOCS_DIR)
    diagrams = next
  }

  const send = (res, type, body) => {
    res.setHeader('content-type', type)
    res.setHeader('cache-control', 'no-cache')
    res.end(body)
  }

  return {
    name: 'msd700-drawio-assets',
    // Run before Vite's own asset/static handling so /diagrams/*.drawio is ours, not a 404.
    enforce: 'pre',
    configResolved() {
      scan()
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0]
        const m = /\/diagrams\/(viewer-[\w.]+\.min\.js|[0-9a-f]{16}\.drawio)$/.exec(url)
        if (!m) return next()

        if (m[1].endsWith('.js')) return send(res, 'text/javascript; charset=utf-8', await viewerBytes())

        const hash = m[1].slice(0, -'.drawio'.length)
        if (!diagrams.has(hash)) scan() // a diagram may have been added since startup
        const file = diagrams.get(hash)
        if (!file) {
          res.statusCode = 404
          return res.end(`no diagram for ${hash}`)
        }
        return send(res, 'application/xml; charset=utf-8', readFileSync(file, 'utf8'))
      })
    },
    async generateBundle(options) {
      if (options.ssr) return
      scan()
      this.emitFile({ type: 'asset', fileName: VIEWER_ASSET, source: await viewerBytes() })
      for (const [hash, file] of diagrams) {
        this.emitFile({ type: 'asset', fileName: `diagrams/${hash}.drawio`, source: readFileSync(file, 'utf8') })
      }
    }
  }
}
