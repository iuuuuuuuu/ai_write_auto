import { AiConfigSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)

  const config = await em.findOne(AiConfigSchema, { id })
  if (!config) {
    throw createError({ statusCode: 404, message: 'Config not found' })
  }

  if (body.enabled !== undefined) {
    config.enabled = Boolean(body.enabled)
  }

  await em.flush()
  return { success: true, enabled: config.enabled }
})
