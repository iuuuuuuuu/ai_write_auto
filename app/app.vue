<script setup lang="ts">
const naiveTheme = computed(() => ({
  common: {
    primaryColor: '#3b82f6',
    primaryColorHover: '#2563eb',
    primaryColorPressed: '#1d4ed8',
    primaryColorSuppl: '#60a5fa',
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
