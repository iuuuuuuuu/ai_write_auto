import { describe, it, expect } from 'vitest'
import { plotThreadSignature, parsePlotThreads } from '../server/utils/plot-threads'

describe('plot-threads', () => {
  describe('plotThreadSignature', () => {
    it('collapses punctuation/whitespace variants of the same summary (so re-extraction dedups)', () => {
      // 同一条线索跨次抽取，措辞带标点/空格差异也应判为同一条，不重复入库
      const a = plotThreadSignature('foreshadow_setup', '墙上的猎枪')
      const b = plotThreadSignature('foreshadow_setup', ' 墙上的，猎枪。 ')
      expect(a).toBe(b)
    })

    it('buckets by category — all foreshadow_* kinds share one signature for the same text', () => {
      // 签名按类目分桶（foreshadow / plot），同类目内不同 kind 不影响去重
      const setup = plotThreadSignature('foreshadow_setup', '神秘信件')
      const payoff = plotThreadSignature('foreshadow_payoff', '神秘信件')
      expect(setup).toBe(payoff)
    })

    it('separates foreshadowing from plot points even with identical text', () => {
      const fs = plotThreadSignature('foreshadow_setup', '神秘信件')
      const pp = plotThreadSignature('plot_open', '神秘信件')
      expect(fs).not.toBe(pp)
    })

    it('produces distinct signatures for genuinely different summaries', () => {
      const a = plotThreadSignature('plot_open', '主角与师门的恩怨')
      const b = plotThreadSignature('plot_open', '反派的身世之谜')
      expect(a).not.toBe(b)
    })

    it('returns a stable 32-char hex signature', () => {
      expect(plotThreadSignature('plot_open', '任意线索')).toMatch(/^[0-9a-f]{32}$/)
    })
  })

  describe('parsePlotThreads', () => {
    it('parses a clean JSON array and defaults relatedTo to null when absent', () => {
      const raw = JSON.stringify([
        { kind: 'foreshadow_setup', summary: '埋下旧铜钥匙的伏笔', groundQuote: '一枚旧铜钥匙' }
      ])
      const r = parsePlotThreads(raw)
      expect(r).toHaveLength(1)
      expect(r[0]).toEqual({
        kind: 'foreshadow_setup',
        summary: '埋下旧铜钥匙的伏笔',
        groundQuote: '一枚旧铜钥匙',
        relatedTo: null
      })
    })

    it('strips ```json code fences', () => {
      const inner = JSON.stringify([
        { kind: 'plot_open', summary: '新开师门恩怨线', groundQuote: '师父冷冷看着他' }
      ])
      const r = parsePlotThreads('```json\n' + inner + '\n```')
      expect(r).toHaveLength(1)
      expect(r[0].kind).toBe('plot_open')
    })

    it('keeps relatedTo for payoff/resolve items', () => {
      const raw = JSON.stringify([
        {
          kind: 'foreshadow_payoff',
          summary: '铜钥匙终于派上用场',
          groundQuote: '钥匙插入锁孔',
          relatedTo: '旧铜钥匙'
        }
      ])
      const r = parsePlotThreads(raw)
      expect(r[0].relatedTo).toBe('旧铜钥匙')
    })

    it('drops unknown kinds and items missing summary/groundQuote, keeping the valid ones', () => {
      const raw = JSON.stringify([
        { kind: 'foreshadow_setup', summary: '有效伏笔', groundQuote: '原文片段' },
        { kind: 'not_a_real_kind', summary: '非法类型', groundQuote: '原文' },
        { kind: 'plot_open', summary: '', groundQuote: '缺 summary' },
        { kind: 'plot_advance', summary: '缺 groundQuote' },
        { kind: 'plot_resolve', summary: '了结一条线', groundQuote: '尘埃落定', relatedTo: '某条线索' }
      ])
      const r = parsePlotThreads(raw)
      expect(r.map((t) => t.kind)).toEqual(['foreshadow_setup', 'plot_resolve'])
    })

    it('salvages the leading complete objects from a truncated JSON array', () => {
      // 模拟模型在 token 上限被截断：第二个对象写到一半、没有收尾的 ]
      const truncated =
        '[{"kind":"plot_open","summary":"完整的第一条线索","groundQuote":"原文片段一"},{"kind":"foreshadow_setup","summary":"第二条还没写完'
      const r = parsePlotThreads(truncated)
      expect(r).toHaveLength(1)
      expect(r[0].summary).toBe('完整的第一条线索')
    })

    it('returns [] for non-array JSON, empty arrays and garbage', () => {
      expect(parsePlotThreads('{"kind":"plot_open"}')).toEqual([])
      expect(parsePlotThreads('[]')).toEqual([])
      expect(parsePlotThreads('这根本不是 JSON')).toEqual([])
      expect(parsePlotThreads('')).toEqual([])
    })
  })
})
