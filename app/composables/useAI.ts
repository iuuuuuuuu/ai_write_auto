import { consumeSSEStream } from '~/utils/sse-stream'

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
    if (abortController) {
      abortController.abort()
    }

    generating.value = true
    streamContent.value = ''
    error.value = null
    abortController = new AbortController()

    try {
      await consumeSSEStream({
        url: endpoint,
        body,
        signal: abortController.signal,
        onChunk(content) {
          streamContent.value += content
          onChunk?.(content)
        },
        onError(msg) {
          error.value = msg
        }
      })
    } catch (e: any) {
      if (e.name !== 'AbortError' && e.name !== 'StreamAbortedError') {
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
      chapterOutline?: string
      temperature?: number
      maxTokens?: number
      aiConfigId?: number
    } = {}
  ) {
    return streamGenerate('/api/ai/generate', { novelId, ...options })
  }

  async function expandText(
    novelId: number,
    chapterId: number,
    selectedText: string,
    direction?: string
  ) {
    return streamGenerate('/api/ai/expand', {
      novelId,
      chapterId,
      selectedText,
      direction
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
