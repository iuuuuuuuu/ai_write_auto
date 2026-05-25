import { consumeSSEStream } from '~/utils/sse-stream'

interface StreamOptions {
  url: string
  body: Record<string, any>
  onChunk: (content: string) => void
  onDone?: (fullContent: string) => void
  onError?: (error: string, partialContent?: string) => void
}

export function useAiStream() {
  const streaming = ref(false)

  async function startStream(options: StreamOptions) {
    streaming.value = true
    try {
      await consumeSSEStream({
        url: options.url,
        body: options.body,
        onChunk: options.onChunk,
        onDone: options.onDone,
        onError: options.onError
      })
    } catch (error: any) {
      const msg = error?.data?.message || error?.message || '生成失败'
      const partial = error?.partialContent
      options.onError?.(msg, partial)
    } finally {
      streaming.value = false
    }
  }

  return { streaming, startStream }
}
