import { z } from 'zod'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { createStreamResponse } from '../../utils/ai-stream'
import { toAiOptions } from '../../utils/ai-client'

const worldbuildingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  genre: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = worldbuildingSchema.parse(body)
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
      content: `你是一位专业的小说世界观策划师。请根据用户提供的小说标题、类型和简介，生成一段精炼的世界观设定和写作风格指南。

要求：
- 世界观设定：描述时代背景、地理环境、核心规则或势力格局，200-400字
- 写作风格指南：描述叙事口吻、节奏、语言风格和注意事项，100-200字
- 返回严格的 JSON 格式，不要包含其他内容：
{"worldSetting": "...", "styleGuide": "..."}`
    },
    {
      role: 'user' as const,
      content: `小说标题：${data.title}\n类型：${data.genre || '未指定'}\n简介：${data.description || '暂无简介'}`
    }
  ]

  return createStreamResponse(
    event,
    {
      ...toAiOptions(aiConfig, {
        messages,
        temperature: 0.85,
        maxTokens: 1500,
        tracking: {
          userId: auth.userId,
          configId: aiConfig.configId,
          modelId: aiConfig.modelId,
          purpose: 'generation',
          scenario: 'worldbuilding_generate',
          source: 'api_route',
          endpoint: '/api/ai/worldbuilding'
        }
      })
    },
    { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model },
    { parseJsonResult: 'object' }
  )
})
