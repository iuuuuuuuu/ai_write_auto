import { maskApiKey } from '../../utils/ai-configs'
import { AiConfigSchema, UserSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)
  const search = (query.search as string || '').trim().toLowerCase()
  const userId = query.userId ? parseInt(query.userId as string) : null

  const filter: Record<string, any> = {}
  if (userId) filter.user = userId

  const [configs, total] = await Promise.all([
    em.find(AiConfigSchema, filter, {
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: { createdAt: 'DESC' },
      populate: ['aiModel', 'aiModel.provider', 'user']
    }),
    em.count(AiConfigSchema, filter),
  ])

  const items = configs.map((config) => {
    const aiModel = config.aiModel as any
    const user = config.user as any
    const provider = aiModel?.provider
    return {
      id: config.id,
      userId: user?.id || user,
      username: user?.username || null,
      purpose: config.purpose,
      temperature: config.temperature,
      isDefault: config.isDefault,
      enabled: config.enabled,
      modelName: aiModel?.name || '',
      model: aiModel?.model || '',
      apiUrl: provider?.apiUrl || '',
      maskedApiKey: provider ? maskApiKey(provider.apiKey) : '',
      maxTokens: aiModel?.maxTokens || null,
      modelEnabled: aiModel?.enabled ?? true,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  })

  const filtered = search
    ? items.filter(item =>
        (item.username || '').toLowerCase().includes(search) ||
        item.model.toLowerCase().includes(search) ||
        item.apiUrl.toLowerCase().includes(search) ||
        item.purpose.toLowerCase().includes(search)
      )
    : items

  return paginatedResult(filtered, search ? filtered.length : total, pagination)
})
