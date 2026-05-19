import { isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const db = await getDatabase()

  const [users, novels, aiConfigs, tokenUsage] = await Promise.all([
    db.select().from(schema.users),
    db.select().from(schema.novels).where(isNull(schema.novels.deletedAt)),
    db.select().from(schema.aiConfigs),
    db.select().from(schema.tokenUsage)
  ])

  const totalTokens = tokenUsage.reduce(
    (sum, item) => sum + item.tokensInput + item.tokensOutput,
    0
  )
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
      inProgress: novels.filter((novel) => novel.status === 'in_progress')
        .length,
      completed: novels.filter((novel) => novel.status === 'completed').length
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
