import { z } from 'zod'
import {
  buildTokenBudget,
  createTrackedStreamResponse,
  prepareBudgetedAiOptions
} from '../../utils/ai-stream'
import { toAiOptions, PROSE_SAMPLING } from '../../utils/ai-client'
import { resolveNovelAiConfig } from '../../utils/ai-configs'
import { NovelSchema, GenerationTaskSchema } from '../../database/entities'
import { prepareChapterContext } from '../../services/chapter-context'
import { resolveChapterGenerationInputs } from '../../services/generation-context'
import {
  getAcceptedChapterWorkflowPlan,
  linkChapterWorkflowPlanToTask
} from '../../services/chapter-workflow'

const contextSelectionSchema = z
  .object({
    includedKeys: z.array(z.string()).optional(),
    excludedKeys: z.array(z.string()).optional()
  })
  .optional()

const generateSchema = z.object({
  novelId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  direction: z.string().optional(),
  chapterOutline: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0.01).max(1).optional(),
  thinkingEnabled: z.boolean().optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  maxTokens: z.number().int().min(256).max(128000).optional(),
  aiConfigId: z.number().int().positive().optional(),
  workflowPlanId: z.number().int().positive().optional(),
  skillIds: z.array(z.number().int().positive()).optional(),
  contextSelection: contextSelectionSchema
})

function formatWorkflowPlanDirection(
  plan: Awaited<ReturnType<typeof getAcceptedChapterWorkflowPlan>>
): string {
  if (!plan) return ''
  const draft = plan.plan
  return [
    '【已验收剧情计划】',
    draft.goal ? `本章目标：${draft.goal}` : '',
    draft.conflict ? `核心冲突：${draft.conflict}` : '',
    draft.turningPoint ? `关键转折：${draft.turningPoint}` : '',
    draft.beats.length ? `剧情节拍：${draft.beats.join('；')}` : '',
    draft.mustInclude.length ? `必须包含：${draft.mustInclude.join('；')}` : '',
    draft.avoid.length ? `必须避免：${draft.avoid.join('；')}` : '',
    draft.interestHooks.length ?
      `兴趣钩子：${draft.interestHooks.join('；')}`
    : '',
    draft.pacing ? `节奏：${draft.pacing}` : '',
    draft.protocol ? `称谓/设定：${draft.protocol}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

function resolveTargetWords(maxOutputTokens: number): number {
  return Math.max(800, Math.floor(maxOutputTokens / 2))
}

function resolveMinimumInputTokens(contextWindowTokens: number): number {
  return Math.max(4096, Math.floor(contextWindowTokens * 0.25))
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const body = await readBody(event)
  const data = generateSchema.parse(body)
  const em = useEm(event)

  if (data.workflowPlanId && !data.chapterId) {
    throw createError({
      statusCode: 400,
      message: 'workflowPlanId 必须与 chapterId 一起提交'
    })
  }

  const novel = await em.findOne(NovelSchema, {
    id: data.novelId,
    user: auth.userId
  })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const aiConfig = await resolveNovelAiConfig(
    em,
    auth.userId,
    data.novelId,
    'generation',
    data.aiConfigId
  )

  const acceptedPlan =
    data.chapterId ?
      await getAcceptedChapterWorkflowPlan(em, data.novelId, data.chapterId)
    : null
  if (
    data.chapterId &&
    (!acceptedPlan || acceptedPlan.workflowPlan.id !== data.workflowPlanId)
  ) {
    throw createError({
      statusCode: 409,
      message: '请先生成并验收本章剧情计划，再生成正文'
    })
  }
  const workflowDirection = formatWorkflowPlanDirection(acceptedPlan)
  const direction = [workflowDirection, data.direction]
    .filter(Boolean)
    .join('\n\n')

  const contextInputs = await resolveChapterGenerationInputs({
    em,
    novel,
    novelId: data.novelId,
    userId: auth.userId,
    chapterId: data.chapterId,
    chapterOutline: data.chapterOutline,
    direction,
    aiConfig,
    requestSkillIds: data.skillIds
  })

  const desiredOutputTokens = data.maxTokens || aiConfig.maxTokens || 4096
  const initialBudget = buildTokenBudget({
    messages: [],
    contextWindowTokens: aiConfig.contextWindowTokens,
    desiredOutputTokens,
    reserveTokens: 1024,
    minOutputTokens: 1024,
    minimumInputTokens: resolveMinimumInputTokens(aiConfig.contextWindowTokens)
  })

  const { messages } = await prepareChapterContext(em, {
    novel,
    novelId: data.novelId,
    userId: auth.userId,
    currentChapter:
      contextInputs.currentChapter ?
        {
          title: contextInputs.currentChapter.title,
          chapterNumber: contextInputs.currentChapter.chapterNumber
        }
      : undefined,
    outline: contextInputs.chapterOutline,
    direction,
    precedingChapters: contextInputs.precedingChapters,
    characters: contextInputs.characters,
    plotPoints: contextInputs.plotPoints,
    storyArcs: contextInputs.storyArcs,
    foreshadowing: contextInputs.foreshadowing,
    recentChapterContent: contextInputs.recentChapterContent,
    depth: 'query-only',
    skillIds: contextInputs.skillIds,
    contextSelection: data.contextSelection,
    generationBudget: {
      maxOutputTokens: initialBudget.maxOutputTokens,
      targetWords: resolveTargetWords(initialBudget.maxOutputTokens)
    }
  })

  const budgeted = prepareBudgetedAiOptions(
    toAiOptions(aiConfig, {
      messages,
      temperature: data.temperature,
      topP: data.topP,
      thinkingEnabled: data.thinkingEnabled,
      reasoningEffort: data.reasoningEffort,
      maxTokens: desiredOutputTokens,
      extraBody: PROSE_SAMPLING,
      tracking: {
        userId: auth.userId,
        configId: aiConfig.configId,
        modelId: aiConfig.modelId,
        purpose: 'generation',
        scenario: 'chapter_generate',
        source: 'api_route',
        endpoint: '/api/ai/generate',
        novelId: data.novelId,
        chapterId: data.chapterId || null
      }
    }),
    {
      contextWindowTokens: aiConfig.contextWindowTokens,
      desiredOutputTokens,
      reserveTokens: 1024,
      minOutputTokens: 1024,
      minimumInputTokens: resolveMinimumInputTokens(
        aiConfig.contextWindowTokens
      )
    }
  )

  if (budgeted.options.tracking) {
    budgeted.options.tracking.taskId = undefined
  }
  const budget = budgeted.budget

  const task = em.create(GenerationTaskSchema, {
    novel: data.novelId,
    chapter: data.chapterId || null,
    type: 'generate',
    status: 'running'
  })
  await em.flush()
  if (budgeted.options.tracking) {
    budgeted.options.tracking.taskId = task.id
  }

  if (data.workflowPlanId) {
    await linkChapterWorkflowPlanToTask(em, {
      planId: data.workflowPlanId,
      taskId: task.id,
      novelId: data.novelId,
      chapterId: data.chapterId!
    })
  }

  return createTrackedStreamResponse(
    event,
    budgeted.options,
    {
      em,
      userId: auth.userId,
      configId: aiConfig.id,
      model: aiConfig.model
    },
    {
      taskId: task.id,
      trackStats: true,
      budget
    }
  )
})
