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

  let available = false
  let reason: string | null = null

  try {
    await callAi({
      apiUrl: data.apiUrl,
      apiKey,
      model: data.model,
      messages: [{ role: 'user', content: '1+1' }],
      temperature: 0,
      maxTokens: 10
    })
    available = true
  } catch (e: any) {
    reason = e.message || '连通性检测失败'
  }

  // If testing an existing model, persist the check result
  if (data.existingModelId) {
    const model = await em.findOne(AiModelSchema, { id: data.existingModelId, user: auth.userId })
    if (model) {
      model.lastCheckAt = new Date()
      model.lastCheckAvailable = available
      model.lastCheckReason = reason
      await em.flush()
    }
  }

  return { available, reason }
})
