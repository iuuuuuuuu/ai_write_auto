import { describe, it, expect } from 'vitest'
import {
  validateConsistencyIssues,
  issueSignature,
  normalizeText
} from '../server/utils/consistency-check'

// 本章原文 / 早先原文（priorQuote 必须摘自此处或前情）
const TARGET = '林川走进大殿，看见王座上空无一人，心中一沉。'
const PRIOR = '第3章：林川曾发誓永不踏入大殿。王座上坐着老国王。'

function rawIssues(over: Record<string, unknown> = {}) {
  return JSON.stringify([
    {
      type: '时间线',
      severity: 'high',
      description: '林川的行为与早先发誓矛盾',
      quote: '林川走进大殿',
      priorQuote: '林川曾发誓永不踏入大殿',
      priorChapter: 3,
      confidence: 0.9,
      ...over
    }
  ])
}

describe('consistency-check', () => {
  describe('validateConsistencyIssues (强制举证)', () => {
    it('keeps a fully grounded issue', () => {
      const r = validateConsistencyIssues(rawIssues(), TARGET, PRIOR)
      expect(r).toHaveLength(1)
      expect(r[0]!.priorChapter).toBe(3)
    })

    it('drops an issue whose quote is not in the chapter (hallucinated)', () => {
      const r = validateConsistencyIssues(rawIssues({ quote: '完全不存在的句子' }), TARGET, PRIOR)
      expect(r).toHaveLength(0)
    })

    it('drops an issue whose priorQuote is not in prior text', () => {
      const r = validateConsistencyIssues(rawIssues({ priorQuote: '凭空捏造的旧情节' }), TARGET, PRIOR)
      expect(r).toHaveLength(0)
    })

    it('drops an issue missing quote or priorQuote', () => {
      expect(validateConsistencyIssues(rawIssues({ quote: '' }), TARGET, PRIOR)).toHaveLength(0)
      expect(validateConsistencyIssues(rawIssues({ priorQuote: '' }), TARGET, PRIOR)).toHaveLength(0)
    })

    it('drops an issue with explicit low confidence', () => {
      expect(validateConsistencyIssues(rawIssues({ confidence: 0.3 }), TARGET, PRIOR)).toHaveLength(0)
    })

    it('keeps a grounded issue when confidence is missing (defaults pass)', () => {
      // JSON.stringify drops undefined -> confidence key absent
      const r = validateConsistencyIssues(rawIssues({ confidence: undefined }), TARGET, PRIOR)
      expect(r).toHaveLength(1)
    })

    it('tolerates whitespace/punctuation differences in the quote (normalized match)', () => {
      const r = validateConsistencyIssues(rawIssues({ quote: '林川 走进，大殿' }), TARGET, PRIOR)
      expect(r).toHaveLength(1)
    })

    it('returns [] on non-JSON or non-array output', () => {
      expect(validateConsistencyIssues('对不起，我无法判断', TARGET, PRIOR)).toHaveLength(0)
      expect(validateConsistencyIssues('{"type":"x"}', TARGET, PRIOR)).toHaveLength(0)
    })
  })

  describe('issueSignature (跨次去重键)', () => {
    const base = {
      type: '时间线',
      severity: 'high' as const,
      description: 'x',
      quote: '林川走进大殿',
      priorQuote: 'p',
      priorChapter: 3,
      confidence: 0.9
    }

    it('is stable across description/confidence rewording', () => {
      expect(issueSignature(base)).toBe(
        issueSignature({ ...base, description: '完全不同的措辞', confidence: 0.5 })
      )
    })

    it('changes when the quote changes', () => {
      expect(issueSignature(base)).not.toBe(issueSignature({ ...base, quote: '另一句完全不同的原文' }))
    })

    it('changes when priorChapter changes', () => {
      expect(issueSignature(base)).not.toBe(issueSignature({ ...base, priorChapter: 5 }))
    })
  })

  describe('normalizeText', () => {
    it('strips whitespace and punctuation, lowercases', () => {
      expect(normalizeText('  Hello， 世界！ ')).toBe('hello世界')
    })
  })
})
