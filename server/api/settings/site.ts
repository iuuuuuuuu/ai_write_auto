export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const method = getMethod(event)
  const em = useEm(event)

  if (method === 'GET') {
    const configs = await em.find('SiteConfig', {})
    const result: Record<string, string> = {}
    for (const c of configs) {
      result[(c as any).key] = (c as any).value
    }
    return result
  }

  if (method === 'PUT') {
    requireAdmin(event)
    const body = await readBody(event)

    for (const [key, value] of Object.entries(body)) {
      const existing = await em.findOne('SiteConfig', { key })
      if (existing) {
        await em.nativeUpdate('SiteConfig', { key }, { value: String(value) })
      } else {
        em.create('SiteConfig', { key, value: String(value) })
        await em.flush()
      }
    }

    return { success: true }
  }
})
