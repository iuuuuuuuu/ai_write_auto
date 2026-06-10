import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockStartLog, mockFirstToken, mockFinishLog, mockFailLog } = vi.hoisted(
  () => ({
    mockStartLog: vi.fn(),
    mockFirstToken: vi.fn(),
    mockFinishLog: vi.fn(),
    mockFailLog: vi.fn()
  })
)

vi.mock('../server/utils/ai-generation-logs', () => ({
  startAiGenerationLog: mockStartLog,
  markFirstToken: mockFirstToken,
  finishAiGenerationLog: mockFinishLog,
  failAiGenerationLog: mockFailLog,
  AI_GENERATION_MODEL_TYPE: {
    CHAT_COMPLETION: 'chat_completion',
    EMBEDDING: 'embedding',
    CONNECTIVITY_CHECK: 'connectivity_check'
  },
  AI_GENERATION_SOURCE: {
    API_ROUTE: 'api_route',
    SERVICE: 'service',
    BACKGROUND_TASK: 'background_task',
    STARTUP: 'startup',
    UNCLASSIFIED: 'unclassified'
  }
}))

import { callAi, callAiWithUsage, streamAi } from '../server/utils/ai-client'

const logHandle = { tag: 'log-handle' }

describe('ai-client request options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStartLog.mockResolvedValue(logHandle)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends top_p and thinking controls in the request body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    await callAi({
      apiUrl: 'https://example.com/v1/chat/completions',
      apiKey: 'secret',
      model: 'mimo-v2.5-pro',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 1,
      topP: 0.95,
      thinkingEnabled: true,
      reasoningEffort: 'high',
      maxTokens: 100
    })

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(String(init.body))

    expect(body.temperature).toBe(1)
    expect(body.top_p).toBe(0.95)
    expect(body.enable_thinking).toBe(true)
    expect(body.reasoning_effort).toBe('high')
  })

  it('records non-streaming token usage metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '标题' } }],
          usage: { prompt_tokens: 12, completion_tokens: 3 }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await callAiWithUsage({
      apiUrl: 'https://example.com/v1/chat/completions',
      apiKey: 'secret',
      model: 'gpt-test',
      modelId: 3,
      messages: [{ role: 'user', content: '生成标题' }],
      tracking: {
        userId: 7,
        configId: 9,
        purpose: 'generation',
        scenario: 'suggest_title',
        source: 'api_route',
        endpoint: '/api/ai/suggest-title'
      }
    })

    expect(result).toEqual({
      content: '标题',
      inputTokens: 12,
      outputTokens: 3
    })
    expect(mockStartLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        configId: 9,
        modelId: 3,
        model: 'gpt-test',
        purpose: 'generation',
        scenario: 'suggest_title',
        source: 'api_route',
        endpoint: '/api/ai/suggest-title',
        streamed: false,
        inputChars: 4
      })
    )
    expect(mockFinishLog).toHaveBeenCalledWith(logHandle, {
      tokensInput: 12,
      tokensOutput: 3,
      inputChars: 4,
      outputChars: 2
    })
    expect(mockFailLog).not.toHaveBeenCalled()
  })

  it('records plain non-streaming token usage when provider returns usage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'pong' } }],
          usage: { prompt_tokens: 5, completion_tokens: 2 }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await callAi({
      apiUrl: 'https://example.com/v1/chat/completions',
      apiKey: 'secret',
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'ping' }],
      tracking: {
        userId: 7,
        purpose: 'planning',
        scenario: 'model_connectivity_check',
        source: 'api_route',
        endpoint: '/api/ai/status'
      }
    })

    expect(result).toBe('pong')
    expect(mockFinishLog).toHaveBeenCalledWith(logHandle, {
      tokensInput: 5,
      tokensOutput: 2,
      inputChars: 4,
      outputChars: 4
    })
    expect(mockFailLog).not.toHaveBeenCalled()
  })

  it('records non-streaming failures and rethrows the original error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('bad gateway', { status: 502 }))
    )

    await expect(
      callAi({
        apiUrl: 'https://example.com/v1/chat/completions',
        apiKey: 'secret',
        model: 'gpt-test',
        messages: [{ role: 'user', content: 'ping' }],
        tracking: {
          userId: 7,
          purpose: 'planning',
          scenario: 'model_connectivity_check',
          source: 'api_route',
          endpoint: '/api/ai/models-test'
        }
      })
    ).rejects.toThrow('AI API error (502): bad gateway')

    expect(mockFailLog).toHaveBeenCalledTimes(1)
    expect(mockFailLog).toHaveBeenCalledWith(logHandle, expect.any(Error))
    expect(mockFinishLog).not.toHaveBeenCalled()
  })

  it('records streaming metadata when visible content arrives', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n')
        )
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}],"usage":{"prompt_tokens":6,"completion_tokens":2}}\n\n'
          )
        )
        controller.close()
      }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    )

    const chunks = []
    for await (const chunk of streamAi({
      apiUrl: 'https://example.com/v1/chat/completions',
      apiKey: 'secret',
      model: 'gpt-test',
      messages: [{ role: 'user', content: '你好' }],
      tracking: {
        userId: 7,
        purpose: 'generation',
        scenario: 'chapter_generate',
        source: 'api_route',
        endpoint: '/api/ai/generate'
      }
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { content: '你', done: false, usage: undefined },
      {
        content: '好',
        done: false,
        usage: { prompt_tokens: 6, completion_tokens: 2 }
      },
      {
        content: '',
        done: true,
        truncated: false,
        usage: { prompt_tokens: 6, completion_tokens: 2 }
      }
    ])
    expect(mockStartLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        model: 'gpt-test',
        scenario: 'chapter_generate',
        streamed: true,
        inputChars: 2
      })
    )
    expect(mockFirstToken).toHaveBeenCalledTimes(1)
    expect(mockFirstToken).toHaveBeenCalledWith(logHandle)
    expect(mockFinishLog).toHaveBeenCalledWith(logHandle, {
      tokensInput: 6,
      tokensOutput: 2,
      inputChars: 2,
      outputChars: 2
    })
    expect(mockFailLog).not.toHaveBeenCalled()
  })
})
