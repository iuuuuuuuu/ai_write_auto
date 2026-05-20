<script setup lang="ts">
const naiveTheme = computed(() => ({
  common: {
    primaryColor: '#0d9488',
    primaryColorHover: '#0f766e',
    primaryColorPressed: '#115e59',
    primaryColorSuppl: '#14b8a6',
    borderRadius: '8px',
    fontFamily:
      "'Geist', 'PingFang SC', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif"
  }
}))
</script>

<template>
  <NaiveConfig :theme-overrides="naiveTheme">
    <NMessageProvider>
      <NDialogProvider>
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>
      </NDialogProvider>
    </NMessageProvider>
  </NaiveConfig>
</template>
