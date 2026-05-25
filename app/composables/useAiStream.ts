import { consumeSSEStream } from '~/utils/sse-stream'

interface StreamOptions {
  url: string
  body: Record<string, any>
  onChunk: (content: string) => void
  onDone?: (fullContent: string, parsedJson?: any) => void
  onError?: (error: string, partialContent?: string) => void
}

export function useAiStream() {
  const streaming = ref(false)
  let abortController: AbortController | null = null

  async function startStream(options: StreamOptions) {
    if (abortController) {
      abortController.abort()
    }
    streaming.value = true
    abortController = new AbortController()
    try {
      await consumeSSEStream({
        url: options.url,
        body: options.body,
        signal: abortController.signal,
        onChunk: options.onChunk,
        onDone: options.onDone,
        onError: options.onError
      })
    } catch (error: any) {
      if (error?.name !== 'AbortError' && error?.name !== 'StreamAbortedError') {
        const msg = error?.data?.message || error?.message || '生成失败'
        const partial = error?.partialContent
        options.onError?.(msg, partial)
      }
    } finally {
      streaming.value = false
      abortController = null
    }
  }

  function abort() {
    abortController?.abort()
  }

  return { streaming, startStream, abort }
}
