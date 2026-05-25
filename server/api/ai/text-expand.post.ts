import { z } from 'zod'
import { createInlineStreamResponse } from '../../utils/ai-stream'
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

  const aiConfig = await resolveUserAiConfig(em, auth.userId, 'generation', data.aiConfigId)

  const messages = [
    { role: 'system' as const, content: '你是一个专业的文本扩写助手。请将用户提供的文本进行扩写，保持原意但增加细节和深度。直接输出扩写后的文本，不要添加任何解释。' },
    { role: 'user' as const, content: data.direction ? `请按照以下方向扩写文本：${data.direction}\n\n原文：\n${data.text}` : `请扩写以下文本：\n${data.text}` }
  ]

  return createInlineStreamResponse(event, {
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: parseFloat(aiConfig.temperature || '0.7'),
    maxTokens: aiConfig.maxTokens || 4096,
  }, { em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model })
})
