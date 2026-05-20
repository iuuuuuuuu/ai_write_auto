export function buildGenerationPrompt(context: {
  novel: any
  chapters: any[]
  characters: any[]
  plotPoints: any[]
  currentChapterOutline?: string
  userDirection?: string
  storyArcs?: any[]
  ragContext?: Array<{ characterName: string; content: string; contentType: string; chapterId: number | null }>
}): Array<{ role: 'system' | 'user'; content: string }> {
  const {
    novel,
    chapters,
    characters,
    plotPoints,
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
- 注意伏笔的铺设和回收`

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
      const char = characters.find((c: any) => c.name === name)
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
    const active = plotPoints.filter((p: any) => p.status !== 'resolved')
    if (active.length > 0) {
      userPrompt += `\n## 活跃剧情线索\n`
      for (const p of active) {
        userPrompt += `- [${p.type}/${p.status}] ${p.description}\n`
      }
    }
  }

  // Generation instruction
  userPrompt += `\n## 生成指令\n`
  if (currentChapterOutline) {
    userPrompt += `本章大纲：${currentChapterOutline}\n`
  }
  if (userDirection) {
    userPrompt += `写作方向：${userDirection}\n`
  }
  if (novel.aiExtraPrompt) {
    userPrompt += `额外指示：${novel.aiExtraPrompt}\n`
  }
  userPrompt += `\n请生成下一章的完整内容。`

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
