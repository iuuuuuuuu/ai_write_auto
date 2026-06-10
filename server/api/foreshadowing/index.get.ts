import { ForeshadowingSchema, NovelSchema } from '../../database/entities'
import {
  isActiveChapterRef,
  isPopulatedChapter
} from '../../utils/chapter-refs'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const novelId = Number(query.novelId)

  if (!novelId)
    throw createError({ statusCode: 400, message: 'novelId is required' })

  const em = useEm(event)
  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const items = await em.find(
    ForeshadowingSchema,
    { novel: novelId },
    {
      populate: ['chapter'],
      orderBy: { createdAt: 'DESC' }
    }
  )

  return items.map((f) => {
    const chapter = f.chapter
    const isActiveChapter =
      isPopulatedChapter(chapter) && isActiveChapterRef(chapter)
    return {
      id: f.id,
      content: f.content,
      description: f.description,
      status: f.status,
      chapterId: isActiveChapter ? chapter.id : null,
      chapterNumber: isActiveChapter ? chapter.chapterNumber : null,
      resolvedAtChapter: f.resolvedAtChapter,
      createdAt: f.createdAt
    }
  })
})
