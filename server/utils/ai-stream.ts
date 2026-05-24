import type { H3Event } from 'h3'
import type { EntityManager } from '@mikro-orm/core'
import { streamAi, callAi, type AiRequestOptions } from './ai-client'
import { TokenUsageSchema, ModelCostRateSchema } from '../database/entities'

export function createRequestSignal(event: H3Event): AbortSignal {
  const controller = new AbortController()
  event.node.req.on('close', () => controller.abort())
  return controller.signal
}

interface StreamContext {
  em: EntityManager
  userId: number
  configId: number
  model: string
}

async function recordUsage(ctx: StreamContext, inputTokens: number, outputTokens: number) {
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

export function createStreamResponse(event: H3Event, options: AiRequestOptions, ctx?: StreamContext) {
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const encoder = new TextEncoder()
  let fullContent = ''

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(': connected\n\n'))
      try {
        let inputTokens = 0
        let outputTokens = 0

        for await (const chunk of streamAi({ ...options, stream: true })) {
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
          fullContent = await callAi(options)
        }

        if (ctx) {
          if (!inputTokens && !outputTokens) {
            outputTokens = Math.ceil(fullContent.length / 2)
          }
          await recordUsage(ctx, inputTokens, outputTokens)
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true, fullContent })}\n\n`))
        controller.close()
      } catch (error: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message || '生成失败', done: true })}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream)
}
