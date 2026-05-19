import { z } from 'zod'
import { wrap } from '@mikro-orm/core'
import { maskApiKey } from '../../utils/ai-configs'

const aiConfigSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(80),
  purpose: z.enum([
    'generation',
    'extraction',
    'consistency_check',
    'style_analysis'
  ]),
  apiUrl: z.string().url(),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  temperature: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional()
})

const deleteSchema = z.object({
  id: z.coerce.number().int().positive()
})

function serializeConfig(config: any) {
  return {
    ...config,
    apiKey: '',
    maskedApiKey: maskApiKey(config.apiKey)
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const configs = await em.find('AiConfig', { user: auth.userId })
    return configs.map(serializeConfig)
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = aiConfigSchema.parse(body)
    if (data.id) {
      const existing = await em.findOne('AiConfig', { id: data.id, user: auth.userId })
      if (!existing) {
        throw createError({ statusCode: 404, message: 'AI config not found' })
      }

      if (data.isDefault) {
        await em.nativeUpdate('AiConfig', { user: auth.userId, purpose: data.purpose }, { isDefault: false, updatedAt: new Date() })
      }

      wrap(existing).assign({
        name: data.name,
        purpose: data.purpose,
        apiUrl: data.apiUrl,
        model: data.model,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        isDefault: data.isDefault ?? (existing as any).isDefault,
        enabled: data.enabled ?? (existing as any).enabled,
        updatedAt: new Date(),
        ...(data.apiKey ? { apiKey: data.apiKey } : {}),
      })
      await em.flush()
      return serializeConfig(existing)
    }

    if (!data.apiKey) {
      throw createError({ statusCode: 400, message: 'API key is required' })
    }

    const existingForPurpose = await em.find('AiConfig', { user: auth.userId, purpose: data.purpose })
    const isDefault = data.isDefault ?? existingForPurpose.length === 0
    if (isDefault) {
      await em.nativeUpdate('AiConfig', { user: auth.userId, purpose: data.purpose }, { isDefault: false, updatedAt: new Date() })
    }

    const config = em.create('AiConfig', {
      user: auth.userId,
      name: data.name,
      purpose: data.purpose,
      apiUrl: data.apiUrl,
      apiKey: data.apiKey,
      model: data.model,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      isDefault,
      enabled: data.enabled ?? true,
    })
    await em.flush()
    return serializeConfig(config)
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const { id } = deleteSchema.parse(query)

    const existing = await em.findOne('AiConfig', { id, user: auth.userId })
    if (!existing) {
      throw createError({ statusCode: 404, message: 'AI config not found' })
    }

    const wasDefault = (existing as any).isDefault
    const purpose = (existing as any).purpose

    await em.nativeDelete('AiConfig', { id, user: auth.userId })

    if (wasDefault) {
      const remaining = await em.findOne('AiConfig', { user: auth.userId, purpose })
      if (remaining) {
        wrap(remaining).assign({ isDefault: true, updatedAt: new Date() })
        await em.flush()
      }
    }

    return { success: true }
  }
})
