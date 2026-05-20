import { NovelSchema, UserSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)

  const novel = await em.findOne(NovelSchema, { id })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  if (body.userId !== undefined) {
    const newOwner = await em.findOne(UserSchema, { id: body.userId })
    if (!newOwner) {
      throw createError({ statusCode: 400, message: 'Target user not found' })
    }
    novel.user = newOwner as any
  }

  if (body.status !== undefined) {
    novel.status = body.status
  }

  await em.flush()
  return { success: true }
})
