export function useAI() {
  const generating = ref(false)
  const streamContent = ref('')
  const error = ref<string | null>(null)
  let abortController: AbortController | null = null

  async function streamGenerate(
    endpoint: string,
    body: Record<string, any>,
    onChunk?: (content: string) => void
  ) {
    generating.value = true
    streamContent.value = ''
    error.value = null
    abortController = new AbortController()

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortController.signal
      })

      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ message: 'Request failed' }))
        throw new Error(err.message || `HTTP ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.content) {
              streamContent.value += data.content
              onChunk?.(data.content)
            }
            if (data.error) {
              error.value = data.error
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        error.value = e.message
      }
    } finally {
      generating.value = false
      abortController = null
    }

    return streamContent.value
  }

  function abort() {
    abortController?.abort()
  }

  async function generateChapter(
    novelId: number,
    options: {
      chapterId?: number
      direction?: string
      temperature?: number
      aiConfigId?: number
    } = {}
  ) {
    return streamGenerate('/api/ai/generate', { novelId, ...options })
  }

  async function expandText(
    novelId: number,
    chapterId: number,
    selectedText: string
  ) {
    return streamGenerate('/api/ai/expand', {
      novelId,
      chapterId,
      selectedText
    })
  }

  async function rewriteText(
    novelId: number,
    chapterId: number,
    selectedText: string,
    direction?: string
  ) {
    return streamGenerate('/api/ai/rewrite', {
      novelId,
      chapterId,
      selectedText,
      direction
    })
  }

  async function generateOutline(novelId: number, idea: string) {
    return streamGenerate('/api/ai/generate-outline', { novelId, idea })
  }

  async function checkConsistency(novelId: number, chapterId: number) {
    const data = await $fetch('/api/ai/consistency-check', {
      method: 'POST',
      body: { novelId, chapterId }
    })
    return data
  }

  async function analyzeStyle(novelId: number) {
    const data = await $fetch('/api/ai/analyze-style', {
      method: 'POST',
      body: { novelId }
    })
    return data
  }

  return {
    generating,
    streamContent,
    error,
    streamGenerate,
    abort,
    generateChapter,
    expandText,
    rewriteText,
    generateOutline,
    checkConsistency,
    analyzeStyle
  }
}
