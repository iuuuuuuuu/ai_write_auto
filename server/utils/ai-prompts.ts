export function buildGenerationPrompt(context: {
  novel: any
  chapters: any[]
  characters: any[]
  plotPoints: any[]
  currentChapterOutline?: string
  userDirection?: string
  storyArcs?: any[]
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, chapters, characters, plotPoints, currentChapterOutline, userDirection, storyArcs } = context

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
  if (novel.worldSetting) userPrompt += `\n## 世界观设定\n${novel.worldSetting}\n`

  // Characters
  if (characters.length > 0) {
    userPrompt += `\n## 角色档案\n`
    for (const char of characters) {
      userPrompt += `- ${char.name}`
      if (char.description) userPrompt += `：${char.description}`
      if (char.traits) userPrompt += `（性格：${char.traits}）`
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
    { role: 'user', content: userPrompt },
  ]
}

export function buildSummaryPrompt(chapterContent: string): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: '你是一位文学编辑。请为以下章节内容生成一段简洁的摘要（100-200字），包含关键事件、角色行为和情节发展。' },
    { role: 'user', content: chapterContent },
  ]
}

export function buildCharacterExtractionPrompt(chapterContent: string): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: `你是一位文学分析师。请从以下章节中提取出现的角色信息，以 JSON 数组格式返回。每个角色包含：
- name: 角色名
- description: 简短描述
- traits: 性格特征
- currentState: 当前状态（位置、情绪等）

只返回 JSON，不要其他内容。` },
    { role: 'user', content: chapterContent },
  ]
}
