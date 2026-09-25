// The pinned draw.io viewer that draws the .drawio files in the browser. docs/.vitepress/drawio-assets.mjs
// serves it in dev and emits it into the build. Keeping the version, URL and hash here means there is
// one place to bump the viewer.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const VIEWER_VERSION = '31.5.2'
export const VIEWER_URL = `https://cdn.jsdelivr.net/gh/jgraph/drawio@${VIEWER_VERSION}/src/main/webapp/js/viewer-static.min.js`
export const VIEWER_SHA256 = 'ee0c444be46c95dc1842999f133c92598fe43e7cdf279f7095d0f057c48771b1'

const ROOT = resolve(import.meta.dirname, '..')
const VIEWER_CACHE = join(ROOT, 'node_modules', '.cache', 'drawio-viewer', VIEWER_VERSION, 'viewer-static.min.js')

// Returns the viewer's bytes, downloading and hash-checking it on first use.
export async function viewerBytes() {
  if (!existsSync(VIEWER_CACHE)) {
    const res = await fetch(VIEWER_URL)
    if (!res.ok) throw new Error(`draw.io viewer download failed: HTTP ${res.status}`)
    const body = Buffer.from(await res.arrayBuffer())
    mkdirSync(dirname(VIEWER_CACHE), { recursive: true })
    writeFileSync(VIEWER_CACHE, body)
  }
  const js = readFileSync(VIEWER_CACHE)
  const sum = createHash('sha256').update(js).digest('hex')
  if (sum !== VIEWER_SHA256) {
    unlinkSync(VIEWER_CACHE)
    throw new Error(`draw.io viewer hash mismatch (${sum}); deleted the cached copy, run again`)
  }
  return js
}
