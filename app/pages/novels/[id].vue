<script setup lang="ts">
const route = useRoute()
const isWideWorkspace = computed(() => {
  const isNovelDetailPage = /^\/novels\/[^/]+\/?$/.test(route.path)
  return (
    isNovelDetailPage ||
    route.path.includes('/chapters/') ||
    route.path.includes('/workspace')
  )
})
</script>

<template>
  <div :class="isWideWorkspace ? 'w-full' : 'mx-auto max-w-7xl'">
    <NuxtPage />
  </div>
</template>
