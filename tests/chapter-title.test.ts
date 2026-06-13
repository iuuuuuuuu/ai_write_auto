import { describe, expect, it } from 'vitest'
import { buildDefaultChapterOutlineIdea } from '../app/utils/chapter-title'

describe('chapter-title utilities', () => {
  describe('buildDefaultChapterOutlineIdea', () => {
    it('uses opening guidance only for the first chapter', () => {
      const result = buildDefaultChapterOutlineIdea({
        chapterNumber: 1,
        chapterTitle: '初入冷宫'
      })

      expect(result).toContain('开篇章节')
      expect(result).toContain('初入冷宫')
    })

    it('uses continuation guidance after the first chapter', () => {
      const result = buildDefaultChapterOutlineIdea({
        chapterNumber: 2,
        chapterTitle: '暗线初现'
      })

      expect(result).toContain('第 2 章')
      expect(result).toContain('暗线初现')
      expect(result).toContain('承接前文')
      expect(result).not.toContain('开篇章节')
    })
  })
})
