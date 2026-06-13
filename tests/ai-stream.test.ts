import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock streamAi（collectStream 内部依赖它）；其余 ai-stream 逻辑为纯 TS，无需 mock
const { mockStreamAi } = vi.hoisted(() => ({ mockStreamAi: vi.fn() }))
vi.mock('../server/utils/ai-client', () => ({ streamAi: mockStreamAi }))

import {
  buildTokenBudget,
  collectAiStreamWithUsage,
  createStreamResponse,
  estimateTokens,
  dynamicMaxTokens,
  prepareBudgetedAiOptions,
  trimMessagesToTokenBudget,
  trimToCompleteEnding,
  streamWithContinuation
} from '../server/utils/ai-stream'

/** 造一个 streamAi 的异步生成器：依次 yield 给定 chunk。 */
function fakeStream(chunks: Array<Record<string, any>>) {
  return (async function* () {
    for (const c of chunks) yield c
  })()
}

const opts = {
  apiUrl: 'http://x',
  apiKey: 'k',
  model: 'm',
  messages: [{ role: 'user' as const, content: '写一章' }],
  maxTokens: 100
}

function fakeEvent() {
  const listeners: Record<string, Array<() => void>> = {}
  return {
    node: {
      req: {
        on(event: string, callback: () => void) {
          listeners[event] = [...(listeners[event] || []), callback]
        }
      },
      res: {
        setHeader() {}
      }
    }
  } as any
}

async function readSsePayloads(response: Response) {
  const text = await response.text()
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as Record<string, any>)
}

describe('ai-stream', () => {
  describe('collectAiStreamWithUsage', () => {
    beforeEach(() => vi.clearAllMocks())

    it('通过 streamAi 收集完整内容和 usage', async () => {
      const signal = new AbortController().signal
      mockStreamAi.mockReturnValue(
        fakeStream([
          { content: '第一段', done: false },
          { content: '第二段', done: false },
          {
            content: '',
            done: true,
            usage: { prompt_tokens: 12, completion_tokens: 34 }
          }
        ])
      )

      const result = await collectAiStreamWithUsage(opts, signal)

      expect(mockStreamAi).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true, signal })
      )
      expect(result.content).toBe('第一段第二段')
      expect(result.inputTokens).toBe(12)
      expect(result.outputTokens).toBe(34)
      expect(result.truncated).toBe(false)
    })
  })

  describe('estimateTokens', () => {
    it('estimates Chinese text at ~1.8 tokens per char', () => {
      const text = '这是一段中文测试文本'
      expect(estimateTokens(text)).toBe(Math.ceil(text.length * 1.8))
    })

    it('estimates English text at ~0.4 tokens per char', () => {
      const text = 'This is an English test string'
      expect(estimateTokens(text)).toBe(Math.ceil(text.length * 0.4))
    })

    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })
  })

  describe('dynamicMaxTokens', () => {
    it('区间内取 ceil(估值)', () => {
      expect(dynamicMaxTokens(3000.2, { floor: 1000, cap: 8000 })).toBe(3001)
    })

    it('低于 floor 抬到 floor', () => {
      expect(dynamicMaxTokens(200, { floor: 1000, cap: 8000 })).toBe(1000)
    })

    it('高于 cap 压到 cap', () => {
      expect(dynamicMaxTokens(99999, { floor: 1000, cap: 8000 })).toBe(8000)
    })

    it('非有限值回落到 floor', () => {
      expect(dynamicMaxTokens(NaN, { floor: 2000, cap: 6000 })).toBe(2000)
    })
  })

  describe('buildTokenBudget', () => {
    it('reserves output and safety space inside the context window', () => {
      const result = buildTokenBudget({
        messages: [
          { role: 'system', content: '系统提示' },
          { role: 'user', content: '用户输入'.repeat(1000) }
        ],
        contextWindowTokens: 4096,
        desiredOutputTokens: 2048,
        reserveTokens: 512
      })

      expect(result.contextWindowTokens).toBe(4096)
      expect(result.maxOutputTokens).toBe(2048)
      expect(result.maxInputTokens).toBe(1536)
      expect(result.inputTokensEstimate).toBeGreaterThan(result.maxInputTokens)
      expect(result.inputOverBudget).toBe(true)
    })

    it('shrinks output when the desired output cannot fit the context window', () => {
      const result = buildTokenBudget({
        messages: [{ role: 'user', content: '短输入' }],
        contextWindowTokens: 1200,
        desiredOutputTokens: 2000,
        reserveTokens: 200,
        minOutputTokens: 256
      })

      expect(result.maxOutputTokens).toBe(1000)
      expect(result.maxInputTokens).toBe(0)
      expect(result.outputWasReduced).toBe(true)
    })

    it('preserves a minimum input budget before assigning output tokens', () => {
      const result = buildTokenBudget({
        messages: [{ role: 'user', content: '上下文'.repeat(2000) }],
        contextWindowTokens: 8192,
        desiredOutputTokens: 8000,
        reserveTokens: 1024,
        minOutputTokens: 1024,
        minimumInputTokens: 4096
      })

      expect(result.maxInputTokens).toBe(4096)
      expect(result.maxOutputTokens).toBe(3072)
      expect(result.outputWasReduced).toBe(true)
    })
  })

  describe('trimMessagesToTokenBudget', () => {
    it('keeps system prompt and the tail of long user prompts inside budget', () => {
      const result = trimMessagesToTokenBudget(
        [
          { role: 'system', content: '系统规则：保持风格。' },
          {
            role: 'user',
            content: `小说信息。${'很长的历史上下文。'.repeat(1000)}\n## 生成指令\n请生成完整正文。`
          }
        ],
        900
      )

      expect(result.trimmed).toBe(true)
      expect(result.messages[0]?.content).toBe('系统规则：保持风格。')
      expect(result.messages[1]?.content).toContain(
        '上下文因模型输入预算已裁剪'
      )
      expect(result.messages[1]?.content).toContain('## 生成指令')
      expect(result.inputTokensEstimate).toBeLessThanOrEqual(900)
    })
  })

  describe('prepareBudgetedAiOptions', () => {
    it('returns messages, max output tokens and metadata from one shared budget path', () => {
      const result = prepareBudgetedAiOptions(
        {
          ...opts,
          messages: [
            { role: 'system', content: '系统规则：保持风格。' },
            {
              role: 'user',
              content: `小说信息。${'很长的历史上下文。'.repeat(1000)}\n## 生成指令\n请生成完整正文。`
            }
          ],
          maxTokens: 8000
        },
        {
          contextWindowTokens: 8192,
          desiredOutputTokens: 8000,
          reserveTokens: 1024,
          minOutputTokens: 1024,
          minimumInputTokens: 4096
        }
      )

      expect(result.options.maxTokens).toBe(3072)
      expect(result.budget.maxOutputTokens).toBe(3072)
      expect(result.budget.maxInputTokens).toBe(4096)
      expect(result.budget.inputTrimmed).toBe(true)
      expect(result.options.messages[1]?.content).toContain(
        '上下文因模型输入预算已裁剪'
      )
    })
  })

  describe('trimToCompleteEnding', () => {
    it('剪掉末尾不完整的半句', () => {
      expect(trimToCompleteEnding('他推开门。外面下着')).toBe('他推开门。')
    })

    it('已在句末标点结尾则原样返回', () => {
      expect(trimToCompleteEnding('他推开门。')).toBe('他推开门。')
    })

    it('整段无句末标记则原样返回', () => {
      expect(trimToCompleteEnding('一段没有标点的连续文字')).toBe(
        '一段没有标点的连续文字'
      )
    })

    it('按换行切分段落，丢弃进行中的尾段', () => {
      expect(trimToCompleteEnding('第一段。\n第二段未完')).toBe('第一段。\n')
    })
  })

  describe('streamWithContinuation', () => {
    const signal = new AbortController().signal

    beforeEach(() => vi.clearAllMocks())

    it('未截断且无 targetWords：不续写，只调一次', async () => {
      mockStreamAi.mockReturnValue(
        fakeStream([
          { content: '完整的一章。', done: false },
          {
            content: '',
            done: true,
            truncated: false,
            usage: { prompt_tokens: 10, completion_tokens: 20 }
          }
        ])
      )
      const r = await streamWithContinuation(opts, signal, () => {})
      expect(mockStreamAi).toHaveBeenCalledTimes(1)
      expect(r.fullContent).toBe('完整的一章。')
      expect(r.finalTruncated).toBe(false)
      expect(r.rounds).toBe(0)
      expect(r.inputTokens).toBe(10)
      expect(r.outputTokens).toBe(20)
    })

    it('被截断：续写直至模型自然停止，并拼接 + 累加 usage', async () => {
      let call = 0
      mockStreamAi.mockImplementation(() => {
        call++
        return call === 1 ?
            fakeStream([
              { content: '前半段被截断', done: false },
              {
                content: '',
                done: true,
                truncated: true,
                usage: { prompt_tokens: 10, completion_tokens: 20 }
              }
            ])
          : fakeStream([
              { content: '，后半段补完整。', done: false },
              {
                content: '',
                done: true,
                truncated: false,
                usage: { prompt_tokens: 5, completion_tokens: 8 }
              }
            ])
      })
      const r = await streamWithContinuation(opts, signal, () => {})
      expect(mockStreamAi).toHaveBeenCalledTimes(2)
      expect(r.fullContent).toBe('前半段被截断，后半段补完整。')
      expect(r.finalTruncated).toBe(false)
      expect(r.rounds).toBe(1)
      expect(r.inputTokens).toBe(15)
      expect(r.outputTokens).toBe(28)
    })

    it('续写请求只携带断点前尾段，避免把完整正文反复塞回上下文', async () => {
      const firstContent = `开头。${'中间内容'.repeat(1200)}结尾断在这里`
      let call = 0
      mockStreamAi.mockImplementation(() => {
        call++
        return call === 1 ?
            fakeStream([
              { content: firstContent, done: false },
              { content: '', done: true, truncated: true }
            ])
          : fakeStream([
              { content: '，补完。', done: false },
              { content: '', done: true, truncated: false }
            ])
      })

      await streamWithContinuation(opts, signal, () => {}, {
        continuationTailChars: 120
      })

      const secondCallOptions = mockStreamAi.mock.calls[1]?.[0]
      const assistantMessage = secondCallOptions.messages.find(
        (message: { role: string }) => message.role === 'assistant'
      )
      expect(assistantMessage.content.length).toBeLessThanOrEqual(120)
      expect(assistantMessage.content).not.toContain('开头。')
      expect(assistantMessage.content).toContain('结尾断在这里')
    })

    it('续写请求追加尾段后仍按输入预算裁剪', async () => {
      const firstContent = '第一轮被截断。'
      let call = 0
      mockStreamAi.mockImplementation(() => {
        call++
        return call === 1 ?
            fakeStream([
              { content: firstContent, done: false },
              { content: '', done: true, truncated: true }
            ])
          : fakeStream([
              { content: '第二轮补完。', done: false },
              { content: '', done: true, truncated: false }
            ])
      })

      await streamWithContinuation(
        {
          ...opts,
          messages: [
            { role: 'system', content: '系统规则：保持风格。' },
            {
              role: 'user',
              content: `小说信息。${'很长的历史上下文。'.repeat(1000)}\n## 生成指令\n请生成完整正文。`
            }
          ]
        },
        signal,
        () => {},
        { maxInputTokens: 900 }
      )

      const secondCallOptions = mockStreamAi.mock.calls[1]?.[0]
      const secondInputEstimate = estimateTokens(
        secondCallOptions.messages
          .map((message: { content: string }) => message.content)
          .join('')
      )
      expect(secondInputEstimate).toBeLessThanOrEqual(900)
      expect(secondCallOptions.messages[1]?.content).toContain(
        '上下文因模型输入预算已裁剪'
      )
    })

    it('始终截断：达 maxRounds 停止并把末尾半句剪到完整结尾', async () => {
      // 每轮都给「完整句 + 半句」并 truncated，验证轮数封顶 + trim
      // 注意用 mockImplementation 每次产生新生成器（异步生成器只能迭代一次）
      mockStreamAi.mockImplementation(() =>
        fakeStream([
          { content: '一句完整的话。还有半句', done: false },
          {
            content: '',
            done: true,
            truncated: true,
            usage: { prompt_tokens: 1, completion_tokens: 1 }
          }
        ])
      )
      const r = await streamWithContinuation(opts, signal, () => {}, {
        maxRounds: 2
      })
      expect(mockStreamAi).toHaveBeenCalledTimes(3) // 1 首轮 + 2 续写
      expect(r.rounds).toBe(2)
      expect(r.finalTruncated).toBe(true)
      expect(r.fullContent.endsWith('。')).toBe(true) // 末尾半句被剪
    })

    it('续写返回空内容：停止，已写内容不变（usage 仍累加）', async () => {
      let call = 0
      mockStreamAi.mockImplementation(() => {
        call++
        return call === 1 ?
            fakeStream([
              { content: '主体内容被截断', done: false },
              {
                content: '',
                done: true,
                truncated: true,
                usage: { prompt_tokens: 10, completion_tokens: 20 }
              }
            ])
          : fakeStream([
              {
                content: '',
                done: true,
                truncated: true,
                usage: { prompt_tokens: 2, completion_tokens: 0 }
              }
            ])
      })
      const r = await streamWithContinuation(opts, signal, () => {})
      expect(mockStreamAi).toHaveBeenCalledTimes(2)
      expect(r.fullContent).toBe('主体内容被截断') // 空续写未改变内容
      expect(r.rounds).toBe(1)
      expect(r.inputTokens).toBe(12) // usage 仍累加
    })

    it('checkAbort 返回 true：轮间停止，不再续写', async () => {
      mockStreamAi.mockReturnValue(
        fakeStream([
          { content: '被截断的内容', done: false },
          {
            content: '',
            done: true,
            truncated: true,
            usage: { prompt_tokens: 1, completion_tokens: 1 }
          }
        ])
      )
      const r = await streamWithContinuation(opts, signal, () => {}, {
        checkAbort: async () => true
      })
      expect(mockStreamAi).toHaveBeenCalledTimes(1)
      expect(r.rounds).toBe(0)
    })

    it('signal 已中止：截断也不续写', async () => {
      const aborted = AbortSignal.abort()
      mockStreamAi.mockReturnValue(
        fakeStream([
          { content: '被截断的内容', done: false },
          {
            content: '',
            done: true,
            truncated: true,
            usage: { prompt_tokens: 1, completion_tokens: 1 }
          }
        ])
      )
      const r = await streamWithContinuation(opts, aborted, () => {})
      expect(mockStreamAi).toHaveBeenCalledTimes(1)
      expect(r.rounds).toBe(0)
    })

    it('onChunk 透出所有轮次的增量内容', async () => {
      let call = 0
      mockStreamAi.mockImplementation(() => {
        call++
        return call === 1 ?
            fakeStream([
              { content: '第一轮内容很长需要续写', done: false },
              { content: '', done: true, truncated: true }
            ])
          : fakeStream([
              { content: '第二轮补全的内容。', done: false },
              { content: '', done: true, truncated: false }
            ])
      })
      const seen: string[] = []
      await streamWithContinuation(opts, signal, (c) => seen.push(c))
      expect(seen).toContain('第一轮内容很长需要续写')
      expect(seen).toContain('第二轮补全的内容。')
    })
  })

  describe('createStreamResponse parsedJson', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.stubGlobal('setResponseHeaders', vi.fn())
    })

    it('keeps boolean parseJsonResult compatible with array parsing', async () => {
      mockStreamAi.mockReturnValue(
        fakeStream([
          { content: '[{"a":1}]', done: false },
          {
            content: '',
            done: true,
            usage: { prompt_tokens: 2, completion_tokens: 3 }
          }
        ])
      )

      const response = createStreamResponse(fakeEvent(), opts, undefined, {
        parseJsonResult: true
      })
      const payloads = await readSsePayloads(response)
      expect(payloads.at(-1)?.parsedJson).toEqual([{ a: 1 }])
    })

    it('can parse object payloads when requested', async () => {
      mockStreamAi.mockReturnValue(
        fakeStream([
          {
            content: '{"worldSetting":"宫廷","styleGuide":"克制"}',
            done: false
          },
          {
            content: '',
            done: true,
            usage: { prompt_tokens: 2, completion_tokens: 3 }
          }
        ])
      )

      const response = createStreamResponse(fakeEvent(), opts, undefined, {
        parseJsonResult: 'object'
      })
      const payloads = await readSsePayloads(response)
      expect(payloads.at(-1)?.parsedJson).toEqual({
        worldSetting: '宫廷',
        styleGuide: '克制'
      })
    })

    it('can transform final fullContent before done payload', async () => {
      mockStreamAi.mockReturnValue(
        fakeStream([
          { content: '标题：宫廷初遇', done: false },
          {
            content: '',
            done: true,
            usage: { prompt_tokens: 2, completion_tokens: 3 }
          }
        ])
      )

      const response = createStreamResponse(fakeEvent(), opts, undefined, {
        transformFullContent: (content) =>
          content.replace(/^标题[：:]/, '').trim()
      })
      const payloads = await readSsePayloads(response)
      expect(payloads.at(-1)?.fullContent).toBe('宫廷初遇')
    })
  })
})
