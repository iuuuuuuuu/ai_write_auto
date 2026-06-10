import { afterEach, describe, expect, it, vi } from 'vitest'
import { callAi } from '../server/utils/ai-client'

describe('ai-client request options', () => {
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
})
