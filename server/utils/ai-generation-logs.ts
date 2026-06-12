import type { RequiredEntityData } from '@mikro-orm/core'
import { getOrm } from '../database'
import {
  AiGenerationLogSchema,
  ModelCostRateSchema,
  type AiGenerationLog
} from '../database/entities'

export const AI_GENERATION_LOG_STATUS = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const

export const AI_GENERATION_MODEL_TYPE = {
  CHAT_COMPLETION: 'chat_completion',
  EMBEDDING: 'embedding',
  CONNECTIVITY_CHECK: 'connectivity_check'
} as const

export const AI_GENERATION_SOURCE = {
  API_ROUTE: 'api_route',
  SERVICE: 'service',
  BACKGROUND_TASK: 'background_task',
  STARTUP: 'startup',
  UNCLASSIFIED: 'unclassified'
} as const

export type AiGenerationLogStatus =
  (typeof AI_GENERATION_LOG_STATUS)[keyof typeof AI_GENERATION_LOG_STATUS]

export type AiGenerationModelType =
  (typeof AI_GENERATION_MODEL_TYPE)[keyof typeof AI_GENERATION_MODEL_TYPE]

export type AiGenerationSource =
  (typeof AI_GENERATION_SOURCE)[keyof typeof AI_GENERATION_SOURCE]

interface ModelCostRateLike {
  inputCostPer1k: string
  outputCostPer1k: string
}

export interface AiGenerationLogStore {
  create(
    schema: typeof AiGenerationLogSchema,
    data: Record<string, unknown>
  ): Record<string, unknown>
  findOne(
    schema: typeof ModelCostRateSchema,
    where: Record<string, unknown>
  ): Promise<ModelCostRateLike | null>
  flush(): Promise<void>
}

export interface AiGenerationTracking {
  userId?: number | null
  configId?: number | null
  modelId?: number | null
  model: string
  modelType?: AiGenerationModelType
  providerName?: string | null
  purpose?: string
  scenario?: string
  endpoint?: string | null
  source?: AiGenerationSource
  streamed?: boolean
  requestId?: string | null
  parentRequestId?: string | null
  novelId?: number | null
  chapterId?: number | null
  taskId?: number | null
  inputChars?: number
  outputChars?: number
  embeddingItems?: number
}

export interface StartAiGenerationLogOptions extends AiGenerationTracking {
  store?: AiGenerationLogStore
  startedAt?: Date
}

export interface FinishAiGenerationLogOptions {
  tokensInput?: number
  tokensOutput?: number
  inputChars?: number
  outputChars?: number
  embeddingItems?: number
}

export interface RecordEmbeddingCallOptions<T> extends Omit<
  AiGenerationTracking,
  'modelType'
> {
  store?: AiGenerationLogStore
  run: () => Promise<T>
}

export interface CalculateEstimatedCostOptions {
  tokensInput: number
  tokensOutput: number
  inputCostPer1k: string
  outputCostPer1k: string
}

export interface AiGenerationLogHandle {
  store: AiGenerationLogStore
  record: Record<string, unknown>
  startedAt: Date
  model: string
  userId: number | null
  firstTokenMarked: boolean
}

function createDefaultStore(): AiGenerationLogStore {
  const em = getOrm().em.fork()

  return {
    create(_schema, data) {
      return em.create(
        AiGenerationLogSchema,
        data as RequiredEntityData<AiGenerationLog>
      ) as unknown as Record<string, unknown>
    },
    async findOne(_schema, where) {
      return await em.findOne(ModelCostRateSchema, where)
    },
    async flush() {
      await em.flush()
    }
  }
}

function warnLogFailure(action: string, error: unknown): void {
  console.warn(`[ai-generation-logs] ${action} failed:`, error)
}

function elapsedMs(startedAt: Date, endedAt: Date): number {
  return Math.max(0, endedAt.getTime() - startedAt.getTime())
}

function readError(error: unknown): { message: string; type: string } {
  if (error instanceof Error) {
    return {
      message: error.message || 'Unknown error',
      type: error.name || 'Error'
    }
  }

  if (typeof error === 'string') {
    return { message: error, type: 'Error' }
  }

  return { message: 'Unknown error', type: 'Unknown' }
}

function setRecordValue(
  record: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  record[key] = value
}

function numberOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function nullableId(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function calculateEstimatedCost({
  tokensInput,
  tokensOutput,
  inputCostPer1k,
  outputCostPer1k
}: CalculateEstimatedCostOptions): string {
  const inputRate = Number.parseFloat(inputCostPer1k)
  const outputRate = Number.parseFloat(outputCostPer1k)
  const safeInputRate = Number.isFinite(inputRate) ? inputRate : 0
  const safeOutputRate = Number.isFinite(outputRate) ? outputRate : 0
  const cost =
    (tokensInput * safeInputRate) / 1000 +
    (tokensOutput * safeOutputRate) / 1000

  return cost.toFixed(6)
}

export async function startAiGenerationLog(
  options: StartAiGenerationLogOptions
): Promise<AiGenerationLogHandle | null> {
  try {
    const store = options.store ?? createDefaultStore()
    const startedAt = options.startedAt ?? new Date()
    const userId = nullableId(options.userId)

    const record = store.create(AiGenerationLogSchema, {
      user: userId,
      aiConfig: nullableId(options.configId),
      aiModel: nullableId(options.modelId),
      model: options.model,
      modelType: options.modelType ?? AI_GENERATION_MODEL_TYPE.CHAT_COMPLETION,
      providerName: options.providerName ?? null,
      purpose: options.purpose ?? 'unknown',
      scenario: options.scenario ?? 'unclassified_ai_call',
      endpoint: options.endpoint ?? null,
      source: options.source ?? AI_GENERATION_SOURCE.UNCLASSIFIED,
      status: AI_GENERATION_LOG_STATUS.RUNNING,
      errorMessage: null,
      errorType: null,
      tokensInput: 0,
      tokensOutput: 0,
      estimatedCost: null,
      inputChars: numberOrZero(options.inputChars),
      outputChars: numberOrZero(options.outputChars),
      embeddingItems: numberOrZero(options.embeddingItems),
      startedAt,
      firstTokenAt: null,
      endedAt: null,
      firstTokenLatencyMs: null,
      durationMs: null,
      streamed: Boolean(options.streamed),
      requestId: options.requestId ?? null,
      parentRequestId: options.parentRequestId ?? null,
      novel: nullableId(options.novelId),
      chapter: nullableId(options.chapterId),
      generationTask: nullableId(options.taskId)
    })

    await store.flush()

    return {
      store,
      record,
      startedAt,
      model: options.model,
      userId,
      firstTokenMarked: false
    }
  } catch (error: unknown) {
    warnLogFailure('start', error)
    return null
  }
}

export async function markFirstToken(
  handle: AiGenerationLogHandle | null
): Promise<void> {
  if (!handle || handle.firstTokenMarked) return

  try {
    const firstTokenAt = new Date()
    setRecordValue(handle.record, 'firstTokenAt', firstTokenAt)
    setRecordValue(
      handle.record,
      'firstTokenLatencyMs',
      elapsedMs(handle.startedAt, firstTokenAt)
    )
    handle.firstTokenMarked = true
    await handle.store.flush()
  } catch (error: unknown) {
    warnLogFailure('mark first token', error)
  }
}

export async function finishAiGenerationLog(
  handle: AiGenerationLogHandle | null,
  options: FinishAiGenerationLogOptions = {}
): Promise<void> {
  if (!handle) return

  try {
    const endedAt = new Date()
    const tokensInput = numberOrZero(options.tokensInput)
    const tokensOutput = numberOrZero(options.tokensOutput)
    let estimatedCost: string | null = null

    if (handle.userId !== null) {
      try {
        const costRate = await handle.store.findOne(ModelCostRateSchema, {
          user: handle.userId,
          model: handle.model
        })
        if (costRate) {
          estimatedCost = calculateEstimatedCost({
            tokensInput,
            tokensOutput,
            inputCostPer1k: costRate.inputCostPer1k,
            outputCostPer1k: costRate.outputCostPer1k
          })
        }
      } catch (error: unknown) {
        warnLogFailure('calculate cost', error)
      }
    }

    setRecordValue(handle.record, 'status', AI_GENERATION_LOG_STATUS.SUCCESS)
    setRecordValue(handle.record, 'tokensInput', tokensInput)
    setRecordValue(handle.record, 'tokensOutput', tokensOutput)
    setRecordValue(handle.record, 'estimatedCost', estimatedCost)
    setRecordValue(
      handle.record,
      'inputChars',
      numberOrZero(options.inputChars)
    )
    setRecordValue(
      handle.record,
      'outputChars',
      numberOrZero(options.outputChars)
    )
    setRecordValue(
      handle.record,
      'embeddingItems',
      numberOrZero(options.embeddingItems)
    )
    if (!handle.firstTokenMarked && numberOrZero(options.outputChars) > 0) {
      setRecordValue(handle.record, 'firstTokenAt', endedAt)
      setRecordValue(
        handle.record,
        'firstTokenLatencyMs',
        elapsedMs(handle.startedAt, endedAt)
      )
      handle.firstTokenMarked = true
    }
    setRecordValue(handle.record, 'endedAt', endedAt)
    setRecordValue(
      handle.record,
      'durationMs',
      elapsedMs(handle.startedAt, endedAt)
    )
    await handle.store.flush()
  } catch (error: unknown) {
    warnLogFailure('finish', error)
  }
}

export async function failAiGenerationLog(
  handle: AiGenerationLogHandle | null,
  error: unknown
): Promise<void> {
  if (!handle) return

  try {
    const endedAt = new Date()
    const info = readError(error)
    setRecordValue(handle.record, 'status', AI_GENERATION_LOG_STATUS.FAILED)
    setRecordValue(handle.record, 'errorMessage', info.message)
    setRecordValue(handle.record, 'errorType', info.type)
    setRecordValue(handle.record, 'endedAt', endedAt)
    setRecordValue(
      handle.record,
      'durationMs',
      elapsedMs(handle.startedAt, endedAt)
    )
    await handle.store.flush()
  } catch (logError: unknown) {
    warnLogFailure('fail', logError)
  }
}

export async function recordEmbeddingCall<T>(
  options: RecordEmbeddingCallOptions<T>
): Promise<T> {
  const handle = await startAiGenerationLog({
    ...options,
    modelType: AI_GENERATION_MODEL_TYPE.EMBEDDING,
    purpose: options.purpose ?? 'embedding',
    streamed: false
  })

  try {
    const result = await options.run()
    await finishAiGenerationLog(handle, {
      inputChars: options.inputChars,
      embeddingItems: options.embeddingItems
    })
    return result
  } catch (error: unknown) {
    await failAiGenerationLog(handle, error)
    throw error
  }
}
