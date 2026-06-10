<script setup lang="ts">
import { zhCN, dateZhCN } from 'naive-ui'

const naiveTheme = computed(() => ({
  common: {
    primaryColor: '#3b82f6',
    primaryColorHover: '#2563eb',
    primaryColorPressed: '#1d4ed8',
    primaryColorSuppl: '#60a5fa',
    borderRadius: '8px',
    borderColor: '#e5e7eb',
    dividerColor: '#f0f0f0',
    cardColor: '#ffffff',
    bodyColor: '#f7f8fa',
    inputColor: '#ffffff',
    tableColor: '#ffffff',
    popoverColor: '#ffffff',
    modalColor: '#ffffff',
    boxShadow1: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
    boxShadow2: '0 2px 8px rgba(0, 0, 0, 0.06)',
    fontFamily:
      "'Geist', 'PingFang SC', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  Card: {
    borderRadius: '10px'
  },
  Button: {
    borderRadiusMedium: '8px',
    borderRadiusSmall: '6px'
  },
  Input: {
    borderRadius: '8px'
  },
  Tag: {
    borderRadius: '6px'
  }
}))

// 全局 AI 状态检查只确认配置可用性，真实连通测试交给设置页手动触发。
const route = useRoute()
const pageKey = useState('page-refresh-key', () => 0)
if (
  import.meta.client &&
  !route.path.startsWith('/setup') &&
  !route.path.startsWith('/login')
) {
  useAiConnectivity({
    immediate: true,
    checkConnectivity: false,
    pollInterval: 5 * 60 * 1000
  })
}
</script>

<template>
  <NaiveConfig
    :theme-overrides="naiveTheme"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <NMessageProvider>
      <NDialogProvider>
        <NuxtLayout>
          <NuxtPage :key="pageKey" />
        </NuxtLayout>
      </NDialogProvider>
    </NMessageProvider>
  </NaiveConfig>
</template>
