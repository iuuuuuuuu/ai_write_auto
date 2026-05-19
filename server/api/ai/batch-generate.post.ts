import { z } from 'zod'
import { streamAi } from '../../utils/ai-client'
import { resolveUserAiConfig } from '../../utils/ai-configs'
import { buildGenerationPrompt } from '../../utils/ai-prompts'
import { checkRateLimit } from '../../utils/rate-limit'

const batchSchema = z.object({
  novelId: z.number().int().positive(),
  fromChapter: z.number().int().positive(),
  toChapter: z.number().int().positive(),
  direction: z.string().optional(),
  aiConfigId: z.number().int().positive().optional()
})

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const rateCheck = checkRateLimit(auth.userId)
  if (!rateCheck.allowed) {
    throw createError({
      statusCode: 429,
      message: `Rate limit exceeded. Try again in ${Math.ceil(rateCheck.resetIn / 1000)}s`
    })
  }

  const body = await readBody(event)
  const data = batchSchema.parse(body)
  const em = useEm(event)

  const novel = await em.findOne('Novel', { id: data.novelId, user: auth.userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveUserAiConfig(em, auth.userId, 'generation', data.aiConfigId)

  const task = em.create('GenerationTask', {
    novel: data.novelId,
    type: 'batch_generate',
    status: 'running',
  })
  await em.flush()
  const taskId = (task as any).id

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (
          let chapterNum = data.fromChapter;
          chapterNum <= data.toChapter;
          chapterNum++
        ) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'progress', current: chapterNum, total: data.toChapter - data.fromChapter + 1 })}\n\n`
            )
          )

          const chapters = await em.find('Chapter', { novel: data.novelId, deletedAt: null }, { orderBy: { chapterNumber: 'ASC' } })
          const characters = await em.find('Character', { novel: data.novelId })
          const plotPoints = await em.find('PlotPoint', { novel: data.novelId })
          const storyArcs = await em.find('StoryArc', { novel: data.novelId })
          const outlines = await em.find('NovelOutline', { novel: data.novelId }, { orderBy: { sortOrder: 'ASC' } })

          const chapterOutline = outlines.find(
            (o: any) => o.chapterNumber === chapterNum
          )

          const prompt = buildGenerationPrompt({
            novel,
            chapters,
            characters,
            plotPoints,
            storyArcs,
            currentChapterOutline: (chapterOutline as any)?.description,
            userDirection: data.direction
          })

          let generatedContent = ''
          for await (const chunk of streamAi({
            apiUrl: aiConfig.apiUrl,
            apiKey: aiConfig.apiKey,
            model: aiConfig.model,
            temperature:
              (novel as any).aiTemperature || parseFloat(aiConfig.temperature) || 0.7,
            maxTokens: aiConfig.maxTokens || 4096,
            messages: prompt
          })) {
            if (chunk.content) {
              generatedContent += chunk.content
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'chunk', chapter: chapterNum, content: chunk.content })}\n\n`
                )
              )
            }
          }

          const existingChapter = chapters.find(
            (c: any) => c.chapterNumber === chapterNum
          )
          if (existingChapter) {
            await em.nativeUpdate('Chapter', { id: (existingChapter as any).id }, {
              content: generatedContent,
              wordCount: generatedContent.replace(/\s/g, '').length,
              status: 'generated',
              updatedAt: new Date()
            })
          } else {
            em.create('Chapter', {
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
              `data: ${JSON.stringify({ type: 'chapter_done', chapter: chapterNum })}\n\n`
            )
          )
        }

        await em.nativeUpdate('GenerationTask', { id: taskId }, {
          status: 'completed',
          completedAt: new Date()
        })

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        )
      } catch (e: any) {
        await em.nativeUpdate('GenerationTask', { id: taskId }, {
          status: 'failed',
          error: e.message
        })

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`
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
