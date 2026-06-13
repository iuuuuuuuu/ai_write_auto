import { z } from 'zod'
import { wrap } from '@mikro-orm/core'
import { AiConfigSchema, AiModelSchema } from '../../database/entities'
import { isModelOperational } from '../../utils/ai-model-capabilities'

const configSchema = z.object({
  id: z.number().int().positive().optional(),
  aiModelId: z.number().int().positive(),
  purpose: z.enum([
    'generation',
    'extraction',
    'consistency_check',
    'style_analysis',
    'planning'
  ]),
  temperature: z.string().optional(),
  topP: z.string().optional(),
  thinkingEnabled: z.boolean().nullable().optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high']).nullable().optional(),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
  order: z.number().int().optional()
})

function serializeAiModel(model: any) {
  const provider = model.provider
  return {
    id: model.id,
    name: model.name,
    model: model.model,
    maxTokens: model.maxTokens,
    contextWindowTokens: model.contextWindowTokens,
    enabled: model.enabled,
    lastCheckAt:
      model.lastCheckAt?.toISOString?.() || model.lastCheckAt || null,
    lastCheckAvailable: model.lastCheckAvailable,
    lastCheckReason: model.lastCheckReason,
    supportsThinking: model.supportsThinking,
    thinkingEnabled: model.thinkingEnabled,
    reasoningEffort: model.reasoningEffort,
    temperatureDefault: model.temperatureDefault,
    temperatureMin: model.temperatureMin,
    temperatureMax: model.temperatureMax,
    topPDefault: model.topPDefault,
    topPMin: model.topPMin,
    topPMax: model.topPMax,
    samplingLockedWhenThinking: model.samplingLockedWhenThinking,
    providerEnabled: provider?.enabled ?? false,
    providerLastCheckAt:
      provider?.lastCheckAt?.toISOString?.() || provider?.lastCheckAt || null,
    providerLastCheckAvailable: provider?.lastCheckAvailable ?? null,
    providerLastCheckReason: provider?.lastCheckReason ?? null,
    operational: isModelOperational({
      enabled: model.enabled,
      lastCheckAvailable: model.lastCheckAvailable,
      provider: { enabled: provider?.enabled }
    })
  }
}

const deleteSchema = z.object({
  id: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const configs = await em.find(
      AiConfigSchema,
      { user: auth.userId },
      {
        populate: ['aiModel', 'aiModel.provider'],
        orderBy: { order: 'ASC', createdAt: 'ASC' }
      }
    )
    return configs.map((c) => ({
      id: c.id,
      purpose: c.purpose,
      temperature: c.temperature,
      topP: c.topP,
      thinkingEnabled: c.thinkingEnabled,
      reasoningEffort: c.reasoningEffort,
      isDefault: c.isDefault,
      enabled: c.enabled,
      order: c.order,
      operational: c.enabled && serializeAiModel(c.aiModel as any).operational,
      aiModel: serializeAiModel(c.aiModel as any),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }))
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = configSchema.parse(body)

    const aiModel = await em.findOne(AiModelSchema, {
      id: data.aiModelId,
      user: auth.userId
    })
    if (!aiModel) {
      throw createError({ statusCode: 400, message: '所选模型不存在' })
    }

    if (data.id) {
      const existing = await em.findOne(AiConfigSchema, {
        id: data.id,
        user: auth.userId
      })
      if (!existing) {
        throw createError({ statusCode: 404, message: '配置不存在' })
      }

      if (data.isDefault) {
        await em.nativeUpdate(
          AiConfigSchema,
          { user: auth.userId, purpose: data.purpose },
          { isDefault: false, updatedAt: new Date() }
        )
      }

      wrap(existing).assign({
        aiModel: data.aiModelId,
        purpose: data.purpose,
        temperature: data.temperature,
        topP: data.topP ?? existing.topP,
        thinkingEnabled: data.thinkingEnabled ?? existing.thinkingEnabled,
        reasoningEffort: data.reasoningEffort ?? existing.reasoningEffort,
        isDefault: data.isDefault ?? existing.isDefault,
        enabled: data.enabled ?? existing.enabled,
        ...(data.order != null ? { order: data.order } : {})
      })
      await em.flush()
      return { success: true, id: existing.id }
    }

    const existingForPurpose = await em.find(AiConfigSchema, {
      user: auth.userId,
      purpose: data.purpose
    })
    const isDefault = data.isDefault ?? existingForPurpose.length === 0
    if (isDefault) {
      await em.nativeUpdate(
        AiConfigSchema,
        { user: auth.userId, purpose: data.purpose },
        { isDefault: false, updatedAt: new Date() }
      )
    }

    const maxOrder = existingForPurpose.reduce(
      (max, c) => Math.max(max, c.order ?? 0),
      0
    )
    const config = em.create(AiConfigSchema, {
      user: auth.userId,
      aiModel: data.aiModelId,
      purpose: data.purpose,
      temperature: data.temperature,
      topP: data.topP ?? null,
      thinkingEnabled: data.thinkingEnabled ?? null,
      reasoningEffort: data.reasoningEffort ?? null,
      isDefault,
      enabled: data.enabled ?? true,
      order: data.order ?? maxOrder + 1
    })
    await em.flush()
    return { success: true, id: config.id }
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const { id } = deleteSchema.parse(query)

    const existing = await em.findOne(AiConfigSchema, { id, user: auth.userId })
    if (!existing) {
      throw createError({ statusCode: 404, message: '配置不存在' })
    }

    const wasDefault = existing.isDefault
    const purpose = existing.purpose

    await em.nativeDelete(AiConfigSchema, { id, user: auth.userId })

    if (wasDefault) {
      const remaining = await em.findOne(AiConfigSchema, {
        user: auth.userId,
        purpose
      })
      if (remaining) {
        wrap(remaining).assign({ isDefault: true })
        await em.flush()
      }
    }

    return { success: true }
  }
})
