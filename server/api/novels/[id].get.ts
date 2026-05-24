import { NovelSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id')!)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id,
    user: auth.userId,
    deletedAt: null,
  }, { populate: ['aiConfig', 'aiConfig.aiModel'] })

  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = novel.aiConfig as any
  const aiModel = aiConfig?.aiModel as any

  return {
    ...novel,
    aiConfigId: aiConfig?.id || null,
    aiConfigName: aiModel?.name || null,
  }
})
