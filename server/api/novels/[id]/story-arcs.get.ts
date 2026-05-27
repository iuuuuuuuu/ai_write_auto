import { StoryArcSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const em = useEm(event)

  const arcs = await em.find(StoryArcSchema, { novel: novelId }, {
    orderBy: { startChapter: 'ASC' } as any
  })

  return arcs.map((arc: any) => ({
    id: arc.id,
    title: arc.title,
    summary: arc.summary,
    startChapter: arc.startChapter,
    endChapter: arc.endChapter,
  }))
})
