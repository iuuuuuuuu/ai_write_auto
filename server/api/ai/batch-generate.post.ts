import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
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

  const db = await getDatabase()

  const novels = await (db as any)
    .select()
    .from(schema.novels)
    .where(
      and(
        eq(schema.novels.id, data.novelId),
        eq(schema.novels.userId, auth.userId)
      )
    )
    .limit(1)

  if (!novels.length) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const novel = novels[0]
  const aiConfig = await resolveUserAiConfig(
    db,
    auth.userId,
    'generation',
    data.aiConfigId
  )

  const task = await (db as any)
    .insert(schema.generationTasks)
    .values({
      novelId: data.novelId,
      type: 'batch_generate',
      status: 'running'
    })
    .returning()

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

          const chapters = await (db as any)
            .select()
            .from(schema.chapters)
            .where(
              and(
                eq(schema.chapters.novelId, data.novelId),
                isNull(schema.chapters.deletedAt)
              )
            )
            .orderBy(schema.chapters.chapterNumber)

          const characters = await (db as any)
            .select()
            .from(schema.characters)
            .where(eq(schema.characters.novelId, data.novelId))

          const plotPoints = await (db as any)
            .select()
            .from(schema.plotPoints)
            .where(eq(schema.plotPoints.novelId, data.novelId))

          const storyArcs = await (db as any)
            .select()
            .from(schema.storyArcs)
            .where(eq(schema.storyArcs.novelId, data.novelId))

          const outlines = await (db as any)
            .select()
            .from(schema.novelOutlines)
            .where(eq(schema.novelOutlines.novelId, data.novelId))
            .orderBy(schema.novelOutlines.sortOrder)

          const chapterOutline = outlines.find(
            (o: any) => o.chapterNumber === chapterNum
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
              novel.aiTemperature || parseFloat(aiConfig.temperature) || 0.7,
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

          let existingChapter = chapters.find(
            (c: any) => c.chapterNumber === chapterNum
          )
          if (existingChapter) {
            await (db as any)
              .update(schema.chapters)
              .set({
                content: generatedContent,
                wordCount: generatedContent.replace(/\s/g, '').length,
                status: 'generated',
                updatedAt: new Date()
              })
              .where(eq(schema.chapters.id, existingChapter.id))
          } else {
            const result = await (db as any)
              .insert(schema.chapters)
              .values({
                novelId: data.novelId,
                chapterNumber: chapterNum,
                title: `第${chapterNum}章`,
                content: generatedContent,
                wordCount: generatedContent.replace(/\s/g, '').length,
                status: 'generated'
              })
              .returning()
            existingChapter = result[0]
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'chapter_done', chapter: chapterNum })}\n\n`
            )
          )
        }

        await (db as any)
          .update(schema.generationTasks)
          .set({ status: 'completed', completedAt: new Date() })
          .where(eq(schema.generationTasks.id, task[0].id))

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        )
      } catch (e: any) {
        await (db as any)
          .update(schema.generationTasks)
          .set({ status: 'failed', error: e.message })
          .where(eq(schema.generationTasks.id, task[0].id))

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
