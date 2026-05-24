import { z } from 'zod'
import { AiModelSchema } from '../../database/entities'
import { callAi } from '../../utils/ai-client'

const schema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  existingModelId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  let apiKey = data.apiKey
  if (apiKey === '__use_existing__' && data.existingModelId) {
    const existing = await em.findOne(AiModelSchema, { id: data.existingModelId, user: auth.userId })
    if (!existing) throw createError({ statusCode: 404, message: '模型不存在' })
    apiKey = existing.apiKey
  }

  try {
    await callAi({
      apiUrl: data.apiUrl,
      apiKey,
      model: data.model,
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
      maxTokens: 8
    })
    return { available: true, reason: null }
  } catch (e: any) {
    return { available: false, reason: e.message || '连通性检测失败' }
  }
})
