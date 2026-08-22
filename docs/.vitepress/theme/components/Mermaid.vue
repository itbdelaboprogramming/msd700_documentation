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
    const dark = isDark.value

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      fontFamily: 'var(--vp-font-family-base, system-ui, sans-serif)',
      flowchart: {
        curve: 'linear',
        useMaxWidth: false,
        htmlLabels: true,
        nodeSpacing: 45,
        rankSpacing: 45
      },
      sequence: {
        useMaxWidth: false,
        wrap: true,
        width: 170,
        messageMargin: 35,
        boxMargin: 10,
        mirrorActors: false
      },
      themeVariables: {
        darkMode: dark,
        fontFamily: 'var(--vp-font-family-base, system-ui, sans-serif)',
        fontSize: '13px',
        primaryColor: dark ? '#1e293b' : '#f8fafc',
        primaryTextColor: dark ? '#f8fafc' : '#0f172a',
        primaryBorderColor: dark ? '#475569' : '#cbd5e1',
        lineColor: dark ? '#38bdf8' : '#0284c7',
        secondaryColor: dark ? '#0f172a' : '#ffffff',
        tertiaryColor: dark ? '#1e293b' : '#f1f5f9',
        clusterBkg: dark ? '#0f172a80' : '#f8fafc99',
        clusterBorder: dark ? '#334155' : '#cbd5e1',
        edgeLabelBackground: dark ? '#1e293b' : '#f8fafc',
        actorBkg: dark ? '#1e293b' : '#f8fafc',
        actorBorder: dark ? '#38bdf8' : '#0284c7',
        actorTextColor: dark ? '#f8fafc' : '#0f172a',
        actorLineColor: dark ? '#475569' : '#94a3b8',
        signalColor: dark ? '#f8fafc' : '#0f172a',
        signalTextColor: dark ? '#f8fafc' : '#0f172a',
        labelBoxBkgColor: dark ? '#1e293b' : '#f8fafc',
        labelBoxBorderColor: dark ? '#475569' : '#cbd5e1',
        labelTextColor: dark ? '#f8fafc' : '#0f172a',
        loopTextColor: dark ? '#f8fafc' : '#0f172a',
        noteBorderColor: dark ? '#64748b' : '#cbd5e1',
        noteBkgColor: dark ? '#1e293b' : '#fef9c3',
        noteTextColor: dark ? '#f8fafc' : '#713f12'
      }
    })

    // A fresh id per render: mermaid keys its internal defs off it
    const { svg: out } = await mermaid.render(`mermaid-svg-${seq++}`, source.value)
    svg.value = out
    failed.value = false
  } catch (err) {
    console.error('[mermaid] failed to render diagram:', err)
    failed.value = true
  }
}

onMounted(render)
// Re-render on theme flip
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
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.mermaid-figure__svg {
  display: flex;
  justify-content: center;
  min-width: min-content;
}

.mermaid-figure__svg :deep(svg) {
  max-width: none;
  height: auto;
  display: block;
  margin: 0 auto;
}

.mermaid-figure__fallback {
  margin: 0;
  white-space: pre;
  font-size: 13px;
  color: var(--vp-c-danger-1);
}
</style>
