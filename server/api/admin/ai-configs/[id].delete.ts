import { AiConfigSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  const config = await em.findOne(AiConfigSchema, { id })
  if (!config) {
    throw createError({ statusCode: 404, message: 'Config not found' })
  }

  await em.removeAndFlush(config)
  return { success: true }
})
