export type Suggestion = {
  originalText: string
  suggestedText: string
  reason: string
  status: 'pending' | 'accepted' | 'rejected'
}

export function useSuggestionMode(novelId: Ref<number>, chapterId: Ref<number>) {
  const suggestions = ref<Suggestion[]>([])
  const isActive = ref(false)
  const loading = ref(false)

  const pendingCount = computed(() =>
    suggestions.value.filter(s => s.status === 'pending').length
  )

  async function fetchSuggestions(aiConfigId?: number) {
    loading.value = true
    try {
      const result = await $fetch<{ suggestions: Array<{ originalText: string; suggestedText: string; reason: string }> }>('/api/ai/suggest', {
        method: 'POST',
        body: {
          novelId: novelId.value,
          chapterId: chapterId.value,
          aiConfigId
        }
      })
      suggestions.value = (result.suggestions || []).map(s => ({
        ...s,
        status: 'pending' as const
      }))
      isActive.value = suggestions.value.length > 0
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
    pendingCount,
    fetchSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    acceptAll,
    rejectAll,
    clearSuggestions
  }
}
