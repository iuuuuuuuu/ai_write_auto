import { UserSchema, NovelSchema, AiConfigSchema, TokenUsageSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)

  const [users, novels, aiConfigs, usageCount] = await Promise.all([
    em.find(UserSchema, {}),
    em.find(NovelSchema, { deletedAt: null }),
    em.find(AiConfigSchema, {}),
    em.count(TokenUsageSchema, {}),
  ])

  const conn = em.getConnection()
  const [tokenSumRow] = await conn.execute<{ total: string }>(
    'SELECT COALESCE(SUM(tokens_input + tokens_output), 0) as total FROM token_usage'
  )
  const totalTokens = Number(tokenSumRow?.total || 0)

  const enabledAiConfigs = aiConfigs.filter((config) => config.enabled).length

  return {
    users: {
      total: users.length,
      admins: users.filter((user) => user.role === 'admin').length,
      regular: users.filter((user) => user.role === 'user').length
    },
    novels: {
      total: novels.length,
      draft: novels.filter((novel) => novel.status === 'draft').length,
      inProgress: novels.filter((novel) => novel.status === 'in_progress').length,
      completed: novels.filter((novel) => novel.status === 'completed').length
    },
    aiConfigs: {
      total: aiConfigs.length,
      enabled: enabledAiConfigs,
      disabled: aiConfigs.length - enabledAiConfigs
    },
    usage: {
      requests: usageCount,
      totalTokens
    }
  }
})
