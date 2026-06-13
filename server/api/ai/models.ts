import { z } from 'zod'
import { wrap } from '@mikro-orm/core'
import {
  AiModelSchema,
  AiConfigSchema,
  AiProviderSchema
} from '../../database/entities'
import {
  getBuiltinModelPreset,
  isModelOperational
} from '../../utils/ai-model-capabilities'

const modelSchema = z.object({
  id: z.number().int().positive().optional(),
  providerId: z.number().int().positive(),
  name: z.string().min(1).max(80),
  model: z.string().min(1),
  maxTokens: z.number().int().positive().optional(),
  contextWindowTokens: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
  supportsThinking: z.boolean().optional(),
  thinkingEnabled: z.boolean().optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  temperatureDefault: z.number().min(0).max(2).optional(),
  temperatureMin: z.number().min(0).max(2).optional(),
  temperatureMax: z.number().min(0).max(2).optional(),
  topPDefault: z.number().min(0.01).max(1).optional(),
  topPMin: z.number().min(0.01).max(1).optional(),
  topPMax: z.number().min(0.01).max(1).optional(),
  samplingLockedWhenThinking: z.boolean().optional(),
  lastCheckAt: z.string().optional(),
  lastCheckAvailable: z.boolean().optional(),
  lastCheckReason: z.string().nullable().optional()
})

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

function modelCapabilityAssign(data: z.infer<typeof modelSchema>) {
  const preset = getBuiltinModelPreset(data.model)
  return {
    supportsThinking: data.supportsThinking ?? preset.supportsThinking,
    thinkingEnabled: data.thinkingEnabled ?? preset.thinkingEnabled,
    reasoningEffort: data.reasoningEffort ?? preset.reasoningEffort,
    temperatureDefault: data.temperatureDefault ?? preset.temperatureDefault,
    temperatureMin: data.temperatureMin ?? preset.temperatureMin,
    temperatureMax: data.temperatureMax ?? preset.temperatureMax,
    topPDefault: data.topPDefault ?? preset.topPDefault,
    topPMin: data.topPMin ?? preset.topPMin,
    topPMax: data.topPMax ?? preset.topPMax,
    samplingLockedWhenThinking:
      data.samplingLockedWhenThinking ?? preset.samplingLockedWhenThinking
  }
}

function serializeModel(model: any) {
  const provider = model.provider
  return {
    id: model.id,
    name: model.name,
    model: model.model,
    maxTokens: model.maxTokens,
    contextWindowTokens: model.contextWindowTokens,
    enabled: model.enabled,
    ...modelCapabilityFields(model),
    operational: isModelOperational({
      enabled: model.enabled,
      lastCheckAvailable: model.lastCheckAvailable,
      provider: { enabled: provider?.enabled }
    }),
    lastCheckAt:
      model.lastCheckAt?.toISOString?.() || model.lastCheckAt || null,
    lastCheckAvailable: model.lastCheckAvailable,
    lastCheckReason: model.lastCheckReason,
    providerId: provider?.id,
    providerName: provider?.name,
    apiUrl: provider?.apiUrl,
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
    const enabledFilter =
      query.enabled !== undefined ? { enabled: query.enabled === 'true' } : {}

    const orderBy: Record<string, 'ASC' | 'DESC'> = {}
    orderBy.enabled = 'DESC'
    if (
      [
        'name',
        'maxTokens',
        'contextWindowTokens',
        'createdAt',
        'model'
      ].includes(sortField)
    ) {
      orderBy[sortField] = sortOrder as 'ASC' | 'DESC'
    }

    const models = await em.find(
      AiModelSchema,
      {
        user: auth.userId,
        ...enabledFilter
      },
      { orderBy, populate: ['provider'] }
    )

    return models.map(serializeModel)
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = modelSchema.parse(body)

    const provider = await em.findOne(AiProviderSchema, {
      id: data.providerId,
      user: auth.userId
    })
    if (!provider) {
      throw createError({ statusCode: 400, message: '所选供应商不存在' })
    }

    if (data.id) {
      const existing = await em.findOne(AiModelSchema, {
        id: data.id,
        user: auth.userId
      })
      if (!existing) {
        throw createError({ statusCode: 404, message: '模型不存在' })
      }
      wrap(existing).assign({
        name: data.name,
        provider: data.providerId,
        model: data.model,
        maxTokens: data.maxTokens ?? existing.maxTokens,
        contextWindowTokens:
          data.contextWindowTokens ?? existing.contextWindowTokens,
        enabled: data.enabled ?? existing.enabled,
        ...modelCapabilityAssign(data),
        ...(data.lastCheckAt ?
          {
            lastCheckAt: new Date(data.lastCheckAt),
            lastCheckAvailable: data.lastCheckAvailable ?? null,
            lastCheckReason: data.lastCheckReason ?? null
          }
        : {})
      })
      await em.flush()
      return serializeModel(existing)
    }

    const model = em.create(AiModelSchema, {
      user: auth.userId,
      provider: data.providerId,
      name: data.name,
      model: data.model,
      maxTokens: data.maxTokens ?? 4096,
      contextWindowTokens: data.contextWindowTokens ?? 32768,
      enabled: data.enabled ?? true,
      ...modelCapabilityAssign(data),
      ...(data.lastCheckAt ?
        {
          lastCheckAt: new Date(data.lastCheckAt),
          lastCheckAvailable: data.lastCheckAvailable ?? null,
          lastCheckReason: data.lastCheckReason ?? null
        }
      : {})
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
      throw createError({
        statusCode: 409,
        message: `该模型正被 ${referencedCount} 个用途配置引用，请先解除绑定`
      })
    }

    await em.nativeDelete(AiModelSchema, { id, user: auth.userId })
    return { success: true }
  }
})
