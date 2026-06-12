import { describe, expect, it } from 'vitest'
import {
  buildAiGenerationLogSqlWhere,
  normalizeAiGenerationLogSummaryRow,
  queryAiGenerationLogStats
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

  it('uses SQL string literals for unknown user aggregate fallback', async () => {
    const executedSql: string[] = []
    const em = {
      find: async () => [],
      count: async () => 0,
      getConnection: () => ({
        execute: async (sql: string) => {
          executedSql.push(sql)
          return []
        }
      })
    }

    await queryAiGenerationLogStats(
      em as Parameters<typeof queryAiGenerationLogStats>[0],
      { since: new Date('2026-06-10T00:00:00.000Z'), userId: 1 },
      { page: 1, pageSize: 20, limit: 20, offset: 0 }
    )

    const aggregateSql = executedSql.find((sql) => sql.includes('users u'))
    expect(aggregateSql).toContain("COALESCE(u.username, '未知用户')")
    expect(aggregateSql).not.toContain('COALESCE(u.username, "未知用户")')
  })

  it('estimates missing tokens for historical successful streaming chat logs', async () => {
    const executedSql: string[] = []
    const em = {
      find: async () => [
        {
          id: 17,
          user: { id: 1, username: 'admin' },
          model: 'mimo-v2.5-pro',
          modelType: 'chat_completion',
          providerName: null,
          purpose: 'generation',
          scenario: 'worldbuilding_generate',
          endpoint: '/api/ai/worldbuilding',
          source: 'api_route',
          status: 'success',
          errorMessage: null,
          errorType: null,
          tokensInput: 0,
          tokensOutput: 0,
          estimatedCost: null,
          inputChars: 407,
          outputChars: 467,
          embeddingItems: 0,
          startedAt: new Date('2026-06-11T03:55:50.000Z'),
          firstTokenAt: new Date('2026-06-11T03:56:34.000Z'),
          endedAt: new Date('2026-06-11T03:56:44.000Z'),
          firstTokenLatencyMs: 44491,
          durationMs: 54660,
          streamed: true,
          requestId: null,
          parentRequestId: null,
          novel: null,
          chapter: null,
          generationTask: null
        }
      ],
      count: async () => 1,
      getConnection: () => ({
        execute: async (sql: string) => {
          executedSql.push(sql)
          if (!sql.includes('GROUP BY')) {
            return [
              {
                total_calls: 1,
                success_calls: 1,
                failed_calls: 0,
                cancelled_calls: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                fallback_input_chars: 407,
                fallback_output_chars: 467,
                total_cost: 0,
                embedding_calls: 0,
                embedding_input_chars: 0,
                avg_first_token_latency_ms: 44491,
                avg_duration_ms: 54660
              }
            ]
          }
          return [
            {
              key: 'worldbuilding_generate',
              label: 'worldbuilding_generate',
              total_calls: 1,
              success_calls: 1,
              failed_calls: 0,
              total_input_tokens: 0,
              total_output_tokens: 0,
              fallback_input_chars: 407,
              fallback_output_chars: 467,
              total_cost: 0,
              embedding_calls: 0,
              avg_first_token_latency_ms: 44491,
              avg_duration_ms: 54660,
              last_started_at: 1781130950
            }
          ]
        }
      })
    }

    const result = await queryAiGenerationLogStats(
      em as Parameters<typeof queryAiGenerationLogStats>[0],
      { since: new Date('2026-06-10T00:00:00.000Z'), userId: 1 },
      { page: 1, pageSize: 20, limit: 20, offset: 0 }
    )

    expect(result.items[0]?.tokensInput).toBe(733)
    expect(result.items[0]?.tokensOutput).toBe(841)
    expect(result.summary.totalInputTokens).toBe(733)
    expect(result.summary.totalOutputTokens).toBe(841)
    expect(result.summary.totalTokens).toBe(1574)
    expect(result.byScenario[0]?.totalTokens).toBe(1574)
    expect(executedSql.join('\n')).toContain('fallback_input_chars')
  })

  it('uses duration as first response latency for historical non-streamed output logs', async () => {
    const em = {
      find: async () => [
        {
          id: 18,
          user: { id: 1, username: 'admin' },
          model: 'mimo-v2.5-pro',
          modelType: 'chat_completion',
          providerName: null,
          purpose: 'generation',
          scenario: 'worldbuilding_generate',
          endpoint: '/api/ai/worldbuilding',
          source: 'api_route',
          status: 'success',
          errorMessage: null,
          errorType: null,
          tokensInput: 320,
          tokensOutput: 180,
          estimatedCost: null,
          inputChars: 407,
          outputChars: 467,
          embeddingItems: 0,
          startedAt: new Date('2026-06-11T03:55:50.000Z'),
          firstTokenAt: null,
          endedAt: new Date('2026-06-11T03:56:44.000Z'),
          firstTokenLatencyMs: null,
          durationMs: 54660,
          streamed: false,
          requestId: null,
          parentRequestId: null,
          novel: null,
          chapter: null,
          generationTask: null
        }
      ],
      count: async () => 1,
      getConnection: () => ({
        execute: async () => [
          {
            total_calls: 1,
            success_calls: 1,
            failed_calls: 0,
            cancelled_calls: 0,
            total_input_tokens: 320,
            total_output_tokens: 180,
            fallback_input_chars: 0,
            fallback_output_chars: 0,
            total_cost: 0,
            embedding_calls: 0,
            embedding_input_chars: 0,
            avg_first_token_latency_ms: null,
            avg_duration_ms: 54660
          }
        ]
      })
    }

    const result = await queryAiGenerationLogStats(
      em as Parameters<typeof queryAiGenerationLogStats>[0],
      { since: new Date('2026-06-10T00:00:00.000Z'), userId: 1 },
      { page: 1, pageSize: 20, limit: 20, offset: 0 }
    )

    expect(result.items[0]?.firstTokenLatencyMs).toBe(54660)
  })
})
