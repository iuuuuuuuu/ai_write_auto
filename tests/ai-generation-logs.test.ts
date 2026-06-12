import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AI_GENERATION_LOG_STATUS,
  calculateEstimatedCost,
  failAiGenerationLog,
  finishAiGenerationLog,
  markFirstToken,
  recordEmbeddingCall,
  startAiGenerationLog
} from '../server/utils/ai-generation-logs'

function createFakeStore() {
  const records: Array<Record<string, unknown>> = []
  const store = {
    create: vi.fn((_schema: unknown, data: Record<string, unknown>) => {
      const record = { id: records.length + 1, ...data }
      records.push(record)
      return record
    }),
    findOne: vi.fn(),
    flush: vi.fn(async () => undefined)
  }

  return { records, store }
}

describe('ai-generation-logs', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('records successful AI metadata without prompt or output text', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-10T10:00:00.000Z'))
    const { records, store } = createFakeStore()
    store.findOne.mockResolvedValue({
      inputCostPer1k: '0.001',
      outputCostPer1k: '0.002'
    })

    const handle = await startAiGenerationLog({
      store,
      userId: 7,
      configId: 9,
      modelId: 3,
      model: 'gpt-test',
      modelType: 'chat_completion',
      purpose: 'generation',
      scenario: 'chapter_generate',
      source: 'api_route',
      endpoint: '/api/ai/generate',
      streamed: true,
      requestId: 'req_1',
      inputChars: 36
    })

    vi.setSystemTime(new Date('2026-06-10T10:00:00.250Z'))
    await markFirstToken(handle)
    vi.setSystemTime(new Date('2026-06-10T10:00:01.000Z'))
    await finishAiGenerationLog(handle, {
      tokensInput: 1200,
      tokensOutput: 800,
      inputChars: 36,
      outputChars: 2800
    })

    expect(records).toHaveLength(1)
    const [record] = records
    expect(record.status).toBe(AI_GENERATION_LOG_STATUS.SUCCESS)
    expect(record.user).toBe(7)
    expect(record.aiConfig).toBe(9)
    expect(record.aiModel).toBe(3)
    expect(record.model).toBe('gpt-test')
    expect(record.modelType).toBe('chat_completion')
    expect(record.scenario).toBe('chapter_generate')
    expect(record.streamed).toBe(true)
    expect(record.tokensInput).toBe(1200)
    expect(record.tokensOutput).toBe(800)
    expect(record.inputChars).toBe(36)
    expect(record.outputChars).toBe(2800)
    expect(record.firstTokenLatencyMs).toBe(250)
    expect(record.durationMs).toBe(1000)
    expect(record.estimatedCost).toBe('0.002800')
    expect(JSON.stringify(record)).not.toContain('secret prompt')
    expect(JSON.stringify(record)).not.toContain('secret output')
  })

  it('records failures without throwing over the original error path', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-10T11:00:00.000Z'))
    const { records, store } = createFakeStore()

    const handle = await startAiGenerationLog({
      store,
      userId: 4,
      model: 'gpt-test',
      modelType: 'connectivity_check',
      purpose: 'planning',
      scenario: 'model_connectivity_check',
      source: 'api_route',
      endpoint: '/api/ai/models-test',
      streamed: false
    })

    vi.setSystemTime(new Date('2026-06-10T11:00:02.400Z'))
    await expect(
      failAiGenerationLog(handle, new TypeError('network timeout'))
    ).resolves.toBeUndefined()

    expect(records).toHaveLength(1)
    const [record] = records
    expect(record.status).toBe(AI_GENERATION_LOG_STATUS.FAILED)
    expect(record.errorMessage).toBe('network timeout')
    expect(record.errorType).toBe('TypeError')
    expect(record.durationMs).toBe(2400)
  })

  it('records first response latency for non-streamed output at finish time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-10T11:30:00.000Z'))
    const { records, store } = createFakeStore()

    const handle = await startAiGenerationLog({
      store,
      userId: 7,
      model: 'gpt-test',
      modelType: 'chat_completion',
      purpose: 'generation',
      scenario: 'worldbuilding_generate',
      source: 'api_route',
      endpoint: '/api/ai/worldbuilding',
      streamed: false,
      inputChars: 24
    })

    vi.setSystemTime(new Date('2026-06-10T11:30:01.250Z'))
    await finishAiGenerationLog(handle, {
      tokensInput: 320,
      tokensOutput: 180,
      inputChars: 24,
      outputChars: 420
    })

    expect(records).toHaveLength(1)
    const [record] = records
    expect(record.firstTokenLatencyMs).toBe(1250)
    expect(record.durationMs).toBe(1250)
  })

  it('calculates estimated cost from per-1k rates', () => {
    expect(
      calculateEstimatedCost({
        tokensInput: 1200,
        tokensOutput: 800,
        inputCostPer1k: '0.001',
        outputCostPer1k: '0.002'
      })
    ).toBe('0.002800')
  })

  it('wraps embedding calls with measurable metadata only', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'))
    const { records, store } = createFakeStore()

    const result = await recordEmbeddingCall({
      store,
      userId: 7,
      model: 'Xenova/bge-small-zh-v1.5',
      scenario: 'embedding_query',
      source: 'service',
      inputChars: '秘密查询文本'.length,
      embeddingItems: 1,
      run: async () => {
        vi.setSystemTime(new Date('2026-06-10T12:00:00.120Z'))
        return new Float32Array([0.1, 0.2])
      }
    })

    expect(result[0]).toBeCloseTo(0.1)
    expect(result[1]).toBeCloseTo(0.2)
    expect(records).toHaveLength(1)
    const [record] = records
    expect(record.status).toBe(AI_GENERATION_LOG_STATUS.SUCCESS)
    expect(record.modelType).toBe('embedding')
    expect(record.scenario).toBe('embedding_query')
    expect(record.tokensInput).toBe(0)
    expect(record.tokensOutput).toBe(0)
    expect(record.inputChars).toBe(6)
    expect(record.embeddingItems).toBe(1)
    expect(record.durationMs).toBe(120)
    expect(JSON.stringify(record)).not.toContain('秘密查询文本')
  })
})
