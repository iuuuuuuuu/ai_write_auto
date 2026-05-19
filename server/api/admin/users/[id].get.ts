import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { maskApiKey } from '../../../utils/ai-configs'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid user id' })
  }

  const db = await getDatabase()
  const users = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      role: schema.users.role,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1)

  if (!users.length) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const [configs, novels, usage] = await Promise.all([
    db.select().from(schema.aiConfigs).where(eq(schema.aiConfigs.userId, id)),
    db.select().from(schema.novels).where(eq(schema.novels.userId, id)),
    db.select().from(schema.tokenUsage).where(eq(schema.tokenUsage.userId, id))
  ])

  const activeNovels = novels.filter((novel) => novel.deletedAt === null)
  const totalTokens = usage.reduce(
    (sum, item) => sum + item.tokensInput + item.tokensOutput,
    0
  )

  return {
    user: users[0],
    aiConfigs: configs.map((config) => ({
      id: config.id,
      name: config.name,
      purpose: config.purpose,
      apiUrl: config.apiUrl,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      isDefault: config.isDefault,
      enabled: config.enabled,
      maskedApiKey: maskApiKey(config.apiKey),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    })),
    novels: activeNovels,
    stats: {
      novels: activeNovels.length,
      deletedNovels: novels.length - activeNovels.length,
      aiConfigs: configs.length,
      enabledAiConfigs: configs.filter((config) => config.enabled).length,
      tokenRequests: usage.length,
      totalTokens
    }
  }
})
