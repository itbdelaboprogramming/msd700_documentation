<!--
  Renders a ```mermaid fenced block as a real SVG diagram instead of preformatted text.

  The fence is rewritten into `<Mermaid code="<base64>" />` by the markdown hook in
  ../../config.mts. Base64 rather than the raw string because the diagram source contains
  quotes, angle brackets and newlines, all of which Vue would otherwise parse as template
  syntax the moment the fence became an element attribute.

  Rendering is client-side only, on purpose. Mermaid needs a DOM to measure text before it can
  lay a graph out, so there is nothing for the static build to pre-render; `onMounted` never
  runs during SSR, and the dynamic `import('mermaid')` keeps ~500 KB of layout engine out of
  every page that has no diagram on it.

  If mermaid throws (a syntax error in the source), the raw source is shown instead of an
  empty gap: a broken diagram should look broken, not look absent.
-->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useData } from 'vitepress'

const props = defineProps<{ code: string }>()

const { isDark } = useData()

const svg = ref('')
const failed = ref(false)

let seq = 0

// atob yields one char per byte, so a UTF-8 source (arrows, accented names) has to be decoded
// through TextDecoder rather than read directly as a string.
const source = computed(() => {
  try {
    const binary = atob(props.code)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return props.code
  }
})

async function render() {
  try {
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({
      startOnLoad: false,
      // Follows the reader's theme rather than picking one: the same page is read in both.
      theme: isDark.value ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'var(--vp-font-family-base)',
      flowchart: { curve: 'basis', useMaxWidth: true },
      sequence: { useMaxWidth: true, wrap: true },
      themeVariables: {
        fontSize: '14px'
      }
    })
    // A fresh id per render: mermaid keys its internal defs (arrowheads, markers) off it, and
    // re-rendering into a reused id leaves the old marker definitions attached to the document.
    const { svg: out } = await mermaid.render(`mermaid-svg-${seq++}`, source.value)
    svg.value = out
    failed.value = false
  } catch (err) {
    console.error('[mermaid] failed to render diagram:', err)
    failed.value = true
  }
}

onMounted(render)
// Re-render on theme flip. Mermaid bakes its palette into the SVG at render time, so a dark
// diagram left over on a light page is unreadable rather than merely off-brand.
watch(isDark, render)
</script>

<template>
  <div class="mermaid-figure">
    <div v-if="!failed" class="mermaid-figure__svg" v-html="svg" />
    <pre v-else class="mermaid-figure__fallback">{{ source }}</pre>
  </div>
</template>

<style scoped>
.mermaid-figure {
  margin: 24px 0;
  padding: 20px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  /* Wide diagrams scroll inside their own box; the page body must never scroll sideways. */
  overflow-x: auto;
}

.mermaid-figure__svg {
  display: flex;
  justify-content: center;
  min-height: 2rem;
}

.mermaid-figure__svg :deep(svg) {
  max-width: 100%;
  height: auto;
}

.mermaid-figure__fallback {
  margin: 0;
  white-space: pre;
  font-size: 13px;
  color: var(--vp-c-danger-1);
}
</style>
