import { describe, it, expect } from 'vitest'
import {
  buildProseProtocolRules,
  buildTextProtocolRules,
  buildGenerationPrompt,
  buildRegenerationPrompt,
  buildSummaryPrompt,
  buildStyleAnalysisPrompt,
  buildConsistencyCheckPrompt,
  buildSuggestionPrompt,
  buildOutlineGenerationPrompt,
  buildCharacterExtractionPrompt,
  buildStoryArcPrompt,
  buildQueryPlanningPrompt,
  buildPlotThreadExtractionPrompt
} from '../server/utils/ai-prompts'

describe('ai-prompts', () => {
  describe('protocol rules', () => {
    it('adds court protocol details for palace context', () => {
      const result = buildProseProtocolRules({
        title: '恶魔皇帝异世宠妃',
        genre: 'historical',
        worldSetting: '古代后宫，女主是林美人，身边有丫鬟和传旨太监。'
      })

      expect(result).toContain('称呼礼仪')
      expect(result).toContain('小主')
      expect(result).toContain('娘娘')
      expect(result).toContain('宣旨')
      expect(result).toContain('太监')
    })

    it('keeps non-palace contexts free of court-specific terms', () => {
      const result = buildProseProtocolRules({
        title: '都市加班日记',
        genre: 'urban',
        worldSetting: '现代都市职场。'
      })

      expect(result).toContain('社会规范')
      expect(result).not.toContain('小主')
      expect(result).not.toContain('娘娘')
      expect(result).not.toContain('宣旨')
    })

    it('text tools preserve the original address system without forcing palace rules', () => {
      const result = buildTextProtocolRules()

      expect(result).toContain('时代背景')
      expect(result).toContain('称谓体系')
      expect(result).not.toContain('小主')
      expect(result).not.toContain('娘娘')
    })
  })

  describe('buildGenerationPrompt', () => {
    it('returns system and user messages', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试小说', genre: '玄幻' },
        chapters: [],
        characters: [],
        plotPoints: []
      })
      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('system')
      expect(result[1].role).toBe('user')
      expect(result[1].content).toContain('测试小说')
      expect(result[1].content).toContain('玄幻')
    })

    it('系统提示含反「AI 腔」负向约束，且不含被移除的「生动的描写」反向指令', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [],
        plotPoints: []
      })
      const sys = result[0].content
      expect(sys).toContain('避免「AI 腔」')
      expect(sys).toContain('潜台词')
      expect(sys).toContain('升华式')
      expect(sys).not.toContain('使用生动的描写和自然的对话')
    })

    it('palace generation prompt includes executable court address rules', () => {
      const result = buildGenerationPrompt({
        novel: {
          title: '后宫试探',
          worldSetting: '古代宫廷，主角是林美人，身边有丫鬟小桃。'
        },
        chapters: [],
        characters: [],
        plotPoints: []
      })

      expect(result[0].content).toContain('社会规范与称谓')
      expect(result[0].content).toContain('小主')
      expect(result[0].content).toContain('娘娘')
      expect(result[0].content).toContain('太监')
    })

    it('includes character info when provided', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [
          {
            name: '张三',
            description: '主角',
            traits: '勇敢',
            overallArc: '从犹豫到承担'
          }
        ],
        plotPoints: []
      })
      expect(result[1].content).toContain('张三')
      expect(result[1].content).toContain('勇敢')
      expect(result[1].content).toContain('从犹豫到承担')
    })

    it('keeps other character profiles when rag context scopes one character', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [
          { name: '张三', description: '主角', traits: '勇敢' },
          { name: '李四', description: '盟友', relationships: '张三的旧识' }
        ],
        plotPoints: [],
        ragContext: [
          {
            characterName: '张三',
            contentType: 'chapter_story',
            content: '张三上一章负伤',
            chapterId: 1
          }
        ]
      })
      expect(result[1].content).toContain('张三上一章负伤')
      expect(result[1].content).toContain('其他角色档案')
      expect(result[1].content).toContain('李四')
      expect(result[1].content).toContain('张三的旧识')
    })

    it('includes non-character rag memories', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [],
        plotPoints: [],
        ragContext: [
          {
            contentType: 'world_detail',
            content: '地下城入口只在雨夜开启',
            chapterId: null
          },
          {
            contentType: 'plot_event',
            content: '铜钥匙已经交给李四',
            chapterId: 2
          }
        ]
      })
      expect(result[1].content).toContain('相关记忆')
      expect(result[1].content).toContain('地下城入口只在雨夜开启')
      expect(result[1].content).toContain('铜钥匙已经交给李四')
    })

    it('includes chapter summaries', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [{ title: '第一章', chapterNumber: 1, summary: '开篇介绍' }],
        characters: [],
        plotPoints: []
      })
      expect(result[1].content).toContain('开篇介绍')
    })

    it('includes style guide in system prompt', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试', styleGuide: '第一人称叙述' },
        chapters: [],
        characters: [],
        plotPoints: []
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
          { type: 'conflict', status: 'resolved', description: '已解决的冲突' }
        ]
      })
      expect(result[1].content).toContain('神秘信件')
      expect(result[1].content).not.toContain('已解决的冲突')
    })

    it('includes foreshadowing to be paid off', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [],
        plotPoints: [],
        foreshadowing: [
          {
            content: '墙上的猎枪',
            description: '第三幕会击发',
            chapterNumber: 1
          }
        ]
      })
      expect(result[1].content).toContain('待回收伏笔')
      expect(result[1].content).toContain('墙上的猎枪')
      expect(result[1].content).toContain('第1章')
    })

    it('prefers explicit recentChapterContent over chapters tail for continuity', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [
          {
            title: '第99章',
            chapterNumber: 99,
            summary: '末尾摘要',
            content: '全书最后一章的正文'
          }
        ],
        characters: [],
        plotPoints: [],
        currentChapter: { title: '第50章', chapterNumber: 50 },
        recentChapterContent: [
          { chapterNumber: 49, title: '前一章', content: '第49章的衔接正文' }
        ]
      })
      // 应使用传入的前序章节正文，而非 chapters 末尾的第99章
      expect(result[1].content).toContain('第49章的衔接正文')
      expect(result[1].content).not.toContain('全书最后一章的正文')
    })

    it('anchors generation to the current chapter number and title', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [],
        plotPoints: [],
        currentChapter: { title: '初入江湖', chapterNumber: 7 }
      })
      // 批量生成必须让 AI 明确知道在写第几章、章节标题是什么
      expect(result[1].content).toContain('第7章')
      expect(result[1].content).toContain('初入江湖')
      expect(result[1].content).toContain('请生成第7章')
    })

    it('does not force AI to stick to a placeholder title', () => {
      const result = buildGenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [],
        plotPoints: [],
        currentChapter: { title: '第7章', chapterNumber: 7 }
      })
      // 占位标题（第N章）不应被当作"已确定的标题"要求 AI 紧扣
      expect(result[1].content).toContain('第7章')
      expect(result[1].content).toContain('标题未定')
      expect(result[1].content).not.toContain('请围绕章节标题')
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
        feedback: '需要更多对话'
      })
      expect(result[1].content).toContain('之前生成的内容')
      expect(result[1].content).toContain('需要更多对话')
    })

    it('系统提示含反「AI 腔」负向约束', () => {
      const result = buildRegenerationPrompt({
        novel: { title: '测试' },
        chapters: [],
        characters: [],
        plotPoints: [],
        previousResult: 'x',
        feedback: 'y'
      })
      expect(result[0].content).toContain('避免「AI 腔」')
      expect(result[0].content).toContain('潜台词')
    })

    it('palace regeneration prompt keeps court address rules', () => {
      const result = buildRegenerationPrompt({
        novel: {
          title: '宫廷重生',
          worldSetting: '后宫嫔妃、太监传旨、宫女侍奉。'
        },
        chapters: [],
        characters: [],
        plotPoints: [],
        previousResult: '太监说：“林美人，请吧。”',
        feedback: '修正称谓礼制'
      })

      expect(result[0].content).toContain('社会规范与称谓')
      expect(result[0].content).toContain('小主')
      expect(result[0].content).toContain('宣旨')
      expect(result[0].content).toContain('下人')
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
    it('includes characters, summaries and prior passages', () => {
      const result = buildConsistencyCheckPrompt({
        characters: [{ name: '李四', description: '配角', traits: '狡猾' }],
        recentSummaries: [{ chapterNumber: 1, summary: '李四出场' }],
        priorPassages: [
          { chapterNumber: 1, label: '李四', content: '李四左手握剑' }
        ],
        targetChapter: { chapterNumber: 2, content: '李四再次出现' }
      })
      expect(result[1].content).toContain('李四')
      expect(result[1].content).toContain('李四出场')
      expect(result[1].content).toContain('李四左手握剑')
      expect(result[1].content).toContain('第2章')
    })

    it('demands grounded quote evidence', () => {
      const result = buildConsistencyCheckPrompt({
        characters: [],
        recentSummaries: [],
        priorPassages: [],
        targetChapter: { chapterNumber: 1, content: '正文' }
      })
      expect(result[0].content).toContain('quote')
      expect(result[0].content).toContain('priorQuote')
      expect(result[0].content).toContain('confidence')
    })
  })

  describe('buildQueryPlanningPrompt', () => {
    it('builds a light floor and demands a JSON query array', () => {
      const result = buildQueryPlanningPrompt({
        intent: '续写衔接',
        seed: '主角准备出发',
        novel: { title: '测试小说', genre: '武侠' },
        characterNames: ['林川', '师父'],
        foreshadowingTitles: ['黑塔之谜'],
        recentSummaries: ['第1章：林川下山']
      })
      expect(result[1].content).toContain('续写衔接')
      expect(result[1].content).toContain('林川')
      expect(result[1].content).toContain('黑塔之谜')
      expect(result[0].content).toContain('JSON')
    })
  })

  describe('buildSuggestionPrompt', () => {
    it('includes novel and chapter info', () => {
      const result = buildSuggestionPrompt({
        novel: { title: '测试小说', genre: '科幻' },
        chapter: {
          chapterNumber: 3,
          title: '星际旅行',
          content: '飞船启动了引擎...'
        },
        characters: [{ name: '船长' }]
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
        characters: []
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
        startChapter: 1
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
          { chapterNumber: 3, description: '转折' }
        ]
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

    it('提示用本名而非场景专属称呼作为 name（防「美人」泛化）', () => {
      const sys = buildCharacterExtractionPrompt('内容')[0].content
      expect(sys).toContain('本名')
      expect(sys).toContain('跨章节必须用同一个 name')
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

  describe('buildPlotThreadExtractionPrompt', () => {
    it('demands a strict JSON array and documents the kind/summary/groundQuote contract', () => {
      const result = buildPlotThreadExtractionPrompt({
        chapterNumber: 3,
        chapterContent: '正文',
        activeForeshadowing: [],
        activePlotPoints: []
      })
      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('system')
      expect(result[1].role).toBe('user')
      const sys = result[0].content
      expect(sys).toContain('JSON')
      expect(sys).toContain('kind')
      expect(sys).toContain('summary')
      expect(sys).toContain('groundQuote')
      expect(sys).toContain('relatedTo')
      // 五种线索类型都要写进契约，模型才能正确归类回收/推进/了结
      expect(sys).toContain('foreshadow_setup')
      expect(sys).toContain('foreshadow_payoff')
      expect(sys).toContain('plot_open')
      expect(sys).toContain('plot_advance')
      expect(sys).toContain('plot_resolve')
    })

    it('anchors to the chapter number and embeds the chapter content as grounding source', () => {
      const result = buildPlotThreadExtractionPrompt({
        chapterNumber: 7,
        chapterContent: '林川在井底发现一枚旧铜钥匙',
        activeForeshadowing: [],
        activePlotPoints: []
      })
      expect(result[1].content).toContain('第7章')
      expect(result[1].content).toContain('林川在井底发现一枚旧铜钥匙')
    })

    it('lists active foreshadowing and plot points so the model matches instead of re-creating', () => {
      const result = buildPlotThreadExtractionPrompt({
        chapterNumber: 5,
        chapterContent: '正文',
        activeForeshadowing: [{ content: '墙上的猎枪' }],
        activePlotPoints: [{ description: '主角与师门的恩怨未了' }]
      })
      expect(result[1].content).toContain('已有待回收伏笔')
      expect(result[1].content).toContain('墙上的猎枪')
      expect(result[1].content).toContain('已有活跃剧情线索')
      expect(result[1].content).toContain('主角与师门的恩怨未了')
    })

    it('shows a placeholder when there is nothing active to match against', () => {
      const result = buildPlotThreadExtractionPrompt({
        chapterNumber: 1,
        chapterContent: '正文',
        activeForeshadowing: [],
        activePlotPoints: []
      })
      expect(result[1].content).toContain('（暂无）')
    })
  })
})
