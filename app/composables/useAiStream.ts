interface StreamOptions {
  url: string
  body: Record<string, any>
  onChunk: (content: string) => void
  onDone?: (fullContent: string) => void
  onError?: (error: string) => void
}

export function useAiStream() {
  const streaming = ref(false)

  async function startStream(options: StreamOptions) {
    streaming.value = true
    try {
      const response = await fetch(options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body)
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
            if (data.error) {
              options.onError?.(data.error)
              return
            }
            if (data.content) {
              fullContent += data.content
              options.onChunk(data.content)
            }
            if (data.done) {
              options.onDone?.(data.fullContent || fullContent)
              return
            }
          } catch {}
        }
      }
      options.onDone?.(fullContent)
    } catch (error: any) {
      const msg = error?.data?.message || error?.message || '生成失败'
      options.onError?.(msg)
    } finally {
      streaming.value = false
    }
  }

  return { streaming, startStream }
}
