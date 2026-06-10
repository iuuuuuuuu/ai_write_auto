import { z } from 'zod'
import { createInlineStreamResponse } from '../../utils/ai-stream'
import { toAiOptions, PROSE_SAMPLING } from '../../utils/ai-client'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { buildTextProtocolRules } from '../../utils/ai-prompts'

const schema = z.object({
  text: z.string().min(1),
  direction: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = schema.parse(body)
  const em = useEm(event)

  const aiConfig = await resolveUserAiConfig(
    em,
    auth.userId,
    'generation',
    data.aiConfigId
  )

  const messages = [
    {
      role: 'system' as const,
      content: `你是一位专业的文本改写助手。请保持原文核心含义、语气和上下文关系，只输出改写后的文本，不要解释。

${buildTextProtocolRules()}`
    },
    {
      role: 'user' as const,
      content:
        data.direction ?
          `请将以下文本进行改写，使其更加流畅、专业或有创意，保持核心含义不变。改写方向：${data.direction}\n\n原文：\n${data.text}\n\n直接输出改写后的文本，不要解释。`
        : `请将以下文本进行改写，使其更加流畅、专业或有创意，保持核心含义不变。\n\n原文：\n${data.text}\n\n直接输出改写后的文本，不要解释。`
    }
  ]

  return createInlineStreamResponse(
    event,
    {
      ...toAiOptions(aiConfig, {
        messages,
        temperature: parseFloat(aiConfig.temperature || '0.7'),
        maxTokens: aiConfig.maxTokens || 4096,
        extraBody: PROSE_SAMPLING,
        tracking: {
          userId: auth.userId,
          configId: aiConfig.configId,
          modelId: aiConfig.modelId,
          purpose: 'generation',
          scenario: 'inline_rewrite',
          source: 'api_route',
          endpoint: '/api/ai/text-rewrite'
        }
      })
    },
    { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model }
  )
})
