import { queryAiGenerationLogStats } from '../../utils/ai-generation-log-stats'

function parseOptionalInt(value: unknown): number | null {
  if (!value) return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const em = useEm(event)
  const query = getQuery(event)
  const pagination = parsePagination(event)
  const days = Math.min(
    365,
    Math.max(1, Number.parseInt(String(query.days || '30'), 10) || 30)
  )
  const since = new Date()
  since.setDate(since.getDate() - days)

  const result = await queryAiGenerationLogStats(
    em,
    {
      since,
      userId: parseOptionalInt(query.userId),
      status: parseOptionalString(query.status),
      purpose: parseOptionalString(query.purpose),
      scenario: parseOptionalString(query.scenario),
      model: parseOptionalString(query.model),
      modelType: parseOptionalString(query.modelType),
      source: parseOptionalString(query.source),
      novelId: parseOptionalInt(query.novelId),
      taskId: parseOptionalInt(query.taskId),
      includeEmbeddings: query.includeEmbeddings !== 'false'
    },
    pagination
  )

  return {
    ...paginatedResult(result.items, result.total, pagination),
    summary: result.summary,
    aggregates: {
      byUser: result.byUser,
      byModel: result.byModel,
      byScenario: result.byScenario,
      byStatus: result.byStatus
    }
  }
})
