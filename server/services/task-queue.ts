import { getOrm } from '../database'
import { callAi } from '../utils/ai-client'
import { buildSummaryPrompt, buildCharacterExtractionPrompt } from '../utils/ai-prompts'
import { GenerationTaskSchema, ChapterSchema, AiConfigSchema, CharacterSchema } from '../database/entities'
import type { GenerationTask } from '../database/entities'

const MAX_RETRIES = 3

async function processTask(task: GenerationTask): Promise<void> {
  const em = getOrm().em.fork()

  await em.nativeUpdate(GenerationTaskSchema, { id: task.id }, { status: 'running' })

  try {
    let result = ''

    if (task.type === 'extract_summary' && task.chapter) {
      const chapter = await em.findOne(ChapterSchema, { id: (task.chapter as any).id || task.chapter })
      if (chapter?.content) {
        const aiConfig = await em.findOne(AiConfigSchema, { purpose: 'extraction' })
        if (aiConfig) {
          const messages = buildSummaryPrompt(chapter.content)
          result = await callAi({
            apiUrl: aiConfig.apiUrl,
            apiKey: aiConfig.apiKey,
            model: aiConfig.model,
            messages,
            temperature: 0.3,
            maxTokens: 500,
          })
          await em.nativeUpdate(ChapterSchema, { id: chapter.id }, { summary: result })
        }
      }
    }

    if (task.type === 'extract_characters' && task.chapter) {
      const chapter = await em.findOne(ChapterSchema, { id: (task.chapter as any).id || task.chapter })
      if (chapter?.content) {
        const aiConfig = await em.findOne(AiConfigSchema, { purpose: 'extraction' })
        if (aiConfig) {
          const messages = buildCharacterExtractionPrompt(chapter.content)
          result = await callAi({
            apiUrl: aiConfig.apiUrl,
            apiKey: aiConfig.apiKey,
            model: aiConfig.model,
            messages,
            temperature: 0.2,
            maxTokens: 2000,
          })

          try {
            const novelId = (task.novel as any).id || task.novel
            const chars = JSON.parse(result)
            for (const char of chars) {
              const existing = await em.findOne(CharacterSchema, {
                novel: novelId,
                name: char.name,
              })

              if (existing) {
                existing.description = char.description || existing.description
                existing.traits = char.traits || existing.traits
                existing.currentState = char.currentState || existing.currentState
              } else {
                em.create(CharacterSchema, {
                  novel: novelId,
                  name: char.name,
                  description: char.description || null,
                  traits: char.traits || null,
                  currentState: char.currentState || null,
                })
              }
            }
            await em.flush()
          } catch {}
        }
      }
    }

    await em.nativeUpdate(GenerationTaskSchema, { id: task.id }, {
      status: 'completed',
      result,
      completedAt: new Date(),
    })
  } catch (err: any) {
    const retryCount = ((task.retryCount as number) || 0) + 1
    if (retryCount < MAX_RETRIES) {
      await em.nativeUpdate(GenerationTaskSchema, { id: task.id }, {
        status: 'pending',
        retryCount,
        error: err.message,
      })
    } else {
      await em.nativeUpdate(GenerationTaskSchema, { id: task.id }, {
        status: 'failed',
        error: err.message,
        retryCount,
      })
    }
  }
}

export async function enqueuePostProcessing(novelId: number, chapterId: number): Promise<void> {
  const em = getOrm().em.fork()

  em.create(GenerationTaskSchema, { novel: novelId, chapter: chapterId, type: 'extract_summary', status: 'pending' })
  em.create(GenerationTaskSchema, { novel: novelId, chapter: chapterId, type: 'extract_characters', status: 'pending' })
  await em.flush()

  setTimeout(() => processPendingTasks(), 1000)
}

export async function processPendingTasks(): Promise<void> {
  const em = getOrm().em.fork()

  const pending = await em.find(GenerationTaskSchema, { status: 'pending' }, { limit: 5 })

  for (const task of pending) {
    await processTask(task)
  }
}
