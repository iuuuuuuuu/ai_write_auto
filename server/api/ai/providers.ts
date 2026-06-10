import { z } from 'zod'
import { wrap } from '@mikro-orm/core'
import { AiProviderSchema, AiModelSchema } from '../../database/entities'
import { maskApiKey } from '../../utils/ai-configs'
import { isModelOperational } from '../../utils/ai-model-capabilities'

function modelCapabilityFields(model: any) {
  return {
    supportsThinking: model.supportsThinking,
    thinkingEnabled: model.thinkingEnabled,
    reasoningEffort: model.reasoningEffort,
    temperatureDefault: model.temperatureDefault,
    temperatureMin: model.temperatureMin,
    temperatureMax: model.temperatureMax,
    topPDefault: model.topPDefault,
    topPMin: model.topPMin,
    topPMax: model.topPMax,
    samplingLockedWhenThinking: model.samplingLockedWhenThinking
  }
}

const providerSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(80),
  apiUrl: z.string().url(),
  apiKey: z.string().optional(),
  enabled: z.boolean().optional(),
  lastCheckAt: z.string().optional(),
  lastCheckAvailable: z.boolean().optional(),
  lastCheckReason: z.string().nullable().optional()
})

function serializeProvider(provider: any) {
  return {
    id: provider.id,
    name: provider.name,
    apiUrl: provider.apiUrl,
    maskedApiKey: maskApiKey(provider.apiKey),
    enabled: provider.enabled,
    lastCheckAt:
      provider.lastCheckAt?.toISOString?.() || provider.lastCheckAt || null,
    lastCheckAvailable: provider.lastCheckAvailable,
    lastCheckReason: provider.lastCheckReason,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const providers = await em.find(
      AiProviderSchema,
      { user: auth.userId },
      {
        orderBy: { enabled: 'DESC', name: 'ASC' }
      }
    )

    const models = await em.find(
      AiModelSchema,
      { user: auth.userId },
      {
        orderBy: { enabled: 'DESC', name: 'ASC' }
      }
    )

    return providers.map((p) => ({
      ...serializeProvider(p),
      models: models
        .filter((m) => (m.provider as any).id === p.id)
        .map((m) => ({
          id: m.id,
          name: m.name,
          model: m.model,
          maxTokens: m.maxTokens,
          enabled: m.enabled,
          ...modelCapabilityFields(m),
          operational: isModelOperational({
            enabled: m.enabled,
            lastCheckAvailable: m.lastCheckAvailable,
            provider: { enabled: p.enabled }
          }),
          lastCheckAt: m.lastCheckAt?.toISOString?.() || m.lastCheckAt || null,
          lastCheckAvailable: m.lastCheckAvailable,
          lastCheckReason: m.lastCheckReason
        }))
    }))
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = providerSchema.parse(body)

    if (data.id) {
      const existing = await em.findOne(AiProviderSchema, {
        id: data.id,
        user: auth.userId
      })
      if (!existing) {
        throw createError({ statusCode: 404, message: '供应商不存在' })
      }
      wrap(existing).assign({
        name: data.name,
        apiUrl: data.apiUrl,
        enabled: data.enabled ?? existing.enabled,
        ...(data.apiKey ? { apiKey: data.apiKey } : {}),
        ...(data.lastCheckAt ?
          {
            lastCheckAt: new Date(data.lastCheckAt),
            lastCheckAvailable: data.lastCheckAvailable ?? null,
            lastCheckReason: data.lastCheckReason ?? null
          }
        : {})
      })
      await em.flush()
      return serializeProvider(existing)
    }

    if (!data.apiKey) {
      throw createError({ statusCode: 400, message: 'API 密钥为必填项' })
    }

    const provider = em.create(AiProviderSchema, {
      user: auth.userId,
      name: data.name,
      apiUrl: data.apiUrl,
      apiKey: data.apiKey,
      enabled: data.enabled ?? true,
      ...(data.lastCheckAt ?
        {
          lastCheckAt: new Date(data.lastCheckAt),
          lastCheckAvailable: data.lastCheckAvailable ?? null,
          lastCheckReason: data.lastCheckReason ?? null
        }
      : {})
    })
    await em.flush()
    return serializeProvider(provider)
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = parseInt(query.id as string)
    if (!id) throw createError({ statusCode: 400, message: '缺少 id 参数' })

    const existing = await em.findOne(AiProviderSchema, {
      id,
      user: auth.userId
    })
    if (!existing) {
      throw createError({ statusCode: 404, message: '供应商不存在' })
    }

    const modelCount = await em.count(AiModelSchema, {
      provider: id,
      user: auth.userId
    })
    if (modelCount > 0) {
      throw createError({
        statusCode: 409,
        message: `该供应商下有 ${modelCount} 个模型，请先删除模型`
      })
    }

    await em.nativeDelete(AiProviderSchema, { id, user: auth.userId })
    return { success: true }
  }
})
