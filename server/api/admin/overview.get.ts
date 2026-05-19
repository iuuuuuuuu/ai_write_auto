export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)

  const [users, novels, aiConfigs, tokenUsage] = await Promise.all([
    em.find('User', {}),
    em.find('Novel', { deletedAt: null }),
    em.find('AiConfig', {}),
    em.find('TokenUsage', {}),
  ])

  const totalTokens = tokenUsage.reduce(
    (sum: number, item: any) => sum + item.tokensInput + item.tokensOutput,
    0
  )
  const enabledAiConfigs = aiConfigs.filter((config: any) => config.enabled).length

  return {
    users: {
      total: users.length,
      admins: users.filter((user: any) => user.role === 'admin').length,
      regular: users.filter((user: any) => user.role === 'user').length
    },
    novels: {
      total: novels.length,
      draft: novels.filter((novel: any) => novel.status === 'draft').length,
      inProgress: novels.filter((novel: any) => novel.status === 'in_progress').length,
      completed: novels.filter((novel: any) => novel.status === 'completed').length
    },
    aiConfigs: {
      total: aiConfigs.length,
      enabled: enabledAiConfigs,
      disabled: aiConfigs.length - enabledAiConfigs
    },
    usage: {
      requests: tokenUsage.length,
      totalTokens
    }
  }
})
