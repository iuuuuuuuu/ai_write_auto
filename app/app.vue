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

// 全局 AI 连通性检测，启动时检测一次，之后每 5 分钟轮询
if (import.meta.client) {
  useAiConnectivity({
    immediate: true,
    checkConnectivity: true,
    pollInterval: 5 * 60 * 1000
  })
}
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
