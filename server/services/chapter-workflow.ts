import type { EntityManager } from '@mikro-orm/core'
import { toAiOptions } from '../utils/ai-client'
import { collectAiStreamWithUsage, recordUsage } from '../utils/ai-stream'
import { resolveNovelAiConfig } from '../utils/ai-configs'
import {
  buildChapterPlanFieldPrompt,
  buildChapterPlanFieldRepairPrompt,
  type ChapterPlanPromptFieldValueKind
} from '../utils/ai-prompts'
import {
  hasInvalidGeneratedPlanIssue,
  buildChapterPlanFieldFallback,
  mergeChapterPlanPartials,
  validateChapterPlanDraft,
  parseChapterPlanDraft,
  parseChapterPlanFieldValue,
  type ChapterPlanDraftField,
  type ChapterPlanDraft,
  type ChapterPlanIssue,
  type ChapterPlanFieldValue,
  type ChapterPlanPartialDraft,
  type ChapterPlanValidationResult
} from '../utils/chapter-plan-quality'
import { filterUsablePlotPoints } from '../utils/plot-points'
import {
  ChapterSchema,
  ChapterWorkflowPlanSchema,
  CharacterSchema,
  ForeshadowingSchema,
  GenerationTaskSchema,
  NovelOutlineSchema,
  NovelSchema,
  PlotPointSchema,
  type Chapter,
  type ChapterWorkflowPlan,
  type Novel
} from '../database/entities'

const CHAPTER_PLAN_CONNECT_TIMEOUT_MS = 120_000
const CHAPTER_PLAN_TEMPERATURE = 0.3

const CHAPTER_PLAN_FIELD_JOBS: Array<{
  field: ChapterPlanDraftField
  label: string
  valueKind: ChapterPlanPromptFieldValueKind
  scenario: string
  maxTokens: number
  instruction?: string
}> = [
  {
    field: 'goal',
    label: '本章目标',
    valueKind: 'text',
    scenario: 'chapter_workflow_plan_field_goal',
    maxTokens: 320,
    instruction: '写清本章主角要主动达成的具体目标，不要写成字段说明。'
  },
  {
    field: 'conflict',
    label: '核心冲突',
    valueKind: 'text',
    scenario: 'chapter_workflow_plan_field_conflict',
    maxTokens: 320,
    instruction: '写清本章外部压力和人物两难，不要泛泛写“制造冲突”。'
  },
  {
    field: 'turningPoint',
    label: '关键转折',
    valueKind: 'text',
    scenario: 'chapter_workflow_plan_field_turning_point',
    maxTokens: 320,
    instruction: '写清本章局面发生变化的具体事件或发现。'
  },
  {
    field: 'beats',
    label: '剧情节拍',
    valueKind: 'list',
    scenario: 'chapter_workflow_plan_field_beats',
    maxTokens: 420,
    instruction: '至少 3 条，每条必须是可执行剧情动作，按本章发生顺序排列。'
  },
  {
    field: 'interestHooks',
    label: '兴趣钩子',
    valueKind: 'list',
    scenario: 'chapter_workflow_plan_field_interest_hooks',
    maxTokens: 260,
    instruction: '写章末或段落里的悬念、爽点或反转，1 到 3 条即可。'
  },
  {
    field: 'mustInclude',
    label: '必须出现',
    valueKind: 'list',
    scenario: 'chapter_workflow_plan_field_must_include',
    maxTokens: 420,
    instruction: '列出本章必须出现的人物、事件、物件、氛围或设定元素。'
  },
  {
    field: 'avoid',
    label: '避免出现',
    valueKind: 'list',
    scenario: 'chapter_workflow_plan_field_avoid',
    maxTokens: 340,
    instruction: '列出本章应避免提前揭露、跑偏或破坏设定的内容。'
  },
  {
    field: 'pacing',
    label: '情绪节奏',
    valueKind: 'text',
    scenario: 'chapter_workflow_plan_field_pacing',
    maxTokens: 260,
    instruction: '写本章情绪推进和节奏控制要求。'
  },
  {
    field: 'protocol',
    label: '称谓设定',
    valueKind: 'text',
    scenario: 'chapter_workflow_plan_field_protocol',
    maxTokens: 260,
    instruction: '写本章需要遵守的称谓、身份、礼制或设定补充。'
  }
]

function logChapterPlanFieldFallback(input: {
  field: ChapterPlanDraftField
  reason: string
  output: string
}) {
  console.debug('[chapter-workflow] Chapter plan field fallback used:', {
    field: input.field,
    reason: input.reason,
    outputPreview: input.output.slice(0, 1000)
  })
}

class ChapterPlanFieldParseError extends Error {
  constructor(
    message: string,
    readonly failedOutput: string,
    readonly inputTokens: number,
    readonly outputTokens: number
  ) {
    super(message)
    this.name = 'ChapterPlanFieldParseError'
  }
}

export interface ChapterWorkflowGenerateInput {
  em: EntityManager
  userId: number
  novelId: number
  chapterId: number
  chapterOutline: string
  characterIds?: number[]
  existingPlan?: Partial<{
    goal: string
    mustInclude: string
    avoid: string
    pacing: string
    protocol: string
  }>
  aiConfigId?: number
}

export interface ChapterWorkflowPlanResult {
  workflowPlan: ChapterWorkflowPlan
  plan: ChapterPlanDraft
  validation: ChapterPlanValidationResult
}

export interface ChapterWorkflowAcceptInput {
  em: EntityManager
  userId: number
  novelId: number
  chapterId: number
  planId: number
  editedPlan?: ChapterPlanDraft
}

export interface ChapterWorkflowFieldGenerateInput {
  em: EntityManager
  userId: number
  novelId: number
  chapterId: number
  chapterOutline: string
  field: ChapterPlanDraftField
  characterIds?: number[]
  existingPlan?: ChapterWorkflowGenerateInput['existingPlan'] &
    Partial<{
      conflict: string
      turningPoint: string
      beats: string
      interestHooks: string
    }>
  aiConfigId?: number
}

export interface ChapterWorkflowDraftCreateInput {
  em: EntityManager
  userId: number
  novelId: number
  chapterId: number
  plan: ChapterPlanDraft
}

export interface AcceptedChapterWorkflowPlan {
  workflowPlan: ChapterWorkflowPlan
  plan: ChapterPlanDraft
}

async function loadNovelAndChapter(
  em: EntityManager,
  userId: number,
  novelId: number,
  chapterId: number
): Promise<{ novel: Novel; chapter: Chapter }> {
  const novel = await em.findOne(NovelSchema, { id: novelId, user: userId })
  if (!novel) {
    throw createError({ statusCode: 404, message: 'Novel not found' })
  }

  const chapter = await em.findOne(ChapterSchema, {
    id: chapterId,
    novel: novelId,
    deletedAt: null
  })
  if (!chapter) {
    throw createError({ statusCode: 404, message: 'Chapter not found' })
  }

  return { novel, chapter }
}

async function loadReferenceContext(
  em: EntityManager,
  novelId: number,
  characterIds?: number[]
) {
  const charactersPromise =
    characterIds ?
      characterIds.length ?
        em.find(CharacterSchema, {
          novel: novelId,
          id: { $in: characterIds }
        })
      : Promise.resolve([])
    : em.find(CharacterSchema, { novel: novelId })

  const [characters, outlines, plotPoints, foreshadowings] = await Promise.all([
    charactersPromise,
    em.find(
      NovelOutlineSchema,
      { novel: novelId },
      { orderBy: { chapterNumber: 'ASC' } }
    ),
    em.find(PlotPointSchema, { novel: novelId }, { populate: ['chapter'] }),
    em.find(ForeshadowingSchema, { novel: novelId })
  ])

  return {
    characters,
    outlines,
    plotPoints: filterUsablePlotPoints(plotPoints),
    foreshadowings
  }
}

async function validatePlanForChapter(
  em: EntityManager,
  novelId: number,
  chapter: Chapter,
  plan: ChapterPlanDraft
): Promise<ChapterPlanValidationResult> {
  const referenceContext = await loadReferenceContext(em, novelId)
  return validateChapterPlanDraft(plan, {
    chapterNumber: chapter.chapterNumber,
    characterIds: new Set(
      referenceContext.characters.map((character) => character.id)
    ),
    plotPointIds: new Set(referenceContext.plotPoints.map((point) => point.id)),
    foreshadowingIds: new Set(
      referenceContext.foreshadowings.map((foreshadowing) => foreshadowing.id)
    )
  })
}

function allowedIdsForField(
  field: ChapterPlanDraftField,
  referenceContext: Awaited<ReturnType<typeof loadReferenceContext>>
): ReadonlySet<number> {
  if (field === 'characters') {
    return new Set(referenceContext.characters.map((character) => character.id))
  }
  if (field === 'plotThreadActions') {
    return new Set(referenceContext.plotPoints.map((point) => point.id))
  }
  if (field === 'foreshadowingActions') {
    return new Set(
      referenceContext.foreshadowings.map((foreshadowing) => foreshadowing.id)
    )
  }
  return new Set()
}

function hasGeneratedFieldValue(value: ChapterPlanFieldValue): boolean {
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0
}

function assignGeneratedFieldValue(
  partial: ChapterPlanPartialDraft,
  field: ChapterPlanDraftField,
  value: ChapterPlanFieldValue
) {
  if (field === 'goal') partial.goal = value as string
  if (field === 'conflict') partial.conflict = value as string
  if (field === 'turningPoint') partial.turningPoint = value as string
  if (field === 'beats') partial.beats = value as string[]
  if (field === 'mustInclude') partial.mustInclude = value as string[]
  if (field === 'avoid') partial.avoid = value as string[]
  if (field === 'characters') partial.characters = value as number[]
  if (field === 'characterStateDeltas') {
    partial.characterStateDeltas = value as string[]
  }
  if (field === 'plotThreadActions') {
    partial.plotThreadActions = value as number[]
  }
  if (field === 'foreshadowingActions') {
    partial.foreshadowingActions = value as number[]
  }
  if (field === 'interestHooks') partial.interestHooks = value as string[]
  if (field === 'continuityRisks') partial.continuityRisks = value as string[]
  if (field === 'pacing') partial.pacing = value as string
  if (field === 'protocol') partial.protocol = value as string
}

function existingPlanToPartial(
  existingPlan: ChapterWorkflowFieldGenerateInput['existingPlan']
): ChapterPlanPartialDraft {
  if (!existingPlan) return {}
  return {
    goal: existingPlan.goal,
    conflict: existingPlan.conflict,
    turningPoint: existingPlan.turningPoint,
    beats: existingPlan.beats ? splitPlanText(existingPlan.beats) : undefined,
    mustInclude:
      existingPlan.mustInclude ?
        splitPlanText(existingPlan.mustInclude)
      : undefined,
    avoid: existingPlan.avoid ? splitPlanText(existingPlan.avoid) : undefined,
    interestHooks:
      existingPlan.interestHooks ?
        splitPlanText(existingPlan.interestHooks)
      : undefined,
    pacing: existingPlan.pacing,
    protocol: existingPlan.protocol
  }
}

function splitPlanText(value: string): string[] {
  return value
    .split(/\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function createFallbackGeneratedField(input: {
  chapter: Chapter
  chapterOutline: string
  referenceContext: Awaited<ReturnType<typeof loadReferenceContext>>
  job: (typeof CHAPTER_PLAN_FIELD_JOBS)[number]
  inputTokens: number
  outputTokens: number
}): Awaited<ReturnType<typeof generateChapterPlanField>> {
  return {
    field: input.job.field,
    value: buildChapterPlanFieldFallback({
      field: input.job.field,
      chapterOutline: input.chapterOutline,
      chapterNumber: input.chapter.chapterNumber,
      chapterTitle: input.chapter.title,
      outlines: input.referenceContext.outlines.map((outline) => ({
        chapterNumber: outline.chapterNumber,
        description: outline.description
      }))
    }),
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens
  }
}

async function generateChapterPlanField(input: {
  aiConfig: Awaited<ReturnType<typeof resolveNovelAiConfig>>
  userId: number
  novelId: number
  chapterId: number
  novel: Novel
  chapter: Chapter
  chapterOutline: string
  referenceContext: Awaited<ReturnType<typeof loadReferenceContext>>
  existingPlan?: ChapterWorkflowGenerateInput['existingPlan']
  existingPartialPlan: ChapterPlanPartialDraft
  job: (typeof CHAPTER_PLAN_FIELD_JOBS)[number]
  repair?: { failedOutput: string; failureReason: string }
}): Promise<{
  field: ChapterPlanDraftField
  value: ChapterPlanFieldValue
  inputTokens: number
  outputTokens: number
}> {
  const promptContext = {
    field: input.job.field,
    label: input.job.label,
    valueKind: input.job.valueKind,
    instruction: input.job.instruction,
    novel: input.novel,
    chapter: {
      title: input.chapter.title,
      chapterNumber: input.chapter.chapterNumber
    },
    chapterOutline: input.chapterOutline,
    characters: input.referenceContext.characters,
    outlines: input.referenceContext.outlines.map((outline) => ({
      chapterNumber: outline.chapterNumber,
      description: outline.description
    })),
    existingPlan: input.existingPlan,
    existingPartialPlan: input.existingPartialPlan,
    plotPoints: input.referenceContext.plotPoints.map((point) => ({
      id: point.id,
      description: point.description
    })),
    foreshadowings: input.referenceContext.foreshadowings.map(
      (foreshadowing) => ({
        id: foreshadowing.id,
        content: foreshadowing.content
      })
    )
  }
  const messages =
    input.repair ?
      buildChapterPlanFieldRepairPrompt({
        ...promptContext,
        failedOutput: input.repair.failedOutput,
        failureReason: input.repair.failureReason
      })
    : buildChapterPlanFieldPrompt(promptContext)
  const result = await collectAiStreamWithUsage(
    toAiOptions(input.aiConfig, {
      messages,
      temperature: input.repair ? 0.2 : CHAPTER_PLAN_TEMPERATURE,
      thinkingEnabled: false,
      maxTokens: input.job.maxTokens,
      connectTimeoutMs: CHAPTER_PLAN_CONNECT_TIMEOUT_MS,
      tracking: {
        userId: input.userId,
        configId: input.aiConfig.configId,
        modelId: input.aiConfig.modelId,
        purpose: 'generation',
        scenario:
          input.repair ? `${input.job.scenario}_repair` : input.job.scenario,
        source: 'service',
        endpoint: '/api/ai/generate-chapter-plan',
        novelId: input.novelId,
        chapterId: input.chapterId
      }
    })
  )

  let value: ChapterPlanFieldValue
  try {
    value = parseChapterPlanFieldValue(result.content, {
      field: input.job.field,
      kind: input.job.valueKind,
      allowedIds: allowedIdsForField(input.job.field, input.referenceContext)
    })
    if (
      !hasGeneratedFieldValue(value) &&
      ![
        'continuityRisks',
        'characters',
        'plotThreadActions',
        'foreshadowingActions'
      ].includes(input.job.field)
    ) {
      throw new Error(`${input.job.label}缺少可用内容`)
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '解析失败'
    throw new ChapterPlanFieldParseError(
      message,
      result.content,
      result.inputTokens,
      result.outputTokens
    )
  }

  return {
    field: input.job.field,
    value,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens
  }
}

async function generateChapterPlanByFields(input: {
  aiConfig: Awaited<ReturnType<typeof resolveNovelAiConfig>>
  userId: number
  novelId: number
  chapterId: number
  novel: Novel
  chapter: Chapter
  chapterOutline: string
  referenceContext: Awaited<ReturnType<typeof loadReferenceContext>>
  existingPlan?: ChapterWorkflowGenerateInput['existingPlan']
}): Promise<{
  plan: ChapterPlanDraft
  inputTokens: number
  outputTokens: number
}> {
  const partial: ChapterPlanPartialDraft = {}
  let inputTokens = 0
  let outputTokens = 0

  const generateJob = async (job: (typeof CHAPTER_PLAN_FIELD_JOBS)[number]) => {
    let generated: Awaited<ReturnType<typeof generateChapterPlanField>>
    try {
      generated = await generateChapterPlanField({
        ...input,
        existingPartialPlan: partial,
        job
      })
    } catch (firstError: unknown) {
      if (firstError instanceof ChapterPlanFieldParseError) {
        try {
          generated = await generateChapterPlanField({
            ...input,
            existingPartialPlan: partial,
            job,
            repair: {
              failedOutput: firstError.failedOutput,
              failureReason: firstError.message
            }
          })
          generated = {
            ...generated,
            inputTokens: firstError.inputTokens + generated.inputTokens,
            outputTokens: firstError.outputTokens + generated.outputTokens
          }
        } catch (repairError: unknown) {
          if (!(repairError instanceof ChapterPlanFieldParseError)) {
            throw createError({
              statusCode: 502,
              message: `AI 未返回可用的剧情计划：${job.label}生成失败${
                repairError instanceof Error ? `（${repairError.message}）` : ''
              }`
            })
          }
          logChapterPlanFieldFallback({
            field: job.field,
            reason: repairError.message,
            output: repairError.failedOutput
          })
          generated = createFallbackGeneratedField({
            chapter: input.chapter,
            chapterOutline: input.chapterOutline,
            referenceContext: input.referenceContext,
            job,
            inputTokens: firstError.inputTokens + repairError.inputTokens,
            outputTokens: firstError.outputTokens + repairError.outputTokens
          })
        }
      } else {
        throw createError({
          statusCode: 502,
          message: `AI 未返回可用的剧情计划：${job.label}生成失败${
            firstError instanceof Error ? `（${firstError.message}）` : ''
          }`
        })
      }
    }
    return generated
  }

  const batches: ChapterPlanDraftField[][] = [
    ['goal', 'conflict', 'turningPoint'],
    ['beats', 'interestHooks', 'mustInclude', 'avoid', 'pacing', 'protocol']
  ]
  for (const batch of batches) {
    const batchJobs = CHAPTER_PLAN_FIELD_JOBS.filter((job) =>
      batch.includes(job.field)
    )
    const generatedFields = await Promise.all(batchJobs.map(generateJob))
    for (const generated of generatedFields) {
      assignGeneratedFieldValue(partial, generated.field, generated.value)
      inputTokens += generated.inputTokens
      outputTokens += generated.outputTokens
    }
  }

  partial.characters = input.referenceContext.characters.map(
    (character) => character.id
  )
  partial.characterStateDeltas = []
  partial.plotThreadActions = []
  partial.foreshadowingActions = []
  partial.continuityRisks = []

  return {
    plan: mergeChapterPlanPartials([partial]),
    inputTokens,
    outputTokens
  }
}

export async function generateChapterWorkflowPlanField(
  input: ChapterWorkflowFieldGenerateInput
): Promise<{ field: ChapterPlanDraftField; value: ChapterPlanFieldValue }> {
  const { em, userId, novelId, chapterId, field } = input
  const { novel, chapter } = await loadNovelAndChapter(
    em,
    userId,
    novelId,
    chapterId
  )
  const job = CHAPTER_PLAN_FIELD_JOBS.find((item) => item.field === field)
  if (!job) {
    throw createError({ statusCode: 400, message: 'Unsupported plan field' })
  }
  const [referenceContext, aiConfig] = await Promise.all([
    loadReferenceContext(em, novelId, input.characterIds),
    resolveNovelAiConfig(em, userId, novelId, 'generation', input.aiConfigId)
  ])

  let result: Awaited<ReturnType<typeof generateChapterPlanField>>
  try {
    result = await generateChapterPlanField({
      aiConfig,
      userId,
      novelId,
      chapterId,
      novel,
      chapter,
      chapterOutline: input.chapterOutline,
      referenceContext,
      existingPlan: input.existingPlan,
      existingPartialPlan: existingPlanToPartial(input.existingPlan),
      job
    })
  } catch (firstError: unknown) {
    if (firstError instanceof ChapterPlanFieldParseError) {
      try {
        result = await generateChapterPlanField({
          aiConfig,
          userId,
          novelId,
          chapterId,
          novel,
          chapter,
          chapterOutline: input.chapterOutline,
          referenceContext,
          existingPlan: input.existingPlan,
          existingPartialPlan: existingPlanToPartial(input.existingPlan),
          job,
          repair: {
            failedOutput: firstError.failedOutput,
            failureReason: firstError.message
          }
        })
        result = {
          ...result,
          inputTokens: firstError.inputTokens + result.inputTokens,
          outputTokens: firstError.outputTokens + result.outputTokens
        }
      } catch (repairError: unknown) {
        if (!(repairError instanceof ChapterPlanFieldParseError)) {
          throw createError({
            statusCode: 502,
            message: `AI 未返回可用的剧情计划：${job.label}生成失败${
              repairError instanceof Error ? `（${repairError.message}）` : ''
            }`
          })
        }
        logChapterPlanFieldFallback({
          field: job.field,
          reason: repairError.message,
          output: repairError.failedOutput
        })
        result = createFallbackGeneratedField({
          chapter,
          chapterOutline: input.chapterOutline,
          referenceContext,
          job,
          inputTokens: firstError.inputTokens + repairError.inputTokens,
          outputTokens: firstError.outputTokens + repairError.outputTokens
        })
      }
    } else {
      throw createError({
        statusCode: 502,
        message: `AI 未返回可用的剧情计划：${job.label}生成失败${
          firstError instanceof Error ? `（${firstError.message}）` : ''
        }`
      })
    }
  }

  await recordUsage(
    { em, userId, configId: aiConfig.id, model: aiConfig.model },
    result.inputTokens,
    result.outputTokens
  )

  return { field: result.field, value: result.value }
}

export async function createChapterWorkflowPlanDraft(
  input: ChapterWorkflowDraftCreateInput
): Promise<ChapterWorkflowPlanResult> {
  const { em, userId, novelId, chapterId, plan } = input
  const { chapter } = await loadNovelAndChapter(em, userId, novelId, chapterId)
  const validation = await validatePlanForChapter(em, novelId, chapter, plan)
  if (hasInvalidGeneratedPlanIssue(validation.issues)) {
    throw createError({
      statusCode: 502,
      message: 'AI 未返回可用的剧情计划：生成内容仍是字段模板'
    })
  }
  const workflowPlan = em.create(ChapterWorkflowPlanSchema, {
    novel: novelId,
    chapter: chapterId,
    generationTask: null,
    status: validation.blocked ? 'needs_revision' : 'draft',
    planJson: JSON.stringify(plan),
    issuesJson:
      validation.issues.length ? JSON.stringify(validation.issues) : null,
    judgeJson: null,
    acceptedAt: null
  })
  await em.flush()

  return { workflowPlan, plan, validation }
}

export async function generateChapterWorkflowPlan(
  input: ChapterWorkflowGenerateInput
): Promise<ChapterWorkflowPlanResult> {
  const { em, userId, novelId, chapterId } = input
  const { novel, chapter } = await loadNovelAndChapter(
    em,
    userId,
    novelId,
    chapterId
  )
  const [referenceContext, aiConfig] = await Promise.all([
    loadReferenceContext(em, novelId, input.characterIds),
    resolveNovelAiConfig(em, userId, novelId, 'generation', input.aiConfigId)
  ])

  const result = await generateChapterPlanByFields({
    aiConfig,
    userId,
    novelId,
    chapterId,
    novel,
    chapter,
    chapterOutline: input.chapterOutline,
    referenceContext,
    existingPlan: input.existingPlan
  })
  await recordUsage(
    { em, userId, configId: aiConfig.id, model: aiConfig.model },
    result.inputTokens,
    result.outputTokens
  )
  const { plan } = result

  const validation = validateChapterPlanDraft(plan, {
    chapterNumber: chapter.chapterNumber,
    characterIds: new Set(
      referenceContext.characters.map((character) => character.id)
    ),
    plotPointIds: new Set(referenceContext.plotPoints.map((point) => point.id)),
    foreshadowingIds: new Set(
      referenceContext.foreshadowings.map((foreshadowing) => foreshadowing.id)
    )
  })
  if (hasInvalidGeneratedPlanIssue(validation.issues)) {
    throw createError({
      statusCode: 502,
      message: 'AI 未返回可用的剧情计划：生成内容仍是字段模板'
    })
  }
  const workflowPlan = em.create(ChapterWorkflowPlanSchema, {
    novel: novelId,
    chapter: chapterId,
    generationTask: null,
    status: validation.blocked ? 'needs_revision' : 'draft',
    planJson: JSON.stringify(plan),
    issuesJson:
      validation.issues.length ? JSON.stringify(validation.issues) : null,
    judgeJson: null,
    acceptedAt: null
  })
  await em.flush()

  return { workflowPlan, plan, validation }
}

export async function acceptChapterWorkflowPlan(
  input: ChapterWorkflowAcceptInput
): Promise<AcceptedChapterWorkflowPlan> {
  const { em, userId, novelId, chapterId, planId } = input
  const { chapter } = await loadNovelAndChapter(em, userId, novelId, chapterId)

  const workflowPlan = await em.findOne(ChapterWorkflowPlanSchema, {
    id: planId,
    novel: novelId,
    chapter: chapterId
  })
  if (!workflowPlan) {
    throw createError({ statusCode: 404, message: 'Workflow plan not found' })
  }

  const plan = input.editedPlan ?? parseChapterPlanDraft(workflowPlan.planJson)
  if (input.editedPlan) {
    const validation = await validatePlanForChapter(em, novelId, chapter, plan)
    workflowPlan.planJson = JSON.stringify(plan)
    workflowPlan.issuesJson =
      validation.issues.length ? JSON.stringify(validation.issues) : null
    if (validation.blocked) {
      workflowPlan.status = 'needs_revision'
      workflowPlan.acceptedAt = null
      await em.flush()
      throw createError({ statusCode: 409, message: '剧情计划仍存在阻断问题' })
    }
  }

  const issues: ChapterPlanIssue[] =
    workflowPlan.issuesJson ? JSON.parse(workflowPlan.issuesJson) : []
  if (issues.some((issue) => issue.severity === 'error')) {
    throw createError({ statusCode: 409, message: '剧情计划仍存在阻断问题' })
  }

  const existingAccepted = await em.find(ChapterWorkflowPlanSchema, {
    novel: novelId,
    chapter: chapterId,
    status: 'accepted'
  })
  for (const accepted of existingAccepted) {
    accepted.status = 'rejected'
  }

  workflowPlan.status = 'accepted'
  workflowPlan.acceptedAt = new Date()
  await em.flush()

  return { workflowPlan, plan }
}

export async function getAcceptedChapterWorkflowPlan(
  em: EntityManager,
  novelId: number,
  chapterId: number
): Promise<AcceptedChapterWorkflowPlan | null> {
  const workflowPlan = await em.findOne(
    ChapterWorkflowPlanSchema,
    { novel: novelId, chapter: chapterId, status: 'accepted' },
    { orderBy: { acceptedAt: 'DESC', id: 'DESC' } }
  )
  if (!workflowPlan) return null

  return {
    workflowPlan,
    plan: parseChapterPlanDraft(workflowPlan.planJson)
  }
}

export async function linkChapterWorkflowPlanToTask(
  em: EntityManager,
  input: {
    planId: number
    taskId: number
    novelId: number
    chapterId: number
  }
): Promise<void> {
  const [workflowPlan, task] = await Promise.all([
    em.findOne(ChapterWorkflowPlanSchema, {
      id: input.planId,
      novel: input.novelId,
      chapter: input.chapterId,
      status: 'accepted'
    }),
    em.findOne(GenerationTaskSchema, {
      id: input.taskId,
      novel: input.novelId,
      chapter: input.chapterId
    })
  ])
  if (!workflowPlan || !task) return

  workflowPlan.generationTask = task
  await em.flush()
}
