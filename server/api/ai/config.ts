import { z } from 'zod'
import { wrap } from '@mikro-orm/core'
import { AiConfigSchema, AiModelSchema } from '../../database/entities'

const configSchema = z.object({
  id: z.number().int().positive().optional(),
  aiModelId: z.number().int().positive(),
  purpose: z.enum(['generation', 'extraction', 'consistency_check', 'style_analysis']),
  temperature: z.string().optional(),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional()
})

const deleteSchema = z.object({
  id: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const configs = await em.find(AiConfigSchema, { user: auth.userId }, { populate: ['aiModel'] })
    return configs.map(c => ({
      id: c.id,
      purpose: c.purpose,
      temperature: c.temperature,
      isDefault: c.isDefault,
      enabled: c.enabled,
      aiModel: {
        id: (c.aiModel as any).id,
        name: (c.aiModel as any).name,
        model: (c.aiModel as any).model,
        maxTokens: (c.aiModel as any).maxTokens,
        enabled: (c.aiModel as any).enabled
      },
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }))
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = configSchema.parse(body)

    const aiModel = await em.findOne(AiModelSchema, { id: data.aiModelId, user: auth.userId })
    if (!aiModel) {
      throw createError({ statusCode: 400, message: '所选模型不存在' })
    }

    if (data.id) {
      const existing = await em.findOne(AiConfigSchema, { id: data.id, user: auth.userId })
      if (!existing) {
        throw createError({ statusCode: 404, message: '配置不存在' })
      }

      if (data.isDefault) {
        await em.nativeUpdate(AiConfigSchema, { user: auth.userId, purpose: data.purpose }, { isDefault: false, updatedAt: new Date() })
      }

      wrap(existing).assign({
        aiModel: data.aiModelId,
        purpose: data.purpose,
        temperature: data.temperature,
        isDefault: data.isDefault ?? existing.isDefault,
        enabled: data.enabled ?? existing.enabled
      })
      await em.flush()
      return { success: true, id: existing.id }
    }

    const existingForPurpose = await em.find(AiConfigSchema, { user: auth.userId, purpose: data.purpose })
    const isDefault = data.isDefault ?? existingForPurpose.length === 0
    if (isDefault) {
      await em.nativeUpdate(AiConfigSchema, { user: auth.userId, purpose: data.purpose }, { isDefault: false, updatedAt: new Date() })
    }

    const config = em.create(AiConfigSchema, {
      user: auth.userId,
      aiModel: data.aiModelId,
      purpose: data.purpose,
      temperature: data.temperature,
      isDefault,
      enabled: data.enabled ?? true
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
      const remaining = await em.findOne(AiConfigSchema, { user: auth.userId, purpose })
      if (remaining) {
        wrap(remaining).assign({ isDefault: true })
        await em.flush()
      }
    }

    return { success: true }
  }
})
