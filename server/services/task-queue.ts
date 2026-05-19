import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { callAi } from '../utils/ai-client'
import { buildSummaryPrompt, buildCharacterExtractionPrompt } from '../utils/ai-prompts'

interface TaskProcessor {
  type: string
  process: (task: any) => Promise<string>
}

const MAX_RETRIES = 3

async function processTask(task: any): Promise<void> {
  const db = await getDatabase()

  await (db as any)
    .update(schema.generationTasks)
    .set({ status: 'running' })
    .where(eq(schema.generationTasks.id, task.id))

  try {
    let result = ''

    if (task.type === 'extract_summary' && task.chapterId) {
      const chapters = await (db as any)
        .select()
        .from(schema.chapters)
        .where(eq(schema.chapters.id, task.chapterId))
        .limit(1)

      if (chapters[0]?.content) {
        const aiConfigs = await (db as any)
          .select()
          .from(schema.aiConfigs)
          .where(eq(schema.aiConfigs.purpose, 'extraction'))
          .limit(1)

        if (aiConfigs.length) {
          const messages = buildSummaryPrompt(chapters[0].content)
          result = await callAi({
            apiUrl: aiConfigs[0].apiUrl,
            apiKey: aiConfigs[0].apiKey,
            model: aiConfigs[0].model,
            messages,
            temperature: 0.3,
            maxTokens: 500,
          })

          await (db as any)
            .update(schema.chapters)
            .set({ summary: result })
            .where(eq(schema.chapters.id, task.chapterId))
        }
      }
    }

    if (task.type === 'extract_characters' && task.chapterId) {
      const chapters = await (db as any)
        .select()
        .from(schema.chapters)
        .where(eq(schema.chapters.id, task.chapterId))
        .limit(1)

      if (chapters[0]?.content) {
        const aiConfigs = await (db as any)
          .select()
          .from(schema.aiConfigs)
          .where(eq(schema.aiConfigs.purpose, 'extraction'))
          .limit(1)

        if (aiConfigs.length) {
          const messages = buildCharacterExtractionPrompt(chapters[0].content)
          result = await callAi({
            apiUrl: aiConfigs[0].apiUrl,
            apiKey: aiConfigs[0].apiKey,
            model: aiConfigs[0].model,
            messages,
            temperature: 0.2,
            maxTokens: 2000,
          })

          try {
            const chars = JSON.parse(result)
            for (const char of chars) {
              const existing = await (db as any)
                .select()
                .from(schema.characters)
                .where(and(
                  eq(schema.characters.novelId, task.novelId),
                  eq(schema.characters.name, char.name),
                ))
                .limit(1)

              if (existing.length) {
                await (db as any)
                  .update(schema.characters)
                  .set({
                    description: char.description || existing[0].description,
                    traits: char.traits || existing[0].traits,
                    currentState: char.currentState || existing[0].currentState,
                  })
                  .where(eq(schema.characters.id, existing[0].id))
              } else {
                await (db as any).insert(schema.characters).values({
                  novelId: task.novelId,
                  name: char.name,
                  description: char.description || null,
                  traits: char.traits || null,
                  currentState: char.currentState || null,
                })
              }
            }
          } catch {}
        }
      }
    }

    await (db as any)
      .update(schema.generationTasks)
      .set({ status: 'completed', result, completedAt: new Date() })
      .where(eq(schema.generationTasks.id, task.id))
  } catch (err: any) {
    const retryCount = (task.retryCount || 0) + 1
    if (retryCount < MAX_RETRIES) {
      await (db as any)
        .update(schema.generationTasks)
        .set({ status: 'pending', retryCount, error: err.message })
        .where(eq(schema.generationTasks.id, task.id))
    } else {
      await (db as any)
        .update(schema.generationTasks)
        .set({ status: 'failed', error: err.message, retryCount })
        .where(eq(schema.generationTasks.id, task.id))
    }
  }
}

export async function enqueuePostProcessing(novelId: number, chapterId: number): Promise<void> {
  const db = await getDatabase()

  const tasks = [
    { novelId, chapterId, type: 'extract_summary', status: 'pending' as const },
    { novelId, chapterId, type: 'extract_characters', status: 'pending' as const },
  ]

  for (const task of tasks) {
    await (db as any).insert(schema.generationTasks).values(task)
  }

  setTimeout(() => processPendingTasks(), 1000)
}

export async function processPendingTasks(): Promise<void> {
  const db = await getDatabase()

  const pending = await (db as any)
    .select()
    .from(schema.generationTasks)
    .where(eq(schema.generationTasks.status, 'pending'))
    .limit(5)

  for (const task of pending) {
    await processTask(task)
  }
}
