import { z } from 'zod'
import { AiModelSchema } from '../../database/entities'
import { callAi } from '../../utils/ai-client'

const schema = z.object({
  id: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const query = getQuery(event)
  const { id } = schema.parse(query)

  const model = await em.findOne(AiModelSchema, { id, user: auth.userId }, { populate: ['provider'] })
  if (!model) {
    throw createError({ statusCode: 404, message: '模型不存在' })
  }

  const provider = model.provider as any
  let available = false
  let reason: string | null = null

  try {
    await callAi({
      apiUrl: provider.apiUrl,
      apiKey: provider.apiKey,
      model: model.model,
      messages: [{ role: 'user', content: '1+1' }],
      temperature: 0,
      maxTokens: 10
    })
    available = true
  } catch (e: any) {
    reason = e.message || '连通性检测失败'
  }

  model.lastCheckAt = new Date()
  model.lastCheckAvailable = available
  model.lastCheckReason = reason
  await em.flush()

  return { available, modelId: id, checkedAt: model.lastCheckAt.toISOString(), reason }
})
