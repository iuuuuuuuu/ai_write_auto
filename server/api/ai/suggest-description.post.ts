import { z } from 'zod'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { createStreamResponse } from '../../utils/ai-stream'
import { toAiOptions } from '../../utils/ai-client'

const schema = z.object({
  title: z.string().min(1),
  genre: z.string().min(1),
  template: z.string().optional(),
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
      content: `标题：${data.title}\n类型：${data.genre}${data.template ? `\n模板：${data.template}` : ''}\n\n请为这部小说生成一段80-150字的中文简介。要求：概括核心冲突、主角处境和悬念，语言精炼有吸引力。直接输出简介正文，不要思考过程、标题、引号或其他标记。`
    }
  ]

  return createStreamResponse(
    event,
    {
      ...toAiOptions(aiConfig, {
        messages,
        temperature: 0.9,
        maxTokens: 300,
        tracking: {
          userId: auth.userId,
          configId: aiConfig.configId,
          modelId: aiConfig.modelId,
          purpose: 'generation',
          scenario: 'suggest_description',
          source: 'api_route',
          endpoint: '/api/ai/suggest-description'
        }
      })
    },
    { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model }
  )
})
