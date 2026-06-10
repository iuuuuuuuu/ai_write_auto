import { z } from 'zod'
import { createInlineStreamResponse } from '../../utils/ai-stream'
import { toAiOptions, PROSE_SAMPLING } from '../../utils/ai-client'
import { resolveUserAiConfig } from '../../utils/ai-configs'

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
      role: 'user' as const,
      content:
        data.direction ?
          `请将以下文本进行扩写，增加细节和深度，保持原意。扩写方向：${data.direction}\n\n原文：\n${data.text}\n\n直接输出扩写后的文本，不要解释。`
        : `请将以下文本进行扩写，增加细节和深度，保持原意。\n\n原文：\n${data.text}\n\n直接输出扩写后的文本，不要解释。`
    }
  ]

  return createInlineStreamResponse(
    event,
    {
      ...toAiOptions(aiConfig, {
        messages,
        temperature: parseFloat(aiConfig.temperature || '0.7'),
        maxTokens: aiConfig.maxTokens || 4096,
        extraBody: PROSE_SAMPLING
      })
    },
    { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model }
  )
})
