import { consumeSSEStream } from '~/utils/sse-stream'

export type Suggestion = {
  originalText: string
  suggestedText: string
  reason: string
  status: 'pending' | 'accepted' | 'rejected'
}

function toSuggestionItems(value: unknown): Suggestion[] {
  const records = Array.isArray(value) ? value : []
  return records
    .map((item) => {
      const record =
        item && typeof item === 'object' ?
          (item as Record<string, unknown>)
        : {}
      return {
        originalText:
          typeof record.originalText === 'string' ? record.originalText : '',
        suggestedText:
          typeof record.suggestedText === 'string' ? record.suggestedText : '',
        reason: typeof record.reason === 'string' ? record.reason : '',
        status: 'pending' as const
      }
    })
    .filter((item) => item.originalText && item.suggestedText)
}

export function useSuggestionMode(
  novelId: Ref<number>,
  chapterId: Ref<number>
) {
  const suggestions = ref<Suggestion[]>([])
  const isActive = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const pendingCount = computed(
    () => suggestions.value.filter((s) => s.status === 'pending').length
  )

  async function fetchSuggestions(aiConfigId?: number) {
    loading.value = true
    error.value = null
    try {
      let parsedSuggestions: Suggestion[] = []
      await consumeSSEStream({
        url: '/api/ai/suggest',
        body: {
          novelId: novelId.value,
          chapterId: chapterId.value,
          aiConfigId
        },
        onDone(_fullContent, parsedJson) {
          parsedSuggestions = toSuggestionItems(parsedJson)
        },
        onError(msg) {
          error.value = msg
        }
      })

      suggestions.value = parsedSuggestions
      if (!suggestions.value.length) {
        if (!error.value) error.value = '解析建议结果失败'
      }
      isActive.value = suggestions.value.length > 0
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '获取建议失败'
      suggestions.value = []
    } finally {
      loading.value = false
    }
  }

  function acceptSuggestion(index: number) {
    if (suggestions.value[index]) {
      suggestions.value[index].status = 'accepted'
    }
    checkAllResolved()
  }

  function rejectSuggestion(index: number) {
    if (suggestions.value[index]) {
      suggestions.value[index].status = 'rejected'
    }
    checkAllResolved()
  }

  function acceptAll() {
    for (const s of suggestions.value) {
      if (s.status === 'pending') s.status = 'accepted'
    }
    checkAllResolved()
  }

  function rejectAll() {
    for (const s of suggestions.value) {
      if (s.status === 'pending') s.status = 'rejected'
    }
    checkAllResolved()
  }

  function clearSuggestions() {
    suggestions.value = []
    isActive.value = false
  }

  function checkAllResolved() {
    if (pendingCount.value === 0) {
      isActive.value = false
    }
  }

  return {
    suggestions,
    isActive,
    loading,
    error,
    pendingCount,
    fetchSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    acceptAll,
    rejectAll,
    clearSuggestions
  }
}
