export interface SSEStreamOptions {
  url: string
  body: Record<string, any>
  signal?: AbortSignal
  onChunk?: (content: string) => void
  onDone?: (fullContent: string, parsedJson?: any) => void
  onError?: (error: string, partialContent: string) => void
  useRAF?: boolean
  timeout?: number
}

export class StreamAbortedError extends Error {
  public partialContent: string
  constructor(partialContent: string) {
    super('Stream aborted')
    this.name = 'StreamAbortedError'
    this.partialContent = partialContent
  }
}

export class StreamTimeoutError extends Error {
  public partialContent: string
  constructor(partialContent: string, timeout: number) {
    super(`生成超时（${Math.round(timeout / 1000)}秒），已保留已生成的内容`)
    this.name = 'StreamTimeoutError'
    this.partialContent = partialContent
  }
}

export async function consumeSSEStream(options: SSEStreamOptions): Promise<string> {
  const timeout = options.timeout
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const controller = new AbortController()
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  if (timeout) {
    timeoutId = setTimeout(() => controller.abort(), timeout)
  }

  let fullContent = ''

  try {
    const response = await fetch(options.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options.body),
      signal: controller.signal
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: '请求失败' }))
      throw new Error(err.message || `HTTP ${response.status}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let rafPending = ''
    let rafId: number | null = null

    function flushRAF() {
      if (rafPending) {
        options.onChunk?.(rafPending)
        rafPending = ''
      }
      rafId = null
    }

    try {
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
            if (data.error) {
              options.onError?.(data.error, fullContent)
              return fullContent
            }
            if (data.content) {
              fullContent += data.content
              if (options.useRAF) {
                rafPending += data.content
                if (!rafId) {
                  rafId = requestAnimationFrame(flushRAF)
                }
              } else {
                options.onChunk?.(data.content)
              }
            }
            if (data.done) {
              if (rafId) { cancelAnimationFrame(rafId); flushRAF() }
              const final = data.fullContent || fullContent
              options.onDone?.(final, data.parsedJson)
              return final
            }
          } catch {}
        }
      }
    } finally {
      if (rafId) { cancelAnimationFrame(rafId); flushRAF() }
    }

    options.onDone?.(fullContent)
    return fullContent
  } catch (e: any) {
    if (e.name === 'AbortError') {
      if (timeout && !options.signal?.aborted) {
        const err = new StreamTimeoutError(fullContent, timeout)
        options.onError?.(err.message, fullContent)
        throw err
      }
      const err = new StreamAbortedError(fullContent)
      throw err
    }
    options.onError?.(e.message || '生成失败', fullContent)
    throw e
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
