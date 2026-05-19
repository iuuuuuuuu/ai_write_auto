import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { getEffectiveDbConfig } from '../../database/db-config'
import { runMigrations } from '../../database/migrate'
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

function serializeConfig(config: typeof schema.aiConfigs.$inferSelect) {
  return {
    ...config,
    apiKey: '',
    maskedApiKey: maskApiKey(config.apiKey)
  }
}

async function clearDefaultForPurpose(
  db: Awaited<ReturnType<typeof getDatabase>>,
  userId: number,
  purpose: typeof schema.aiConfigs.$inferSelect.purpose
) {
  await db
    .update(schema.aiConfigs)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(
      and(
        eq(schema.aiConfigs.userId, userId),
        eq(schema.aiConfigs.purpose, purpose)
      )
    )
}

function isMissingAiConfigColumnError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes('no such column') ||
      error.message.includes('Unknown column'))
  )
}

async function getUserConfigs(
  db: Awaited<ReturnType<typeof getDatabase>>,
  userId: number
) {
  try {
    return await db
      .select()
      .from(schema.aiConfigs)
      .where(eq(schema.aiConfigs.userId, userId))
  } catch (error) {
    if (!isMissingAiConfigColumnError(error)) throw error

    await runMigrations(getEffectiveDbConfig())
    return await db
      .select()
      .from(schema.aiConfigs)
      .where(eq(schema.aiConfigs.userId, userId))
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const db = await getDatabase()

  if (method === 'GET') {
    const configs = await getUserConfigs(db, auth.userId)
    return configs.map(serializeConfig)
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const data = aiConfigSchema.parse(body)

    if (data.id) {
      const existing = await db
        .select()
        .from(schema.aiConfigs)
        .where(
          and(
            eq(schema.aiConfigs.id, data.id),
            eq(schema.aiConfigs.userId, auth.userId)
          )
        )
        .limit(1)

      if (!existing.length) {
        throw createError({ statusCode: 404, message: 'AI config not found' })
      }

      if (data.isDefault) {
        await clearDefaultForPurpose(db, auth.userId, data.purpose)
      }

      const updateData = {
        name: data.name,
        purpose: data.purpose,
        apiUrl: data.apiUrl,
        model: data.model,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        isDefault: data.isDefault ?? existing[0].isDefault,
        enabled: data.enabled ?? existing[0].enabled,
        updatedAt: new Date(),
        ...(data.apiKey ? { apiKey: data.apiKey } : {})
      }

      const result = await db
        .update(schema.aiConfigs)
        .set(updateData)
        .where(
          and(
            eq(schema.aiConfigs.id, data.id),
            eq(schema.aiConfigs.userId, auth.userId)
          )
        )
        .returning()
      return serializeConfig(result[0])
    }

    if (!data.apiKey) {
      throw createError({ statusCode: 400, message: 'API key is required' })
    }

    const existingForPurpose = await db
      .select()
      .from(schema.aiConfigs)
      .where(
        and(
          eq(schema.aiConfigs.userId, auth.userId),
          eq(schema.aiConfigs.purpose, data.purpose)
        )
      )

    const isDefault = data.isDefault ?? existingForPurpose.length === 0
    if (isDefault) {
      await clearDefaultForPurpose(db, auth.userId, data.purpose)
    }

    const result = await db
      .insert(schema.aiConfigs)
      .values({
        userId: auth.userId,
        name: data.name,
        purpose: data.purpose,
        apiUrl: data.apiUrl,
        apiKey: data.apiKey,
        model: data.model,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        isDefault,
        enabled: data.enabled ?? true
      })
      .returning()
    return serializeConfig(result[0])
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const { id } = deleteSchema.parse(query)

    const existing = await db
      .select()
      .from(schema.aiConfigs)
      .where(
        and(
          eq(schema.aiConfigs.id, id),
          eq(schema.aiConfigs.userId, auth.userId)
        )
      )
      .limit(1)

    if (!existing.length) {
      throw createError({ statusCode: 404, message: 'AI config not found' })
    }

    await db
      .delete(schema.aiConfigs)
      .where(
        and(
          eq(schema.aiConfigs.id, id),
          eq(schema.aiConfigs.userId, auth.userId)
        )
      )

    if (existing[0].isDefault) {
      const remaining = await db
        .select()
        .from(schema.aiConfigs)
        .where(
          and(
            eq(schema.aiConfigs.userId, auth.userId),
            eq(schema.aiConfigs.purpose, existing[0].purpose)
          )
        )
        .limit(1)

      if (remaining.length) {
        await db
          .update(schema.aiConfigs)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(schema.aiConfigs.id, remaining[0].id))
      }
    }

    return { success: true }
  }
})
