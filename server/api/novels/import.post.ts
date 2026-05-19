import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'

const importSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  format: z.enum(['txt', 'md']).default('txt'),
})

const CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千\d]+章\s*/,
  /^Chapter\s+\d+/i,
  /^#{1,2}\s+第[一二三四五六七八九十百千\d]+章/,
  /^#{1,2}\s+Chapter\s+\d+/i,
]

function splitIntoChapters(content: string, format: string): Array<{ title: string; content: string }> {
  const lines = content.split('\n')
  const chapters: Array<{ title: string; content: string }> = []
  let currentTitle = ''
  let currentContent: string[] = []

  for (const line of lines) {
    const isChapterHeading = CHAPTER_PATTERNS.some(p => p.test(line.trim()))

    if (isChapterHeading) {
      if (currentTitle || currentContent.length > 0) {
        chapters.push({
          title: currentTitle || `章节 ${chapters.length + 1}`,
          content: currentContent.join('\n').trim(),
        })
      }
      currentTitle = line.trim().replace(/^#{1,2}\s+/, '').replace(/^[-=]+$/, '').trim()
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }

  if (currentTitle || currentContent.length > 0) {
    chapters.push({
      title: currentTitle || `章节 ${chapters.length + 1}`,
      content: currentContent.join('\n').trim(),
    })
  }

  if (chapters.length === 0) {
    chapters.push({ title: '第1章', content: content.trim() })
  }

  return chapters
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody(event)
  const data = importSchema.parse(body)

  const db = await getDatabase()

  const novelResult = await (db as any).insert(schema.novels).values({
    userId: auth.userId,
    title: data.title,
    status: 'in_progress',
  }).returning()

  const novel = novelResult[0]
  const chapters = splitIntoChapters(data.content, data.format)

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]!
    const wordCount = ch.content.replace(/\s/g, '').length
    await (db as any).insert(schema.chapters).values({
      novelId: novel.id,
      chapterNumber: i + 1,
      title: ch.title,
      content: ch.content,
      status: 'edited',
      wordCount,
    })
  }

  return { novelId: novel.id, chaptersImported: chapters.length }
})
