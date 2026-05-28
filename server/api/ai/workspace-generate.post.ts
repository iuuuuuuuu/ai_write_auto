import { z } from 'zod'
import { streamAi, toAiOptions } from '../../utils/ai-client'
import { createRequestSignal, recordUsage, estimateTokens } from '../../utils/ai-stream'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildGenerationPrompt } from '../../utils/ai-prompts'
import {
  NovelSchema, ChapterSchema, CharacterSchema, PlotPointSchema,
  StoryArcSchema, NovelOutlineSchema, GenerationTaskSchema
} from '../../database/entities'
import { recordAiGeneration } from '../../utils/writing-stats'
import { enqueuePostProcessing } from '../../services/task-queue'
import { isEmbeddingReady } from '../../services/embedding'
import { retrieveRelevant, getActiveForeshadowing } from '../../services/content-rag'
import { WORKSPACE_MAX_CHAPTERS } from '../../utils/ai-constants'

const workspaceSchema = z.object({
  novelId: z.number().int().positive(),
  fromChapter: z.number().int().positive(),
  toChapter: z.number().int().positive(),
  direction: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = workspaceSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) throw createError({ statusCode: 404, message: 'Novel not found' })

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'generation', data.aiConfigId)

  const totalChapters = data.toChapter - data.fromChapter + 1
  if (totalChapters > WORKSPACE_MAX_CHAPTERS) {
    throw createError({ statusCode: 400, message: `Maximum ${WORKSPACE_MAX_CHAPTERS} chapters per workspace session` })
  }

  const task = em.create(GenerationTaskSchema, {
    novel: data.novelId,
    type: 'batch_generate',
    status: 'running',
  })
  await em.flush()
  const taskId = task.id

  const signal = createRequestSignal(event)

  // Pre-load shared context once
  const characters = await em.find(CharacterSchema, { novel: data.novelId })
  const plotPoints = await em.find(PlotPointSchema, { novel: data.novelId })
  const storyArcs = await em.find(StoryArcSchema, { novel: data.novelId })
  const outlines = await em.find(NovelOutlineSchema, { novel: data.novelId }, { orderBy: { sortOrder: 'ASC' } })

  let foreshadowing: Array<{ content: string; description: string | null; chapterNumber: number | null }> = []
  try { foreshadowing = await getActiveForeshadowing(data.novelId) } catch {}

  // Pre-fetch RAG context for the entire batch
  let sharedRagContext: Array<{ content: string; contentType: string; chapterId: number | null; characterName?: string }> = []
  if (isEmbeddingReady()) {
    const batchQuery = [novel.title, novel.description, data.direction].filter(Boolean).join(' ')
    if (batchQuery) {
      sharedRagContext = await retrieveRelevant(data.novelId, batchQuery, 15)
    }
  }

  async function readTaskStatus() {
    const currentTask = await em.findOne(GenerationTaskSchema, { id: taskId })
    return currentTask?.status || 'running'
  }

  async function waitWhilePaused(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder) {
    const MAX_PAUSE_MS = 30 * 60 * 1000
    const pauseStart = Date.now()
    while ((await readTaskStatus()) === 'paused') {
      if (signal.aborted) return
      if (Date.now() - pauseStart > MAX_PAUSE_MS) {
        await em.nativeUpdate(GenerationTaskSchema, { id: taskId }, { status: 'cancelled' })
        return
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'paused', taskId })}\n\n`))
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(': connected\n\n'))

      try {
        // Track previous chapter content for sliding window
        let prevChapterContent: string | null = null
        let prevPrevChapterContent: string | null = null

        for (let chapterNum = data.fromChapter; chapterNum <= data.toChapter; chapterNum++) {
          if (signal.aborted) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'cancelled', taskId, reason: 'client_disconnected' })}\n\n`))
            return
          }
          await waitWhilePaused(controller, encoder)
          if ((await readTaskStatus()) === 'cancelled') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'cancelled', taskId })}\n\n`))
            return
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', taskId, current: chapterNum, completed: chapterNum - data.fromChapter, total: totalChapters })}\n\n`))

          // Re-fetch chapters for up-to-date summaries
          const chapters = await em.find(ChapterSchema, { novel: data.novelId, deletedAt: null }, { orderBy: { chapterNumber: 'ASC' }, populate: ['content'] })

          const chapterOutline = outlines.find(o => o.chapterNumber === chapterNum)

          // Build recent chapter content (sliding window from workspace)
          const recentChapterContent: Array<{ chapterNumber: number; title: string; content: string }> = []
          if (prevPrevChapterContent) {
            const prevPrevCh = chapters.find(c => c.chapterNumber === chapterNum - 2)
            if (prevPrevCh) {
              recentChapterContent.push({ chapterNumber: prevPrevCh.chapterNumber, title: prevPrevCh.title, content: prevPrevChapterContent.slice(-3000) })
            }
          }
          if (prevChapterContent) {
            const prevCh = chapters.find(c => c.chapterNumber === chapterNum - 1)
            if (prevCh) {
              recentChapterContent.push({ chapterNumber: prevCh.chapterNumber, title: prevCh.title, content: prevChapterContent.slice(-4000) })
            }
          }

          const prompt = buildGenerationPrompt({
            novel,
            chapters,
            characters,
            plotPoints,
            storyArcs,
            currentChapterOutline: chapterOutline?.description,
            userDirection: data.direction,
            ragContext: sharedRagContext,
            foreshadowing,
            recentChapterContent
          })

          let generatedContent = ''
          let inputTokens = 0
          let outputTokens = 0
          let chunkCount = 0

          for await (const chunk of streamAi(toAiOptions(aiConfig, {
            temperature: novel.aiTemperature ? parseFloat(novel.aiTemperature) : parseFloat(aiConfig.temperature ?? '0.7'),
            maxTokens: aiConfig.maxTokens || 4096,
            messages: prompt,
            stream: true,
            signal
          }))) {
            chunkCount++
            if (chunkCount % 20 === 0) {
              if ((await readTaskStatus()) === 'cancelled') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'cancelled', taskId })}\n\n`))
                return
              }
            }
            if (chunk.content) {
              generatedContent += chunk.content
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', taskId, chapter: chapterNum, content: chunk.content })}\n\n`))
            }
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || inputTokens
              outputTokens = chunk.usage.completion_tokens || outputTokens
            }
          }

          if (!inputTokens && !outputTokens && generatedContent) {
            outputTokens = estimateTokens(generatedContent)
          }
          await recordUsage({ em, userId: auth.userId, configId: aiConfig.id, model: aiConfig.model }, inputTokens, outputTokens)

          // Save chapter
          const existingChapter = chapters.find(c => c.chapterNumber === chapterNum)
          let savedChapterId: number
          if (existingChapter) {
            await em.nativeUpdate(ChapterSchema, { id: existingChapter.id }, {
              content: generatedContent,
              wordCount: generatedContent.replace(/\s/g, '').length,
              status: 'generated',
              updatedAt: new Date()
            })
            savedChapterId = existingChapter.id
          } else {
            const newChapter = em.create(ChapterSchema, {
              novel: data.novelId,
              chapterNumber: chapterNum,
              title: `第${chapterNum}章`,
              content: generatedContent,
              wordCount: generatedContent.replace(/\s/g, '').length,
              status: 'generated',
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

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chapter_done', taskId, chapter: chapterNum, completed: chapterNum - data.fromChapter + 1, total: totalChapters })}\n\n`))
        }

        await em.nativeUpdate(GenerationTaskSchema, { id: taskId }, { status: 'completed', completedAt: new Date() })
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', taskId, completed: totalChapters, total: totalChapters })}\n\n`))
      } catch (e: any) {
        await em.nativeUpdate(GenerationTaskSchema, { id: taskId }, { status: 'failed', error: e.message }).catch(() => {})
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', taskId, message: e.message })}\n\n`)) } catch {}
      } finally {
        try { controller.close() } catch {}
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
