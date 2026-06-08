import type { H3Event } from 'h3'
import type { EntityManager } from '@mikro-orm/core'
import { streamAi, type AiRequestOptions } from './ai-client'
import {
  TokenUsageSchema,
  ModelCostRateSchema,
  GenerationTaskSchema
} from '../database/entities'
import { recordAiGeneration } from './writing-stats'
import { parsePartialJsonArray } from './json-salvage'

export function createRequestSignal(event: H3Event): AbortSignal {
  const controller = new AbortController()
  event.node.req.on('close', () => controller.abort())
  return controller.signal
}

export interface StreamContext {
  em: EntityManager
  userId: number
  configId: number
  model: string
}

export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[一-鿿㐀-䶿]/g) || []).length
  const nonChinese = text.length - chineseChars
  return Math.ceil(chineseChars * 1.8 + nonChinese * 0.4)
}

/**
 * 按预估输出规模动态给 maxTokens，clamp 到 [floor, cap]。
 * 用于输出长度随输入规模增长的结构化生成（大纲随章数、角色随正文长度），
 * 避免固定上限把长输出截断成无法解析的半截 JSON。非有限值回落到 floor。
 */
export function dynamicMaxTokens(
  estimatedOutputTokens: number,
  { floor, cap }: { floor: number; cap: number }
): number {
  const n = Number.isFinite(estimatedOutputTokens)
    ? Math.ceil(estimatedOutputTokens)
    : floor
  return Math.max(floor, Math.min(n, cap))
}

export async function recordUsage(
  ctx: StreamContext,
  inputTokens: number,
  outputTokens: number
) {
  if (!inputTokens && !outputTokens) return
  try {
    let estimatedCost: string | null = null
    const costRate = await ctx.em.findOne(ModelCostRateSchema, {
      user: ctx.userId,
      model: ctx.model
    })
    if (costRate) {
      const cost =
        (inputTokens * parseFloat(costRate.inputCostPer1k)) / 1000 +
        (outputTokens * parseFloat(costRate.outputCostPer1k)) / 1000
      estimatedCost = cost.toFixed(6)
    }
    ctx.em.create(TokenUsageSchema, {
      user: ctx.userId,
      aiConfig: ctx.configId,
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      estimatedCost
    })
    await ctx.em.flush()
  } catch (e) {
    console.warn('[ai-stream] Failed to record token usage:', e)
  }
}

export interface StreamResponseOptions {
  parseJsonResult?: boolean
}

interface StreamCollector {
  fullContent: string
  inputTokens: number
  outputTokens: number
  truncated: boolean
}

function setSSEHeaders(event: H3Event) {
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })
}

async function collectStream(
  options: AiRequestOptions,
  signal: AbortSignal,
  onChunk: (content: string) => void
): Promise<StreamCollector> {
  let fullContent = ''
  let inputTokens = 0
  let outputTokens = 0
  let truncated = false

  for await (const chunk of streamAi({ ...options, stream: true, signal })) {
    if (chunk.content) {
      fullContent += chunk.content
      onChunk(chunk.content)
    }
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }
    if (chunk.truncated) truncated = true
    if (chunk.done) break
  }

  if (!inputTokens && !outputTokens && fullContent) {
    outputTokens = estimateTokens(fullContent)
  }

  return { fullContent, inputTokens, outputTokens, truncated }
}

/** 去空白可见字数（中文长度的稳定度量，避免 token 估算误差）。 */
function visibleLength(text: string): number {
  return text.replace(/\s/g, '').length
}

/**
 * 截断恢复用：把末尾「不完整的半句」剪掉，只保留到最后一个句末标点/换行处，
 * 避免续写轮次用尽后仍把半句正文落库。整段无任何句末标记时原样返回。
 */
export function trimToCompleteEnding(text: string): string {
  const enders = '。！？!?…”』」\n'
  for (let i = text.length - 1; i >= 0; i--) {
    if (enders.includes(text[i]!)) {
      return i < text.length - 1 ? text.slice(0, i + 1) : text
    }
  }
  return text
}

const CONTINUATION_PROMPT =
  '请从上文断点处自然续写，不要重复已有内容，不要添加任何标题或分隔符，写到一个完整的段落结尾处停止。'

export interface ContinuationOptions {
  /** 最多续写轮数（不含首轮），默认 3 */
  maxRounds?: number
  /** 目标正文字数（可选）：未达 90% 也会触发续写。P0 默认不传，仅靠截断信号驱动。 */
  targetWords?: number
  /** 轮间中止检查（如批量的「任务已取消」）。返回 true 则停止续写。 */
  checkAbort?: () => Promise<boolean>
}

export interface ContinuationResult {
  fullContent: string
  inputTokens: number
  outputTokens: number
  /** 末轮是否仍被模型按长度截断 */
  finalTruncated: boolean
  /** 实际续写轮数 */
  rounds: number
}

/**
 * 截断驱动的续写核心：首轮生成后，只要模型因长度被截断（或设了 targetWords 且未达标），
 * 就以「assistant=已写 + user=从断点续写」追加生成，最多 maxRounds 轮。
 * 单章 / 重生 / 批量共用，保证长章节不在句中被切断。任一轮失败/中止即停，返回已得内容。
 */
export async function streamWithContinuation(
  options: AiRequestOptions,
  signal: AbortSignal,
  onChunk: (content: string) => void,
  opts: ContinuationOptions = {}
): Promise<ContinuationResult> {
  const maxRounds = opts.maxRounds ?? 3
  const { targetWords, checkAbort } = opts

  const first = await collectStream(options, signal, onChunk)
  let fullContent = first.fullContent
  let inputTokens = first.inputTokens
  let outputTokens = first.outputTokens
  let truncated = first.truncated
  let rounds = 0

  const needMore = () =>
    truncated ||
    (targetWords ? visibleLength(fullContent) < targetWords * 0.9 : false)

  while (needMore() && rounds < maxRounds && !signal.aborted && fullContent) {
    if (checkAbort && (await checkAbort())) break
    rounds++

    const extendMessages = [
      ...options.messages,
      { role: 'assistant' as const, content: fullContent },
      { role: 'user' as const, content: CONTINUATION_PROMPT }
    ]
    const next = await collectStream(
      { ...options, messages: extendMessages },
      signal,
      onChunk
    )
    inputTokens += next.inputTokens
    outputTokens += next.outputTokens
    fullContent += next.fullContent
    truncated = next.truncated
    // 续写返回空内容 → 模型已无更多可写，停止（避免空轮空转；短的完句仍会被拼上）
    if (visibleLength(next.fullContent) === 0) break
  }

  // 轮数用尽仍被截断：剪掉末尾半句，避免半句落库
  if (truncated && rounds >= maxRounds) {
    fullContent = trimToCompleteEnding(fullContent)
  }

  return {
    fullContent,
    inputTokens,
    outputTokens,
    finalTruncated: truncated,
    rounds
  }
}

export function createStreamResponse(
  event: H3Event,
  options: AiRequestOptions,
  ctx?: StreamContext,
  responseOpts?: StreamResponseOptions
) {
  setSSEHeaders(event)
  const signal = createRequestSignal(event)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (data: Record<string, any>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      controller.enqueue(encoder.encode(': connected\n\n'))
      try {
        const { fullContent, inputTokens, outputTokens } = await collectStream(
          options,
          signal,
          (content) => send({ content, done: false })
        )

        if (!fullContent) {
          send({ error: 'AI 返回了空内容', done: true })
          controller.close()
          return
        }

        if (ctx) await recordUsage(ctx, inputTokens, outputTokens)

        const donePayload: Record<string, any> = {
          content: '',
          done: true,
          fullContent,
          usage: {
            inputTokens,
            outputTokens
          }
        }
        if (responseOpts?.parseJsonResult) {
          // 容错解析 + 截断 salvage：长大纲/长建议被按长度截断时，
          // 也能取出已写完的前 N 条，而非整体丢失（旧实现 JSON.parse 抛错被吞 → 前端拿空）。
          const arr = parsePartialJsonArray(fullContent)
          if (arr.length) donePayload.parsedJson = arr
        }

        send(donePayload)
        controller.close()
      } catch (error: any) {
        send({ error: error.message || '生成失败', done: true })
        controller.close()
      }
    }
  })

  return new Response(stream)
}

export function createInlineStreamResponse(
  event: H3Event,
  options: AiRequestOptions,
  ctx?: StreamContext
) {
  setSSEHeaders(event)
  const signal = createRequestSignal(event)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (data: Record<string, any>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      controller.enqueue(encoder.encode(': connected\n\n'))
      try {
        const { fullContent, inputTokens, outputTokens } = await collectStream(
          options,
          signal,
          (content) => send({ content, done: false })
        )

        if (ctx) await recordUsage(ctx, inputTokens, outputTokens)
        send({ content: '', done: true })
        controller.close()
      } catch (err: any) {
        send({ error: err.message || '生成失败', done: true })
        controller.close()
      }
    }
  })

  return new Response(stream)
}

export interface TrackedStreamOptions {
  taskId: number
  trackStats?: boolean
  onComplete?: (fullContent: string) => Promise<void>
  autoExtend?: boolean
}

export function createTrackedStreamResponse(
  event: H3Event,
  options: AiRequestOptions,
  ctx: StreamContext,
  tracked: TrackedStreamOptions
) {
  setSSEHeaders(event)
  const signal = createRequestSignal(event)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (data: Record<string, any>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      controller.enqueue(encoder.encode(': connected\n\n'))
      try {
        const maxRounds = tracked.autoExtend === false ? 0 : 3
        const {
          fullContent,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          finalTruncated
        } = await streamWithContinuation(
          options,
          signal,
          (content) => send({ content, done: false }),
          { maxRounds }
        )

        if (!fullContent) {
          await ctx.em.nativeUpdate(
            GenerationTaskSchema,
            { id: tracked.taskId },
            {
              status: 'failed',
              error: 'AI 返回了空内容'
            }
          )
          send({ error: 'AI 返回了空内容', done: true })
          controller.close()
          return
        }

        const totalTokens = totalInputTokens + totalOutputTokens

        await ctx.em.nativeUpdate(
          GenerationTaskSchema,
          { id: tracked.taskId },
          {
            status: 'completed',
            result: fullContent,
            tokensUsed: totalTokens,
            completedAt: new Date()
          }
        )

        await recordUsage(ctx, totalInputTokens, totalOutputTokens)
        if (tracked.trackStats) await recordAiGeneration(ctx.em, ctx.userId)
        if (tracked.onComplete && fullContent)
          await tracked.onComplete(fullContent)

        send({ content: '', done: true, taskId: tracked.taskId, truncated: finalTruncated })
        controller.close()
      } catch (err: any) {
        await ctx.em.nativeUpdate(
          GenerationTaskSchema,
          { id: tracked.taskId },
          {
            status: 'failed',
            error: err.message
          }
        )
        send({ error: err.message, done: true })
        controller.close()
      }
    }
  })

  return new Response(stream)
}
