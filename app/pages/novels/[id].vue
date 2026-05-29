<script setup lang="ts">
const route = useRoute()
const isChapterWorkspace = computed(() => route.path.includes('/chapters/') || route.path.includes('/workspace'))
</script>

<template>
  <div :class="isChapterWorkspace ? 'w-full' : 'mx-auto max-w-7xl'">
    <NuxtPage />
  </div>
</template>
