import { NovelSchema, ChapterSchema } from '../../../database/entities'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseIntParam(event, 'id')
  const query = getQuery(event)
  const format = (query.format as string) || 'txt'
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: novelId, user: auth.userId, deletedAt: null })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const chapters = await em.find(ChapterSchema, { novel: novelId, deletedAt: null }, { orderBy: { chapterNumber: 'ASC' }, populate: ['content'] })

  if (format === 'epub') {
    const epub = (await import('epub-gen-memory')).default
    const escapeHtml = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const epubChapters = chapters.map((ch) => ({
      title: `第${ch.chapterNumber}章 ${ch.title}`,
      content: (ch.content || '').split('\n').map((p: string) => `<p>${escapeHtml(p)}</p>`).join(''),
    }))

    const buffer = await epub(
      {
        title: novel.title,
        author: 'AI Novel Writer',
        description: novel.description || '',
      },
      epubChapters
    )

    setResponseHeaders(event, {
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(novel.title)}.epub"`,
    })

    return buffer
  }

  let content = ''
  let contentType = 'text/plain'
  let ext = 'txt'

  if (format === 'md' || format === 'markdown') {
    ext = 'md'
    contentType = 'text/markdown'
    content = `# ${novel.title}\n\n`
    if (novel.description) content += `> ${novel.description}\n\n---\n\n`
    for (const ch of chapters) {
      content += `## 第${ch.chapterNumber}章 ${ch.title}\n\n`
      content += `${ch.content || ''}\n\n`
    }
  } else {
    content = `${novel.title}\n${'='.repeat(novel.title.length)}\n\n`
    if (novel.description) content += `${novel.description}\n\n`
    for (const ch of chapters) {
      content += `第${ch.chapterNumber}章 ${ch.title}\n${'-'.repeat(20)}\n\n`
      content += `${ch.content || ''}\n\n\n`
    }
  }

  setResponseHeaders(event, {
    'Content-Type': `${contentType}; charset=utf-8`,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(novel.title)}.${ext}"`,
  })

  return content
})
