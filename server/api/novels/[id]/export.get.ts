export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const novelId = parseInt(getRouterParam(event, 'id')!)
  const query = getQuery(event)
  const format = (query.format as string) || 'txt'
  const em = useEm(event)

  const novel = await em.findOne('Novel', { id: novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const chapters = await em.find('Chapter', { novel: novelId, deletedAt: null }, { orderBy: { chapterNumber: 'ASC' } })

  if (format === 'epub') {
    const epub = (await import('epub-gen-memory')).default
    const epubChapters = chapters.map((ch: any) => ({
      title: `第${ch.chapterNumber}章 ${ch.title}`,
      content: (ch.content || '').split('\n').map((p: string) => `<p>${p}</p>`).join(''),
    }))

    const buffer = await epub(
      {
        title: (novel as any).title,
        author: 'AI Novel Writer',
        description: (novel as any).description || '',
      },
      epubChapters
    )

    setResponseHeaders(event, {
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent((novel as any).title)}.epub"`,
    })

    return buffer
  }

  let content = ''
  let contentType = 'text/plain'
  let ext = 'txt'

  if (format === 'md' || format === 'markdown') {
    ext = 'md'
    contentType = 'text/markdown'
    content = `# ${(novel as any).title}\n\n`
    if ((novel as any).description) content += `> ${(novel as any).description}\n\n---\n\n`
    for (const ch of chapters) {
      content += `## 第${(ch as any).chapterNumber}章 ${(ch as any).title}\n\n`
      content += `${(ch as any).content || ''}\n\n`
    }
  } else {
    content = `${(novel as any).title}\n${'='.repeat((novel as any).title.length)}\n\n`
    if ((novel as any).description) content += `${(novel as any).description}\n\n`
    for (const ch of chapters) {
      content += `第${(ch as any).chapterNumber}章 ${(ch as any).title}\n${'-'.repeat(20)}\n\n`
      content += `${(ch as any).content || ''}\n\n\n`
    }
  }

  setResponseHeaders(event, {
    'Content-Type': `${contentType}; charset=utf-8`,
    'Content-Disposition': `attachment; filename="${encodeURIComponent((novel as any).title)}.${ext}"`,
  })

  return content
})
