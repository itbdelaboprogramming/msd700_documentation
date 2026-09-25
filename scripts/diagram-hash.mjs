// Shared by docs/.vitepress/drawio-assets.mjs (which serves/emits each .drawio under this hash) and
// the markdown hook in docs/.vitepress/config.mts (which points each ![alt](x.drawio) at that file).
// Both sides must hash the same bytes, so the function lives here only.
import { createHash } from 'node:crypto'

// Line endings don't change the drawing (editors on Windows may rewrite them)
export function diagramHash(xml) {
  return createHash('sha256').update(xml.replace(/\r\n?/g, '\n')).digest('hex').slice(0, 16)
}
