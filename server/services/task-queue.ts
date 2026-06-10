import { getOrm } from '../database'
import {
  streamAi,
  toAiOptions,
  type AiRequestTracking
} from '../utils/ai-client'
import { runConsistencyCheck } from '../utils/consistency-check'
import { runPlotThreadExtraction } from '../utils/plot-threads'
import { parseExtractedCharacters } from '../utils/character-extraction'
import {
  recordUsage,
  estimateTokens,
  dynamicMaxTokens,
  type StreamContext
} from '../utils/ai-stream'
import {
  buildSummaryPrompt,
  buildCharacterExtractionPrompt,
  buildChapterStoryPrompt,
  buildOverallArcPrompt,
  buildStoryArcPrompt
} from '../utils/ai-prompts'
import { isEmbeddingReady } from './embedding'
import { indexCharacterEvent, indexChapterSummary } from './content-rag'
import { extractCharacterStateChangesForChapter } from './character-state-changes'
import {
  GenerationTaskSchema,
  ChapterSchema,
  AiConfigSchema,
  CharacterSchema,
  ChapterCharacterSchema,
  CharacterAppearanceSchema,
  StoryArcSchema,
  NovelSchema
} from '../database/entities'
import type { GenerationTask } from '../database/entities'
import type { ResolvedAiConfig } from '../utils/ai-configs'

/** Streaming wrapper that returns the same shape as the old callAiWithUsage. */
async function callAiStreaming(options: Parameters<typeof streamAi>[0]) {
  let content = ''
  let inputTokens = 0
  let outputTokens = 0
  for await (const chunk of streamAi(options)) {
    if (chunk.content) content += chunk.content
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || inputTokens
      outputTokens = chunk.usage.completion_tokens || outputTokens
    }
  }
  // Strip markdown code fences that some models wrap around JSON responses
  content = content
    .replace(/^```(?:json|JSON)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim()
  return { content, inputTokens, outputTokens }
}

const MAX_RETRIES = 3
const STALE_TASK_TIMEOUT_MS = 10 * 60 * 1000
const POST_PROCESSING_TYPES = [
  'extract_summary',
  'extract_characters',
  'extract_character_state_changes',
  'consistency_check',
  'extract_plot_threads'
]
let isProcessing = false

async function resolveConfigForPurpose(
  em: any,
  purpose: string,
  userId?: number
): Promise<ResolvedAiConfig | null> {
  const filter: Record<string, unknown> = { purpose, enabled: true }
  if (userId) filter.user = userId

  const config =
    (await em.findOne(
      AiConfigSchema,
      { ...filter, isDefault: true },
      { populate: ['aiModel', 'aiModel.provider'] }
    )) ||
    (await em.findOne(AiConfigSchema, filter, {
      populate: ['aiModel', 'aiModel.provider']
    }))
  if (!config || !config.aiModel) return null
  const aiModel = config.aiModel as any
  if (!aiModel.enabled) return null
  const provider = aiModel.provider
  if (!provider?.enabled) return null
  return {
    id: config.id,
    configId: config.id,
    modelId: aiModel.id,
    apiUrl: provider.apiUrl,
    apiKey: provider.apiKey,
    model: aiModel.model,
    temperature: config.temperature,
    maxTokens: aiModel.maxTokens
  }
}

function getEntityId(entity: unknown): number {
  if (typeof entity === 'number') return entity
  if (entity && typeof entity === 'object' && 'id' in entity) {
    return Number((entity as { id: unknown }).id)
  }
  return Number(entity)
}

async function processTask(task: GenerationTask): Promise<void> {
  const em = getOrm().em.fork()

  const updated = await em.nativeUpdate(
    GenerationTaskSchema,
    { id: task.id, status: 'pending' },
    { status: 'running' }
  )
  if (!updated) return

  try {
    let result = ''
    let totalInputTokens = 0
    let totalOutputTokens = 0
    const novelId = getEntityId(task.novel)
    const novelEntity = (await em.findOne(NovelSchema, { id: novelId })) as any
    const userId = novelEntity ? getEntityId(novelEntity.user) : undefined

    function buildTaskTracking(
      aiConfig: ResolvedAiConfig,
      scenario: string,
      purpose: string,
      chapterId?: number | null
    ): AiRequestTracking {
      return {
        userId: userId ?? null,
        configId: aiConfig.configId,
        modelId: aiConfig.modelId,
        purpose,
        scenario,
        source: 'background_task',
        novelId,
        chapterId: chapterId ?? null,
        taskId: task.id
      }
    }

    if (task.type === 'extract_summary' && task.chapter) {
      const chapter = await em.findOne(
        ChapterSchema,
        {
          id: getEntityId(task.chapter)
        },
        { populate: ['content'] }
      )
      if (chapter?.content) {
        const aiConfig = await resolveConfigForPurpose(em, 'extraction', userId)
        if (aiConfig) {
          const messages = buildSummaryPrompt(chapter.content)
          const aiResult = await callAiStreaming(
            toAiOptions(aiConfig, {
              messages,
              temperature: 0.3,
              maxTokens: 500,
              tracking: buildTaskTracking(
                aiConfig,
                'task_extract_summary',
                'extraction',
                chapter.id
              )
            })
          )
          result = aiResult.content
          totalInputTokens += aiResult.inputTokens
          totalOutputTokens += aiResult.outputTokens
          await em.nativeUpdate(
            ChapterSchema,
            { id: chapter.id },
            { summary: result }
          )
          // Index summary for RAG retrieval
          if (isEmbeddingReady() && result) {
            await indexChapterSummary(novelId, chapter.id, result).catch(
              () => {}
            )
          }
        }
      }
    }

    if (task.type === 'extract_characters' && task.chapter) {
      const chapter = await em.findOne(
        ChapterSchema,
        {
          id: getEntityId(task.chapter)
        },
        { populate: ['content'] }
      )
      if (chapter?.content) {
        const aiConfig = await resolveConfigForPurpose(em, 'extraction', userId)
        if (aiConfig) {
          const messages = buildCharacterExtractionPrompt(chapter.content)
          const aiResult = await callAiStreaming(
            toAiOptions(aiConfig, {
              messages,
              temperature: 0.2,
              // 按正文长度动态给上限（角色清单随正文增长），避免长章节角色多被固定 2000 截断
              maxTokens: dynamicMaxTokens(
                estimateTokens(chapter.content) * 0.5,
                { floor: 2000, cap: 6000 }
              ),
              tracking: buildTaskTracking(
                aiConfig,
                'task_character_extract',
                'extraction',
                chapter.id
              )
            })
          )
          result = aiResult.content
          totalInputTokens += aiResult.inputTokens
          totalOutputTokens += aiResult.outputTokens

          const chars = parseExtractedCharacters(result)
          for (const char of chars) {
            const existing = await em.findOne(CharacterSchema, {
              novel: novelId,
              name: char.name
            })
            const character =
              existing ||
              em.create(CharacterSchema, {
                novel: novelId,
                name: char.name,
                description: char.description,
                traits: char.traits,
                currentState: char.currentState,
                firstAppearanceChapter: chapter.chapterNumber,
                lastAppearanceChapter: chapter.chapterNumber
              })

            if (existing) {
              existing.description = char.description || existing.description
              existing.traits = char.traits || existing.traits
              existing.currentState = char.currentState || existing.currentState
              existing.firstAppearanceChapter =
                existing.firstAppearanceChapter === null ?
                  chapter.chapterNumber
                : Math.min(
                    existing.firstAppearanceChapter,
                    chapter.chapterNumber
                  )
              existing.lastAppearanceChapter =
                existing.lastAppearanceChapter === null ?
                  chapter.chapterNumber
                : Math.max(
                    existing.lastAppearanceChapter,
                    chapter.chapterNumber
                  )
            }

            await em.flush()

            const assignment = await em.findOne(ChapterCharacterSchema, {
              chapter: chapter.id,
              character: character.id
            })
            if (assignment) {
              assignment.role = char.role
            } else {
              em.create(ChapterCharacterSchema, {
                chapter: chapter.id,
                character: character.id,
                role: char.role
              })
            }

            await em.nativeDelete(CharacterAppearanceSchema, {
              chapter: chapter.id,
              character: character.id
            })

            for (const appearance of char.appearances.slice(0, 5)) {
              em.create(CharacterAppearanceSchema, {
                novel: novelId,
                chapter: chapter.id,
                character: character.id,
                role: char.role,
                snippet: appearance.snippet,
                positionStart: appearance.positionStart,
                positionEnd: appearance.positionEnd,
                background: appearance.background
              })
            }
          }
          await em.flush()

          // Generate chapter stories and update overall arcs
          const chapterChars = await em.find(ChapterCharacterSchema, {
            chapter: chapter.id
          })
          for (const cc of chapterChars) {
            const charEntity = await em.findOne(CharacterSchema, {
              id: getEntityId(cc.character)
            })
            if (!charEntity) continue

            const appearances = await em.find(CharacterAppearanceSchema, {
              chapter: chapter.id,
              character: charEntity.id
            })

            try {
              const storyMessages = buildChapterStoryPrompt(
                charEntity.name,
                chapter.content,
                appearances.map((a) => ({
                  snippet: a.snippet,
                  background: a.background
                }))
              )
              const storyResult = await callAiStreaming(
                toAiOptions(aiConfig, {
                  messages: storyMessages,
                  temperature: 0.3,
                  maxTokens: 500,
                  tracking: buildTaskTracking(
                    aiConfig,
                    'task_character_story',
                    'extraction',
                    chapter.id
                  )
                })
              )
              const chapterStory = storyResult.content
              totalInputTokens += storyResult.inputTokens
              totalOutputTokens += storyResult.outputTokens
              cc.chapterStory = chapterStory

              const arcMessages = buildOverallArcPrompt(
                charEntity.name,
                charEntity.description,
                charEntity.overallArc,
                chapterStory,
                chapter.chapterNumber
              )
              const arcResult = await callAiStreaming(
                toAiOptions(aiConfig, {
                  messages: arcMessages,
                  temperature: 0.3,
                  maxTokens: 800,
                  tracking: buildTaskTracking(
                    aiConfig,
                    'task_character_arc',
                    'extraction',
                    chapter.id
                  )
                })
              )
              totalInputTokens += arcResult.inputTokens
              totalOutputTokens += arcResult.outputTokens
              charEntity.overallArc = arcResult.content
            } catch (storyErr) {
              console.warn(
                `[task-queue] Failed to generate story/arc for character ${charEntity.name}:`,
                storyErr instanceof Error ? storyErr.message : storyErr
              )
            }
          }
          await em.flush()

          // Index embeddings for RAG
          if (isEmbeddingReady()) {
            for (const cc of chapterChars) {
              const charEntity = await em.findOne(CharacterSchema, {
                id: getEntityId(cc.character)
              })
              if (!charEntity) continue
              if (cc.chapterStory) {
                await indexCharacterEvent(
                  charEntity.id,
                  chapter.id,
                  novelId,
                  cc.chapterStory,
                  'chapter_story'
                ).catch(() => {})
              }
              if (charEntity.overallArc) {
                await indexCharacterEvent(
                  charEntity.id,
                  null,
                  novelId,
                  charEntity.overallArc,
                  'overall_arc'
                ).catch(() => {})
              }
            }
          }
        }
      }
    }

    if (task.type === 'consistency_check' && task.chapter) {
      const chapterId = getEntityId(task.chapter)
      const chapter = await em.findOne(ChapterSchema, { id: chapterId })
      if (chapter && userId) {
        const issues = await runConsistencyCheck(em, userId, novelId, chapterId)
        result = `Found ${issues.length} consistency issues`
      }
    }

    if (
      task.type === 'extract_character_state_changes' &&
      task.chapter &&
      userId
    ) {
      const r = await extractCharacterStateChangesForChapter(em, {
        userId,
        novelId,
        chapterId: getEntityId(task.chapter),
        replaceAi: true
      })
      result = `Character state changes: +${r.created} created, ${r.accepted} accepted, ${r.pending} pending, ${r.skipped} skipped`
    }

    if (task.type === 'extract_plot_threads' && task.chapter && userId) {
      const r = await runPlotThreadExtraction(
        em,
        userId,
        novelId,
        getEntityId(task.chapter)
      )
      totalInputTokens += r.inputTokens
      totalOutputTokens += r.outputTokens
      result = `Plot threads: +${r.created} new, ${r.resolved} resolved`
    }

    if (task.type === 'generate_arc') {
      const allChapters = await em.find(
        ChapterSchema,
        {
          novel: novelId,
          deletedAt: null,
          summary: { $ne: null }
        },
        { orderBy: { chapterNumber: 'ASC' } }
      )

      const ARC_GROUP_SIZE = 10
      const totalChapters = allChapters.length

      if (totalChapters >= ARC_GROUP_SIZE) {
        const aiConfig = await resolveConfigForPurpose(em, 'extraction', userId)
        if (aiConfig) {
          const arcCount = Math.floor(totalChapters / ARC_GROUP_SIZE)
          for (let i = 0; i < arcCount; i++) {
            const startIdx = i * ARC_GROUP_SIZE
            const endIdx = startIdx + ARC_GROUP_SIZE
            const group = allChapters.slice(startIdx, endIdx)
            const startChapter = group[0]!.chapterNumber
            const endChapter = group[group.length - 1]!.chapterNumber

            const existing = await em.findOne(StoryArcSchema, {
              novel: novelId,
              startChapter,
              endChapter
            })
            if (existing) continue

            const summaries = group
              .filter((ch) => ch.summary)
              .map((ch) => ({
                chapterNumber: ch.chapterNumber,
                title: ch.title,
                summary: ch.summary!
              }))

            if (summaries.length < 3) continue

            const messages = buildStoryArcPrompt(
              summaries,
              startChapter,
              endChapter
            )
            const arcResult = await callAiStreaming(
              toAiOptions(aiConfig, {
                messages,
                temperature: 0.3,
                maxTokens: 500,
                tracking: buildTaskTracking(
                  aiConfig,
                  'task_story_arc_generate',
                  'extraction'
                )
              })
            )
            const arcSummary = arcResult.content
            totalInputTokens += arcResult.inputTokens
            totalOutputTokens += arcResult.outputTokens

            em.create(StoryArcSchema, {
              novel: novelId,
              title: `第${startChapter}-${endChapter}章`,
              summary: arcSummary,
              startChapter,
              endChapter
            })
          }
          await em.flush()
          result = `Generated ${arcCount} arc summaries`
        }
      }
    }

    if (task.type === 'style_analysis') {
      const chapters = await em.find(
        ChapterSchema,
        {
          novel: novelId,
          deletedAt: null
        },
        { orderBy: { chapterNumber: 'ASC' }, limit: 5, populate: ['content'] }
      )

      const sampleText = chapters
        .filter((ch) => ch.content)
        .map((ch) => ch.content!.slice(0, 1500))
        .join('\n\n---\n\n')

      if (sampleText) {
        const aiConfig =
          (await resolveConfigForPurpose(em, 'style_analysis', userId)) ||
          (await resolveConfigForPurpose(em, 'extraction', userId))

        if (aiConfig) {
          const messages = [
            {
              role: 'system' as const,
              content:
                '你是一位文学评论家和写作风格分析师。请分析以下文本的写作风格，包括：叙事视角、句式特点、用词习惯、节奏感、修辞手法、情感基调。输出简洁的风格指南（200字以内），可直接用于指导 AI 续写时保持一致风格。'
            },
            {
              role: 'user' as const,
              content: `请分析以下小说片段的写作风格：\n\n${sampleText}`
            }
          ]
          const styleResult = await callAiStreaming(
            toAiOptions(aiConfig, {
              messages,
              temperature: 0.3,
              maxTokens: 500,
              tracking: buildTaskTracking(
                aiConfig,
                'task_style_analysis',
                'style_analysis'
              )
            })
          )
          const styleGuide = styleResult.content
          totalInputTokens += styleResult.inputTokens
          totalOutputTokens += styleResult.outputTokens
          if (styleGuide) {
            await em.nativeUpdate(NovelSchema, { id: novelId }, { styleGuide })
            result = styleGuide
          }
        }
      }
    }

    await em.nativeUpdate(
      GenerationTaskSchema,
      { id: task.id },
      {
        status: 'completed',
        result,
        tokensUsed: totalInputTokens + totalOutputTokens,
        completedAt: new Date()
      }
    )

    if (userId && (totalInputTokens || totalOutputTokens)) {
      const aiConfig = await resolveConfigForPurpose(em, 'extraction', userId)
      if (aiConfig) {
        await recordUsage(
          {
            em,
            userId,
            configId: aiConfig.id,
            model: aiConfig.model
          } as StreamContext,
          totalInputTokens,
          totalOutputTokens
        )
      }
    }
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown task error'
    const retryCount = ((task.retryCount as number) || 0) + 1
    if (retryCount < MAX_RETRIES) {
      await em.nativeUpdate(
        GenerationTaskSchema,
        { id: task.id },
        {
          status: 'pending',
          retryCount,
          error: errorMessage
        }
      )
    } else {
      await em.nativeUpdate(
        GenerationTaskSchema,
        { id: task.id },
        {
          status: 'failed',
          error: errorMessage,
          retryCount
        }
      )
    }
  }
}

export async function enqueuePostProcessing(
  novelId: number,
  chapterId: number
): Promise<void> {
  const em = getOrm().em.fork()

  for (const type of POST_PROCESSING_TYPES) {
    const existing = await em.findOne(GenerationTaskSchema, {
      novel: novelId,
      chapter: chapterId,
      type,
      status: { $in: ['pending', 'running'] }
    })
    if (!existing) {
      em.create(GenerationTaskSchema, {
        novel: novelId,
        chapter: chapterId,
        type,
        status: 'pending'
      })
    }
  }

  // Trigger arc generation when chapter count is a multiple of 10
  const chapterCount = await em.count(ChapterSchema, {
    novel: novelId,
    deletedAt: null
  })
  if (chapterCount > 0 && chapterCount % 10 === 0) {
    const existingArcTask = await em.findOne(GenerationTaskSchema, {
      novel: novelId,
      type: 'generate_arc',
      status: { $in: ['pending', 'running'] }
    })
    if (!existingArcTask) {
      em.create(GenerationTaskSchema, {
        novel: novelId,
        chapter: chapterId,
        type: 'generate_arc',
        status: 'pending'
      })
    }
  }

  await em.flush()

  setTimeout(() => processPendingTasks().catch(() => {}), 5000)
}

export async function processPendingTasks(): Promise<void> {
  if (isProcessing) return
  isProcessing = true
  try {
    const em = getOrm().em.fork()

    // Recover stale tasks stuck in 'running' for too long (e.g., server crash)
    const staleThreshold = new Date(Date.now() - STALE_TASK_TIMEOUT_MS)
    await em.nativeUpdate(
      GenerationTaskSchema,
      { status: 'running', createdAt: { $lt: staleThreshold } },
      { status: 'pending' }
    )

    // Check if any AI config is available before processing
    const anyConfig = await em.findOne(
      AiConfigSchema,
      { enabled: true },
      { populate: ['aiModel', 'aiModel.provider'] }
    )
    if (
      !anyConfig ||
      !(anyConfig.aiModel as any)?.enabled ||
      !(anyConfig.aiModel as any)?.provider?.enabled
    ) {
      return
    }

    const pending = await em.find(
      GenerationTaskSchema,
      { status: 'pending' },
      { limit: 3 }
    )

    for (const task of pending) {
      await processTask(task)
    }
  } finally {
    isProcessing = false
  }
}
