export interface AiStatus {
  available: boolean
  checkedAt: string
  reason: string | null
  checkedConnectivity?: boolean
}

export function useAiConnectivity(options?: {
  immediate?: boolean
  checkConnectivity?: boolean
  pollInterval?: number
}) {
  const {
    immediate = true,
    checkConnectivity: shouldCheck = false,
    pollInterval = 0
  } = options || {}

  const aiStatus = useState<AiStatus>('ai-connectivity-status', () => ({
    available: false,
    checkedAt: '',
    reason: null
  }))

  const isRefreshing = ref(false)

  async function refreshAiStatus(check = false) {
    isRefreshing.value = true
    try {
      const query = check ? { check: 'true' } : {}
      const result = await $fetch<AiStatus>('/api/ai/status', { query })
      aiStatus.value = result
    } catch {
      aiStatus.value = {
        available: false,
        checkedAt: new Date().toISOString(),
        reason: '获取 AI 状态失败'
      }
    } finally {
      isRefreshing.value = false
    }
  }

  async function checkConnectivity() {
    return refreshAiStatus(true)
  }

  if (import.meta.client && immediate && !aiStatus.value.checkedAt) {
    // Defer to avoid SSR hydration mismatch (server renders isRefreshing=false)
    setTimeout(() => refreshAiStatus(shouldCheck), 0)
  }

  let intervalId: ReturnType<typeof setInterval> | null = null
  if (import.meta.client && pollInterval > 0) {
    intervalId = setInterval(() => refreshAiStatus(false), pollInterval)
    onBeforeUnmount(() => {
      if (intervalId) clearInterval(intervalId)
    })
  }

  return {
    aiStatus,
    isRefreshing,
    refreshAiStatus,
    checkConnectivity
  }
}
