export function useEmbeddingStatus() {
  const status = ref<'idle' | 'downloading' | 'ready' | 'error'>('idle')
  const progress = ref(0)
  const error = ref('')

  let timer: ReturnType<typeof setInterval> | null = null

  async function fetchStatus() {
    try {
      const data = await $fetch<{ status: string; progress: number; error: string }>('/api/ai/embedding-status')
      status.value = data.status as any
      progress.value = data.progress
      error.value = data.error || ''
    } catch {}
  }

  async function triggerDownload() {
    await $fetch('/api/ai/embedding-download', { method: 'POST' })
    startPolling()
  }

  function startPolling() {
    if (timer) return
    timer = setInterval(async () => {
      await fetchStatus()
      if (status.value === 'ready' || status.value === 'error') {
        stopPolling()
      }
    }, 2000)
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(() => {
    fetchStatus()
  })

  onUnmounted(() => {
    stopPolling()
  })

  return {
    status: readonly(status),
    progress: readonly(progress),
    error: readonly(error),
    triggerDownload,
    refresh: fetchStatus
  }
}
