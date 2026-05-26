import type { H3Event } from 'h3'
import type { EntityManager } from '@mikro-orm/core'
import { streamAi, type AiRequestOptions } from './ai-client'
import {
  TokenUsageSchema,
  ModelCostRateSchema,
  GenerationTaskSchema
} from '../database/entities'
import { recordAiGeneration } from './writing-stats'

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

  for await (const chunk of streamAi({ ...options, stream: true, signal })) {
    if (chunk.content) {
      fullContent += chunk.content
      onChunk(chunk.content)
    }
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }
    if (chunk.done) break
  }

  if (!inputTokens && !outputTokens && fullContent) {
    outputTokens = estimateTokens(fullContent)
  }

  return { fullContent, inputTokens, outputTokens }
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
          try {
            const jsonMatch =
              fullContent.match(/\[[\s\S]*\]/) ||
              fullContent.match(/\{[\s\S]*\}/)
            if (jsonMatch) donePayload.parsedJson = JSON.parse(jsonMatch[0])
          } catch {}
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
        const { inputTokens, outputTokens } = await collectStream(
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

function estimateTargetChars(maxTokens: number): number {
  return Math.round(maxTokens * 0.55)
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
        let fullContent = ''
        let totalInputTokens = 0
        let totalOutputTokens = 0

        const {
          fullContent: firstContent,
          inputTokens,
          outputTokens
        } = await collectStream(options, signal, (content) =>
          send({ content, done: false })
        )

        fullContent = firstContent
        totalInputTokens += inputTokens
        totalOutputTokens += outputTokens

        // Auto-extend: if content is far below target, continue generating
        if (tracked.autoExtend !== false && fullContent && options.maxTokens) {
          const targetChars = estimateTargetChars(options.maxTokens)
          const currentChars = fullContent.replace(/\s/g, '').length
          const MAX_EXTEND_ROUNDS = 3

          for (let round = 0; round < MAX_EXTEND_ROUNDS; round++) {
            if (signal.aborted) break
            const remaining =
              targetChars -
              currentChars -
              fullContent.replace(/\s/g, '').length +
              currentChars
            const actualRemaining =
              targetChars - fullContent.replace(/\s/g, '').length
            if (actualRemaining < targetChars * 0.3) break

            const remainingTokens = Math.min(
              options.maxTokens,
              Math.round(actualRemaining / 0.55) + 200
            )

            const extendMessages = [
              ...options.messages,
              {
                role: 'assistant' as const,
                content: fullContent
              },
              {
                role: 'user' as const,
                content: `请从上文断点处自然续写，不要重复已有内容，不要加任何标题或分隔符。剩余约${actualRemaining}字需要补充，写到合适的段落结尾处停止。`
              }
            ]

            const {
              fullContent: extContent,
              inputTokens: extIn,
              outputTokens: extOut
            } = await collectStream(
              {
                ...options,
                messages: extendMessages,
                maxTokens: remainingTokens
              },
              signal,
              (content) => send({ content, done: false })
            )

            if (!extContent || extContent.replace(/\s/g, '').length < 50) break

            fullContent += extContent
            totalInputTokens += extIn
            totalOutputTokens += extOut
          }
        }

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

        send({ content: '', done: true, taskId: tracked.taskId })
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
