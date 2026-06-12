import {
  AI_CONNECT_TIMEOUT_MS,
  AI_STREAM_READ_TIMEOUT_MS
} from './ai-constants'
import { getOrm } from '../database'
import { AiModelSchema } from '../database/entities'
import { wrap } from '@mikro-orm/core'
import type { ResolvedAiConfig } from './ai-configs'
import { resolveAiRequestParameters } from './ai-model-capabilities'
import {
  failAiGenerationLog,
  finishAiGenerationLog,
  markFirstToken,
  startAiGenerationLog,
  type AiGenerationLogHandle,
  type AiGenerationTracking
} from './ai-generation-logs'

export type AiRequestTracking = Omit<AiGenerationTracking, 'model'> & {
  model?: string
}

export interface AiRequestOptions {
  apiUrl: string
  apiKey: string
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  topP?: number
  thinkingEnabled?: boolean
  reasoningEffort?: string | null
  maxTokens?: number
  stream?: boolean
  signal?: AbortSignal
  connectTimeoutMs?: number
  extraBody?: Record<string, unknown>
  modelId?: number
  tracking?: AiRequestTracking
}

/**
 * 正文（prose）生成的反「AI 腔」采样参数，经 extraBody 注入请求体。
 * - frequency_penalty 压 token 级重复（口头禅、雷同句式、排比）——降 AI 味的主杠杆；
 * - presence_penalty 保守取小，避免抑制小说里必然高频复现的人名/地名/专有名词。
 * 仅用于正文 prose；结构化调用（大纲/角色/摘要等 JSON 或定长输出）不要用，会损坏格式或精度。
 * 不支持这些字段的端点会忽略它们（与 chapter-context 的 extraBody 同理，失败也只是被忽略）。
 */
export const PROSE_SAMPLING = {
  frequency_penalty: 0.3,
  presence_penalty: 0.2
} as const

export function toAiOptions(
  config: Pick<ResolvedAiConfig, 'apiUrl' | 'apiKey' | 'model' | 'modelId'> &
    Partial<
      Pick<
        ResolvedAiConfig,
        | 'temperature'
        | 'topP'
        | 'thinkingEnabled'
        | 'reasoningEffort'
        | 'capabilities'
      >
    >,
  overrides: Omit<
    AiRequestOptions,
    'apiUrl' | 'apiKey' | 'model' | 'modelId'
  > = {} as any
): AiRequestOptions {
  const parameters = resolveAiRequestParameters({
    model: config.model,
    modelCapabilities: config.capabilities,
    config: {
      temperature: config.temperature,
      topP: config.topP,
      thinkingEnabled: config.thinkingEnabled,
      reasoningEffort: config.reasoningEffort
    },
    request: {
      temperature: overrides.temperature,
      topP: overrides.topP,
      thinkingEnabled: overrides.thinkingEnabled,
      reasoningEffort: overrides.reasoningEffort
    }
  })
  return {
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    model: config.model,
    modelId: config.modelId,
    ...overrides,
    temperature: parameters.temperature,
    topP: parameters.topP,
    thinkingEnabled: parameters.thinkingEnabled,
    reasoningEffort: parameters.reasoningEffort
  } as AiRequestOptions
}

export interface AiStreamChunk {
  content: string
  done: boolean
  truncated?: boolean
  usage?: { prompt_tokens: number; completion_tokens: number }
}

export interface AiResultWithUsage {
  content: string
  inputTokens: number
  outputTokens: number
}

function stripThinking(text: string): string {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/g, '')
    .replace(
      /^The request was rejected.*|^This content violates.*|content.?policy|safety filter/gi,
      ''
    )
    .trim()
  // Reasoning models may wrap the entire output in <think> tags.
  // Fall back to the raw text so we don't return empty content.
  if (!cleaned && text.trim()) {
    return text.trim()
  }
  return cleaned
}

function countMessageChars(messages: AiRequestOptions['messages']): number {
  return messages.reduce((sum, message) => sum + message.content.length, 0)
}

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[一-鿿㐀-䶿]/g) || []).length
  const nonChinese = text.length - chineseChars
  return Math.ceil(chineseChars * 1.8 + nonChinese * 0.4)
}

function estimateMessageTokens(messages: AiRequestOptions['messages']): number {
  return messages.reduce(
    (sum, message) => sum + estimateTokens(message.content),
    0
  )
}

function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return message.includes('fetch failed')
}

function getMessageContent(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const record = message as Record<string, unknown>
  return (
    (typeof record.content === 'string' && record.content) ||
    (typeof record.reasoning_content === 'string' &&
      record.reasoning_content) ||
    ''
  )
}

function buildTrackingOptions(
  options: AiRequestOptions,
  streamed: boolean
): AiGenerationTracking {
  if (!options.tracking) {
    console.warn(
      '[ai-client] AI request missing tracking metadata; recording as unclassified_ai_call'
    )
  }

  return {
    ...options.tracking,
    model: options.tracking?.model ?? options.model,
    modelId: options.tracking?.modelId ?? options.modelId ?? null,
    scenario: options.tracking?.scenario ?? 'unclassified_ai_call',
    source: options.tracking?.source ?? 'unclassified',
    streamed: options.tracking?.streamed ?? streamed,
    inputChars:
      options.tracking?.inputChars ?? countMessageChars(options.messages)
  }
}

async function startRequestLog(
  options: AiRequestOptions,
  streamed: boolean
): Promise<AiGenerationLogHandle | null> {
  return await startAiGenerationLog(buildTrackingOptions(options, streamed))
}

async function doFetch(
  options: AiRequestOptions,
  stream: boolean
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await doFetchOnce(options, stream)
    } catch (error: unknown) {
      lastError = error
      if (attempt > 0 || !isTransientFetchError(error)) break
    }
  }
  throw lastError
}

async function doFetchOnce(
  options: AiRequestOptions,
  stream: boolean
): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const connectTimeoutMs = options.connectTimeoutMs ?? AI_CONNECT_TIMEOUT_MS
  const connectTimeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, connectTimeoutMs)

  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(connectTimeout)
      throw new Error('请求已被取消')
    }
    options.signal.addEventListener('abort', () => controller.abort(), {
      once: true
    })
  }

  let response: Response
  try {
    response = await fetch(options.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 0.95,
        max_tokens: options.maxTokens ?? 4096,
        stream,
        ...(typeof options.thinkingEnabled === 'boolean' ?
          { enable_thinking: options.thinkingEnabled }
        : {}),
        ...(options.reasoningEffort ?
          { reasoning_effort: options.reasoningEffort }
        : {}),
        ...options.extraBody
      }),
      signal: controller.signal
    })
  } catch (e: any) {
    clearTimeout(connectTimeout)
    if (e.name === 'AbortError') {
      if (timedOut) {
        throw new Error(
          `AI API 连接超时（${connectTimeoutMs / 1000}秒），请检查 API 地址是否可达: ${options.apiUrl}`
        )
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

  // Update model connectivity status on success
  if (options.modelId) {
    try {
      const orm = getOrm()
      const em = orm.em.fork()
      const model = await em.findOne(AiModelSchema, { id: options.modelId })
      if (model) {
        wrap(model).assign({
          lastCheckAt: new Date(),
          lastCheckAvailable: true,
          lastCheckReason: null
        })
        await em.flush()
      }
    } catch {}
  }

  return response
}

export async function callAi(options: AiRequestOptions): Promise<string> {
  const logHandle = await startRequestLog(options, false)

  try {
    const response = await doFetch(options, false)
    const data = await response.json()
    const content = getMessageContent(data.choices[0]?.message)
    const cleaned = stripThinking(content)
    const inputTokens = data.usage?.prompt_tokens || 0
    const outputTokens = data.usage?.completion_tokens || 0

    await finishAiGenerationLog(logHandle, {
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      inputChars: countMessageChars(options.messages),
      outputChars: cleaned.length
    })

    return cleaned
  } catch (error: unknown) {
    await failAiGenerationLog(logHandle, error)
    throw error
  }
}

export async function callAiWithUsage(
  options: AiRequestOptions
): Promise<AiResultWithUsage> {
  const logHandle = await startRequestLog(options, false)

  try {
    const response = await doFetch(options, false)
    const data = await response.json()
    const raw = getMessageContent(data.choices[0]?.message)
    const content = stripThinking(raw)
    const inputTokens = data.usage?.prompt_tokens || 0
    const outputTokens = data.usage?.completion_tokens || 0

    await finishAiGenerationLog(logHandle, {
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      inputChars: countMessageChars(options.messages),
      outputChars: content.length
    })

    return {
      content,
      inputTokens,
      outputTokens
    }
  } catch (error: unknown) {
    await failAiGenerationLog(logHandle, error)
    throw error
  }
}

export async function* streamAi(
  options: AiRequestOptions
): AsyncGenerator<AiStreamChunk> {
  const logHandle = await startRequestLog(options, true)
  const inputChars = countMessageChars(options.messages)
  let outputChars = 0
  let inputTokens = 0
  let outputTokens = 0
  let tokenEstimateContent = ''
  let firstTokenMarked = false
  let finished = false
  let response: Response

  try {
    response = await doFetch(options, true)
  } catch (error: unknown) {
    await failAiGenerationLog(logHandle, error)
    throw error
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let insideThink = false
  let thinkBuffer = ''
  let hasContent = false

  const markContent = async (content: string) => {
    if (!content) return
    hasContent = true
    outputChars += content.length
    tokenEstimateContent += content
    if (!firstTokenMarked) {
      firstTokenMarked = true
      await markFirstToken(logHandle)
    }
  }

  const finishLog = async () => {
    if (finished) {
      return {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens
      }
    }
    finished = true
    if (!inputTokens) {
      inputTokens = estimateMessageTokens(options.messages)
    }
    if (!outputTokens && tokenEstimateContent) {
      outputTokens = estimateTokens(tokenEstimateContent)
    }
    await finishAiGenerationLog(logHandle, {
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      inputChars,
      outputChars
    })
    return {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens
    }
  }

  try {
    while (true) {
      let timeoutId: ReturnType<typeof setTimeout>
      const readPromise = reader.read()
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new Error(
                `AI API 流式读取超时（${AI_STREAM_READ_TIMEOUT_MS / 1000}秒无数据）`
              )
            ),
          AI_STREAM_READ_TIMEOUT_MS
        )
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
          if (usage) {
            inputTokens = usage.prompt_tokens || inputTokens
            outputTokens = usage.completion_tokens || outputTokens
          }

          if (delta) {
            // Skip content moderation messages from API providers
            if (
              /^The request was rejected|^This content violates|content.?policy|safety filter/i.test(
                delta
              )
            ) {
              continue
            }
            if (insideThink) {
              thinkBuffer += delta
              if (
                thinkBuffer.includes('</think>') ||
                thinkBuffer.includes('<|/think|>')
              ) {
                insideThink = false
                const afterClose =
                  thinkBuffer.split(/<\/think>|<\|\/think\|>/).pop() || ''
                thinkBuffer = ''
                if (afterClose.trim()) {
                  await markContent(afterClose)
                  yield { content: afterClose, done: false, usage }
                }
              }
            } else if (
              delta.includes('<think>') ||
              delta.includes('<|think|>')
            ) {
              const beforeOpen = delta.split(/<think>|<\|think\|>/)[0] || ''
              if (beforeOpen.trim()) {
                await markContent(beforeOpen)
                yield { content: beforeOpen, done: false, usage }
              }
              insideThink = true
              const afterOpen = delta
                .split(/<think>|<\|think\|>/)
                .slice(1)
                .join('')
              thinkBuffer = afterOpen
              if (
                thinkBuffer.includes('</think>') ||
                thinkBuffer.includes('<|/think|>')
              ) {
                insideThink = false
                const afterClose =
                  thinkBuffer.split(/<\/think>|<\|\/think\|>/).pop() || ''
                thinkBuffer = ''
                if (afterClose.trim()) {
                  await markContent(afterClose)
                  yield { content: afterClose, done: false, usage }
                }
              }
            } else {
              await markContent(delta)
              yield { content: delta, done: false, usage }
            }
          }
          if (finishReason === 'stop' || finishReason === 'length') {
            if (!hasContent) break
            const finalUsage = await finishLog()
            yield {
              content: '',
              done: true,
              truncated: finishReason === 'length',
              usage: usage ?? finalUsage
            }
            return
          }
        } catch {}
      }
    }
  } catch (error: unknown) {
    await failAiGenerationLog(logHandle, error)
    throw error
  } finally {
    reader.cancel().catch(() => {})
  }

  // Fallback: stream ended with no content — model doesn't support streaming
  if (!hasContent) {
    const fallbackResponse = await doFetch(options, false)
    const fallbackData = await fallbackResponse.json()
    const content = getMessageContent(fallbackData.choices?.[0]?.message)
    const usage = fallbackData.usage
    const cleaned = stripThinking(content)
    inputTokens = usage?.prompt_tokens || 0
    outputTokens = usage?.completion_tokens || 0
    if (cleaned) {
      await markContent(cleaned)
      yield {
        content: cleaned,
        done: false,
        usage
      }
    }
    const finalUsage = await finishLog()
    yield {
      content: '',
      done: true,
      usage: usage ?? finalUsage
    }
  }
}
