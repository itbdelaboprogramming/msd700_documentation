<script setup lang="ts">
type Role = 'user' | 'technician' | 'developer'

const labels: Record<Role, string> = {
  user: 'End User',
  technician: 'Technician',
  developer: 'Developer'
}

const props = defineProps<{
  role: Role
}>()
</script>

<template>
  <span class="role-badge" :class="`role-badge-${props.role}`">
    <span class="role-badge-dot" />
    {{ labels[props.role] }}
  </span>
</template>

<style scoped>
.role-badge {

  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--vp-c-divider);
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  margin-bottom: 12px;
  margin-top: 12px;
}

.role-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.role-badge-user .role-badge-dot {
  background-color: var(--vp-c-brand-1);
}

.role-badge-technician .role-badge-dot {
  background-color: var(--vp-c-warning-1);
}

.role-badge-developer .role-badge-dot {
  background-color: var(--vp-c-tip-1);
}
</style>
