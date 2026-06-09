import { z } from 'zod'
import { callAiWithUsage, toAiOptions } from '../../utils/ai-client'
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
        '你是章节标题生成器。只输出一个 4-10 个中文字的章节标题本身，然后立即结束。\n严禁输出：思考过程、解释说明、序号（如「第3章」）、书名号/引号/标点、多个候选、或「标题：」之类前缀。\n标题应概括本章核心事件或氛围。现在直接输出标题，不要任何多余文字。'
    },
    {
      role: 'user' as const,
      content:
        contentHint ?
          `小说：${novel.title}${novel.genre ? `（${novel.genre}）` : ''}\n第${chapterNumber}章${previousHint}${outlineHint}\n\n章节内容片段：\n${contentHint}\n\n请生成章节标题：`
        : `小说：${novel.title}${novel.genre ? `（${novel.genre}）` : ''}\n第${chapterNumber}章${previousHint}${outlineHint}\n请生成一个适合作为下一章的章节标题：`
    }
  ]

  // 标题是「服务端消费完再返回 JSON」的短任务，不需要流式；改用非流式 callAiWithUsage
  // 才能可靠拿到 usage——流式下多数 OpenAI 兼容端点不回 usage 块（未传 stream_options），
  // 导致前端「本次消耗」恒为 0。
  const { content: title, inputTokens, outputTokens } = await callAiWithUsage(
    toAiOptions(aiConfig, {
      messages,
      temperature: 0.8,
      maxTokens: 48,
      extraBody: {
        enable_thinking: false,
        reasoning_effort: 'low'
      }
    })
  )

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

  // 取首个非空行 + 去掉「第N章」序号、「标题：」前缀、引号标点；防模型啰嗦或带序号导致标题异常
  const firstLine =
    title
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\|?think\|?>[\s\S]*?<\/?\|?think\|?>/gi, '')
      .split(/[\n\r]+/)
      .map((s) => s.trim())
      .find((s) => s.length > 0) || ''
  const cleaned = firstLine
    .replace(/^第\s*\d+\s*章[：:、.\s]*/g, '')
    .replace(/^(章节标题|标题|title)\s*[：:]\s*/gi, '')
    .replace(/["""''《》【】「」\s]/g, '')
    .replace(/^[，,。.！!？?；;、]+|[，,。.！!？?；;、]+$/g, '')
    .slice(0, 16)

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
