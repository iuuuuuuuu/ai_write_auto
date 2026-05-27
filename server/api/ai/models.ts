import { z } from 'zod'
import { wrap } from '@mikro-orm/core'
import { AiModelSchema, AiConfigSchema } from '../../database/entities'
import { maskApiKey } from '../../utils/ai-configs'

const modelSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(80),
  apiUrl: z.string().url(),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  maxTokens: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
  lastCheckAt: z.string().optional(),
  lastCheckAvailable: z.boolean().optional(),
  lastCheckReason: z.string().nullable().optional()
})

function serializeModel(model: any) {
  return {
    id: model.id,
    name: model.name,
    apiUrl: model.apiUrl,
    maskedApiKey: maskApiKey(model.apiKey),
    model: model.model,
    maxTokens: model.maxTokens,
    enabled: model.enabled,
    lastCheckAt: model.lastCheckAt?.toISOString?.() || model.lastCheckAt || null,
    lastCheckAvailable: model.lastCheckAvailable,
    lastCheckReason: model.lastCheckReason,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const query = getQuery(event)
    const sortField = (query.sortBy as string) || 'name'
    const sortOrder = (query.sortOrder as string) === 'desc' ? 'DESC' : 'ASC'
    const enabledFilter = query.enabled !== undefined
      ? { enabled: query.enabled === 'true' }
      : {}

    const orderBy: Record<string, 'ASC' | 'DESC'> = {}
    orderBy.enabled = 'DESC'
    if (['name', 'maxTokens', 'createdAt', 'model'].includes(sortField)) {
      orderBy[sortField] = sortOrder as 'ASC' | 'DESC'
    }

    const models = await em.find(AiModelSchema, {
      user: auth.userId,
      ...enabledFilter
    }, { orderBy })

    return models.map(serializeModel)
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = modelSchema.parse(body)

    if (data.id) {
      const existing = await em.findOne(AiModelSchema, { id: data.id, user: auth.userId })
      if (!existing) {
        throw createError({ statusCode: 404, message: '模型不存在' })
      }
      wrap(existing).assign({
        name: data.name,
        apiUrl: data.apiUrl,
        model: data.model,
        maxTokens: data.maxTokens ?? existing.maxTokens,
        enabled: data.enabled ?? existing.enabled,
        ...(data.apiKey ? { apiKey: data.apiKey } : {}),
        ...(data.lastCheckAt ? {
          lastCheckAt: new Date(data.lastCheckAt),
          lastCheckAvailable: data.lastCheckAvailable ?? null,
          lastCheckReason: data.lastCheckReason ?? null
        } : {})
      })
      await em.flush()
      return serializeModel(existing)
    }

    if (!data.apiKey) {
      throw createError({ statusCode: 400, message: 'API 密钥为必填项' })
    }

    const model = em.create(AiModelSchema, {
      user: auth.userId,
      name: data.name,
      apiUrl: data.apiUrl,
      apiKey: data.apiKey,
      model: data.model,
      maxTokens: data.maxTokens ?? 4096,
      enabled: data.enabled ?? true,
      ...(data.lastCheckAt ? {
        lastCheckAt: new Date(data.lastCheckAt),
        lastCheckAvailable: data.lastCheckAvailable ?? null,
        lastCheckReason: data.lastCheckReason ?? null
      } : {})
    })
    await em.flush()
    return serializeModel(model)
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = parseInt(query.id as string)
    if (!id) throw createError({ statusCode: 400, message: '缺少 id 参数' })

    const existing = await em.findOne(AiModelSchema, { id, user: auth.userId })
    if (!existing) {
      throw createError({ statusCode: 404, message: '模型不存在' })
    }

    const referencedCount = await em.count(AiConfigSchema, { aiModel: id })
    if (referencedCount > 0) {
      throw createError({ statusCode: 409, message: `该模型正被 ${referencedCount} 个用途配置引用，请先解除绑定` })
    }

    await em.nativeDelete(AiModelSchema, { id, user: auth.userId })
    return { success: true }
  }
})
