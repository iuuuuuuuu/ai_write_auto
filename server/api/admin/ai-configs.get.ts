import { maskApiKey } from '../../utils/ai-configs'
import { AiConfigSchema, UserSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)
  const search = (query.search as string || '').trim().toLowerCase()

  const filter: Record<string, any> = {}
  if (search) {
    filter.name = { $like: `%${search}%` }
  }

  const [configs, total] = await Promise.all([
    em.find(AiConfigSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { createdAt: 'DESC' },
    }),
    em.count(AiConfigSchema, filter),
  ])

  const userIds = [...new Set(configs.map((c) => c.user as any))]
  const users = userIds.length ? await em.find(UserSchema, { id: { $in: userIds } }) : []
  const usersById = new Map(users.map((user) => [user.id, { id: user.id, username: user.username, role: user.role }]))

  const items = configs.map((config) => ({
    id: config.id,
    userId: config.user,
    user: usersById.get(config.user as any) || null,
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
    updatedAt: config.updatedAt,
  }))

  return paginatedResult(items, total, pagination)
})
