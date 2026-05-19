import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const query = getQuery(event)
  const format = (query.format as string) || 'txt'

  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(and(eq(schema.novels.id, novelId), eq(schema.novels.userId, auth.userId)))
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }
  const novel = novels[0]

  const chapters = await (db as any)
    .select()
    .from(schema.chapters)
    .where(and(eq(schema.chapters.novelId, novelId), isNull(schema.chapters.deletedAt)))
    .orderBy(schema.chapters.chapterNumber)

  if (format === 'epub') {
    const epub = (await import('epub-gen-memory')).default
    const epubChapters = chapters.map((ch: any) => ({
      title: `第${ch.chapterNumber}章 ${ch.title}`,
      content: (ch.content || '').split('\n').map((p: string) => `<p>${p}</p>`).join(''),
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
