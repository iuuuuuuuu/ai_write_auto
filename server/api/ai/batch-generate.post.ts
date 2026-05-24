import { z } from 'zod'
import { streamAi } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { buildGenerationPrompt } from '../../utils/ai-prompts'
import { NovelSchema, ChapterSchema, CharacterSchema, PlotPointSchema, StoryArcSchema, NovelOutlineSchema, GenerationTaskSchema } from '../../database/entities'
import { recordAiGeneration } from '../../utils/writing-stats'

const batchSchema = z.object({
  novelId: z.number().int().positive(),
  fromChapter: z.number().int().positive(),
  toChapter: z.number().int().positive(),
  direction: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = batchSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne(NovelSchema, { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveNovelAiConfig(em, auth.userId, data.novelId, 'generation', data.aiConfigId)

  const task = em.create(GenerationTaskSchema, {
    novel: data.novelId,
    type: 'batch_generate',
    status: 'running',
  })
  await em.flush()
  const taskId = task.id
  const totalChapters = data.toChapter - data.fromChapter + 1

  async function readTaskStatus() {
    const currentTask = await em.findOne(GenerationTaskSchema, { id: taskId })
    return currentTask?.status || 'running'
  }

  async function waitWhilePaused(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder) {
    while ((await readTaskStatus()) === 'paused') {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'paused', taskId })}\n\n`
        )
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(': connected\n\n'))
      try {
        for (
          let chapterNum = data.fromChapter;
          chapterNum <= data.toChapter;
          chapterNum++
        ) {
          await waitWhilePaused(controller, encoder)
          const currentStatus = await readTaskStatus()
          if (currentStatus === 'cancelled') {
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

          const chapters = await em.find(ChapterSchema, { novel: data.novelId, deletedAt: null }, { orderBy: { chapterNumber: 'ASC' } })
          const characters = await em.find(CharacterSchema, { novel: data.novelId })
          const plotPoints = await em.find(PlotPointSchema, { novel: data.novelId })
          const storyArcs = await em.find(StoryArcSchema, { novel: data.novelId })
          const outlines = await em.find(NovelOutlineSchema, { novel: data.novelId }, { orderBy: { sortOrder: 'ASC' } })

          const chapterOutline = outlines.find(
            (o) => o.chapterNumber === chapterNum
          )

          const prompt = buildGenerationPrompt({
            novel,
            chapters,
            characters,
            plotPoints,
            storyArcs,
            currentChapterOutline: chapterOutline?.description,
            userDirection: data.direction
          })

          let generatedContent = ''
          for await (const chunk of streamAi({
            apiUrl: aiConfig.apiUrl,
            apiKey: aiConfig.apiKey,
            model: aiConfig.model,
            temperature:
              novel.aiTemperature ? parseFloat(novel.aiTemperature) : parseFloat(aiConfig.temperature ?? '0.7'),
            maxTokens: aiConfig.maxTokens || 4096,
            messages: prompt
          })) {
            const liveStatus = await readTaskStatus()
            if (liveStatus === 'cancelled') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'cancelled', taskId })}\n\n`
                )
              )
              return
            }

            if (chunk.content) {
              generatedContent += chunk.content
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'chunk', taskId, chapter: chapterNum, content: chunk.content })}\n\n`
                )
              )
            }
          }

          const existingChapter = chapters.find(
            (c) => c.chapterNumber === chapterNum
          )
          if (existingChapter) {
            await em.nativeUpdate(ChapterSchema, { id: existingChapter.id }, {
              content: generatedContent,
              wordCount: generatedContent.replace(/\s/g, '').length,
              status: 'generated',
              updatedAt: new Date()
            })
          } else {
            em.create(ChapterSchema, {
              novel: data.novelId,
              chapterNumber: chapterNum,
              title: `第${chapterNum}章`,
              content: generatedContent,
              wordCount: generatedContent.replace(/\s/g, '').length,
              status: 'generated',
            })
            await em.flush()
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'chapter_done', taskId, chapter: chapterNum, completed: chapterNum - data.fromChapter + 1, total: totalChapters })}\n\n`
            )
          )
        }

        await em.nativeUpdate(GenerationTaskSchema, { id: taskId }, {
          status: 'completed',
          completedAt: new Date()
        })

        await recordAiGeneration(em, auth.userId)

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', taskId, completed: totalChapters, total: totalChapters })}\n\n`)
        )
      } catch (e: any) {
        await em.nativeUpdate(GenerationTaskSchema, { id: taskId }, {
          status: 'failed',
          error: e.message
        })

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', taskId, message: e.message })}\n\n`
          )
        )
      } finally {
        controller.close()
      }
    }
  })

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })

  return stream
})
