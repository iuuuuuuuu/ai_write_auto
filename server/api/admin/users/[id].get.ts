import { maskApiKey } from '../../../utils/ai-configs'
import { UserSchema, AiConfigSchema, NovelSchema, TokenUsageSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid user id' })
  }

  const em = useEm(event)
  const user = await em.findOne(UserSchema, { id })
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const [configs, novels, usage] = await Promise.all([
    em.find(AiConfigSchema, { user: id }),
    em.find(NovelSchema, { user: id }),
    em.find(TokenUsageSchema, { user: id }),
  ])

  const activeNovels = novels.filter((novel) => novel.deletedAt === null)
  const totalTokens = usage.reduce(
    (sum, item) => sum + item.tokensInput + item.tokensOutput,
    0
  )

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    },
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
