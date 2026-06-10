import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockRecordEmbeddingCall } = vi.hoisted(() => ({
  mockRecordEmbeddingCall: vi.fn()
}))

vi.mock('../server/utils/ai-generation-logs', () => ({
  recordEmbeddingCall: mockRecordEmbeddingCall
}))

interface WorkerMessage {
  type: string
  id?: number
  texts?: string[]
}

type WorkerHandler = (message: Record<string, unknown>) => void

class MockWorker {
  private readonly messageHandlers: WorkerHandler[] = []

  postMessage(message: WorkerMessage): void {
    if (message.type === 'load') {
      queueMicrotask(() => this.emit({ type: 'ready', elapsed: 0 }))
      return
    }

    if (message.type === 'embed' && typeof message.id === 'number') {
      const texts = message.texts ?? []
      queueMicrotask(() =>
        this.emit({
          type: 'embed-result',
          id: message.id,
          results: texts.map(() => [0.1, 0.2])
        })
      )
    }
  }

  on(event: string, handler: WorkerHandler): this {
    if (event === 'message') this.messageHandlers.push(handler)
    return this
  }

  unref(): void {}

  async terminate(): Promise<number> {
    return 0
  }

  private emit(message: Record<string, unknown>): void {
    for (const handler of this.messageHandlers) handler(message)
  }
}

vi.mock('node:worker_threads', () => ({
  Worker: MockWorker
}))

describe('embedding service logging', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('records embedding input size and item count without storing text', async () => {
    mockRecordEmbeddingCall.mockImplementation(
      async (options: { run: () => Promise<unknown> }) => await options.run()
    )

    const { embed } = await import('../server/services/embedding')
    const results = await embed(['甲', '乙'], {
      userId: 7,
      scenario: 'embedding_query',
      source: 'service'
    })

    expect(results).toHaveLength(2)
    expect(mockRecordEmbeddingCall).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        model: 'Xenova/bge-small-zh-v1.5',
        scenario: 'embedding_query',
        source: 'service',
        inputChars: 2,
        embeddingItems: 2
      })
    )
    expect(JSON.stringify(mockRecordEmbeddingCall.mock.calls)).not.toContain(
      '甲'
    )
    expect(JSON.stringify(mockRecordEmbeddingCall.mock.calls)).not.toContain(
      '乙'
    )
  })
})
