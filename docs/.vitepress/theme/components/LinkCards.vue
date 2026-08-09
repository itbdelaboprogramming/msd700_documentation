<template>
  <div class="link-cards">
    <slot />
  </div>
</template>

<style scoped>
.link-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  margin: 16px 0 24px;
}
</style>
