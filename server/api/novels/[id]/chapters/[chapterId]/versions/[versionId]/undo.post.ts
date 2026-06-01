import {
  NovelSchema,
  ChapterSchema,
  ChapterVersionSchema
} from '../../../../../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const chapterId = parseIntParam(event, 'chapterId')
  const versionId = parseIntParam(event, 'versionId')
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter = await em.findOne(ChapterSchema, {
    id: chapterId,
    novel: novelId,
    deletedAt: null
  })
  if (!chapter)
    throw createError({ statusCode: 404, message: 'Chapter not found' })

  const version = await em.findOne(ChapterVersionSchema, {
    id: versionId,
    chapter: chapterId
  })
  if (!version)
    throw createError({ statusCode: 404, message: 'Version not found' })

  chapter.content = version.content
  chapter.wordCount = (version.content || '').replace(/\s/g, '').length

  await em.flush()

  return {
    success: true,
    undoneToVersionId: versionId,
    undoneToVersionNumber: version.versionNumber
  }
})
