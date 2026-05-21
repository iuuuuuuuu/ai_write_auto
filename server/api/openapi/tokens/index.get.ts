import { ApiTokenSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)

  const tokens = await em.find(
    ApiTokenSchema,
    { user: auth.userId },
    { orderBy: { createdAt: 'DESC' } }
  )

  return tokens.map((token) => ({
    id: token.id,
    name: token.name,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt
  }))
})
