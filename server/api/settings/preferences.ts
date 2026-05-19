import { z } from 'zod'

const prefSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const prefs = await em.find('UserPreference', { user: auth.userId })
    const result: Record<string, string> = {}
    for (const p of prefs) {
      result[(p as any).key] = (p as any).value
    }
    return result
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const data = prefSchema.parse(body)

    const existing = await em.findOne('UserPreference', { user: auth.userId, key: data.key })
    if (existing) {
      await em.nativeUpdate('UserPreference', { user: auth.userId, key: data.key }, { value: data.value })
    } else {
      em.create('UserPreference', {
        user: auth.userId,
        key: data.key,
        value: data.value,
      })
      await em.flush()
    }

    return { success: true }
  }
})
