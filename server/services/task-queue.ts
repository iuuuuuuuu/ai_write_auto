import { getOrm } from '../database'
import { callAi } from '../utils/ai-client'
import { buildSummaryPrompt, buildCharacterExtractionPrompt } from '../utils/ai-prompts'
import type { GenerationTask, Chapter, AiConfig, Character } from '../database/entities'

const MAX_RETRIES = 3

async function processTask(task: GenerationTask): Promise<void> {
  const em = getOrm().em.fork()

  await em.nativeUpdate('GenerationTask', { id: task.id }, { status: 'running' })

  try {
    let result = ''

    if (task.type === 'extract_summary' && task.chapter) {
      const chapter = await em.findOne('Chapter', { id: (task.chapter as any).id || task.chapter }) as Chapter | null
      if (chapter?.content) {
        const aiConfig = await em.findOne('AiConfig', { purpose: 'extraction' }) as AiConfig | null
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
          await em.nativeUpdate('Chapter', { id: chapter.id }, { summary: result })
        }
      }
    }

    if (task.type === 'extract_characters' && task.chapter) {
      const chapter = await em.findOne('Chapter', { id: (task.chapter as any).id || task.chapter }) as Chapter | null
      if (chapter?.content) {
        const aiConfig = await em.findOne('AiConfig', { purpose: 'extraction' }) as AiConfig | null
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
              const existing = await em.findOne('Character', {
                novel: novelId,
                name: char.name,
              }) as Character | null

              if (existing) {
                existing.description = char.description || existing.description
                existing.traits = char.traits || existing.traits
                existing.currentState = char.currentState || existing.currentState
              } else {
                em.create('Character', {
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

    await em.nativeUpdate('GenerationTask', { id: task.id }, {
      status: 'completed',
      result,
      completedAt: new Date(),
    })
  } catch (err: any) {
    const retryCount = ((task.retryCount as number) || 0) + 1
    if (retryCount < MAX_RETRIES) {
      await em.nativeUpdate('GenerationTask', { id: task.id }, {
        status: 'pending',
        retryCount,
        error: err.message,
      })
    } else {
      await em.nativeUpdate('GenerationTask', { id: task.id }, {
        status: 'failed',
        error: err.message,
        retryCount,
      })
    }
  }
}

export async function enqueuePostProcessing(novelId: number, chapterId: number): Promise<void> {
  const em = getOrm().em.fork()

  em.create('GenerationTask', { novel: novelId, chapter: chapterId, type: 'extract_summary', status: 'pending' })
  em.create('GenerationTask', { novel: novelId, chapter: chapterId, type: 'extract_characters', status: 'pending' })
  await em.flush()

  setTimeout(() => processPendingTasks(), 1000)
}

export async function processPendingTasks(): Promise<void> {
  const em = getOrm().em.fork()

  const pending = await em.find('GenerationTask', { status: 'pending' }, { limit: 5 }) as GenerationTask[]

  for (const task of pending) {
    await processTask(task)
  }
}
