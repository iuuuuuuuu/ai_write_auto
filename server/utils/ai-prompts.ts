export interface PromptNovel {
  title: string
  genre?: string | null
  description?: string | null
  worldSetting?: string | null
  styleGuide?: string | null
  aiExtraPrompt?: string | null
  aiTemperature?: string | null
}

export interface PromptChapter {
  title: string
  chapterNumber: number
  content?: string | null
  summary?: string | null
}

export interface PromptCharacter {
  name: string
  description?: string | null
  traits?: string | null
  relationships?: string | null
  currentState?: string | null
  overallArc?: string | null
}

export interface PromptPlotPoint {
  type: string
  status: string
  description: string
}

export interface PromptStoryArc {
  title: string
  startChapter: number
  endChapter?: number | null
  summary?: string | null
}

export function buildGenerationPrompt(context: {
  novel: PromptNovel
  chapters: PromptChapter[]
  characters: PromptCharacter[]
  plotPoints: PromptPlotPoint[]
  currentChapter?: { title: string; chapterNumber: number }
  currentChapterOutline?: string
  userDirection?: string
  storyArcs?: PromptStoryArc[]
  ragContext?: Array<{ characterName: string; content: string; contentType: string; chapterId: number | null }>
}): Array<{ role: 'system' | 'user'; content: string }> {
  const {
    novel,
    chapters,
    characters,
    plotPoints,
    currentChapter,
    currentChapterOutline,
    userDirection,
    storyArcs,
    ragContext
  } = context

  let systemPrompt = `你是一位专业的小说作家。请根据提供的上下文信息，生成高质量的小说章节内容。

## 写作要求
- 保持与已有章节一致的写作风格和叙事视角
- 确保角色性格和行为的连贯性
- 推进剧情发展，不要重复已有内容
- 使用生动的描写和自然的对话
- 注意伏笔的铺设和回收
- 重要：必须在一个完整的段落结尾处停止，不要在句子中间截断。如果接近字数上限，请在当前段落写完后自然收束`

  if (novel.styleGuide) {
    systemPrompt += `\n\n## 风格指南\n${novel.styleGuide}`
  }

  let userPrompt = ''

  // Story Bible
  userPrompt += `## 小说信息\n标题：${novel.title}\n`
  if (novel.genre) userPrompt += `类型：${novel.genre}\n`
  if (novel.description) userPrompt += `简介：${novel.description}\n`
  if (novel.worldSetting)
    userPrompt += `\n## 世界观设定\n${novel.worldSetting}\n`

  // Characters
  if (ragContext?.length) {
    userPrompt += `\n## 角色档案（基于本章相关性检索）\n`
    const grouped = new Map<string, typeof ragContext>()
    for (const item of ragContext) {
      const list = grouped.get(item.characterName) || []
      list.push(item)
      grouped.set(item.characterName, list)
    }
    for (const [name, items] of grouped) {
      const char = characters.find(c => c.name === name)
      userPrompt += `\n### ${name}\n`
      if (char?.description) userPrompt += `简介：${char.description}\n`
      if (char?.traits) userPrompt += `性格：${char.traits}\n`
      if (char?.relationships) userPrompt += `关系：${char.relationships}\n`
      if (char?.currentState) userPrompt += `当前状态：${char.currentState}\n`
      if (char?.overallArc) userPrompt += `整体弧线：${char.overallArc}\n`
      const stories = items.filter(i => i.contentType === 'chapter_story')
      if (stories.length) {
        userPrompt += `相关章节经历：\n`
        for (const s of stories) {
          userPrompt += `- ${s.content}\n`
        }
      }
    }
  } else if (characters.length > 0) {
    userPrompt += `\n## 角色档案\n`
    for (const char of characters) {
      userPrompt += `- ${char.name}`
      if (char.description) userPrompt += `：${char.description}`
      if (char.traits) userPrompt += `（性格：${char.traits}）`
      if (char.relationships) userPrompt += `（关系：${char.relationships}）`
      if (char.currentState) userPrompt += `【当前状态：${char.currentState}】`
      userPrompt += '\n'
    }
  }

  // Chapter summaries (adaptive compression)
  if (chapters.length > 0) {
    userPrompt += `\n## 已有章节摘要\n`
    const totalChapters = chapters.length

    if (totalChapters <= 30) {
      for (const ch of chapters) {
        if (ch.summary) {
          userPrompt += `第${ch.chapterNumber}章「${ch.title}」：${ch.summary}\n`
        }
      }
    } else {
      // Arc compression for distant chapters
      if (storyArcs?.length) {
        userPrompt += `### 故事弧线\n`
        for (const arc of storyArcs) {
          userPrompt += `- ${arc.title}（第${arc.startChapter}-${arc.endChapter || '?'}章）：${arc.summary || ''}\n`
        }
      }
      // Recent chapters keep individual summaries
      const recentStart = Math.max(0, totalChapters - 10)
      userPrompt += `\n### 近期章节\n`
      for (let i = recentStart; i < totalChapters; i++) {
        const ch = chapters[i]
        if (ch.summary) {
          userPrompt += `第${ch.chapterNumber}章「${ch.title}」：${ch.summary}\n`
        }
      }
    }

    // Sliding window: last 1-2 chapters full text
    const windowSize = totalChapters > 20 ? 1 : 2
    const windowStart = Math.max(0, totalChapters - windowSize)
    userPrompt += `\n## 最近章节全文\n`
    for (let i = windowStart; i < totalChapters; i++) {
      const ch = chapters[i]
      if (ch.content) {
        userPrompt += `\n### 第${ch.chapterNumber}章「${ch.title}」\n${ch.content}\n`
      }
    }
  }

  // Plot points
  if (plotPoints.length > 0) {
    const active = plotPoints.filter(p => p.status !== 'resolved')
    if (active.length > 0) {
      userPrompt += `\n## 活跃剧情线索\n`
      for (const p of active) {
        userPrompt += `- [${p.type}/${p.status}] ${p.description}\n`
      }
    }
  }

  // Generation instruction
  userPrompt += `\n## 生成指令\n`
  if (currentChapter) {
    userPrompt += `当前章节：第${currentChapter.chapterNumber}章「${currentChapter.title}」\n`
    userPrompt += `请围绕章节标题「${currentChapter.title}」展开内容，标题已确定，不要更改。生成的内容应与章节标题紧密相关。\n`
  }
  if (currentChapterOutline) {
    userPrompt += `本章大纲：${currentChapterOutline}\n`
  }
  if (userDirection) {
    userPrompt += `写作方向：${userDirection}\n`
  }
  if (novel.aiExtraPrompt) {
    userPrompt += `额外指示：${novel.aiExtraPrompt}\n`
  }
  if (currentChapter) {
    userPrompt += `\n请生成第${currentChapter.chapterNumber}章「${currentChapter.title}」的完整内容。不要包含章节标题，直接从正文开始。`
  } else {
    userPrompt += `\n请生成下一章的完整内容。`
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
}

export function buildSummaryPrompt(
  chapterContent: string
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    {
      role: 'system',
      content:
        '你是一位文学编辑。请为以下章节内容生成一段简洁的摘要（100-200字），包含关键事件、角色行为和情节发展。'
    },
    { role: 'user', content: chapterContent }
  ]
}

export function buildChapterStoryPrompt(
  characterName: string,
  chapterContent: string,
  appearances: Array<{ snippet: string | null; background: string | null }>
): Array<{ role: 'system' | 'user'; content: string }> {
  const snippets = appearances
    .map(a => a.background || a.snippet)
    .filter(Boolean)
    .join('\n')

  return [
    {
      role: 'system',
      content: `你是一位文学分析师。请总结角色「${characterName}」在本章中的经历和状态变化。要求：
- 150-300字
- 包含该角色在本章的行为、情绪变化、与他人的互动
- 用第三人称叙述
- 只返回纯文本摘要，不要标题或格式`
    },
    {
      role: 'user',
      content: `## 章节内容\n${chapterContent.slice(0, 6000)}\n\n## 该角色出现的片段\n${snippets}`
    }
  ]
}

export function buildOverallArcPrompt(
  characterName: string,
  description: string | null,
  previousArc: string | null,
  newChapterStory: string,
  chapterNumber: number
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    {
      role: 'system',
      content: `你是一位文学编辑。请根据角色「${characterName}」的已有故事弧线和最新章节经历，更新其整体故事弧线摘要。要求：
- 300-600字
- 按时间线梳理角色的成长、转变和关键事件
- 保留之前弧线中的重要信息，融入新章节的发展
- 用第三人称叙述
- 只返回纯文本摘要，不要标题或格式`
    },
    {
      role: 'user',
      content: [
        description ? `## 角色简介\n${description}` : '',
        previousArc ? `## 已有故事弧线\n${previousArc}` : '## 已有故事弧线\n（暂无，这是该角色首次出场）',
        `## 第${chapterNumber}章经历\n${newChapterStory}`
      ].filter(Boolean).join('\n\n')
    }
  ]
}

export function buildCharacterGenerationPrompt(context: {
  novel: { title: string; description?: string; genre?: string; worldSetting?: string; styleGuide?: string }
  existingCharacters: Array<{ name: string; description?: string; traits?: string; currentState?: string }>
  outlines: Array<{ chapterNumber: number; description: string }>
  count: number
  customPrompt?: string
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, existingCharacters, outlines, count, customPrompt } = context

  let systemPrompt = customPrompt || `你是一位专业的小说角色设计师。请根据小说的背景信息，设计出性格鲜明、关系合理、有故事张力的角色。

## 设计原则
- 角色性格要有层次感，避免脸谱化
- 角色之间要有关系网络和冲突点
- 每个角色要有独特的辨识度
- 角色设定要服务于故事发展`

  let userPrompt = `## 小说信息\n标题：${novel.title}\n`
  if (novel.genre) userPrompt += `类型：${novel.genre}\n`
  if (novel.description) userPrompt += `简介：${novel.description}\n`
  if (novel.worldSetting) userPrompt += `\n## 世界观设定\n${novel.worldSetting}\n`
  if (novel.styleGuide) userPrompt += `\n## 风格指南\n${novel.styleGuide}\n`

  if (existingCharacters.length > 0) {
    userPrompt += `\n## 已有角色（请勿重复，新角色需与他们产生关联）\n`
    for (const char of existingCharacters) {
      userPrompt += `- ${char.name}`
      if (char.description) userPrompt += `：${char.description}`
      if (char.traits) userPrompt += `（性格：${char.traits}）`
      userPrompt += '\n'
    }
  }

  if (outlines.length > 0) {
    userPrompt += `\n## 章节大纲（供参考角色出场规划）\n`
    for (const o of outlines.slice(0, 20)) {
      userPrompt += `- 第${o.chapterNumber}章：${o.description}\n`
    }
  }

  userPrompt += `\n## 生成要求\n请生成 ${count} 个角色，返回严格 JSON 数组，不要 Markdown，不要解释。

每个角色对象必须包含：
- name: 角色名
- description: 角色简介（身份、背景）
- traits: 性格特征
- relationships: 与其他角色的关系（包括已有角色）
- currentState: 初始状态或处境
- role: 角色定位，只能是 main、supporting、mentioned

示例：
[
  {
    "name": "张明",
    "description": "前朝遗臣之后，隐居山林的剑客",
    "traits": "沉默寡言、重情重义、内心矛盾",
    "relationships": "与李文是师兄弟关系",
    "currentState": "隐居深山，等待时机",
    "role": "main"
  }
]`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
}

export function buildCharacterExtractionPrompt(
  chapterContent: string
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    {
      role: 'system',
      content: `你是一位文学分析师。请从以下章节中提取出现的角色信息，只返回严格 JSON 数组，不要 Markdown，不要解释。

每个角色对象必须包含：
- name: 角色名，尽量使用正文中的稳定称呼
- description: 简短描述，没有则为 null
- traits: 性格特征，没有则为 null
- currentState: 当前状态、处境、情绪或位置，没有则为 null
- role: 本章作用，只能是 main、supporting、mentioned
- appearances: 出现上下文数组，每项包含：
  - snippet: 包含角色名的原文短片段，控制在 120 字以内
  - positionStart: 片段在章节全文中的起始字符下标，不确定则为 null
  - positionEnd: 片段在章节全文中的结束字符下标，不确定则为 null
  - background: 根据片段总结的本章背景或行动，没有则为 null

示例：
[
  {
    "name": "李文",
    "description": "清晨出现的人物",
    "traits": null,
    "currentState": "早上开始行动",
    "role": "supporting",
    "appearances": [
      {
        "snippet": "早上，李文从屋里走出来。",
        "positionStart": 0,
        "positionEnd": 12,
        "background": "李文在清晨登场。"
      }
    ]
  }
]`
    },
    { role: 'user', content: chapterContent }
  ]
}

export function buildStoryArcPrompt(
  chapterSummaries: Array<{ chapterNumber: number; title: string; summary: string }>,
  startChapter: number,
  endChapter: number
): Array<{ role: 'system' | 'user'; content: string }> {
  const summaryText = chapterSummaries
    .map(ch => `第${ch.chapterNumber}章「${ch.title}」：${ch.summary}`)
    .join('\n')

  return [
    {
      role: 'system',
      content: `你是一位文学分析师。请将以下连续章节的摘要压缩为一段简洁的故事弧线摘要。

要求：
- 提炼这组章节的核心剧情线索和主要事件
- 标注关键转折点和角色状态变化
- 控制在 200 字以内
- 只返回纯文本摘要，不要 JSON，不要标题

这组章节范围：第${startChapter}章 ~ 第${endChapter}章`
    },
    { role: 'user', content: summaryText }
  ]
}

export function buildRegenerationPrompt(context: {
  novel: PromptNovel
  chapters: PromptChapter[]
  characters: PromptCharacter[]
  plotPoints: PromptPlotPoint[]
  storyArcs?: PromptStoryArc[]
  currentChapter?: { title: string; chapterNumber: number }
  currentChapterOutline?: string
  previousResult: string
  feedback: string
  ragContext?: Array<{ characterName: string; content: string; contentType: string; chapterId: number | null }>
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, chapters, characters, plotPoints, storyArcs, currentChapter, currentChapterOutline, previousResult, feedback, ragContext } = context

  const systemPrompt = `你是一位专业的小说作家。用户对上一次生成的章节内容不满意，并提供了修改反馈。请根据反馈重新生成章节内容。

## 重要规则
- 认真理解用户的反馈意见，针对性地调整
- 保持与已有章节一致的写作风格和叙事视角
- 不要简单地在原文基础上修补，而是重新构思并生成
- 保留原文中用户没有提出异议的优秀部分
- 确保角色性格和行为的连贯性
- 必须在一个完整的段落结尾处停止，不要在句子中间截断${novel.styleGuide ? `\n\n## 风格指南\n${novel.styleGuide}` : ''}`

  let userPrompt = `## 小说信息\n标题：${novel.title}\n`
  if (novel.genre) userPrompt += `类型：${novel.genre}\n`
  if (novel.worldSetting) userPrompt += `\n## 世界观设定\n${novel.worldSetting}\n`

  if (currentChapter) {
    userPrompt += `\n## 当前章节\n第${currentChapter.chapterNumber}章「${currentChapter.title}」\n`
  }

  if (ragContext?.length) {
    userPrompt += `\n## 相关角色事件（基于本章检索）\n`
    for (const item of ragContext) {
      userPrompt += `- ${item.characterName}：${item.content}\n`
    }
  } else if (characters.length > 0) {
    userPrompt += `\n## 角色档案\n`
    for (const char of characters.slice(0, 10)) {
      userPrompt += `- ${char.name}`
      if (char.description) userPrompt += `：${char.description}`
      if (char.traits) userPrompt += `（性格：${char.traits}）`
      if (char.relationships) userPrompt += `（关系：${char.relationships}）`
      userPrompt += '\n'
    }
  }

  if (chapters.length > 0) {
    userPrompt += `\n## 近期章节\n`
    const currentIdx = currentChapter
      ? chapters.findIndex(ch => ch.chapterNumber === currentChapter.chapterNumber)
      : chapters.length
    const precedingChapters = chapters.slice(Math.max(0, currentIdx - 5), currentIdx)
    for (const ch of precedingChapters) {
      if (ch.summary) {
        userPrompt += `第${ch.chapterNumber}章「${ch.title}」：${ch.summary}\n`
      }
    }
    const lastChapter = precedingChapters[precedingChapters.length - 1]
    if (lastChapter?.content) {
      userPrompt += `\n## 上一章全文（第${lastChapter.chapterNumber}章）\n${lastChapter.content.slice(-3000)}\n`
    }
  }

  if (plotPoints.length > 0) {
    const active = plotPoints.filter(p => p.status !== 'resolved')
    if (active.length > 0) {
      userPrompt += `\n## 活跃剧情线索\n`
      for (const p of active.slice(0, 10)) {
        userPrompt += `- [${p.type}/${p.status}] ${p.description}\n`
      }
    }
  }

  if (currentChapterOutline) {
    userPrompt += `\n## 本章大纲\n${currentChapterOutline}\n`
  }

  userPrompt += `\n## 上次生成的内容（用户不满意）\n${previousResult.slice(0, 4000)}\n`
  userPrompt += `\n## 用户反馈\n${feedback}\n`
  if (currentChapter) {
    userPrompt += `\n请根据以上反馈重新生成第${currentChapter.chapterNumber}章「${currentChapter.title}」的内容。不要包含章节标题，直接从正文开始。`
  } else {
    userPrompt += `\n请根据以上反馈重新生成本章内容。`
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
}

export function buildStyleAnalysisPrompt(
  sampleText: string
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    {
      role: 'system',
      content: `你是一位文学风格分析师。请分析以下小说片段的写作风格，生成一份简洁的风格指南（200-400字），包含：
1. 叙事视角（第一人称/第三人称/全知等）
2. 句式特点（长句/短句/混合，是否多用修辞）
3. 用词风格（文学性/口语化/简洁/华丽）
4. 节奏感（快节奏/慢节奏/交替）
5. 对话风格（简短/冗长/方言/书面）
6. 描写偏好（重环境/重心理/重动作）

直接输出风格指南文本，不要标题或前缀。`
    },
    { role: 'user', content: sampleText }
  ]
}

export function buildConsistencyCheckPrompt(context: {
  characters: Array<{ name: string; description?: string | null; traits?: string | null }>
  recentSummaries: Array<{ chapterNumber: number; summary: string }>
  targetChapter: { chapterNumber: number; content: string }
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { characters, recentSummaries, targetChapter } = context

  const charInfo = characters
    .map(c => `${c.name}: ${c.description || ''} (${c.traits || ''})`)
    .join('\n')

  const summaryText = recentSummaries
    .map(c => `第${c.chapterNumber}章: ${c.summary}`)
    .join('\n')

  return [
    {
      role: 'system',
      content: `你是一位专业的小说编辑。请检查以下章节内容是否存在一致性问题。
检查项目：
1. 角色名字是否前后一致
2. 时间线是否有矛盾
3. 已死亡/离开的角色是否意外出现
4. 地点描述是否前后矛盾
5. 角色性格是否突然改变（无合理原因）

以 JSON 数组格式返回发现的问题：[{"type": "角色一致性|时间线|地点|性格", "severity": "high|medium|low", "description": "问题描述"}]
如果没有发现问题，返回空数组 []。只返回 JSON。`
    },
    {
      role: 'user',
      content: `角色档案：\n${charInfo}\n\n前情摘要：\n${summaryText}\n\n当前章节（第${targetChapter.chapterNumber}章）：\n${targetChapter.content}`
    }
  ]
}

export function buildSuggestionPrompt(context: {
  novel: { title: string; genre?: string | null }
  chapter: { chapterNumber: number; title: string; content: string }
  characters: Array<{ name: string; description?: string | null }>
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, chapter, characters } = context

  const charInfo = characters.length > 0
    ? characters.map(c => `${c.name}: ${c.description || ''}`).join('\n')
    : ''

  return [
    {
      role: 'system',
      content: `你是一位专业的小说编辑。请审阅以下章节内容，找出可以改进的地方并提出具体修改建议。

## 审阅重点
- 表达不够生动或冗余的句子
- 对话不够自然的地方
- 描写可以更精炼或更有画面感的段落
- 节奏不当的地方（过快或过慢）
- 用词重复或不够精确的地方

## 返回格式
返回严格 JSON 数组，每条建议包含：
- originalText: 需要修改的原文片段（必须是章节中的精确原文，20-100字）
- suggestedText: 修改后的文本
- reason: 修改原因（简短，10-30字）

限制：最多返回 8 条建议，优先选择改进效果最明显的。
只返回 JSON 数组，不要其他内容。`
    },
    {
      role: 'user',
      content: `## 小说信息\n标题：${novel.title}${novel.genre ? `\n类型：${novel.genre}` : ''}\n章节：第${chapter.chapterNumber}章「${chapter.title}」\n\n${charInfo ? `## 角色档案\n${charInfo}\n\n` : ''}## 章节内容\n${chapter.content.slice(0, 10000)}`
    }
  ]
}

export function buildOutlineGenerationPrompt(context: {
  novel: { title: string; genre?: string | null; worldSetting?: string | null }
  characters: Array<{ name: string; description?: string | null }>
  idea: string
  chapterCount: number
  startChapter: number
  existingOutlines?: Array<{ chapterNumber: number; description: string }>
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, characters, idea, chapterCount, startChapter, existingOutlines } = context

  const worldContext = novel.worldSetting ? `\n世界观设定：${novel.worldSetting.slice(0, 500)}` : ''
  const characterContext = characters.length > 0
    ? `\n角色：${characters.slice(0, 15).map(c => `${c.name}${c.description ? `(${c.description})` : ''}`).join('、')}`
    : ''

  let existingContext = ''
  if (existingOutlines?.length) {
    const before = existingOutlines.filter(o => o.chapterNumber < startChapter)
    if (before.length > 0) {
      existingContext = `\n\n已有大纲（保留参考）：\n${before.map(o => `第${o.chapterNumber}章：${o.description}`).join('\n')}`
    }
  }

  return [
    {
      role: 'system',
      content: `你是一位专业的小说策划师。请根据用户提供的故事核心想法，生成章节大纲。
从第 ${startChapter} 章开始，连续生成 ${chapterCount} 章。
每章用一句话描述核心内容。
返回 JSON 数组格式：[{"chapterNumber": ${startChapter}, "description": "..."}]
只返回 JSON，不要其他内容。`
    },
    {
      role: 'user',
      content: `小说标题：${novel.title}\n类型：${novel.genre || '未指定'}${worldContext}${characterContext}\n\n故事核心想法：${idea}${existingContext}`
    }
  ]
}
