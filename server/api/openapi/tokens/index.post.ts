import { z } from 'zod'
import { nanoid } from 'nanoid'
import { ApiTokenSchema } from '../../../database/entities'

const createSchema = z.object({
  name: z.string().min(1).max(100)
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)

  const body = await readBody(event)
  const data = createSchema.parse(body)

  const rawToken = `ak_${nanoid(32)}`
  const bcrypt = await import('bcryptjs')
  const tokenHash = bcrypt.hashSync(rawToken, 10)

  const token = em.create(ApiTokenSchema, {
    user: auth.userId,
    name: data.name,
    tokenHash
  })
  await em.flush()

  return {
    id: token.id,
    name: token.name,
    token: rawToken,
    createdAt: token.createdAt
  }
})
