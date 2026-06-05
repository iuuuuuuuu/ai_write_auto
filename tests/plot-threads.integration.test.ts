import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'

/**
 * Part B2 端到端编排校验：用真实的（临时文件）libsql ORM 跑 runPlotThreadExtraction，
 * 只 mock 模型调用（streamAi），其余（配置解析、签名 upsert、回收、grounding、落库）全走真实代码。
 * 直接对应计划里的「端到端」断言：自动入库 active → 回收置 resolved → 重复跑同章不重复。
 */
const { mockStreamAi, responseHolder } = vi.hoisted(() => ({
  mockStreamAi: vi.fn(),
  responseHolder: { text: '[]' }
}))
vi.mock('../server/utils/ai-client', () => ({
  streamAi: mockStreamAi,
  toAiOptions: (cfg: Record<string, unknown>, opts: Record<string, unknown>) => ({
    ...cfg,
    ...opts
  })
}))

import { MikroORM } from '@mikro-orm/core'
import { LibSqlDriver } from '@mikro-orm/libsql'
import {
  allEntities,
  UserSchema,
  AiProviderSchema,
  AiModelSchema,
  AiConfigSchema,
  NovelSchema,
  ChapterSchema,
  ForeshadowingSchema,
  PlotPointSchema
} from '../server/database/entities'
import { runPlotThreadExtraction } from '../server/utils/plot-threads'

// 进程级唯一文件名：避免与并行/历史运行冲突，也规避「文件残留→表已存在」
const DB_PATH = join(tmpdir(), `plot-threads-it-${process.pid}.db`)

/** Windows 上 close() 后句柄可能短暂未释放，删除失败不应让套件失败（临时文件由 OS 兜底回收）。 */
function bestEffortCleanup() {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(DB_PATH + suffix, { force: true })
    } catch {
      /* ignore EBUSY */
    }
  }
}

let orm: MikroORM
let userId: number
let novelId: number
let chapterSeq = 1000

/** 让下一次 streamAi 调用产出给定 JSON（作为单条 content chunk）。 */
function setAiResponse(json: unknown) {
  responseHolder.text = typeof json === 'string' ? json : JSON.stringify(json)
}

async function seedChapter(content: string, chapterNumber?: number): Promise<number> {
  const em = orm.em.fork()
  const ch = em.create(ChapterSchema, {
    novel: novelId,
    chapterNumber: chapterNumber ?? chapterSeq++,
    title: '章',
    content,
    status: 'generated'
  })
  await em.flush()
  return ch.id
}

async function seedActiveForeshadowing(content: string, chapterNumber: number): Promise<number> {
  const chId = await seedChapter('（伏笔埋设所在章）', chapterNumber)
  const em = orm.em.fork()
  const fs = em.create(ForeshadowingSchema, {
    novel: novelId,
    chapter: chId,
    content,
    status: 'active'
  })
  await em.flush()
  return fs.id
}

beforeAll(async () => {
  bestEffortCleanup()
  orm = await MikroORM.init({
    driver: LibSqlDriver,
    dbName: DB_PATH,
    entities: allEntities,
    discovery: { disableDynamicFileAccess: true },
    allowGlobalContext: true
  })
  await orm.schema.createSchema()

  const em = orm.em.fork()
  const user = em.create(UserSchema, { username: 'tester', passwordHash: 'x' })
  await em.flush()
  userId = user.id
  const provider = em.create(AiProviderSchema, {
    user: userId,
    name: 'p',
    apiUrl: 'http://x',
    apiKey: 'k',
    enabled: true
  })
  await em.flush()
  const model = em.create(AiModelSchema, {
    user: userId,
    provider: provider.id,
    name: 'm',
    model: 'm',
    maxTokens: 4096,
    enabled: true
  })
  await em.flush()
  em.create(AiConfigSchema, {
    user: userId,
    aiModel: model.id,
    purpose: 'extraction',
    enabled: true,
    isDefault: true
  })
  const novel = em.create(NovelSchema, { user: userId, title: '测试小说' })
  await em.flush()
  novelId = novel.id

  // 每次调用返回一个新的生成器，迭代时读取最新的 responseHolder.text
  mockStreamAi.mockImplementation(() =>
    (async function* () {
      yield { content: responseHolder.text }
      yield { usage: { prompt_tokens: 5, completion_tokens: 7 } }
    })()
  )
})

afterAll(async () => {
  await orm?.close(true)
  bestEffortCleanup()
})

describe('plot-threads integration (runPlotThreadExtraction)', () => {
  it('auto-inserts a newly planted foreshadow as an active Foreshadowing tied to the chapter', async () => {
    const chId = await seedChapter('夜里，他在井底发现一枚旧铜钥匙，随手揣进怀里。')
    setAiResponse([
      { kind: 'foreshadow_setup', summary: '主角捡到一枚旧铜钥匙', groundQuote: '一枚旧铜钥匙' }
    ])

    const r = await runPlotThreadExtraction(orm.em.fork(), userId, novelId, chId)
    expect(r.created).toBe(1)
    expect(r.outputTokens).toBe(7) // usage 透传

    const rows = await orm.em.fork().find(ForeshadowingSchema, { novel: novelId, chapter: chId })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('active')
    expect(rows[0].content).toBe('主角捡到一枚旧铜钥匙')
  })

  it('drops items whose groundQuote does not literally appear in the chapter', async () => {
    const chId = await seedChapter('风平浪静的一天，什么都没有发生。')
    setAiResponse([
      { kind: 'foreshadow_setup', summary: '凭空捏造的伏笔', groundQuote: '这句原文根本不存在' }
    ])

    const r = await runPlotThreadExtraction(orm.em.fork(), userId, novelId, chId)
    expect(r.created).toBe(0)
    expect(await orm.em.fork().find(ForeshadowingSchema, { novel: novelId, chapter: chId })).toHaveLength(0)
  })

  it('resolves an existing active foreshadow on payoff and stamps resolvedAtChapter', async () => {
    const fsId = await seedActiveForeshadowing('墙上挂着一把猎枪', 1)
    const chId = await seedChapter('第三幕，他取下墙上的猎枪，扣动了扳机。', 30)
    setAiResponse([
      {
        kind: 'foreshadow_payoff',
        summary: '墙上的猎枪在第三幕击发',
        groundQuote: '取下墙上的猎枪',
        relatedTo: '墙上挂着一把猎枪'
      }
    ])

    const r = await runPlotThreadExtraction(orm.em.fork(), userId, novelId, chId)
    expect(r.resolved).toBe(1)

    const fs = await orm.em.fork().findOne(ForeshadowingSchema, { id: fsId })
    expect(fs?.status).toBe('resolved')
    expect(fs?.resolvedAtChapter).toBe(30)
  })

  it('does not create duplicates when the same chapter is processed twice', async () => {
    const chId = await seedChapter('集市上，一个蒙面人塞给他一封没有署名的信。')
    const payload = [
      { kind: 'plot_open', summary: '蒙面人递来的匿名信', groundQuote: '一封没有署名的信' }
    ]

    setAiResponse(payload)
    expect((await runPlotThreadExtraction(orm.em.fork(), userId, novelId, chId)).created).toBe(1)

    setAiResponse(payload) // 同章二次抽取：签名命中已有活跃项 → 不重建
    expect((await runPlotThreadExtraction(orm.em.fork(), userId, novelId, chId)).created).toBe(0)

    const rows = await orm.em.fork().find(PlotPointSchema, { novel: novelId, chapter: chId })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('introduced')
    expect(rows[0].type).toBe('setup')
  })

  it('soft-returns zero when the user has no extraction config (never blocks generation)', async () => {
    const chId = await seedChapter('任意正文片段。')
    setAiResponse([{ kind: 'plot_open', summary: 'x', groundQuote: '任意正文片段' }])

    const r = await runPlotThreadExtraction(orm.em.fork(), 999999, novelId, chId)
    expect(r).toEqual({ created: 0, resolved: 0, inputTokens: 0, outputTokens: 0 })
  })
})
