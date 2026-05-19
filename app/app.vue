<script setup lang="ts">
const colorMode = useColorMode()
colorMode.preference = 'dark'

useHead({
  htmlAttrs: { class: 'dark' }
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
