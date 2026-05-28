import { z } from 'zod'
import { AiModelSchema, AiProviderSchema } from '../../database/entities'
import { callAi } from '../../utils/ai-client'

const schema = z.object({
  apiUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  providerId: z.number().int().positive().optional(),
  existingModelId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  let apiUrl = data.apiUrl
  let apiKey = data.apiKey

  // Resolve from provider if providerId given
  if (data.providerId && (!apiUrl || !apiKey)) {
    const provider = await em.findOne(AiProviderSchema, { id: data.providerId, user: auth.userId })
    if (!provider) throw createError({ statusCode: 404, message: '供应商不存在' })
    apiUrl = apiUrl || provider.apiUrl
    apiKey = apiKey || provider.apiKey
  }

  // Resolve from existing model's provider
  if (data.existingModelId && (!apiUrl || !apiKey)) {
    const existing = await em.findOne(AiModelSchema, { id: data.existingModelId, user: auth.userId }, { populate: ['provider'] })
    if (!existing) throw createError({ statusCode: 404, message: '模型不存在' })
    const prov = existing.provider as any
    apiUrl = apiUrl || prov.apiUrl
    apiKey = apiKey || prov.apiKey
  }

  if (!apiUrl || !apiKey) {
    throw createError({ statusCode: 400, message: '缺少 API 地址或密钥' })
  }

  let available = false
  let reason: string | null = null

  try {
    await callAi({
      apiUrl,
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

  // Persist check result on existing model
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
