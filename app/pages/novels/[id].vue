<script setup lang="ts">
const route = useRoute()
const isChapterWorkspace = computed(() => route.path.includes('/chapters/'))
</script>

<template>
  <div :class="isChapterWorkspace ? 'w-full' : 'mx-auto max-w-7xl'">
    <NuxtPage />
  </div>
</template>
