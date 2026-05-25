import { describe, it, expect } from 'vitest'
import {
  buildGenerationPrompt,
  buildRegenerationPrompt,
  buildSummaryPrompt,
  buildStyleAnalysisPrompt,
  buildConsistencyCheckPrompt,
  buildSuggestionPrompt,
  buildOutlineGenerationPrompt,
  buildCharacterExtractionPrompt,
  buildStoryArcPrompt,
} from '../server/utils/ai-prompts'

describe('ai-prompts', () => {
  describe('buildGenerationPrompt', () => {
    it('returns system and user messages', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试小说', genre: '玄幻' },
        chapters: [],
        characters: [],
        plotPoints: [],
      })
      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('system')
      expect(result[1].role).toBe('user')
      expect(result[1].content).toContain('测试小说')
      expect(result[1].content).toContain('玄幻')
    })

    it('includes character info when provided', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [{ name: '张三', description: '主角', traits: '勇敢' }],
        plotPoints: [],
      })
      expect(result[1].content).toContain('张三')
      expect(result[1].content).toContain('勇敢')
    })

    it('includes chapter summaries', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [{ title: '第一章', chapterNumber: 1, summary: '开篇介绍' }],
        characters: [],
        plotPoints: [],
      })
      expect(result[1].content).toContain('开篇介绍')
    })

    it('includes style guide in system prompt', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试', styleGuide: '第一人称叙述' },
        chapters: [],
        characters: [],
        plotPoints: [],
      })
      expect(result[0].content).toContain('第一人称叙述')
    })

    it('includes active plot points', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [],
        plotPoints: [
          { type: 'foreshadowing', status: 'active', description: '神秘信件' },
          { type: 'conflict', status: 'resolved', description: '已解决的冲突' },
        ],
      })
      expect(result[1].content).toContain('神秘信件')
      expect(result[1].content).not.toContain('已解决的冲突')
    })
  })

  describe('buildRegenerationPrompt', () => {
    it('includes feedback and previous result', () => {
      const result = buildRegenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [],
        plotPoints: [],
        previousResult: '之前生成的内容',
        feedback: '需要更多对话',
      })
      expect(result[1].content).toContain('之前生成的内容')
      expect(result[1].content).toContain('需要更多对话')
    })
  })

  describe('buildSummaryPrompt', () => {
    it('returns correct structure', () => {
      const result = buildSummaryPrompt('章节内容文本')
      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('system')
      expect(result[1].content).toBe('章节内容文本')
    })
  })

  describe('buildStyleAnalysisPrompt', () => {
    it('passes sample text as user content', () => {
      const result = buildStyleAnalysisPrompt('示例文本片段')
      expect(result).toHaveLength(2)
      expect(result[1].content).toBe('示例文本片段')
      expect(result[0].content).toContain('叙事视角')
    })
  })

  describe('buildConsistencyCheckPrompt', () => {
    it('includes characters and summaries', () => {
      const result = buildConsistencyCheckPrompt({
        characters: [{ name: '李四', description: '配角', traits: '狡猾' }],
        recentSummaries: [{ chapterNumber: 1, summary: '李四出场' }],
        targetChapter: { chapterNumber: 2, content: '李四再次出现' },
      })
      expect(result[1].content).toContain('李四')
      expect(result[1].content).toContain('李四出场')
      expect(result[1].content).toContain('第2章')
    })
  })

  describe('buildSuggestionPrompt', () => {
    it('includes novel and chapter info', () => {
      const result = buildSuggestionPrompt({
        novel: { title: '测试小说', genre: '科幻' },
        chapter: { chapterNumber: 3, title: '星际旅行', content: '飞船启动了引擎...' },
        characters: [{ name: '船长' }],
      })
      expect(result[1].content).toContain('测试小说')
      expect(result[1].content).toContain('第3章')
      expect(result[1].content).toContain('船长')
    })

    it('truncates long chapter content', () => {
      const longContent = 'x'.repeat(20000)
      const result = buildSuggestionPrompt({
        novel: { title: '测试' },
        chapter: { chapterNumber: 1, title: '长章', content: longContent },
        characters: [],
      })
      expect(result[1].content.length).toBeLessThan(15000)
    })
  })

  describe('buildOutlineGenerationPrompt', () => {
    it('includes idea and chapter count', () => {
      const result = buildOutlineGenerationPrompt({
        novel: { title: '测试', genre: '武侠' },
        characters: [],
        idea: '一个少年学武的故事',
        chapterCount: 10,
        startChapter: 1,
      })
      expect(result[0].content).toContain('10')
      expect(result[1].content).toContain('一个少年学武的故事')
    })

    it('includes existing outlines as reference', () => {
      const result = buildOutlineGenerationPrompt({
        novel: { title: '测试' },
        characters: [],
        idea: '继续故事',
        chapterCount: 5,
        startChapter: 4,
        existingOutlines: [
          { chapterNumber: 1, description: '开篇' },
          { chapterNumber: 2, description: '发展' },
          { chapterNumber: 3, description: '转折' },
        ],
      })
      expect(result[1].content).toContain('已有大纲')
      expect(result[1].content).toContain('开篇')
    })
  })

  describe('buildCharacterExtractionPrompt', () => {
    it('passes chapter content', () => {
      const result = buildCharacterExtractionPrompt('张三走进了房间')
      expect(result[1].content).toBe('张三走进了房间')
      expect(result[0].content).toContain('JSON')
    })
  })

  describe('buildStoryArcPrompt', () => {
    it('includes chapter range', () => {
      const result = buildStoryArcPrompt(
        [{ chapterNumber: 1, title: '开始', summary: '故事开始' }],
        1,
        5
      )
      expect(result[0].content).toContain('第1章')
      expect(result[0].content).toContain('第5章')
      expect(result[1].content).toContain('故事开始')
    })
  })
})
