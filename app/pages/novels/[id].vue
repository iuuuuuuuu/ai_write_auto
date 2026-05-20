<script setup lang="ts">
const route = useRoute()
const novelId = computed(() => route.params.id)
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <NuxtPage />
  </div>
</template>
