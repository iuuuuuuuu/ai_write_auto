import {
  AiGenerationLogSchema,
  type AiGenerationLog
} from '../database/entities'
import type { PaginationParams } from './pagination'

export interface AiGenerationLogQueryFilters {
  since: Date
  userId?: number | null
  status?: string | null
  purpose?: string | null
  scenario?: string | null
  model?: string | null
  modelType?: string | null
  source?: string | null
  novelId?: number | null
  taskId?: number | null
  includeEmbeddings?: boolean
}

export interface AiGenerationLogSqlWhere {
  clause: string
  params: Array<number | string>
}

export interface AiGenerationLogSummary {
  totalCalls: number
  successCalls: number
  failedCalls: number
  cancelledCalls: number
  successRate: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: string
  embeddingCalls: number
  embeddingInputChars: number
  avgFirstTokenLatencyMs: number | null
  avgDurationMs: number | null
  p95FirstTokenLatencyMs: number | null
  p95DurationMs: number | null
}

export interface AiGenerationLogItem {
  id: number
  userId: number | null
  username: string | null
  model: string
  modelType: string
  providerName: string | null
  purpose: string
  scenario: string
  endpoint: string | null
  source: string
  status: string
  errorMessage: string | null
  errorType: string | null
  tokensInput: number
  tokensOutput: number
  estimatedCost: string | null
  inputChars: number
  outputChars: number
  embeddingItems: number
  startedAt: Date
  firstTokenAt: Date | null
  endedAt: Date | null
  firstTokenLatencyMs: number | null
  durationMs: number | null
  streamed: boolean
  requestId: string | null
  parentRequestId: string | null
  novelId: number | null
  chapterId: number | null
  taskId: number | null
}

export interface AiGenerationLogAggregateRow {
  key: string
  label: string
  userId?: number | null
  username?: string | null
  totalCalls: number
  successCalls: number
  failedCalls: number
  successRate: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: string
  embeddingCalls: number
  avgFirstTokenLatencyMs: number | null
  avgDurationMs: number | null
  lastStartedAt: string | null
}

export interface AiGenerationLogStatsResult {
  items: AiGenerationLogItem[]
  total: number
  summary: AiGenerationLogSummary
  byUser: AiGenerationLogAggregateRow[]
  byModel: AiGenerationLogAggregateRow[]
  byScenario: AiGenerationLogAggregateRow[]
  byStatus: AiGenerationLogAggregateRow[]
}

type EntityManagerLike = {
  find: typeof import('@mikro-orm/core').EntityManager.prototype.find
  count: typeof import('@mikro-orm/core').EntityManager.prototype.count
  getConnection: typeof import('@mikro-orm/core').EntityManager.prototype.getConnection
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = toFiniteNumber(value)
  return Number.isFinite(parsed) ? parsed : null
}

function roundNullable(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = toFiniteNumber(value)
  return Number.isFinite(parsed) ? Number(parsed.toFixed(1)) : null
}

function normalizeCost(value: unknown): string {
  return toFiniteNumber(value).toFixed(6)
}

function estimateTokensByChars(chars: number): number {
  return Math.ceil(Math.max(0, chars) * 1.8)
}

function needsTokenEstimate(
  log: Pick<
    AiGenerationLog,
    | 'status'
    | 'modelType'
    | 'streamed'
    | 'tokensInput'
    | 'tokensOutput'
    | 'inputChars'
    | 'outputChars'
  >
): boolean {
  return (
    String(log.status ?? '') === 'success' &&
    String(log.modelType ?? '') === 'chat_completion' &&
    Boolean(log.streamed) &&
    toFiniteNumber(log.tokensInput) === 0 &&
    toFiniteNumber(log.tokensOutput) === 0 &&
    (toFiniteNumber(log.inputChars) > 0 || toFiniteNumber(log.outputChars) > 0)
  )
}

function resolveTokenValue(
  tokenValue: unknown,
  charValue: unknown,
  shouldEstimate: boolean
): number {
  const tokens = toFiniteNumber(tokenValue)
  if (tokens || !shouldEstimate) return tokens
  return estimateTokensByChars(toFiniteNumber(charValue))
}

function getEntityId(entity: unknown): number | null {
  if (entity === null || entity === undefined) return null
  if (typeof entity === 'number') return entity
  if (entity && typeof entity === 'object' && 'id' in entity) {
    return nullableNumber((entity as { id: unknown }).id)
  }
  return nullableNumber(entity)
}

function getUsername(entity: unknown): string | null {
  if (entity && typeof entity === 'object' && 'username' in entity) {
    const username = (entity as { username: unknown }).username
    return typeof username === 'string' ? username : null
  }
  return null
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

function addStringFilter(
  conditions: string[],
  params: Array<number | string>,
  column: string,
  value: string | null | undefined
): void {
  if (!value || value === 'all') return
  conditions.push(`${column} = ?`)
  params.push(value)
}

function addNumberFilter(
  conditions: string[],
  params: Array<number | string>,
  column: string,
  value: number | null | undefined
): void {
  if (!value) return
  conditions.push(`${column} = ?`)
  params.push(value)
}

export function buildAiGenerationLogSqlWhere(
  filters: AiGenerationLogQueryFilters
): AiGenerationLogSqlWhere {
  const conditions = ['started_at >= ?']
  const params: Array<number | string> = [toUnixSeconds(filters.since)]

  addNumberFilter(conditions, params, 'user_id', filters.userId)
  addStringFilter(conditions, params, 'status', filters.status)
  addStringFilter(conditions, params, 'purpose', filters.purpose)
  addStringFilter(conditions, params, 'scenario', filters.scenario)
  addStringFilter(conditions, params, 'model', filters.model)
  addStringFilter(conditions, params, 'model_type', filters.modelType)
  addStringFilter(conditions, params, 'source', filters.source)
  addNumberFilter(conditions, params, 'novel_id', filters.novelId)
  addNumberFilter(conditions, params, 'generation_task_id', filters.taskId)

  if (filters.includeEmbeddings === false && !filters.modelType) {
    conditions.push('model_type != ?')
    params.push('embedding')
  }

  return { clause: conditions.join(' AND '), params }
}

export function normalizeAiGenerationLogSummaryRow(
  row: Record<string, unknown> | null | undefined
): AiGenerationLogSummary {
  const totalCalls = toFiniteNumber(row?.total_calls)
  const successCalls = toFiniteNumber(row?.success_calls)
  const failedCalls = toFiniteNumber(row?.failed_calls)
  const cancelledCalls = toFiniteNumber(row?.cancelled_calls)
  const totalInputTokens =
    toFiniteNumber(row?.total_input_tokens) +
    estimateTokensByChars(toFiniteNumber(row?.fallback_input_chars))
  const totalOutputTokens =
    toFiniteNumber(row?.total_output_tokens) +
    estimateTokensByChars(toFiniteNumber(row?.fallback_output_chars))

  return {
    totalCalls,
    successCalls,
    failedCalls,
    cancelledCalls,
    successRate:
      totalCalls ? Number((successCalls / totalCalls).toFixed(4)) : 0,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost: normalizeCost(row?.total_cost),
    embeddingCalls: toFiniteNumber(row?.embedding_calls),
    embeddingInputChars: toFiniteNumber(row?.embedding_input_chars),
    avgFirstTokenLatencyMs: roundNullable(row?.avg_first_token_latency_ms),
    avgDurationMs: roundNullable(row?.avg_duration_ms),
    p95FirstTokenLatencyMs: roundNullable(row?.p95_first_token_latency_ms),
    p95DurationMs: roundNullable(row?.p95_duration_ms)
  }
}

function normalizeAggregateRow(
  row: Record<string, unknown>,
  labelFallback = '未分类'
): AiGenerationLogAggregateRow {
  const totalCalls = toFiniteNumber(row.total_calls)
  const successCalls = toFiniteNumber(row.success_calls)
  const totalInputTokens =
    toFiniteNumber(row.total_input_tokens) +
    estimateTokensByChars(toFiniteNumber(row.fallback_input_chars))
  const totalOutputTokens =
    toFiniteNumber(row.total_output_tokens) +
    estimateTokensByChars(toFiniteNumber(row.fallback_output_chars))
  const key = String(row.key ?? labelFallback)

  return {
    key,
    label: String(row.label ?? row.username ?? row.key ?? labelFallback),
    userId: nullableNumber(row.user_id),
    username: typeof row.username === 'string' ? row.username : null,
    totalCalls,
    successCalls,
    failedCalls: toFiniteNumber(row.failed_calls),
    successRate:
      totalCalls ? Number((successCalls / totalCalls).toFixed(4)) : 0,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost: normalizeCost(row.total_cost),
    embeddingCalls: toFiniteNumber(row.embedding_calls),
    avgFirstTokenLatencyMs: roundNullable(row.avg_first_token_latency_ms),
    avgDurationMs: roundNullable(row.avg_duration_ms),
    lastStartedAt:
      row.last_started_at === null || row.last_started_at === undefined ?
        null
      : new Date(toFiniteNumber(row.last_started_at) * 1000).toISOString()
  }
}

function buildOrmFilter(filters: AiGenerationLogQueryFilters) {
  const filter: Record<string, unknown> = { startedAt: { $gte: filters.since } }
  if (filters.userId) filter.user = filters.userId
  if (filters.status && filters.status !== 'all') filter.status = filters.status
  if (filters.purpose && filters.purpose !== 'all')
    filter.purpose = filters.purpose
  if (filters.scenario && filters.scenario !== 'all')
    filter.scenario = filters.scenario
  if (filters.model && filters.model !== 'all') filter.model = filters.model
  if (filters.modelType && filters.modelType !== 'all')
    filter.modelType = filters.modelType
  if (filters.source && filters.source !== 'all') filter.source = filters.source
  if (filters.novelId) filter.novel = filters.novelId
  if (filters.taskId) filter.generationTask = filters.taskId
  if (filters.includeEmbeddings === false && !filters.modelType) {
    filter.modelType = { $ne: 'embedding' }
  }
  return filter
}

function toItem(log: AiGenerationLog): AiGenerationLogItem {
  const shouldEstimateTokens = needsTokenEstimate(log)
  const tokensInput = resolveTokenValue(
    log.tokensInput,
    log.inputChars,
    shouldEstimateTokens
  )
  const tokensOutput = resolveTokenValue(
    log.tokensOutput,
    log.outputChars,
    shouldEstimateTokens
  )
  const durationMs = nullableNumber(log.durationMs)
  const firstTokenLatencyMs =
    nullableNumber(log.firstTokenLatencyMs) ??
    ((
      String(log.status ?? '') === 'success' &&
      !Boolean(log.streamed) &&
      toFiniteNumber(log.outputChars) > 0
    ) ?
      durationMs
    : null)

  return {
    id: toFiniteNumber(log.id),
    userId: getEntityId(log.user),
    username: getUsername(log.user),
    model: String(log.model ?? ''),
    modelType: String(log.modelType ?? ''),
    providerName:
      typeof log.providerName === 'string' ? log.providerName : null,
    purpose: String(log.purpose ?? ''),
    scenario: String(log.scenario ?? ''),
    endpoint: typeof log.endpoint === 'string' ? log.endpoint : null,
    source: String(log.source ?? ''),
    status: String(log.status ?? ''),
    errorMessage:
      typeof log.errorMessage === 'string' ? log.errorMessage : null,
    errorType: typeof log.errorType === 'string' ? log.errorType : null,
    tokensInput,
    tokensOutput,
    estimatedCost:
      typeof log.estimatedCost === 'string' ? log.estimatedCost : null,
    inputChars: toFiniteNumber(log.inputChars),
    outputChars: toFiniteNumber(log.outputChars),
    embeddingItems: toFiniteNumber(log.embeddingItems),
    startedAt: log.startedAt instanceof Date ? log.startedAt : new Date(),
    firstTokenAt: log.firstTokenAt instanceof Date ? log.firstTokenAt : null,
    endedAt: log.endedAt instanceof Date ? log.endedAt : null,
    firstTokenLatencyMs,
    durationMs,
    streamed: Boolean(log.streamed),
    requestId: typeof log.requestId === 'string' ? log.requestId : null,
    parentRequestId:
      typeof log.parentRequestId === 'string' ? log.parentRequestId : null,
    novelId: getEntityId(log.novel),
    chapterId: getEntityId(log.chapter),
    taskId: getEntityId(log.generationTask)
  }
}

async function runRows(
  em: EntityManagerLike,
  sql: string,
  params: Array<number | string>
): Promise<Array<Record<string, unknown>>> {
  const rows = await em.getConnection().execute(sql, params)
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : []
}

async function querySummary(
  em: EntityManagerLike,
  where: AiGenerationLogSqlWhere
): Promise<AiGenerationLogSummary> {
  const rows = await runRows(
    em,
    `SELECT COUNT(*) as total_calls,
            COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END),0) as success_calls,
            COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),0) as failed_calls,
            COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END),0) as cancelled_calls,
            COALESCE(SUM(tokens_input),0) as total_input_tokens,
            COALESCE(SUM(tokens_output),0) as total_output_tokens,
            COALESCE(SUM(CASE WHEN status = 'success' AND model_type = 'chat_completion' AND streamed = 1 AND tokens_input = 0 AND tokens_output = 0 THEN input_chars ELSE 0 END),0) as fallback_input_chars,
            COALESCE(SUM(CASE WHEN status = 'success' AND model_type = 'chat_completion' AND streamed = 1 AND tokens_input = 0 AND tokens_output = 0 THEN output_chars ELSE 0 END),0) as fallback_output_chars,
            COALESCE(SUM(CASE WHEN estimated_cost IS NOT NULL THEN CAST(estimated_cost AS REAL) ELSE 0 END),0) as total_cost,
            COALESCE(SUM(CASE WHEN model_type = 'embedding' THEN 1 ELSE 0 END),0) as embedding_calls,
            COALESCE(SUM(CASE WHEN model_type = 'embedding' THEN input_chars ELSE 0 END),0) as embedding_input_chars,
            AVG(first_token_latency_ms) as avg_first_token_latency_ms,
            AVG(duration_ms) as avg_duration_ms
     FROM ai_generation_logs WHERE ${where.clause}`,
    where.params
  )
  return normalizeAiGenerationLogSummaryRow(rows[0])
}

async function queryAggregate(
  em: EntityManagerLike,
  where: AiGenerationLogSqlWhere,
  keySql: string,
  labelSql: string,
  extraSelect = '',
  joins = '',
  limit = 20
): Promise<AiGenerationLogAggregateRow[]> {
  const rows = await runRows(
    em,
    `SELECT ${keySql} as key,
            ${labelSql} as label
            ${extraSelect},
            COUNT(*) as total_calls,
            COALESCE(SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END),0) as success_calls,
            COALESCE(SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END),0) as failed_calls,
            COALESCE(SUM(l.tokens_input),0) as total_input_tokens,
            COALESCE(SUM(l.tokens_output),0) as total_output_tokens,
            COALESCE(SUM(CASE WHEN l.status = 'success' AND l.model_type = 'chat_completion' AND l.streamed = 1 AND l.tokens_input = 0 AND l.tokens_output = 0 THEN l.input_chars ELSE 0 END),0) as fallback_input_chars,
            COALESCE(SUM(CASE WHEN l.status = 'success' AND l.model_type = 'chat_completion' AND l.streamed = 1 AND l.tokens_input = 0 AND l.tokens_output = 0 THEN l.output_chars ELSE 0 END),0) as fallback_output_chars,
            COALESCE(SUM(CASE WHEN l.estimated_cost IS NOT NULL THEN CAST(l.estimated_cost AS REAL) ELSE 0 END),0) as total_cost,
            COALESCE(SUM(CASE WHEN l.model_type = 'embedding' THEN 1 ELSE 0 END),0) as embedding_calls,
            AVG(l.first_token_latency_ms) as avg_first_token_latency_ms,
            AVG(l.duration_ms) as avg_duration_ms,
            MAX(l.started_at) as last_started_at
     FROM ai_generation_logs l
     ${joins}
     WHERE ${where.clause.replace(/\b([a-z_]+)\b/g, (match) => {
       if (match.includes('.')) return match
       if (match === 'AND' || match === 'OR') return match
       if (match === 'NULL') return match
       return `l.${match}`
     })}
     GROUP BY ${keySql}, ${labelSql}
     ORDER BY total_calls DESC
     LIMIT ${limit}`,
    where.params
  )
  return rows.map((row) => normalizeAggregateRow(row))
}

export async function queryAiGenerationLogStats(
  em: EntityManagerLike,
  filters: AiGenerationLogQueryFilters,
  pagination: PaginationParams
): Promise<AiGenerationLogStatsResult> {
  const ormFilter = buildOrmFilter(filters)
  const where = buildAiGenerationLogSqlWhere(filters)
  const [logs, total, summary, byUser, byModel, byScenario, byStatus] =
    await Promise.all([
      em.find(AiGenerationLogSchema, ormFilter, {
        limit: pagination.limit,
        offset: pagination.offset,
        orderBy: { startedAt: 'DESC' },
        populate: ['user']
      }),
      em.count(AiGenerationLogSchema, ormFilter),
      querySummary(em, where),
      queryAggregate(
        em,
        where,
        'COALESCE(l.user_id, 0)',
        "COALESCE(u.username, '未知用户')",
        ', l.user_id as user_id, u.username as username',
        'LEFT JOIN users u ON u.id = l.user_id',
        50
      ),
      queryAggregate(em, where, 'l.model', 'l.model', '', '', 50),
      queryAggregate(em, where, 'l.scenario', 'l.scenario', '', '', 80),
      queryAggregate(em, where, 'l.status', 'l.status', '', '', 20)
    ])

  return {
    items: logs.map((log) => toItem(log)),
    total,
    summary,
    byUser,
    byModel,
    byScenario,
    byStatus
  }
}
