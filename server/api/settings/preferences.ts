import { z } from 'zod'
import { UserPreferenceSchema } from '../../database/entities'

const prefSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const prefs = await em.find(UserPreferenceSchema, { user: auth.userId })
    const result: Record<string, string> = {}
    for (const p of prefs) {
      result[p.key] = p.value
    }
    return result
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const data = prefSchema.parse(body)

    const existing = await em.findOne(UserPreferenceSchema, { user: auth.userId, key: data.key })
    if (existing) {
      await em.nativeUpdate(UserPreferenceSchema, { user: auth.userId, key: data.key }, { value: data.value })
    } else {
      em.create(UserPreferenceSchema, {
        user: auth.userId,
        key: data.key,
        value: data.value,
      })
      await em.flush()
    }

    return { success: true }
  }
})
