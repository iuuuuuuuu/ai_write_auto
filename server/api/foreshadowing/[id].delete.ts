import { ForeshadowingSchema, NovelSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const em = useEm(event)

  const foreshadowing = await em.findOne(ForeshadowingSchema, { id }, { populate: ['novel'] })
  if (!foreshadowing) throw createError({ statusCode: 404, message: 'Not found' })
  if ((foreshadowing.novel as any).user !== auth.userId) throw createError({ statusCode: 403, message: 'Forbidden' })

  await em.removeAndFlush(foreshadowing)
  return { success: true }
})