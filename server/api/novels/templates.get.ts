import { NovelTemplateSchema } from '../../database/entities'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const em = useEm(event)

  const templates = await em.find(NovelTemplateSchema, {}, { orderBy: { id: 'DESC' } })
  return templates
})
