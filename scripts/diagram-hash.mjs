// Shared by scripts/render-diagrams.mjs (which writes docs/public/diagrams/<hash>.png) and the
// markdown hook in docs/.vitepress/config.mts (which points each ```mermaid fence at that file).
// Both sides must hash the same text the same way, so the normalisation lives here only.
import { createHash } from 'node:crypto'

// Indentation, trailing spaces and surrounding blank lines don't change the diagram, and
// markdown-it and the line scanner below don't agree on them, so they are normalised away.
export function normalizeDiagram(code) {
  const lines = code.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''))
  while (lines.length && !lines[0]) lines.shift()
  while (lines.length && !lines[lines.length - 1]) lines.pop()
  const indent = Math.min(...lines.filter(Boolean).map((l) => l.match(/^ */)[0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}

// Bump whenever render-diagrams.mjs changes how diagrams look. It is part of every image's file
// name, so a restyle produces new URLs instead of browsers and Apache serving the cached old PNGs.
export const RENDER_VERSION = 2

export function diagramHash(code) {
  return createHash('sha256').update(`v${RENDER_VERSION}\n${normalizeDiagram(code)}`).digest('hex').slice(0, 16)
}

// Every ```mermaid fence in a markdown source, skipping ones nested in other code blocks.
export function extractMermaidFences(src) {
  const out = []
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  let open = null // { char, len, mermaid, start, body }
  lines.forEach((line, i) => {
    if (!open) {
      const m = /^\s*(`{3,}|~{3,})\s*([^\s`]*)/.exec(line.replace(/^(\s*>\s?)+/, '').replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''))
      if (m) open = { char: m[1][0], len: m[1].length, mermaid: m[2].toLowerCase() === 'mermaid', start: i + 1, body: [] }
      return
    }
    const close = new RegExp(`^\\s*${open.char === '`' ? '`' : '~'}{${open.len},}\\s*$`)
    if (close.test(line)) {
      if (open.mermaid) out.push({ code: open.body.join('\n'), line: open.start })
      open = null
    } else open.body.push(line)
  })
  return out
}
