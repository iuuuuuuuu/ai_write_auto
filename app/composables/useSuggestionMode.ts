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
      const response = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novelId: novelId.value,
          chapterId: chapterId.value,
          aiConfigId
        })
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: '请求失败' }))
        throw new Error(err.message || `HTTP ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          try {
            const data = JSON.parse(trimmed.slice(6))
            if (data.content) fullContent += data.content
            if (data.done && data.fullContent) fullContent = data.fullContent
          } catch {}
        }
      }

      try {
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch?.[0] || fullContent)
        suggestions.value = (parsed.suggestions || []).map((s: any) => ({
          originalText: s.originalText || '',
          suggestedText: s.suggestedText || '',
          reason: s.reason || '',
          status: 'pending' as const
        }))
      } catch {
        suggestions.value = []
      }
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
