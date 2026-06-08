import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock streamAi（collectStream 内部依赖它）；其余 ai-stream 逻辑为纯 TS，无需 mock
const { mockStreamAi } = vi.hoisted(() => ({ mockStreamAi: vi.fn() }))
vi.mock('../server/utils/ai-client', () => ({ streamAi: mockStreamAi }))

import {
  estimateTokens,
  dynamicMaxTokens,
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

describe('ai-stream', () => {
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

  describe('trimToCompleteEnding', () => {
    it('剪掉末尾不完整的半句', () => {
      expect(trimToCompleteEnding('他推开门。外面下着')).toBe('他推开门。')
    })

    it('已在句末标点结尾则原样返回', () => {
      expect(trimToCompleteEnding('他推开门。')).toBe('他推开门。')
    })

    it('整段无句末标记则原样返回', () => {
      expect(trimToCompleteEnding('一段没有标点的连续文字')).toBe('一段没有标点的连续文字')
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
          { content: '', done: true, truncated: false, usage: { prompt_tokens: 10, completion_tokens: 20 } }
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
        return call === 1
          ? fakeStream([
              { content: '前半段被截断', done: false },
              { content: '', done: true, truncated: true, usage: { prompt_tokens: 10, completion_tokens: 20 } }
            ])
          : fakeStream([
              { content: '，后半段补完整。', done: false },
              { content: '', done: true, truncated: false, usage: { prompt_tokens: 5, completion_tokens: 8 } }
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

    it('始终截断：达 maxRounds 停止并把末尾半句剪到完整结尾', async () => {
      // 每轮都给「完整句 + 半句」并 truncated，验证轮数封顶 + trim
      // 注意用 mockImplementation 每次产生新生成器（异步生成器只能迭代一次）
      mockStreamAi.mockImplementation(() =>
        fakeStream([
          { content: '一句完整的话。还有半句', done: false },
          { content: '', done: true, truncated: true, usage: { prompt_tokens: 1, completion_tokens: 1 } }
        ])
      )
      const r = await streamWithContinuation(opts, signal, () => {}, { maxRounds: 2 })
      expect(mockStreamAi).toHaveBeenCalledTimes(3) // 1 首轮 + 2 续写
      expect(r.rounds).toBe(2)
      expect(r.finalTruncated).toBe(true)
      expect(r.fullContent.endsWith('。')).toBe(true) // 末尾半句被剪
    })

    it('续写返回空内容：停止，已写内容不变（usage 仍累加）', async () => {
      let call = 0
      mockStreamAi.mockImplementation(() => {
        call++
        return call === 1
          ? fakeStream([
              { content: '主体内容被截断', done: false },
              { content: '', done: true, truncated: true, usage: { prompt_tokens: 10, completion_tokens: 20 } }
            ])
          : fakeStream([
              { content: '', done: true, truncated: true, usage: { prompt_tokens: 2, completion_tokens: 0 } }
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
          { content: '', done: true, truncated: true, usage: { prompt_tokens: 1, completion_tokens: 1 } }
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
          { content: '', done: true, truncated: true, usage: { prompt_tokens: 1, completion_tokens: 1 } }
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
        return call === 1
          ? fakeStream([
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
})
