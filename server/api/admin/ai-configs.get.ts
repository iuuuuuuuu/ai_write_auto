import { maskApiKey } from '../../utils/ai-configs'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)

  const [configs, users] = await Promise.all([
    em.find('AiConfig', {}),
    em.find('User', {}),
  ])

  const usersById = new Map(users.map((user: any) => [user.id, { id: user.id, username: user.username, role: user.role }]))

  return configs.map((config: any) => ({
    id: config.id,
    userId: config.user,
    user: usersById.get(config.user) || null,
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
