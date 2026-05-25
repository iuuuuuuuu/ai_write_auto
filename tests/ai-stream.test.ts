import { describe, it, expect } from 'vitest'
import { estimateTokens } from '../server/utils/ai-stream'

describe('ai-stream', () => {
  describe('estimateTokens', () => {
    it('estimates Chinese text at ~1.8 tokens per char', () => {
      const text = '这是一段中文测试文本'
      const tokens = estimateTokens(text)
      expect(tokens).toBeGreaterThan(text.length)
      expect(tokens).toBe(Math.ceil(text.length * 1.8))
    })

    it('estimates English text at ~0.4 tokens per char', () => {
      const text = 'This is an English test string'
      const tokens = estimateTokens(text)
      expect(tokens).toBe(Math.ceil(text.length * 0.4))
    })

    it('handles mixed Chinese and English', () => {
      const text = '你好 hello 世界 world'
      const chineseChars = 4
      const nonChinese = text.length - chineseChars
      const expected = Math.ceil(chineseChars * 1.8 + nonChinese * 0.4)
      expect(estimateTokens(text)).toBe(expected)
    })

    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })
  })
})
