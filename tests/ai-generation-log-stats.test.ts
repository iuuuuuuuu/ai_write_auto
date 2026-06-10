import { describe, expect, it } from 'vitest'
import {
  buildAiGenerationLogSqlWhere,
  normalizeAiGenerationLogSummaryRow
} from '../server/utils/ai-generation-log-stats'

describe('ai-generation-log-stats', () => {
  it('builds SQL filters for user, model type, scenario and embedding exclusion', () => {
    const since = new Date('2026-06-10T00:00:00.000Z')
    const where = buildAiGenerationLogSqlWhere({
      since,
      userId: 7,
      status: 'success',
      scenario: 'chapter_generate',
      modelType: null,
      includeEmbeddings: false
    })

    expect(where.clause).toBe(
      'started_at >= ? AND user_id = ? AND status = ? AND scenario = ? AND model_type != ?'
    )
    expect(where.params).toEqual([
      Math.floor(since.getTime() / 1000),
      7,
      'success',
      'chapter_generate',
      'embedding'
    ])
  })

  it('normalizes summary rows into measurable totals and rates', () => {
    const summary = normalizeAiGenerationLogSummaryRow({
      total_calls: '10',
      success_calls: '7',
      failed_calls: '2',
      cancelled_calls: '1',
      total_input_tokens: '1200',
      total_output_tokens: '800',
      total_cost: '0.0028',
      embedding_calls: '3',
      embedding_input_chars: '240',
      avg_first_token_latency_ms: '123.4',
      avg_duration_ms: '456.7'
    })

    expect(summary).toEqual({
      totalCalls: 10,
      successCalls: 7,
      failedCalls: 2,
      cancelledCalls: 1,
      successRate: 0.7,
      totalInputTokens: 1200,
      totalOutputTokens: 800,
      totalTokens: 2000,
      totalCost: '0.002800',
      embeddingCalls: 3,
      embeddingInputChars: 240,
      avgFirstTokenLatencyMs: 123.4,
      avgDurationMs: 456.7,
      p95FirstTokenLatencyMs: null,
      p95DurationMs: null
    })
  })
})
