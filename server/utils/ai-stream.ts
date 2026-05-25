import type { H3Event } from 'h3'
import type { EntityManager } from '@mikro-orm/core'
import { streamAi, type AiRequestOptions } from './ai-client'
import { TokenUsageSchema, ModelCostRateSchema, GenerationTaskSchema } from '../database/entities'

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

export async function recordUsage(ctx: StreamContext, inputTokens: number, outputTokens: number) {
  if (!inputTokens && !outputTokens) return
  try {
    let estimatedCost: string | null = null
    const costRate = await ctx.em.findOne(ModelCostRateSchema, { user: ctx.userId, model: ctx.model })
    if (costRate) {
      const cost = (inputTokens * parseFloat(costRate.inputCostPer1k) / 1000)
        + (outputTokens * parseFloat(costRate.outputCostPer1k) / 1000)
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
  } catch {}
}

export interface StreamResponseOptions {
  parseJsonResult?: boolean
}

export function createStreamResponse(event: H3Event, options: AiRequestOptions, ctx?: StreamContext, responseOpts?: StreamResponseOptions) {
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const signal = createRequestSignal(event)
  let fullContent = ''

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(': connected\n\n'))
      try {
        let inputTokens = 0
        let outputTokens = 0

        for await (const chunk of streamAi({ ...options, stream: true, signal })) {
          if (chunk.content) {
            fullContent += chunk.content
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`))
          }
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens || inputTokens
            outputTokens = chunk.usage.completion_tokens || outputTokens
          }
          if (chunk.done) break
        }

        if (!fullContent) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI 返回了空内容', done: true })}\n\n`))
          controller.close()
          return
        }

        if (ctx) {
          if (!inputTokens && !outputTokens) {
            outputTokens = estimateTokens(fullContent)
          }
          await recordUsage(ctx, inputTokens, outputTokens)
        }

        const donePayload: Record<string, any> = { content: '', done: true, fullContent }
        if (responseOpts?.parseJsonResult) {
          try {
            const jsonMatch = fullContent.match(/\[[\s\S]*\]/) || fullContent.match(/\{[\s\S]*\}/)
            if (jsonMatch) donePayload.parsedJson = JSON.parse(jsonMatch[0])
          } catch {}
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(donePayload)}\n\n`))
        controller.close()
      } catch (error: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message || '生成失败', done: true })}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream)
}

export function createInlineStreamResponse(event: H3Event, options: AiRequestOptions, ctx?: StreamContext) {
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const signal = createRequestSignal(event)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(': connected\n\n'))
      let inputTokens = 0
      let outputTokens = 0
      let fullContent = ''
      try {
        for await (const chunk of streamAi({ ...options, stream: true, signal })) {
          if (chunk.content) {
            fullContent += chunk.content
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`))
          }
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens || inputTokens
            outputTokens = chunk.usage.completion_tokens || outputTokens
          }
          if (chunk.done) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`))
            if (ctx) {
              if (!inputTokens && !outputTokens && fullContent) {
                outputTokens = estimateTokens(fullContent)
              }
              await recordUsage(ctx, inputTokens, outputTokens)
            }
            controller.close()
            return
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`))
        if (ctx) {
          if (!inputTokens && !outputTokens && fullContent) {
            outputTokens = estimateTokens(fullContent)
          }
          await recordUsage(ctx, inputTokens, outputTokens)
        }
        controller.close()
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message || '生成失败', done: true })}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream)
}

export interface TrackedStreamOptions {
  taskId: number
  onComplete?: (fullContent: string) => Promise<void>
}

export function createTrackedStreamResponse(
  event: H3Event,
  options: AiRequestOptions,
  ctx: StreamContext,
  tracked: TrackedStreamOptions
) {
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const signal = createRequestSignal(event)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(': connected\n\n'))
      let fullContent = ''
      let totalTokens = 0

      try {
        for await (const chunk of streamAi({ ...options, stream: true, signal })) {
          if (chunk.content) {
            fullContent += chunk.content
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`))
          }
          if (chunk.usage) {
            totalTokens = (chunk.usage.prompt_tokens || 0) + (chunk.usage.completion_tokens || 0)
          }
          if (chunk.done) {
            await ctx.em.nativeUpdate(GenerationTaskSchema, { id: tracked.taskId }, {
              status: 'completed',
              result: fullContent,
              tokensUsed: totalTokens || estimateTokens(fullContent),
              completedAt: new Date()
            })

            const inputTokens = chunk.usage?.prompt_tokens || 0
            const outputTokens = chunk.usage?.completion_tokens || (fullContent ? estimateTokens(fullContent) : 0)
            await recordUsage(ctx, inputTokens, outputTokens)

            if (tracked.onComplete) await tracked.onComplete(fullContent)

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true, taskId: tracked.taskId })}\n\n`))
            controller.close()
            return
          }
        }
      } catch (err: any) {
        await ctx.em.nativeUpdate(GenerationTaskSchema, { id: tracked.taskId }, {
          status: 'failed',
          error: err.message
        })
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream)
}
