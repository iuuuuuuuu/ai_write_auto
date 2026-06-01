import { describe, it, expect, vi, beforeEach } from 'vitest'

// 隔离 AI 调用与用量记账，避免触发真实网络/数据库
vi.mock('../server/utils/ai-client', () => ({
  streamAi: vi.fn(),
  toAiOptions: (config: any, overrides: any) => ({ ...config, ...overrides })
}))
vi.mock('../server/utils/ai-stream', () => ({
  recordUsage: vi.fn(async () => {}),
  estimateTokens: (s: string) => (s ? s.length : 0)
}))

import { ensureChapterOutline, ensureOutlinesForRange } from '../server/services/outline-autofill'
import { streamAi } from '../server/utils/ai-client'

const mockedStreamAi = vi.mocked(streamAi)

/** 构造一个一次性的 AI 流：先吐内容，再吐带 usage 的结束块。 */
function streamYielding(content: string) {
  return (async function* () {
    if (content) yield { content, done: false }
    yield { content: '', done: true, usage: { prompt_tokens: 5, completion_tokens: 8 } }
  })()
}

function makeEm() {
  const created: Array<{ schema: unknown; data: any }> = []
  return {
    created,
    create: vi.fn((schema: unknown, data: any) => { created.push({ schema, data }); return data }),
    flush: vi.fn(async () => {})
  }
}

const novel = { title: '测试书', genre: '玄幻', worldSetting: null, description: '一个测试故事' }
const characters = [{ name: '主角', description: '勇敢' }]
const aiConfig = {
  id: 1, configId: 1, modelId: 1, apiUrl: 'http://x', apiKey: 'k',
  model: 'test-model', temperature: '0.7', maxTokens: 4096
} as any

describe('outline-autofill', () => {
  beforeEach(() => {
    mockedStreamAi.mockReset()
  })

  describe('ensureChapterOutline', () => {
    it('已存在则直接返回、不调用 AI', async () => {
      const em = makeEm()
      const res = await ensureChapterOutline({
        em: em as any, novel, novelId: 1, chapterNumber: 3, characters,
        existingOutlines: [{ chapterNumber: 3, description: '已有大纲' }],
        aiConfig, userId: 1
      })
      expect(mockedStreamAi).not.toHaveBeenCalled()
      expect(res).toEqual({ description: '已有大纲', created: false })
      expect(em.create).not.toHaveBeenCalled()
    })

    it('缺失则生成并落库（sortOrder=章号）', async () => {
      const em = makeEm()
      mockedStreamAi.mockImplementation(() => streamYielding('[{"chapterNumber":3,"description":"自动大纲"}]') as any)
      const res = await ensureChapterOutline({
        em: em as any, novel, novelId: 1, chapterNumber: 3, characters,
        existingOutlines: [], aiConfig, userId: 1
      })
      expect(res.created).toBe(true)
      expect(res.description).toBe('自动大纲')
      expect(em.create).toHaveBeenCalledTimes(1)
      expect(em.created[0].data).toMatchObject({ novel: 1, chapterNumber: 3, description: '自动大纲', sortOrder: 3 })
      expect(em.flush).toHaveBeenCalled()
    })

    it('AI 返回不可解析时降级返回 undefined、不落库', async () => {
      const em = makeEm()
      mockedStreamAi.mockImplementation(() => streamYielding('抱歉，无法生成') as any)
      const res = await ensureChapterOutline({
        em: em as any, novel, novelId: 1, chapterNumber: 3, characters,
        existingOutlines: [], aiConfig, userId: 1
      })
      expect(res).toEqual({ description: undefined, created: false })
      expect(em.create).not.toHaveBeenCalled()
    })

    it('streamAi 抛错时降级、不抛出', async () => {
      const em = makeEm()
      mockedStreamAi.mockImplementation(() => { throw new Error('network down') })
      const res = await ensureChapterOutline({
        em: em as any, novel, novelId: 1, chapterNumber: 3, characters,
        existingOutlines: [], aiConfig, userId: 1
      })
      expect(res).toEqual({ description: undefined, created: false })
    })
  })

  describe('ensureOutlinesForRange', () => {
    it('只补缺失章号、不覆盖已有', async () => {
      const em = makeEm()
      mockedStreamAi.mockImplementation(() => streamYielding(
        '[{"chapterNumber":1,"description":"x1"},{"chapterNumber":2,"description":"补2"},{"chapterNumber":3,"description":"x3"}]'
      ) as any)
      const existingOutlines = [
        { chapterNumber: 1, description: '原1' },
        { chapterNumber: 3, description: '原3' }
      ]
      const res = await ensureOutlinesForRange({
        em: em as any, novel, novelId: 1, fromChapter: 1, toChapter: 3, characters,
        existingOutlines, aiConfig, userId: 1
      })
      expect(res.filled).toEqual([2])
      expect(em.create).toHaveBeenCalledTimes(1)
      expect(em.created[0].data).toMatchObject({ chapterNumber: 2, description: '补2', sortOrder: 2 })
      // 新条目被 push 进数组，供后续章节作为前序参考
      expect(existingOutlines.find(o => o.chapterNumber === 2)?.description).toBe('补2')
    })

    it('整段已有则不调用 AI', async () => {
      const em = makeEm()
      const existingOutlines = [
        { chapterNumber: 1, description: 'a' },
        { chapterNumber: 2, description: 'b' },
        { chapterNumber: 3, description: 'c' }
      ]
      const res = await ensureOutlinesForRange({
        em: em as any, novel, novelId: 1, fromChapter: 1, toChapter: 3, characters,
        existingOutlines, aiConfig, userId: 1
      })
      expect(res.filled).toEqual([])
      expect(mockedStreamAi).not.toHaveBeenCalled()
      expect(em.create).not.toHaveBeenCalled()
    })
  })
})
