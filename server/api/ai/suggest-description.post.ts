import { z } from 'zod'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { createStreamResponse } from '../../utils/ai-stream'

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

  const aiConfig = await resolveUserAiConfig(em, auth.userId, 'generation', data.aiConfigId)

  const messages = [
    {
      role: 'system' as const,
      content: `你是小说简介生成器。用户给出标题和类型，你直接输出一段中文小说简介，80-150字。

规则：
1. 只输出简介正文，不输出任何思考过程、解释、标题、引号或标记
2. 必须是中文
3. 概括核心冲突、主角处境和悬念
4. 语言精炼有吸引力`
    },
    {
      role: 'user' as const,
      content: `标题：${data.title}\n类型：${data.genre}${data.template ? `\n模板：${data.template}` : ''}\n\n直接输出简介：`
    }
  ]

  return createStreamResponse(event, {
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: 0.9,
    maxTokens: 300
  }, { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model })
})
