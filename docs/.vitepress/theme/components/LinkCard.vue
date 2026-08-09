<script setup lang="ts">
import { withBase } from 'vitepress'

defineProps<{
  title: string
  details?: string
  link: string
  icon?: string
}>()
</script>

<template>
  <a class="link-card" :href="withBase(link)">
    <span v-if="icon" class="link-card-icon">{{ icon }}</span>
    <span class="link-card-body">
      <span class="link-card-title">{{ title }}</span>
      <span v-if="details" class="link-card-details">{{ details }}</span>
    </span>
    <span class="link-card-arrow" aria-hidden="true">&rarr;</span>
  </a>
</template>

<style scoped>
.link-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background-color: var(--vp-c-bg-soft);
  text-decoration: none !important;
  transition: border-color 0.25s, background-color 0.25s;
  height: 100%;
}

.link-card:hover {
  border-color: var(--vp-c-brand-1);
  background-color: var(--vp-c-bg-soft-up, var(--vp-c-bg-soft));
}

.link-card-icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.link-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.link-card-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--vp-c-text-1);
}

.link-card-details {
  font-size: 13px;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.link-card-arrow {
  color: var(--vp-c-text-3);
  flex-shrink: 0;
}
</style>
