import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/core'
import { streamAi, toAiOptions } from '../../utils/ai-client'
import {
  createRequestSignal,
  recordUsage,
  estimateTokens
} from '../../utils/ai-stream'
import {
  resolveNovelAiConfig,
  type ResolvedAiConfig
} from '../../utils/ai-configs'
import { buildGenerationPrompt } from '../../utils/ai-prompts'
import {
  NovelSchema,
  ChapterSchema,
  CharacterSchema,
  PlotPointSchema,
  StoryArcSchema,
  NovelOutlineSchema,
  GenerationTaskSchema
} from '../../database/entities'
import { recordAiGeneration } from '../../utils/writing-stats'
import { enqueuePostProcessing } from '../../services/task-queue'
import { isEmbeddingReady } from '../../services/embedding'
import {
  retrieveRelevant,
  getActiveForeshadowing
} from '../../services/content-rag'
import {
  WORKSPACE_MAX_CHAPTERS,
  MAX_TOKENS_WORKSPACE
} from '../../utils/ai-constants'
import { ensureOutlinesForRange } from '../../services/outline-autofill'

const workspaceSchema = z.object({
  novelId: z.number().int().positive(),
  fromChapter: z.number().int().positive(),
  toChapter: z.number().int().positive(),
  direction: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

function isPlaceholderChapterTitle(
  title: string | null | undefined,
  chapterNumber: number
) {
  const normalized = (title || '').trim()
  return (
    !normalized ||
    normalized === `第${chapterNumber}章` ||
    /^第\d+章\s*$/.test(normalized)
  )
}

function cleanGeneratedChapterTitle(rawTitle: string) {
  return (
    rawTitle
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/g, '')
      .replace(/^\s*(章节名|章节标题|标题)[:：]\s*/u, '')
      .replace(/^第[\d一二三四五六七八九十百千万]+章\s*/u, '')
      .replace(/["“”'‘’《》【】#*`\n\r]/g, '')
      .replace(/\s+/g, '')
      .split(/[。！？!?，,；;：:]/u)[0]
      ?.trim()
      .slice(0, 20) || ''
  )
}

function fallbackTitleFromOutline(chapterNumber: number, outline?: string) {
  const title = outline ? cleanGeneratedChapterTitle(outline) : ''
  return title || `第${chapterNumber}章`
}

async function generateChapterTitle(options: {
  em: EntityManager
  userId: number
  aiConfig: ResolvedAiConfig
  novel: { title: string; genre?: string | null }
  chapterNumber: number
  chapterOutline?: string
  previousChapterTitle?: string
  signal: AbortSignal
}) {
  const fallbackTitle = fallbackTitleFromOutline(
    options.chapterNumber,
    options.chapterOutline
  )

  try {
    const outlineHint =
      options.chapterOutline ? `\n章节大纲：${options.chapterOutline}` : ''
    const previousHint =
      options.previousChapterTitle ?
        `\n上一章标题：${options.previousChapterTitle}`
      : ''
    const messages = [
      {
        role: 'system' as const,
        content:
          '你是章节标题生成器。根据小说信息和章节大纲生成一个简短的章节标题。规则：1. 只输出标题文字，4-10个中文字 2. 不要序号、引号、标点或任何解释 3. 标题要概括本章核心事件或氛围'
      },
      {
        role: 'user' as const,
        content: `小说：${options.novel.title}${options.novel.genre ? `（${options.novel.genre}）` : ''}\n第${options.chapterNumber}章${previousHint}${outlineHint}\n\n请生成章节标题：`
      }
    ]

    let title = ''
    let inputTokens = 0
    let outputTokens = 0
    for await (const chunk of streamAi(
      toAiOptions(options.aiConfig, {
        messages,
        temperature: 0.8,
        maxTokens: 128,
        stream: true,
        signal: options.signal,
        extraBody: {
          enable_thinking: false,
          reasoning_effort: 'low'
        }
      })
    )) {
      if (chunk.content) title += chunk.content
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens || inputTokens
        outputTokens = chunk.usage.completion_tokens || outputTokens
      }
    }

    if (!inputTokens && !outputTokens && title) {
      outputTokens = estimateTokens(title)
    }
    await recordUsage(
      {
        em: options.em,
        userId: options.userId,
        configId: options.aiConfig.id,
        model: options.aiConfig.model
      },
      inputTokens,
      outputTokens
    )

    return cleanGeneratedChapterTitle(title) || fallbackTitle
  } catch {
    return fallbackTitle
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = workspaceSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    data.novelId,
    'generation',
    data.aiConfigId
  )

  const totalChapters = data.toChapter - data.fromChapter + 1
  if (totalChapters > WORKSPACE_MAX_CHAPTERS) {
    throw createError({
      statusCode: 400,
      message: `Maximum ${WORKSPACE_MAX_CHAPTERS} chapters per workspace session`
    })
  }

  const task = em.create(GenerationTaskSchema, {
    novel: data.novelId,
    type: 'batch_generate',
    status: 'running'
  })
  await em.flush()
  const taskId = task.id

  const signal = createRequestSignal(event)

  // Pre-load shared context once
  const characters = await em.find(CharacterSchema, { novel: data.novelId })
  const plotPoints = await em.find(PlotPointSchema, { novel: data.novelId })
  const storyArcs = await em.find(StoryArcSchema, { novel: data.novelId })
  const outlines = await em.find(
    NovelOutlineSchema,
    { novel: data.novelId },
    { orderBy: { sortOrder: 'ASC' } }
  )

  let foreshadowing: Array<{
    content: string
    description: string | null
    chapterNumber: number | null
  }> = []
  try {
    foreshadowing = await getActiveForeshadowing(data.novelId)
  } catch {}

  // Pre-fetch RAG context for the entire batch
  let sharedRagContext: Array<{
    content: string
    contentType: string
    chapterId: number | null
    characterName?: string
  }> = []
  if (isEmbeddingReady()) {
    const batchQuery = [novel.title, novel.description, data.direction]
      .filter(Boolean)
      .join(' ')
    if (batchQuery) {
      sharedRagContext = await retrieveRelevant(data.novelId, batchQuery, 15)
    }
  }

  async function readTaskStatus() {
    const currentTask = await em.findOne(GenerationTaskSchema, { id: taskId })
    return currentTask?.status || 'running'
  }

  async function waitWhilePaused(
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder
  ) {
    const MAX_PAUSE_MS = 30 * 60 * 1000
    const pauseStart = Date.now()
    while ((await readTaskStatus()) === 'paused') {
      if (signal.aborted) return
      if (Date.now() - pauseStart > MAX_PAUSE_MS) {
        await em.nativeUpdate(
          GenerationTaskSchema,
          { id: taskId },
          { status: 'cancelled' }
        )
        return
      }
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'paused', taskId })}\n\n`
        )
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(': connected\n\n'))

      try {
        // 先大纲、再正文：批量生成前一次性补齐整段缺失的大纲（只补缺口、不覆盖已有；失败则降级继续）
        try {
          const { filled } = await ensureOutlinesForRange({
            em,
            novel,
            novelId: data.novelId,
            fromChapter: data.fromChapter,
            toChapter: data.toChapter,
            characters,
            existingOutlines: outlines,
            direction: data.direction,
            aiConfig,
            userId: auth.userId
          })
          if (filled.length) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'outline_filled', taskId, chapters: filled })}\n\n`
              )
            )
          }
        } catch {
          /* 降级：补全失败按无大纲继续生成 */
        }

        // Track previous chapter content for sliding window
        let prevChapterContent: string | null = null
        let prevPrevChapterContent: string | null = null

        for (
          let chapterNum = data.fromChapter;
          chapterNum <= data.toChapter;
          chapterNum++
        ) {
          if (signal.aborted) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'cancelled', taskId, reason: 'client_disconnected' })}\n\n`
              )
            )
            return
          }
          await waitWhilePaused(controller, encoder)
          if ((await readTaskStatus()) === 'cancelled') {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'cancelled', taskId })}\n\n`
              )
            )
            return
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'progress', taskId, current: chapterNum, completed: chapterNum - data.fromChapter, total: totalChapters })}\n\n`
            )
          )

          // Re-fetch chapters for up-to-date summaries
          const allChapters = await em.find(
            ChapterSchema,
            { novel: data.novelId, deletedAt: null },
            { orderBy: { chapterNumber: 'ASC' }, populate: ['content'] }
          )
          // 仅把「当前章之前」的章节作为上下文，避免把尚未生成/将被覆盖的后续章节摘要泄露给 AI
          const chapters = allChapters.filter(
            (c) => c.chapterNumber < chapterNum
          )

          const chapterOutline = outlines.find(
            (o) => o.chapterNumber === chapterNum
          )

          // Build recent chapter content (sliding window).
          // 优先用本次会话刚生成的正文；从中间章节起步时本地缓存为空，则回退到 DB 中的已有前序章节，保证首章也有前文衔接。
          const recentChapterContent: Array<{
            chapterNumber: number
            title: string
            content: string
          }> = []
          const prevPrevCh = allChapters.find(
            (c) => c.chapterNumber === chapterNum - 2
          )
          if (prevPrevCh) {
            const body = prevPrevChapterContent ?? prevPrevCh.content
            if (body)
              recentChapterContent.push({
                chapterNumber: prevPrevCh.chapterNumber,
                title: prevPrevCh.title,
                content: body.slice(-3000)
              })
          }
          const prevCh = allChapters.find(
            (c) => c.chapterNumber === chapterNum - 1
          )
          if (prevCh) {
            const body = prevChapterContent ?? prevCh.content
            if (body)
              recentChapterContent.push({
                chapterNumber: prevCh.chapterNumber,
                title: prevCh.title,
                content: body.slice(-4000)
              })
          }

          // 章节定位锚点：先大纲、再标题、再正文。已有自定义标题不覆盖；默认标题则基于大纲预生成。
          const existingForNum = allChapters.find(
            (c) => c.chapterNumber === chapterNum
          )
          const previousTitle = prevCh?.title || undefined
          const chapterTitle =
            isPlaceholderChapterTitle(existingForNum?.title, chapterNum) ?
              await generateChapterTitle({
                em,
                userId: auth.userId,
                aiConfig,
                novel,
                chapterNumber: chapterNum,
                chapterOutline: chapterOutline?.description,
                previousChapterTitle: previousTitle,
                signal
              })
            : existingForNum!.title
          if (signal.aborted) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'cancelled', taskId, reason: 'client_disconnected' })}\n\n`
              )
            )
            return
          }
          const currentChapter = {
            chapterNumber: chapterNum,
            title: chapterTitle
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'title_generated', taskId, chapter: chapterNum, title: chapterTitle })}\n\n`
            )
          )

          // 每章针对本章剧情独立检索相关角色近况；缺少本章锚点时回退到整批共享检索
          let ragContext = sharedRagContext
          if (isEmbeddingReady()) {
            const perChapterQuery = [
              chapterOutline?.description,
              data.direction
            ]
              .filter(Boolean)
              .join(' ')
            if (perChapterQuery) {
              ragContext = await retrieveRelevant(
                data.novelId,
                perChapterQuery,
                10
              )
            }
          }

          const prompt = buildGenerationPrompt({
            novel,
            chapters,
            characters,
            plotPoints,
            storyArcs,
            currentChapter,
            currentChapterOutline: chapterOutline?.description,
            userDirection: data.direction,
            ragContext,
            foreshadowing,
            recentChapterContent
          })

          let generatedContent = ''
          let inputTokens = 0
          let outputTokens = 0
          let chunkCount = 0

          for await (const chunk of streamAi(
            toAiOptions(aiConfig, {
              temperature:
                novel.aiTemperature ?
                  parseFloat(novel.aiTemperature)
                : parseFloat(aiConfig.temperature ?? '0.7'),
              maxTokens: aiConfig.maxTokens || MAX_TOKENS_WORKSPACE,
              messages: prompt,
              stream: true,
              signal
            })
          )) {
            chunkCount++
            if (chunkCount % 20 === 0) {
              if ((await readTaskStatus()) === 'cancelled') {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'cancelled', taskId })}\n\n`
                  )
                )
                return
              }
            }
            if (chunk.content) {
              generatedContent += chunk.content
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'chunk', taskId, chapter: chapterNum, content: chunk.content })}\n\n`
                )
              )
            }
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || inputTokens
              outputTokens = chunk.usage.completion_tokens || outputTokens
            }
          }

          if (!inputTokens && !outputTokens && generatedContent) {
            outputTokens = estimateTokens(generatedContent)
          }
          await recordUsage(
            {
              em,
              userId: auth.userId,
              configId: aiConfig.id,
              model: aiConfig.model
            },
            inputTokens,
            outputTokens
          )

          // Save chapter
          const existingChapter = allChapters.find(
            (c) => c.chapterNumber === chapterNum
          )
          let savedChapterId: number
          if (existingChapter) {
            await em.nativeUpdate(
              ChapterSchema,
              { id: existingChapter.id },
              {
                title: chapterTitle,
                content: generatedContent,
                wordCount: generatedContent.replace(/\s/g, '').length,
                status: 'generated',
                updatedAt: new Date()
              }
            )
            savedChapterId = existingChapter.id
          } else {
            const newChapter = em.create(ChapterSchema, {
              novel: data.novelId,
              chapterNumber: chapterNum,
              title: chapterTitle,
              content: generatedContent,
              wordCount: generatedContent.replace(/\s/g, '').length,
              status: 'generated'
            })
            await em.flush()
            savedChapterId = newChapter.id
          }

          // Track content for next chapter's sliding window
          prevPrevChapterContent = prevChapterContent
          prevChapterContent = generatedContent

          await recordAiGeneration(em, auth.userId)
          enqueuePostProcessing(data.novelId, savedChapterId).catch(() => {})

          em.clear()

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'chapter_done', taskId, chapter: chapterNum, title: chapterTitle, completed: chapterNum - data.fromChapter + 1, total: totalChapters })}\n\n`
            )
          )
        }

        await em.nativeUpdate(
          GenerationTaskSchema,
          { id: taskId },
          { status: 'completed', completedAt: new Date() }
        )
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', taskId, completed: totalChapters, total: totalChapters })}\n\n`
          )
        )
      } catch (e: any) {
        await em
          .nativeUpdate(
            GenerationTaskSchema,
            { id: taskId },
            { status: 'failed', error: e.message }
          )
          .catch(() => {})
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', taskId, message: e.message })}\n\n`
            )
          )
        } catch {}
      } finally {
        try {
          controller.close()
        } catch {}
      }
    }
  })

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })

  return new Response(stream)
})
