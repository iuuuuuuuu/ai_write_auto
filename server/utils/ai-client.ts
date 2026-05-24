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

function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/g, '')
    .trim()
}

export async function callAi(options: AiRequestOptions): Promise<string> {
  const controller = new AbortController()
  const connectTimeout = setTimeout(() => controller.abort(), 30000)

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
        stream: false,
      }),
      signal: controller.signal,
    })
  } catch (e: any) {
    clearTimeout(connectTimeout)
    if (e.name === 'AbortError') {
      throw new Error(`AI API 连接超时（30秒），请检查 API 地址是否可达: ${options.apiUrl}`)
    }
    throw new Error(`AI API 连接失败: ${e.message}`)
  }
  clearTimeout(connectTimeout)

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content || ''
  return stripThinking(content)
}

export interface AiResultWithUsage {
  content: string
  inputTokens: number
  outputTokens: number
}

export async function callAiWithUsage(options: AiRequestOptions): Promise<AiResultWithUsage> {
  const controller = new AbortController()
  const connectTimeout = setTimeout(() => controller.abort(), 30000)

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
        stream: false,
      }),
      signal: controller.signal,
    })
  } catch (e: any) {
    clearTimeout(connectTimeout)
    if (e.name === 'AbortError') {
      throw new Error(`AI API 连接超时（30秒），请检查 API 地址是否可达: ${options.apiUrl}`)
    }
    throw new Error(`AI API 连接失败: ${e.message}`)
  }
  clearTimeout(connectTimeout)

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content || ''
  return {
    content: stripThinking(content),
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0
  }
}

export async function* streamAi(options: AiRequestOptions): AsyncGenerator<AiStreamChunk> {
  const controller = new AbortController()
  const connectTimeout = setTimeout(() => controller.abort(), 30000)

  if (options.signal) {
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
        stream: true,
      }),
      signal: controller.signal,
    })
  } catch (e: any) {
    clearTimeout(connectTimeout)
    if (e.name === 'AbortError') {
      throw new Error(`AI API 连接超时（30秒），请检查 API 地址是否可达: ${options.apiUrl}`)
    }
    throw new Error(`AI API 连接失败: ${e.message}`)
  }
  clearTimeout(connectTimeout)

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI API error (${response.status}): ${err}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let insideThink = false

  while (true) {
    const readPromise = reader.read()
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI API 流式读取超时（30秒无数据）')), 30000)
    )
    const { done, value } = await Promise.race([readPromise, timeoutPromise])
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') {
        yield { content: '', done: true }
        return
      }
      try {
        const parsed = JSON.parse(data)
        let delta = parsed.choices?.[0]?.delta?.content || ''
        const finishReason = parsed.choices?.[0]?.finish_reason
        const usage = parsed.usage

        if (delta) {
          if (delta.includes('<think>') || delta.includes('<|think|>')) insideThink = true
          if (insideThink) {
            if (delta.includes('</think>') || delta.includes('<|/think|>')) {
              insideThink = false
              delta = delta.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\|think\|>[\s\S]*?<\|\/think\|>/g, '')
              const afterClose = delta.split(/<\/think>|<\|\/think\|>/).pop() || ''
              if (afterClose.trim()) yield { content: afterClose, done: false, usage }
            }
          } else {
            yield { content: delta, done: false, usage }
          }
        }
        if (finishReason === 'stop') {
          yield { content: '', done: true, usage }
          return
        }
      } catch {}
    }
  }
}
