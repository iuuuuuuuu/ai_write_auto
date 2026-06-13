import { z } from 'zod'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import {
  createStreamResponse,
  prepareBudgetedAiOptions,
  standardAiBudgetOptions
} from '../../utils/ai-stream'
import { toAiOptions } from '../../utils/ai-client'

const schema = z.object({
  title: z.string().min(1),
  genre: z.string().min(1),
  template: z.string().optional(),
  idea: z.string().trim().max(5000).optional(),
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
      content: `标题：${data.title}\n类型：${data.genre}${data.template ? `\n模板：${data.template}` : ''}${data.idea ? `\n用户想法：${data.idea}` : ''}\n\n请为这部小说${data.idea ? '基于用户想法丰满、改写成' : '生成'}一段80-180字的中文简介。要求：保留用户想法里的核心人设、关系和冲突；补足主角处境、核心矛盾和悬念；语言精炼有吸引力。直接输出简介正文，不要思考过程、标题、引号或其他标记。`
    }
  ]
  const desiredOutputTokens = 800
  const budgeted = prepareBudgetedAiOptions(
    toAiOptions(aiConfig, {
      messages,
      temperature: 0.9,
      maxTokens: desiredOutputTokens,
      extraBody: {
        enable_thinking: false,
        reasoning_effort: 'low'
      },
      tracking: {
        userId: auth.userId,
        configId: aiConfig.configId,
        modelId: aiConfig.modelId,
        purpose: 'generation',
        scenario: 'suggest_description',
        source: 'api_route',
        endpoint: '/api/ai/suggest-description'
      }
    }),
    standardAiBudgetOptions(aiConfig.contextWindowTokens, desiredOutputTokens)
  )

  return createStreamResponse(event, budgeted.options, {
    em,
    userId: auth.userId,
    configId: aiConfig.id,
    model: aiConfig.model
  })
})
