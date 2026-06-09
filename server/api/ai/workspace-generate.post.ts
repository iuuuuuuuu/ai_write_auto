import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/core'
import { streamAi, toAiOptions, PROSE_SAMPLING } from '../../utils/ai-client'
import {
  createRequestSignal,
  recordUsage,
  estimateTokens,
  streamWithContinuation
} from '../../utils/ai-stream'
import {
  resolveNovelAiConfig,
  type ResolvedAiConfig
} from '../../utils/ai-configs'
import { prepareChapterContext } from '../../services/chapter-context'
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
  getActiveForeshadowing,
  type ContentContext
} from '../../services/content-rag'
import {
  WORKSPACE_MAX_CHAPTERS,
  MAX_TOKENS_WORKSPACE
} from '../../utils/ai-constants'
import { ensureOutlinesForRange } from '../../services/outline-autofill'
import { parseEnabledSkillIds } from '../../utils/writing-skills'

const workspaceSchema = z.object({
  novelId: z.number().int().positive(),
  fromChapter: z.number().int().positive(),
  toChapter: z.number().int().positive(),
  direction: z.string().optional(),
  aiConfigId: z.number().int().positive().optional(),
  skillIds: z.array(z.number().int().positive()).optional()
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

function buildBatchChapterSummary(content: string) {
  const plain = content.replace(/\s+/g, ' ').trim()
  return plain.length > 240 ? `${plain.slice(0, 240)}…` : plain
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

  // 本批生成统一的写作技能包：本次显式勾选优先，否则用小说默认启用。
  const resolvedSkillIds =
    data.skillIds ?? parseEnabledSkillIds(novel.enabledSkillIds)

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
  let sharedRagContext: ContentContext[] = []
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
        const batchChapterSummaries = new Map<
          number,
          { title: string; summary: string }
        >()

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
          const chapters = allChapters
            .filter((c) => c.chapterNumber < chapterNum)
            .map((c) => {
              const batchSummary = batchChapterSummaries.get(c.chapterNumber)
              return {
                title: batchSummary?.title || c.title,
                chapterNumber: c.chapterNumber,
                summary: c.summary || batchSummary?.summary || null,
                content: c.content
              }
            })
          const promptNovel =
            (await em.findOne(NovelSchema, {
              id: data.novelId,
              user: auth.userId
            })) || novel
          const promptCharacters = await em.find(CharacterSchema, {
            novel: data.novelId
          })
          const promptPlotPoints = await em.find(PlotPointSchema, {
            novel: data.novelId
          })
          const promptStoryArcs = await em.find(StoryArcSchema, {
            novel: data.novelId
          })
          let promptForeshadowing = foreshadowing
          try {
            promptForeshadowing = await getActiveForeshadowing(data.novelId)
          } catch {}

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
                novel: promptNovel,
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

          // 每章针对本章剧情独立检索（query-only，廉价模型产 query）；整批 sharedRagContext 经 extraNotes 合并去重保留
          const { messages: prompt } = await prepareChapterContext(em, {
            novel: promptNovel,
            novelId: data.novelId,
            userId: auth.userId,
            currentChapter,
            outline: chapterOutline?.description,
            direction: data.direction,
            precedingChapters: chapters,
            characters: promptCharacters,
            plotPoints: promptPlotPoints,
            storyArcs: promptStoryArcs,
            foreshadowing: promptForeshadowing,
            recentChapterContent,
            depth: 'query-only',
            extraNotes: sharedRagContext,
            skillIds: resolvedSkillIds
          })

          // 截断驱动续写：长章节触达 maxTokens 不在句中断；轮间检查任务是否被取消
          const {
            fullContent: generatedContent,
            inputTokens,
            outputTokens,
            finalTruncated
          } = await streamWithContinuation(
            toAiOptions(aiConfig, {
              temperature:
                promptNovel.aiTemperature ?
                  parseFloat(promptNovel.aiTemperature)
                : parseFloat(aiConfig.temperature ?? '0.7'),
              maxTokens: aiConfig.maxTokens || MAX_TOKENS_WORKSPACE,
              extraBody: PROSE_SAMPLING,
              messages: prompt,
              stream: true,
              signal
            }),
            signal,
            (content) =>
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'chunk', taskId, chapter: chapterNum, content })}\n\n`
                )
              ),
            { checkAbort: async () => (await readTaskStatus()) === 'cancelled' }
          )

          // 流式结束后若任务已被取消（或客户端断开）则不保存本章，直接结束
          if (signal.aborted || (await readTaskStatus()) === 'cancelled') {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'cancelled', taskId })}\n\n`
              )
            )
            return
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
          const batchSummary = buildBatchChapterSummary(generatedContent)
          if (batchSummary) {
            batchChapterSummaries.set(chapterNum, {
              title: chapterTitle,
              summary: batchSummary
            })
          }

          await recordAiGeneration(em, auth.userId)
          enqueuePostProcessing(data.novelId, savedChapterId).catch(() => {})

          em.clear()

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'chapter_done', taskId, chapter: chapterNum, title: chapterTitle, truncated: finalTruncated, completed: chapterNum - data.fromChapter + 1, total: totalChapters })}\n\n`
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
