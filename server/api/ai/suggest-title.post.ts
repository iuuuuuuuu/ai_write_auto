import { z } from 'zod'
import { callAiWithUsage } from '../../utils/ai-client'
import { recordUsage } from '../../utils/ai-stream'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import {
  NovelSchema,
  ChapterSchema,
  NovelOutlineSchema
} from '../../database/entities'

const schema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  chapterNumber: z.number().int().positive().optional(),
  previousChapterTitle: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const em = useEm(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const chapter =
    data.chapterId ?
      await em.findOne(ChapterSchema, {
        id: data.chapterId,
        novel: data.novelId
      })
    : null
  if (data.chapterId && !chapter)
    throw createError({ statusCode: 404, message: 'Chapter not found' })

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    data.novelId,
    'generation',
    data.aiConfigId
  )

  const chapterNumber = chapter?.chapterNumber || data.chapterNumber
  if (!chapterNumber)
    throw createError({
      statusCode: 400,
      message: 'chapterId or chapterNumber is required'
    })

  const contentHint = chapter?.content ? chapter.content.slice(0, 800) : ''
  const chapterOutline = await em.findOne(NovelOutlineSchema, {
    novel: data.novelId,
    chapterNumber
  })
  const outlineHint =
    chapterOutline?.description ?
      `\n章节大纲：${chapterOutline.description}`
    : ''
  const previousHint =
    data.previousChapterTitle ?
      `\n上一章标题：${data.previousChapterTitle}`
    : ''

  const messages = [
    {
      role: 'system' as const,
      content:
        '你是章节标题生成器。根据小说信息和章节内容生成一个简短的章节标题。规则：1. 只输出标题文字，4-10个中文字 2. 不要序号、引号、标点或任何解释 3. 标题要概括章节核心事件或氛围'
    },
    {
      role: 'user' as const,
      content:
        contentHint ?
          `小说：${novel.title}${novel.genre ? `（${novel.genre}）` : ''}\n第${chapterNumber}章${previousHint}${outlineHint}\n\n章节内容片段：\n${contentHint}\n\n请生成章节标题：`
        : `小说：${novel.title}${novel.genre ? `（${novel.genre}）` : ''}\n第${chapterNumber}章${previousHint}${outlineHint}\n请生成一个适合作为下一章的章节标题：`
    }
  ]

  const {
    content: title,
    inputTokens,
    outputTokens
  } = await callAiWithUsage({
    apiUrl: aiConfig.apiUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    messages,
    temperature: 0.8,
    maxTokens: 1024,
    extraBody: {
      enable_thinking: false,
      reasoning_effort: 'low',
    }
  })

  await recordUsage(
    {
      em,
      userId: auth.userId,
      configId: aiConfig.configId,
      model: aiConfig.model
    },
    inputTokens,
    outputTokens
  )

  const cleaned = title
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/g, '')
    .replace(/["""''《》【】\n\r]/g, '')
    .trim()
    .slice(0, 20)

  if (!cleaned) {
    throw createError({
      statusCode: 500,
      message: `AI 返回标题为空，原始响应: ${title || '(空)'}`
    })
  }

  return {
    title: cleaned,
    usage: {
      inputTokens,
      outputTokens
    }
  }
})
