import { maskApiKey } from '../../../utils/ai-configs'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid user id' })
  }

  const em = useEm(event)
  const user = await em.findOne('User', { id })
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const [configs, novels, usage] = await Promise.all([
    em.find('AiConfig', { user: id }),
    em.find('Novel', { user: id }),
    em.find('TokenUsage', { user: id }),
  ])

  const activeNovels = novels.filter((novel: any) => novel.deletedAt === null)
  const totalTokens = usage.reduce(
    (sum: number, item: any) => sum + item.tokensInput + item.tokensOutput,
    0
  )

  return {
    user: {
      id: (user as any).id,
      username: (user as any).username,
      role: (user as any).role,
      createdAt: (user as any).createdAt,
    },
    aiConfigs: configs.map((config: any) => ({
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
      enabledAiConfigs: configs.filter((config: any) => config.enabled).length,
      tokenRequests: usage.length,
      totalTokens
    }
  }
})
