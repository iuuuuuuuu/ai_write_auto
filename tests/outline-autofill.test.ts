import { describe, it, expect, vi, beforeEach } from 'vitest'

// 隔离 AI 调用与用量记账，避免触发真实网络/数据库
vi.mock('../server/utils/ai-client', () => ({
  streamAi: vi.fn(),
  toAiOptions: (config: any, overrides: any) => ({ ...config, ...overrides })
}))
vi.mock('../server/utils/ai-stream', () => ({
  recordUsage: vi.fn(async () => {}),
  estimateTokens: (s: string) => (s ? s.length : 0),
  dynamicMaxTokens: (n: number, opts: { floor: number; cap: number }) =>
    Math.max(opts.floor, Math.min(Math.ceil(n), opts.cap))
}))

import { ensureChapterOutline } from '../server/services/outline-autofill'
import { streamAi } from '../server/utils/ai-client'

const mockedStreamAi = vi.mocked(streamAi)

/** 构造一个一次性的 AI 流：先吐内容，再吐带 usage 的结束块。 */
function streamYielding(content: string) {
  return (async function* () {
    if (content) yield { content, done: false }
    yield {
      content: '',
      done: true,
      usage: { prompt_tokens: 5, completion_tokens: 8 }
    }
  })()
}

function makeEm() {
  const created: Array<{ schema: unknown; data: any }> = []
  return {
    created,
    create: vi.fn((schema: unknown, data: any) => {
      created.push({ schema, data })
      return data
    }),
    flush: vi.fn(async () => {})
  }
}

const novel = {
  title: '测试书',
  genre: '玄幻',
  worldSetting: null,
  description: '一个测试故事'
}
const characters = [{ name: '主角', description: '勇敢' }]
const aiConfig = {
  id: 1,
  configId: 1,
  modelId: 1,
  apiUrl: 'http://x',
  apiKey: 'k',
  model: 'test-model',
  temperature: '0.7',
  maxTokens: 4096
} as any

describe('outline-autofill', () => {
  beforeEach(() => {
    mockedStreamAi.mockReset()
  })

  describe('ensureChapterOutline', () => {
    it('已存在则直接返回、不调用 AI', async () => {
      const em = makeEm()
      const res = await ensureChapterOutline({
        em: em as any,
        novel,
        novelId: 1,
        chapterNumber: 3,
        characters,
        existingOutlines: [{ chapterNumber: 3, description: '已有大纲' }],
        aiConfig,
        userId: 1
      })
      expect(mockedStreamAi).not.toHaveBeenCalled()
      expect(res).toEqual({ description: '已有大纲', created: false })
      expect(em.create).not.toHaveBeenCalled()
    })

    it('缺失则不再隐式生成或落库', async () => {
      const em = makeEm()
      mockedStreamAi.mockImplementation(
        () =>
          streamYielding(
            '[{"chapterNumber":3,"description":"自动大纲"}]'
          ) as any
      )
      const res = await ensureChapterOutline({
        em: em as any,
        novel,
        novelId: 1,
        chapterNumber: 3,
        characters,
        existingOutlines: [],
        aiConfig,
        userId: 1
      })
      expect(res).toEqual({ description: undefined, created: false })
      expect(mockedStreamAi).not.toHaveBeenCalled()
      expect(em.create).not.toHaveBeenCalled()
    })
  })
})
