import { getDatabase, schema } from '../../database'
import { maskApiKey } from '../../utils/ai-configs'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const db = await getDatabase()

  const [configs, users] = await Promise.all([
    db.select().from(schema.aiConfigs),
    db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role
      })
      .from(schema.users)
  ])

  const usersById = new Map(users.map((user) => [user.id, user]))

  return configs.map((config) => ({
    id: config.id,
    userId: config.userId,
    user: usersById.get(config.userId) || null,
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
  }))
})
