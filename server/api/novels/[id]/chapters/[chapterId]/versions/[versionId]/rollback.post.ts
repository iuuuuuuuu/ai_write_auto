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

  // 创建新版本记录当前状态（作为回滚前的备份）
  const currentVersions = await em.find(
    ChapterVersionSchema,
    { chapter: chapterId },
    { orderBy: { versionNumber: 'ASC' } }
  )

  em.create(ChapterVersionSchema, {
    chapter: chapterId,
    versionNumber: currentVersions.length + 1,
    content: chapter.content || '',
    source: 'user_edited'
  })

  // 回滚到目标版本内容
  chapter.content = version.content
  chapter.wordCount = (version.content || '').replace(/\s/g, '').length

  await em.flush()

  return {
    success: true,
    rolledBackToVersionId: versionId,
    rolledBackToVersionNumber: version.versionNumber
  }
})
