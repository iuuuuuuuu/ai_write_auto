import { NovelSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id')!)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id,
    user: auth.userId,
    deletedAt: null,
  }, { populate: ['aiConfig'] })

  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  return {
    ...novel,
    aiConfigId: (novel.aiConfig as any)?.id || null,
    aiConfigName: (novel.aiConfig as any)?.name || null,
  }
})
