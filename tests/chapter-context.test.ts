import { describe, it, expect, vi, beforeEach } from 'vitest'

// 用 vi.hoisted 让 mock 函数在被提升的 vi.mock 工厂里可用
const {
  mockCollectAi,
  mockRetrieve,
  mockResolvePlanning,
  mockEmbeddingReady,
  mockFlagEnabled
} = vi.hoisted(() => ({
  mockCollectAi: vi.fn(),
  mockRetrieve: vi.fn(),
  mockResolvePlanning: vi.fn(),
  mockEmbeddingReady: vi.fn(),
  mockFlagEnabled: vi.fn()
}))

vi.mock('../server/utils/ai-client', () => ({
  toAiOptions: (config: any, overrides: any) => ({ ...config, ...overrides })
}))
vi.mock('../server/utils/ai-stream', () => ({
  collectAiStreamWithUsage: mockCollectAi,
  prepareBudgetedAiOptions: (options: unknown) => ({ options }),
  standardAiBudgetOptions: () => ({})
}))
vi.mock('../server/utils/ai-configs', () => ({
  resolvePlanningConfig: mockResolvePlanning,
  isAgenticRetrievalEnabled: mockFlagEnabled
}))
vi.mock('../server/services/content-rag', () => ({
  retrieveRelevant: mockRetrieve
}))
vi.mock('../server/services/embedding', () => ({
  isEmbeddingReady: mockEmbeddingReady
}))

import { gatherRelevantContext } from '../server/services/chapter-context'

const em = {} as any
const fakeCfg = {
  id: 1,
  configId: 1,
  modelId: 1,
  apiUrl: 'http://x',
  apiKey: 'k',
  model: 'm',
  temperature: '0.3',
  maxTokens: 256
}
const sampleNote = {
  content: '主角的近况',
  contentType: 'profile',
  chapterId: null,
  characterName: '主角',
  score: 0.9
}

describe('gatherRelevantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbeddingReady.mockReturnValue(true)
    mockFlagEnabled.mockReturnValue(true)
    mockResolvePlanning.mockResolvedValue(fakeCfg)
    mockRetrieve.mockResolvedValue([sampleNote])
    mockCollectAi.mockResolvedValue({
      content: '["查询A","查询B"]',
      inputTokens: 10,
      outputTokens: 5
    })
  })

  it('seed-only: 不调规划模型，用 seed 直接检索', async () => {
    const r = await gatherRelevantContext(em, {
      novelId: 1,
      userId: 1,
      intent: '测试',
      seed: '种子查询',
      depth: 'seed-only'
    })
    expect(mockCollectAi).not.toHaveBeenCalled()
    expect(mockRetrieve).toHaveBeenCalledWith(1, '种子查询', 10, undefined)
    expect(r.retrievedNotes).toHaveLength(1)
    expect(r.retrievedNotes[0]).toMatchObject({
      content: '主角的近况',
      characterName: '主角'
    })
  })

  it('query-only: 调一次规划模型，按产出的每条 query 检索', async () => {
    const r = await gatherRelevantContext(em, {
      novelId: 1,
      userId: 1,
      intent: '测试',
      seed: 's',
      depth: 'query-only'
    })
    expect(mockCollectAi).toHaveBeenCalledTimes(1)
    expect(mockCollectAi).toHaveBeenCalledWith(
      expect.objectContaining({
        tracking: expect.objectContaining({
          userId: 1,
          configId: 1,
          modelId: 1,
          purpose: 'planning',
          scenario: 'rag_query_planning',
          source: 'service',
          novelId: 1
        })
      })
    )
    expect(mockRetrieve).toHaveBeenCalledTimes(2)
    expect(r.queries).toEqual(['查询A', '查询B'])
    expect(r.usage.outputTokens).toBe(5)
  })

  it('query-only: 模型返回非法 JSON 时回落到 seed 检索', async () => {
    mockCollectAi.mockResolvedValue({
      content: '对不起我无法规划',
      inputTokens: 3,
      outputTokens: 2
    })
    const r = await gatherRelevantContext(em, {
      novelId: 1,
      userId: 1,
      intent: '测试',
      seed: '兜底种子',
      depth: 'query-only'
    })
    expect(mockCollectAi).toHaveBeenCalledTimes(1)
    expect(mockRetrieve).toHaveBeenCalledTimes(1)
    expect(mockRetrieve).toHaveBeenCalledWith(1, '兜底种子', 10, undefined)
    expect(r.queries).toBeUndefined()
  })

  it('full 在 v1 等价 query-only（仍走规划模型）', async () => {
    await gatherRelevantContext(em, {
      novelId: 1,
      userId: 1,
      intent: '测试',
      seed: 's',
      depth: 'full'
    })
    expect(mockCollectAi).toHaveBeenCalledTimes(1)
  })

  it('总开关关闭时强制 seed-only（不调模型）', async () => {
    mockFlagEnabled.mockReturnValue(false)
    await gatherRelevantContext(em, {
      novelId: 1,
      userId: 1,
      intent: '测试',
      seed: 's',
      depth: 'query-only'
    })
    expect(mockCollectAi).not.toHaveBeenCalled()
    expect(mockRetrieve).toHaveBeenCalledTimes(1)
  })

  it('无 planning 配置时回落到 seed 检索（不抛错）', async () => {
    mockResolvePlanning.mockResolvedValue(null)
    const r = await gatherRelevantContext(em, {
      novelId: 1,
      userId: 1,
      intent: '测试',
      seed: '兜底',
      depth: 'query-only'
    })
    expect(mockCollectAi).not.toHaveBeenCalled()
    expect(mockRetrieve).toHaveBeenCalledWith(1, '兜底', 10, undefined)
    expect(r.queries).toBeUndefined()
  })

  it('embedding 未就绪时只返回 extraNotes，不检索不调模型', async () => {
    mockEmbeddingReady.mockReturnValue(false)
    const extra = [
      { content: 'shared', contentType: 'chapter_summary', chapterId: 2 }
    ]
    const r = await gatherRelevantContext(em, {
      novelId: 1,
      userId: 1,
      intent: '测试',
      seed: 's',
      depth: 'query-only',
      extraNotes: extra
    })
    expect(mockRetrieve).not.toHaveBeenCalled()
    expect(mockCollectAi).not.toHaveBeenCalled()
    expect(r.retrievedNotes).toEqual(extra)
  })

  it('retrievedNotes 形状为 RagContextItem 且与 extraNotes 合并去重', async () => {
    const dup = {
      content: 'dup',
      contentType: 'profile',
      chapterId: null,
      characterName: 'A',
      score: 0.5
    }
    mockRetrieve.mockResolvedValue([dup]) // 两条 query 各返回同一条
    const extra = [
      {
        content: 'dup',
        contentType: 'profile',
        chapterId: null,
        characterName: 'A'
      }
    ] // 又是同一条
    const r = await gatherRelevantContext(em, {
      novelId: 1,
      userId: 1,
      intent: '测试',
      seed: 's',
      depth: 'query-only',
      extraNotes: extra
    })
    expect(r.retrievedNotes).toHaveLength(1)
    expect(r.retrievedNotes[0]).toMatchObject({
      content: 'dup',
      contentType: 'profile'
    })
  })

  it('contentType 过滤会透传给 retrieveRelevant', async () => {
    await gatherRelevantContext(em, {
      novelId: 1,
      userId: 1,
      intent: '测试',
      seed: 's',
      depth: 'seed-only',
      contentType: 'profile'
    })
    expect(mockRetrieve).toHaveBeenCalledWith(1, 's', 10, 'profile')
  })
})
