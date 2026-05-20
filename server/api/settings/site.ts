import { SiteConfigSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const configs = await em.find(SiteConfigSchema, {})
    const result: Record<string, string> = {}
    for (const c of configs) {
      result[c.key] = c.value
    }
    return result
  }

  if (method === 'PUT') {
    requireAdmin(event)
    const body = await readBody(event)

    for (const [key, value] of Object.entries(body)) {
      const existing = await em.findOne(SiteConfigSchema, { key })
      if (existing) {
        await em.nativeUpdate(SiteConfigSchema, { key }, { value: String(value) })
      } else {
        em.create(SiteConfigSchema, { key, value: String(value) })
        await em.flush()
      }
    }

    return { success: true }
  }
})
