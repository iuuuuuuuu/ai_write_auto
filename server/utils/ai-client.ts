import { AI_CONNECT_TIMEOUT_MS, AI_STREAM_READ_TIMEOUT_MS } from './ai-constants'

export interface AiRequestOptions {
  apiUrl: string
  apiKey: string
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
  signal?: AbortSignal
}

export interface AiStreamChunk {
  content: string
  done: boolean
  usage?: { prompt_tokens: number; completion_tokens: number }
}

export interface AiResultWithUsage {
  content: string
  inputTokens: number
  outputTokens: number
}

function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/g, '')
    .trim()
}

async function doFetch(options: AiRequestOptions, stream: boolean): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const connectTimeout = setTimeout(() => { timedOut = true; controller.abort() }, AI_CONNECT_TIMEOUT_MS)

  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(connectTimeout)
      throw new Error('请求已被取消')
    }
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let response: Response
  try {
    response = await fetch(options.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream,
      }),
      signal: controller.signal,
    })
  } catch (e: any) {
    clearTimeout(connectTimeout)
    if (e.name === 'AbortError') {
      if (timedOut) {
        throw new Error(`AI API 连接超时（30秒），请检查 API 地址是否可达: ${options.apiUrl}`)
      }
      throw new Error('请求已被取消')
    }
    throw new Error(`AI API 连接失败: ${e.message}`)
  }
  clearTimeout(connectTimeout)

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI API error (${response.status}): ${err}`)
  }

  return response
}

export async function callAi(options: AiRequestOptions): Promise<string> {
  const response = await doFetch(options, false)
  const data = await response.json()
  const content = data.choices[0]?.message?.content || ''
  return stripThinking(content)
}

export async function callAiWithUsage(options: AiRequestOptions): Promise<AiResultWithUsage> {
  const response = await doFetch(options, false)
  const data = await response.json()
  const content = data.choices[0]?.message?.content || ''
  return {
    content: stripThinking(content),
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0
  }
}

export async function* streamAi(options: AiRequestOptions): AsyncGenerator<AiStreamChunk> {
  const response = await doFetch(options, true)

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let insideThink = false
  let thinkBuffer = ''
  let hasContent = false

  try {
    while (true) {
      let timeoutId: ReturnType<typeof setTimeout>
      const readPromise = reader.read()
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('AI API 流式读取超时（30秒无数据）')), AI_STREAM_READ_TIMEOUT_MS)
      })
      const { done, value } = await Promise.race([readPromise, timeoutPromise])
      clearTimeout(timeoutId!)
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          if (!hasContent) break
          yield { content: '', done: true }
          return
        }
        try {
          const parsed = JSON.parse(data)
          let delta = parsed.choices?.[0]?.delta?.content || ''
          const finishReason = parsed.choices?.[0]?.finish_reason
          const usage = parsed.usage

          if (delta) {
            hasContent = true
            if (insideThink) {
              thinkBuffer += delta
              if (thinkBuffer.includes('</think>') || thinkBuffer.includes('<|/think|>')) {
                insideThink = false
                const afterClose = thinkBuffer.split(/<\/think>|<\|\/think\|>/).pop() || ''
                thinkBuffer = ''
                if (afterClose.trim()) yield { content: afterClose, done: false, usage }
              }
            } else if (delta.includes('<think>') || delta.includes('<|think|>')) {
              const beforeOpen = delta.split(/<think>|<\|think\|>/)[0] || ''
              if (beforeOpen.trim()) yield { content: beforeOpen, done: false, usage }
              insideThink = true
              const afterOpen = delta.split(/<think>|<\|think\|>/).slice(1).join('')
              thinkBuffer = afterOpen
              if (thinkBuffer.includes('</think>') || thinkBuffer.includes('<|/think|>')) {
                insideThink = false
                const afterClose = thinkBuffer.split(/<\/think>|<\|\/think\|>/).pop() || ''
                thinkBuffer = ''
                if (afterClose.trim()) yield { content: afterClose, done: false, usage }
              }
            } else {
              yield { content: delta, done: false, usage }
            }
          }
          if (finishReason === 'stop' || finishReason === 'length') {
            if (!hasContent) break
            yield { content: '', done: true, usage }
            return
          }
        } catch {}
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }

  // Fallback: stream ended with no content — model doesn't support streaming
  if (!hasContent) {
    const fallbackResponse = await doFetch(options, false)
    const fallbackData = await fallbackResponse.json()
    const content = fallbackData.choices?.[0]?.message?.content || ''
    const usage = fallbackData.usage
    const cleaned = stripThinking(content)
    if (cleaned) {
      yield { content: cleaned, done: false, usage: { prompt_tokens: usage?.prompt_tokens || 0, completion_tokens: usage?.completion_tokens || 0 } }
    }
    yield { content: '', done: true, usage: { prompt_tokens: usage?.prompt_tokens || 0, completion_tokens: usage?.completion_tokens || 0 } }
  }
}
