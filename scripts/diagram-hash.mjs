// Shared by scripts/render-diagrams.mjs (which writes docs/public/diagrams/<hash>.png) and the
// markdown hook in docs/.vitepress/config.mts (which points each ![alt](x.drawio) at that file).
// Both sides must find the same references and hash the same bytes, so that logic lives here only.
import { createHash } from 'node:crypto'

// Bump whenever render-diagrams.mjs changes how diagrams look. It is part of every image's file
// name, so a restyle produces new URLs instead of browsers and Apache serving the cached old PNGs.
export const RENDER_VERSION = 4

// Line endings don't change the drawing (editors on Windows may rewrite them)
export function diagramHash(xml) {
  return createHash('sha256').update(`v${RENDER_VERSION}\n${xml.replace(/\r\n?/g, '\n')}`).digest('hex').slice(0, 16)
}

// Every ![alt](path.drawio) in a markdown source, skipping ones inside code blocks or code spans.
export function extractDrawioRefs(src) {
  const out = []
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  let fence = null // { char, len }
  lines.forEach((line, i) => {
    const m = /^\s*(`{3,}|~{3,})/.exec(line.replace(/^(\s*>\s?)+/, ''))
    if (fence) {
      if (m && m[1][0] === fence.char && m[1].length >= fence.len && !line.slice(line.indexOf(m[1]) + m[1].length).trim()) fence = null
      return
    }
    if (m) { fence = { char: m[1][0], len: m[1].length }; return }
    // inline code (`![x](y.drawio)` written as an example) is not a reference
    for (const r of line.replace(/(`+)[\s\S]*?\1/g, '').matchAll(/!\[([^\]]*)\]\(\s*([^)\s]+\.drawio)\s*\)/g)) out.push({ alt: r[1], ref: r[2], line: i + 1 })
  })
  return out
}
