import { z } from 'zod'
import {
  createInlineStreamResponse,
  inlineAiBudgetOptions,
  prepareBudgetedAiOptions
} from '../../utils/ai-stream'
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
      content: `你是一位专业的文本扩写助手。请保持原文核心含义、语气和上下文关系，只输出扩写后的文本，不要解释。

${buildTextProtocolRules()}`
    },
    {
      role: 'user' as const,
      content:
        data.direction ?
          `请将以下文本进行扩写，增加细节和深度，保持原意。扩写方向：${data.direction}\n\n原文：\n${data.text}\n\n直接输出扩写后的文本，不要解释。`
        : `请将以下文本进行扩写，增加细节和深度，保持原意。\n\n原文：\n${data.text}\n\n直接输出扩写后的文本，不要解释。`
    }
  ]

  const desiredOutputTokens = aiConfig.maxTokens || 4096
  const budgeted = prepareBudgetedAiOptions(
    toAiOptions(aiConfig, {
      messages,
      temperature: parseFloat(aiConfig.temperature || '0.7'),
      maxTokens: desiredOutputTokens,
      extraBody: PROSE_SAMPLING,
      tracking: {
        userId: auth.userId,
        configId: aiConfig.configId,
        modelId: aiConfig.modelId,
        purpose: 'generation',
        scenario: 'inline_expand',
        source: 'api_route',
        endpoint: '/api/ai/text-expand'
      }
    }),
    inlineAiBudgetOptions(aiConfig.contextWindowTokens, desiredOutputTokens)
  )

  return createInlineStreamResponse(
    event,
    budgeted.options,
    { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model }
  )
})
