import {
  CONTEXT_TRUNCATE_FULL,
  CONTEXT_TRUNCATE_REGEN,
  CONTEXT_TRUNCATE_CHAPTER,
  CONTEXT_TRUNCATE_WORLD
} from './ai-constants'

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
  id?: number
  name: string
  description?: string | null
  traits?: string | null
  relationships?: string | null
  currentState?: string | null
  realName?: string | null
  displayTitle?: string | null
  rolePosition?: string | null
  storyRole?: string | null
  overallArc?: string | null
}

export interface PromptCharacterStateChangeExtractionContext {
  novel: PromptNovel
  chapter: PromptChapter & { content: string }
  characters: Array<PromptCharacter & { id: number }>
}

export interface PromptCharacterStateChange {
  chapterNumber: number
  characterName: string
  relatedCharacterName?: string | null
  changeType: string
  afterValue: string
  evidenceQuote?: string | null
}

function formatPromptCharacterProfile(character: PromptCharacter): string {
  const parts = [
    character.realName ? `本名：${character.realName}` : '',
    character.displayTitle ? `称呼/位分：${character.displayTitle}` : '',
    character.rolePosition ? `身份：${character.rolePosition}` : '',
    character.storyRole ? `作用：${character.storyRole}` : '',
    character.description ? `简介：${character.description}` : '',
    character.traits ? `性格：${character.traits}` : '',
    character.relationships ? `关系：${character.relationships}` : '',
    character.currentState ? `当前状态：${character.currentState}` : '',
    character.overallArc ? `整体弧线：${character.overallArc}` : ''
  ].filter(Boolean)

  return parts.length ?
      `${character.id ? `角色ID ${character.id}：` : ''}${character.name}（${parts.join('；')}）`
    : `${character.id ? `角色ID ${character.id}：` : ''}${character.name}`
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

export interface PromptForeshadowing {
  content: string
  description: string | null
  chapterNumber: number | null
}

/** 写作技能包注入形态（systemAddon 注入 system，fewShots 作范文示范）。 */
export interface PromptWritingSkill {
  name: string
  systemAddon: string
  fewShots: Array<{ scene: string; content: string }>
  checklist: string[]
  genre: string | null
}

export interface RagContextItem {
  content: string
  contentType: string
  chapterId: number | null
  characterName?: string
  score?: number
}

function buildChapterSummaries(
  chapters: PromptChapter[],
  storyArcs?: PromptStoryArc[]
): string {
  let result = ''
  const totalChapters = chapters.length
  if (totalChapters <= 30) {
    for (const ch of chapters) {
      if (ch.summary)
        result += `第${ch.chapterNumber}章《${ch.title}》：${ch.summary}\n`
    }
  } else if (totalChapters <= 100) {
    for (const ch of chapters) {
      if (!ch.summary) continue
      const isRecent = ch.chapterNumber > totalChapters - 15
      const isFirst = ch.chapterNumber <= 5
      if (isRecent || isFirst) {
        result += `第${ch.chapterNumber}章《${ch.title}》：${ch.summary}\n`
      } else {
        const compressed =
          ch.summary.length > 80 ? ch.summary.slice(0, 80) + '…' : ch.summary
        result += `第${ch.chapterNumber}章：${compressed}\n`
      }
    }
  } else {
    if (storyArcs?.length) {
      result += '### 故事弧线概览\n'
      for (const arc of storyArcs) {
        result += `- ${arc.title}（第${arc.startChapter}-${arc.endChapter || '?'}章）：${arc.summary || '（进行中）'}\n`
      }
    }
    result += '### 开篇章节\n'
    for (const ch of chapters.slice(0, 5)) {
      if (ch.summary)
        result += `第${ch.chapterNumber}章《${ch.title}》：${ch.summary}\n`
    }
    result += '\n### 关键节点\n'
    for (const ch of chapters) {
      if (ch.chapterNumber % 10 === 0 && ch.summary)
        result += `第${ch.chapterNumber}章《${ch.title}》：${ch.summary}\n`
    }
    result += '\n### 近期章节\n'
    const recentStart = Math.max(0, totalChapters - 15)
    for (let i = recentStart; i < totalChapters; i++) {
      const ch = chapters[i]
      if (ch?.summary)
        result += `第${ch.chapterNumber}章《${ch.title}》：${ch.summary}\n`
    }
  }
  return result
}

function getRagContextLabel(contentType: string) {
  const labels: Record<string, string> = {
    plot_event: '剧情线索',
    world_detail: '世界观',
    chapter_summary: '章节摘要',
    foreshadowing: '伏笔',
    overall_arc: '角色弧线',
    profile: '角色档案',
    chapter_story: '角色经历'
  }
  return labels[contentType] || contentType
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

export function shouldUseCourtProtocol(novel?: PromptNovel | null) {
  if (!novel) {
    return false
  }

  const source = [
    novel.title,
    novel.genre,
    novel.description,
    novel.worldSetting,
    novel.styleGuide,
    novel.aiExtraPrompt
  ]
    .filter(Boolean)
    .join('\n')

  return includesAny(source, [
    '古代',
    '宫廷',
    '后宫',
    '宫斗',
    '皇帝',
    '嫔妃',
    '妃嫔',
    '皇后',
    '贵妃',
    '婕妤',
    '美人',
    '才人',
    '小主',
    '娘娘',
    '陛下',
    '太监',
    '宫女',
    '丫鬟'
  ])
}

export function buildProseProtocolRules(novel?: PromptNovel | null) {
  let rules = `## 社会规范与称谓
- 严格遵守世界观里的社会规范、等级体系、身份差序和称呼礼仪；人物说话必须符合其身份、地位、亲疏关系与当下场合。
- 保持同一人物、同一身份关系下的称谓一致；不要让下位者用现代平等口吻称呼上位者，不要随意直呼尊长、上级或主子。`

  if (shouldUseCourtProtocol(novel)) {
    rules += `
- 涉及古代宫廷、后宫、帝王或嫔妃场景时，必须使用宫廷称谓：正式宣旨可称完整位号，如「漪澜苑林美人」；太监、宫女、丫鬟当面对嫔妃应称「小主」「林小主」「婕妤小主」或对高位称「娘娘」，不得用轻慢、现代或平辈口吻。
- 丫鬟/宫女私下向自家主子提及其他嫔妃，也应称「张小主」「孙小主」「赵小主」「皇后娘娘」「贵妃娘娘」等；不要直呼其名，也不要让下人随意直称「张婕妤」「孙美人」来替代礼貌称谓。
- 嫔妃之间按位分与关系称呼，可用「姐姐」「妹妹」「某位分」等，但语气要符合尊卑与试探关系；太监传话时可冷硬，但不能越过礼制。`
  }

  return rules
}

export function buildTextProtocolRules() {
  return `## 文本一致性
- 保持原文的时代背景、身份关系、称谓体系和人物口吻；扩写或改写时不要把古代语境改成现代口吻，也不要改变上下级、主仆、官阶或亲疏关系。
- 若原文已有尊称、位号、官称、辈分称呼或主仆称谓，后续文本必须沿用同一套规则，不要随意直呼其名。`
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
  ragContext?: RagContextItem[]
  foreshadowing?: PromptForeshadowing[]
  recentChapterContent?: Array<{
    chapterNumber: number
    title: string
    content: string
  }>
  characterStateChanges?: PromptCharacterStateChange[]
  skills?: PromptWritingSkill[]
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
    ragContext,
    foreshadowing,
    recentChapterContent,
    characterStateChanges
  } = context

  let systemPrompt = `你是一位专业的小说作家。根据提供的上下文，续写本章正文。

## 叙事要求
- 保持与已有章节一致的写作风格、人称与时态
- 角色言行符合其性格与当前处境；推进剧情，不重复已有内容
- 注意伏笔的铺设与回收

${buildProseProtocolRules(novel)}

## 文字要求（避免「AI 腔」）
- 用具体的动作、对话、感官细节去「呈现」情绪与情节，不要用形容词和抽象议论去「告诉」读者人物的心情
- 不写总结式 / 升华式的段落或收尾（如「这一刻他终于明白……」「从此一切都不一样了」）
- 少用「与此同时」「然而」「殊不知」「不知为何」这类套话转场和万能连接词
- 对话保留潜台词，不要让人物把动机和道理一次说尽、说破
- 句子长短交错、控制节奏，避免每段结构雷同、信息密度均匀
- 克制比喻、不堆砌辞藻与排比；宁可朴素具体，不要空泛优美

## 输出
- 重要：必须在一个完整的段落结尾处停止，不要在句子中间截断。如果接近字数上限，请在当前段落写完后自然收束`

  if (novel.styleGuide) {
    systemPrompt += `\n\n## 风格指南\n${novel.styleGuide}`
  }

  // 写作技能包注入：systemAddon 接在风格之后；few-shot 范文与自检清单择要附上。
  // few-shot 已由加载层按「同题材优先」排序，这里只学手法、不照抄。
  const skills = context.skills || []
  if (skills.length) {
    const addons = skills
      .map((s) => s.systemAddon?.trim())
      .filter((x): x is string => Boolean(x))
    if (addons.length) {
      systemPrompt += `\n\n## 写作技能\n${addons.join('\n\n')}`
    }
    const shots: Array<{ scene: string; content: string }> = []
    for (const s of skills) {
      for (const fs of s.fewShots || []) {
        if (fs?.content?.trim()) shots.push(fs)
        if (shots.length >= 2) break
      }
      if (shots.length >= 2) break
    }
    if (shots.length) {
      systemPrompt += `\n\n## 优秀范例（仅学习其手法、节奏与质感，切勿照抄其情节、人名或设定）`
      for (const fs of shots) {
        systemPrompt += `\n\n【${fs.scene}】\n${fs.content.trim()}`
      }
    }
    const checks = Array.from(
      new Set(
        skills
          .flatMap((s) => s.checklist || [])
          .map((c) => c.trim())
          .filter(Boolean)
      )
    ).slice(0, 6)
    if (checks.length) {
      systemPrompt += `\n\n## 完成后自查（通读一遍，确保满足）\n${checks
        .map((c) => `- ${c}`)
        .join('\n')}`
    }
  }

  let userPrompt = ''

  // Story Bible
  userPrompt += `## 小说信息\n标题：${novel.title}\n`
  if (novel.genre) userPrompt += `类型：${novel.genre}\n`
  if (novel.description) userPrompt += `简介：${novel.description}\n`
  if (novel.worldSetting)
    userPrompt += `\n## 世界观设定\n${novel.worldSetting}\n`

  // Characters
  const ragItems = ragContext || []
  const charScoped = ragItems.filter(
    (i): i is RagContextItem & { characterName: string } =>
      Boolean(i.characterName)
  )
  const scopedCharacterNames = new Set(charScoped.map((i) => i.characterName))
  if (charScoped.length) {
    userPrompt += `\n## 角色档案（基于本章相关性检索）\n`
    const grouped = new Map<string, typeof charScoped>()
    for (const item of charScoped) {
      const list = grouped.get(item.characterName) || []
      list.push(item)
      grouped.set(item.characterName, list)
    }
    for (const [name, items] of grouped) {
      const char = characters.find((c) => c.name === name)
      userPrompt += `\n### ${name}\n`
      if (char) userPrompt += `${formatPromptCharacterProfile(char)}\n`
      const stories = items.filter((i) => i.contentType === 'chapter_story')
      if (stories.length) {
        userPrompt += `相关章节经历：\n`
        for (const s of stories) {
          userPrompt += `- ${s.content}\n`
        }
      }
    }
  }
  const characterList =
    charScoped.length ?
      characters.filter((char) => !scopedCharacterNames.has(char.name))
    : characters
  if (characterList.length > 0) {
    userPrompt += charScoped.length ? `\n## 其他角色档案\n` : `\n## 角色档案\n`
    for (const char of characterList) {
      userPrompt += `- ${formatPromptCharacterProfile(char)}\n`
    }
  }

  if (characterStateChanges?.length) {
    userPrompt += `\n## 已确认角色变化（仅限当前章之前）\n`
    for (const change of characterStateChanges.slice(-30)) {
      const relation =
        change.relatedCharacterName ?
          `；关联角色：${change.relatedCharacterName}`
        : ''
      const evidence =
        change.evidenceQuote ? `；证据：「${change.evidenceQuote}」` : ''
      userPrompt += `- 第${change.chapterNumber}章，${change.characterName} [${change.changeType}]：${change.afterValue}${relation}${evidence}\n`
    }
  }

  const nonCharacterRagItems = ragItems.filter((item) => !item.characterName)
  if (nonCharacterRagItems.length > 0) {
    userPrompt += `\n## 相关记忆（基于本章检索）\n`
    for (const item of nonCharacterRagItems.slice(0, 12)) {
      userPrompt += `- [${getRagContextLabel(item.contentType)}] ${item.content}\n`
    }
  }

  // Chapter summaries (hierarchical - never drops middle chapters)
  if (chapters.length > 0) {
    userPrompt += `\n## 已有章节摘要\n`
    userPrompt += buildChapterSummaries(chapters, storyArcs)
  }

  // Recent chapters full text — directly衔接当前章节的前序正文，保证剧情连贯。
  // 调用方传入的 recentChapterContent 是「当前章节的前 N 章」（连续生成场景已正确构建滑动窗口）；
  // 缺省时回退到从 chapters 末尾取，兼容未传该参数的旧调用。
  if (recentChapterContent?.length) {
    userPrompt += `\n## 最近章节全文\n`
    for (const ch of recentChapterContent) {
      userPrompt += `\n### 第${ch.chapterNumber}章「${ch.title}」\n${ch.content}\n`
    }
  } else if (chapters.length > 0) {
    const windowSize = chapters.length > 20 ? 1 : 2
    const windowStart = Math.max(0, chapters.length - windowSize)
    userPrompt += `\n## 最近章节全文\n`
    for (let i = windowStart; i < chapters.length; i++) {
      const ch = chapters[i]!
      if (ch.content) {
        userPrompt += `\n### 第${ch.chapterNumber}章「${ch.title}」\n${ch.content}\n`
      }
    }
  }

  // Plot points
  if (plotPoints.length > 0) {
    const active = plotPoints.filter((p) => p.status !== 'resolved')
    if (active.length > 0) {
      userPrompt += `\n## 活跃剧情线索\n`
      for (const p of active) {
        userPrompt += `- [${p.type}/${p.status}] ${p.description}\n`
      }
    }
  }

  // Foreshadowing — 待回收伏笔，提示 AI 在合适时机呼应或推进，避免伏笔悬空。
  if (foreshadowing?.length) {
    userPrompt += `\n## 待回收伏笔\n`
    for (const f of foreshadowing) {
      const where = f.chapterNumber ? `（第${f.chapterNumber}章埋设）` : ''
      userPrompt += `- ${f.content}${where}${f.description ? `：${f.description}` : ''}\n`
    }
  }

  // Generation instruction
  userPrompt += `\n## 生成指令\n`
  // 区分「真实标题」与「占位标题」：占位标题（第N章）只用于定位章节序号，
  // 不应要求 AI 紧扣这个空洞符号；只有用户/已有章节起过的真实标题才让 AI 围绕展开。
  const isPlaceholderTitle = (t: string, n: number) =>
    /^第\d+章\s*$/.test(t) || t.trim() === `第${n}章`
  if (currentChapter) {
    const hasRealTitle = !isPlaceholderTitle(
      currentChapter.title,
      currentChapter.chapterNumber
    )
    if (hasRealTitle) {
      userPrompt += `当前章节：第${currentChapter.chapterNumber}章「${currentChapter.title}」\n`
      userPrompt += `请围绕章节标题「${currentChapter.title}」展开内容，标题已确定，不要更改。生成的内容应与章节标题紧密相关。\n`
    } else {
      userPrompt += `当前生成：第${currentChapter.chapterNumber}章（标题未定）\n`
      userPrompt += `请承接前文、依据本章大纲与写作方向自然推进剧情，不要受占位标题约束。\n`
    }
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
    userPrompt += `\n请生成第${currentChapter.chapterNumber}章的完整内容。不要包含章节标题，直接从正文开始。`
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
    .map((a) => a.background || a.snippet)
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
      content: `## 章节内容\n${chapterContent.slice(0, CONTEXT_TRUNCATE_FULL)}\n\n## 该角色出现的片段\n${snippets}`
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
        previousArc ?
          `## 已有故事弧线\n${previousArc}`
        : '## 已有故事弧线\n（暂无，这是该角色首次出场）',
        `## 第${chapterNumber}章经历\n${newChapterStory}`
      ]
        .filter(Boolean)
        .join('\n\n')
    }
  ]
}

export function buildCharacterGenerationPrompt(context: {
  novel: {
    title: string
    description?: string
    genre?: string
    worldSetting?: string
    styleGuide?: string
  }
  existingCharacters: Array<{
    name: string
    description?: string
    traits?: string
    currentState?: string
  }>
  outlines: Array<{ chapterNumber: number; description: string }>
  count: number
  customPrompt?: string
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, existingCharacters, outlines, count, customPrompt } = context

  let systemPrompt =
    customPrompt ||
    `你是一位专业的小说角色设计师。请根据小说的背景信息，设计出性格鲜明、关系合理、有故事张力的角色。

## 设计原则
- 角色性格要有层次感，避免脸谱化
- 角色之间要有关系网络和冲突点
- 每个角色要有独特的辨识度
- 角色设定要服务于故事发展`

  let userPrompt = `## 小说信息\n标题：${novel.title}\n`
  if (novel.genre) userPrompt += `类型：${novel.genre}\n`
  if (novel.description) userPrompt += `简介：${novel.description}\n`
  if (novel.worldSetting)
    userPrompt += `\n## 世界观设定\n${novel.worldSetting}\n`
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
- name: 角色的本名 / 全书固定的通用称谓。注意：「美人」「公子」「那女人」这类**某个场景或某个人物专属的称呼、爱称、敬称、绰号**不是角色名，不要用作 name——优先用真实姓名；确无姓名时用中性指称（如「黑衣青年」），并把这类专属称呼写进 description。同一角色跨章节必须用同一个 name。
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

export function buildCharacterStateChangeExtractionPrompt(
  context: PromptCharacterStateChangeExtractionContext
): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, chapter, characters } = context
  const characterList = characters
    .map(
      (character) =>
        `- ID ${character.id}：${formatPromptCharacterProfile(character)}`
    )
    .join('\n')

  const systemPrompt = `你是一位严谨的小说角色状态编辑。请从当前章节正文中抽取“角色状态变化事实”，用于维护角色时间线。

只抽取章节中有明确原文证据的变化，不要根据常识、未来剧情或脑补补全角色资料。

changeType 只能使用以下值：
- description：身份、背景、角色简介发生明确补充或修正
- traits：性格、做事风格、长期行为特征发生明确变化
- relationships：与其他角色的关系、亲疏、阵营、敌友发生明确变化
- currentState：当前处境、状态、伤病、情绪、目标、位置发生明确变化
- realName：本名被揭示或修正
- displayTitle：称呼、位分、头衔发生明确变化
- rolePosition：身份定位、阶层、阵营、职能发生明确变化
- storyRole：剧情作用发生明确变化
- overallArc：角色长期弧线出现重要转折

输出要求：
- 返回严格 JSON 数组，不要 Markdown，不要解释。
- characterId 必须来自下方角色清单；不能确定具体角色时不要输出。
- relatedCharacterId 仅在 relationships 变化且能确定对方角色时填写，否则为 null。
- evidenceQuote 必须逐字摘录当前章节原文，10-80 字；没有原文证据的条目不要输出。
- confidence 是 0 到 1 的小数；证据直接清楚可给 0.8 以上，推断性较强应低于 0.8。
- afterValue 写成可直接进入角色档案的一句话；不要写“可能”“疑似”。

字段固定：
[{
  "characterId": 1,
  "characterName": "角色名",
  "relatedCharacterId": null,
  "relatedCharacterName": null,
  "changeType": "currentState",
  "beforeValue": null,
  "afterValue": "角色在本章后的新状态",
  "reason": "为什么这是变化",
  "evidenceQuote": "当前章节原文摘录",
  "confidence": 0.85
}]

没有可抽取的变化时返回 []。`

  let userPrompt = `## 小说信息\n标题：${novel.title}\n`
  if (novel.genre) userPrompt += `类型：${novel.genre}\n`
  if (novel.description) userPrompt += `简介：${novel.description}\n`
  if (novel.worldSetting)
    userPrompt += `\n## 世界观设定\n${novel.worldSetting.slice(0, CONTEXT_TRUNCATE_WORLD)}\n`

  userPrompt += `\n## 角色清单\n${characterList || '（暂无已知角色，返回 []）'}\n`
  userPrompt += `\n## 当前章节\n第${chapter.chapterNumber}章「${chapter.title}」\n`
  if (chapter.summary) userPrompt += `章节摘要：${chapter.summary}\n`
  userPrompt += `\n## 当前章节正文\n${chapter.content.slice(0, CONTEXT_TRUNCATE_FULL)}`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
}

export function buildStoryArcPrompt(
  chapterSummaries: Array<{
    chapterNumber: number
    title: string
    summary: string
  }>,
  startChapter: number,
  endChapter: number
): Array<{ role: 'system' | 'user'; content: string }> {
  const summaryText = chapterSummaries
    .map((ch) => `第${ch.chapterNumber}章「${ch.title}」：${ch.summary}`)
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
  ragContext?: RagContextItem[]
  foreshadowing?: PromptForeshadowing[]
}): Array<{ role: 'system' | 'user'; content: string }> {
  const {
    novel,
    chapters,
    characters,
    plotPoints,
    storyArcs,
    currentChapter,
    currentChapterOutline,
    previousResult,
    feedback,
    ragContext,
    foreshadowing
  } = context

  const systemPrompt = `你是一位专业的小说作家。用户对上一次生成的章节内容不满意，并提供了修改反馈。请根据反馈重新生成章节内容。

## 重要规则
- 认真理解用户的反馈意见，针对性地调整
- 保持与已有章节一致的写作风格和叙事视角
- 不要简单地在原文基础上修补，而是重新构思并生成
- 保留原文中用户没有提出异议的优秀部分
- 确保角色性格和行为的连贯性
- 必须在一个完整的段落结尾处停止，不要在句子中间截断

${buildProseProtocolRules(novel)}

## 文字要求（避免「AI 腔」）
- 用具体的动作、对话、感官细节去「呈现」情绪与情节，不要用形容词和抽象议论去「告诉」读者人物的心情
- 不写总结式 / 升华式的段落或收尾（如「这一刻他终于明白……」）
- 少用「与此同时」「然而」「殊不知」这类套话转场和万能连接词
- 对话保留潜台词，不要让人物把动机和道理一次说尽、说破
- 句子长短交错、控制节奏，避免每段结构雷同
- 克制比喻、不堆砌辞藻与排比；宁可朴素具体，不要空泛优美${novel.styleGuide ? `\n\n## 风格指南\n${novel.styleGuide}` : ''}`

  let userPrompt = `## 小说信息\n标题：${novel.title}\n`
  if (novel.genre) userPrompt += `类型：${novel.genre}\n`
  if (novel.worldSetting)
    userPrompt += `\n## 世界观设定\n${novel.worldSetting}\n`

  if (currentChapter) {
    userPrompt += `\n## 当前章节\n第${currentChapter.chapterNumber}章「${currentChapter.title}」\n`
  }

  if (ragContext?.length) {
    const charScoped = ragContext.filter((i) => i.characterName)
    if (charScoped.length) {
      userPrompt += `\n## 相关角色事件（基于本章检索）\n`
      for (const item of charScoped) {
        userPrompt += `- ${item.characterName}：${item.content}\n`
      }
    }
  } else if (characters.length > 0) {
    userPrompt += `\n## 角色档案\n`
    for (const char of characters.slice(0, 10)) {
      userPrompt += `- ${formatPromptCharacterProfile(char)}\n`
    }
  }

  if (chapters.length > 0) {
    userPrompt += `\n## 近期章节\n`
    const currentIdx =
      currentChapter ?
        chapters.findIndex(
          (ch) => ch.chapterNumber === currentChapter.chapterNumber
        )
      : chapters.length
    const precedingChapters = chapters.slice(
      Math.max(0, currentIdx - 5),
      currentIdx
    )
    for (const ch of precedingChapters) {
      if (ch.summary) {
        userPrompt += `第${ch.chapterNumber}章「${ch.title}」：${ch.summary}\n`
      }
    }
    const lastChapter = precedingChapters[precedingChapters.length - 1]
    if (lastChapter?.content) {
      userPrompt += `\n## 上一章全文（第${lastChapter.chapterNumber}章）\n${lastChapter.content.slice(-CONTEXT_TRUNCATE_CHAPTER)}\n`
    }
  }

  if (plotPoints.length > 0) {
    const active = plotPoints.filter((p) => p.status !== 'resolved')
    if (active.length > 0) {
      userPrompt += `\n## 活跃剧情线索\n`
      for (const p of active.slice(0, 10)) {
        userPrompt += `- [${p.type}/${p.status}] ${p.description}\n`
      }
    }
  }

  if (foreshadowing?.length) {
    userPrompt += `\n## 待回收伏笔\n`
    for (const f of foreshadowing.slice(0, 10)) {
      const where = f.chapterNumber ? `（第${f.chapterNumber}章埋设）` : ''
      userPrompt += `- ${f.content}${where}${f.description ? `：${f.description}` : ''}\n`
    }
  }

  if (currentChapterOutline) {
    userPrompt += `\n## 本章大纲\n${currentChapterOutline}\n`
  }

  userPrompt += `\n## 上次生成的内容（用户不满意）\n${previousResult.slice(0, CONTEXT_TRUNCATE_REGEN)}\n`
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
  novel?: { worldSetting?: string | null }
  characters: Array<{
    id: number
    name: string
    description?: string | null
    traits?: string | null
  }>
  recentSummaries: Array<{ chapterNumber: number; summary: string }>
  priorPassages: Array<{
    chapterNumber: number | null
    label: string
    content: string
  }>
  targetChapter: { chapterNumber: number; content: string }
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, characters, recentSummaries, priorPassages, targetChapter } =
    context

  const charInfo = characters
    .map((c) => `${c.name}: ${c.description || ''} (${c.traits || ''})`)
    .join('\n')

  const summaryText = recentSummaries
    .map((c) => `第${c.chapterNumber}章: ${c.summary}`)
    .join('\n')

  const priorText =
    priorPassages.length ?
      priorPassages
        .map(
          (p) =>
            `【${p.chapterNumber ? `第${p.chapterNumber}章` : p.label}】${p.content}`
        )
        .join('\n\n')
    : '（无检索到的早先原文，若无法引用早先原文/前情请不要报告需要跨章对照的问题）'

  return [
    {
      role: 'system',
      content: `你是一位严谨的小说编辑。请检查当前章节是否与"早先原文/前情"存在**真正的**一致性矛盾。

检查项目：
1. 角色名字/称呼前后不一致
2. 称呼不符合世界观设定（如宫廷文中用"小姐"而非"小主/娘娘"，武侠文中用"你"而非"阁下/前辈"等）
3. 时间线矛盾
4. 已死亡/离开的角色意外出现
5. 地点描述前后矛盾
6. 角色性格无合理原因突变

举证要求（非常重要，违反则该问题作废）：
- 每条问题必须同时给出两段**真实存在、逐字摘录**的原文：
  - quote：摘自"当前章节"的原文片段（20-60 字）
  - priorQuote：摘自上方"早先相关原文/前情摘要"的原文片段（20-60 字），并在 priorChapter 标注其所属章节号
- 给不出这两段真实原文引用的疑似问题，一律**不要输出**（宁可漏报，不要臆测）
- 不要把叙事手法当矛盾：伏笔、有意留白、回忆/闪回、视角差异、不可靠叙述者都**不是**矛盾
- confidence 表示你对"这是真矛盾"的把握（0-1 小数），低于 0.5 的不要输出

以 JSON 数组返回：
[{"type":"角色一致性|时间线|地点|性格","severity":"high|medium|low","description":"问题描述","quote":"本章原文","priorQuote":"早先原文","priorChapter":章节号,"confidence":0.8}]
没有发现真矛盾时返回空数组 []。只返回 JSON。`
    },
    {
      role: 'user',
      content: `${novel?.worldSetting ? `世界观设定：\n${novel.worldSetting}\n\n` : ''}角色档案：\n${charInfo}\n\n前情摘要：\n${summaryText}\n\n早先相关原文（priorQuote 必须摘自这里或上面的前情摘要）：\n${priorText}\n\n当前章节（第${targetChapter.chapterNumber}章，quote 必须摘自这里）：\n${targetChapter.content}`
    }
  ]
}

export function buildSuggestionPrompt(context: {
  novel: { title: string; genre?: string | null }
  chapter: { chapterNumber: number; title: string; content: string }
  characters: Array<{ name: string; description?: string | null }>
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, chapter, characters } = context

  const charInfo =
    characters.length > 0 ?
      characters.map((c) => `${c.name}: ${c.description || ''}`).join('\n')
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
  const {
    novel,
    characters,
    idea,
    chapterCount,
    startChapter,
    existingOutlines
  } = context

  const worldContext =
    novel.worldSetting ?
      `\n世界观设定：${novel.worldSetting.slice(0, CONTEXT_TRUNCATE_WORLD)}`
    : ''
  const characterContext =
    characters.length > 0 ?
      `\n角色：${characters
        .slice(0, 15)
        .map((c) => `${c.name}${c.description ? `(${c.description})` : ''}`)
        .join('、')}`
    : ''

  let existingContext = ''
  if (existingOutlines?.length) {
    const before = existingOutlines.filter(
      (o) => o.chapterNumber < startChapter
    )
    if (before.length > 0) {
      existingContext = `\n\n已有大纲（保留参考）：\n${before.map((o) => `第${o.chapterNumber}章：${o.description}`).join('\n')}`
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

export function buildChapterOutlinePrompt(context: {
  novel: {
    title: string
    genre?: string | null
    worldSetting?: string | null
    styleGuide?: string | null
  }
  chapter: { chapterNumber: number; title: string }
  characters: Array<{ name: string; description?: string | null }>
  idea?: string | null
  currentOutline?: string | null
  existingOutlines?: Array<{ chapterNumber: number; description: string }>
}): Array<{ role: 'system' | 'user'; content: string }> {
  const worldContext =
    context.novel.worldSetting ?
      `\n世界观设定：${context.novel.worldSetting.slice(0, CONTEXT_TRUNCATE_WORLD)}`
    : ''
  const styleContext =
    context.novel.styleGuide ?
      `\n写作风格：${context.novel.styleGuide.slice(0, 800)}`
    : ''
  const characterContext =
    context.characters.length ?
      `\n相关角色：${context.characters
        .slice(0, 15)
        .map(
          (character) =>
            `${character.name}${character.description ? `（${character.description}）` : ''}`
        )
        .join('、')}`
    : ''
  const nearbyOutlines = (context.existingOutlines || [])
    .filter(
      (outline) =>
        outline.chapterNumber !== context.chapter.chapterNumber &&
        Math.abs(outline.chapterNumber - context.chapter.chapterNumber) <= 3
    )
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
    .map((outline) => `第${outline.chapterNumber}章：${outline.description}`)
    .join('\n')

  return [
    {
      role: 'system',
      content: `你是一位专业的小说章节策划师。请为用户指定的单个章节生成一段可直接写入编辑器的本章大纲。\n只返回一段本章大纲文本，不要 JSON，不要 Markdown，不要章节号列表，不要解释。`
    },
    {
      role: 'user',
      content: `小说标题：${context.novel.title}\n类型：${context.novel.genre || '未指定'}${worldContext}${styleContext}${characterContext}\n章节：第${context.chapter.chapterNumber}章「${context.chapter.title}」\n当前本章大纲：${context.currentOutline || '暂无'}\n用户规划方向：${context.idea || '请按小说设定自然规划'}${nearbyOutlines ? `\n邻近章节大纲：\n${nearbyOutlines}` : ''}`
    }
  ]
}

export function buildChapterPlanGenerationPrompt(context: {
  novel: {
    title: string
    genre?: string | null
    worldSetting?: string | null
    styleGuide?: string | null
  }
  chapter: { title: string; chapterNumber: number }
  chapterOutline: string
  characters: Array<{
    name: string
    description?: string | null
    traits?: string | null
    relationships?: string | null
    currentState?: string | null
    realName?: string | null
    displayTitle?: string | null
    rolePosition?: string | null
    storyRole?: string | null
  }>
  outlines: Array<{ chapterNumber: number; description: string }>
  existingPlan?: Partial<{
    goal: string
    mustInclude: string
    avoid: string
    pacing: string
    protocol: string
  }>
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, chapter, chapterOutline, characters, outlines, existingPlan } =
    context

  const worldContext =
    novel.worldSetting ?
      `\n世界观设定：${novel.worldSetting.slice(0, CONTEXT_TRUNCATE_WORLD)}`
    : ''
  const styleContext =
    novel.styleGuide ? `\n写作风格：${novel.styleGuide.slice(0, 800)}` : ''
  const characterContext =
    characters.length ?
      `\n已确认出场角色：\n${characters
        .slice(0, 12)
        .map((character) => `- ${formatPromptCharacterProfile(character)}`)
        .join('\n')}`
    : '\n已确认出场角色：未选择，请按大纲自然规划，不要硬塞无关角色。'
  const nearbyOutlines = outlines
    .filter((outline) => {
      return Math.abs(outline.chapterNumber - chapter.chapterNumber) <= 2
    })
    .map((outline) => `第${outline.chapterNumber}章：${outline.description}`)
    .join('\n')
  const outlineContext =
    nearbyOutlines ? `\n邻近章节大纲：\n${nearbyOutlines}` : ''
  const existingPlanContext =
    existingPlan ?
      `\n用户已填剧情要求：\n${[
        ['本章目标', existingPlan.goal],
        ['必须出现', existingPlan.mustInclude],
        ['避免出现', existingPlan.avoid],
        ['情绪/节奏', existingPlan.pacing],
        ['称谓或设定补充', existingPlan.protocol]
      ]
        .map(([label, value]) => {
          const text = String(value || '').trim()
          return text ? `${label}：${text}` : ''
        })
        .filter(Boolean)
        .join('\n')}`
    : ''

  return [
    {
      role: 'system',
      content: `你是一位专业的小说章节策划师。请根据已确认的本章大纲和角色，生成「大致剧情」计划。

要求：
- 只做剧情规划，不要写正文，不要写章节标题，不要输出解释。
- 草案要服务本章大纲，避免加入与大纲无关的新支线。
    - 本章必须有清晰目标、核心冲突、关键转折和读者继续读下去的兴趣钩子。
- 必须尊重角色身份、上下级关系、时代背景和称谓礼制；宫廷/古言场景尤其注意太监、宫女、嫔妃、皇帝之间的称谓边界。
- 如果用户已有填写内容，在不违背大纲的前提下吸收并优化。
- 只返回严格 JSON 对象，不要 markdown，不要代码块，不要解释文字。
- JSON 必须包含这些字段名：goal, conflict, turningPoint, beats, mustInclude, avoid, characters, characterStateDeltas, plotThreadActions, foreshadowingActions, interestHooks, continuityRisks, pacing, protocol。
- JSON 形状必须严格匹配：{"goal":"","conflict":"","turningPoint":"","beats":[],"mustInclude":[],"avoid":[],"characters":[],"characterStateDeltas":[],"plotThreadActions":[],"foreshadowingActions":[],"interestHooks":[],"continuityRisks":[],"pacing":"","protocol":""}
- 上面的空字符串和空数组只表示字段类型，禁止原样返回上面的空 JSON 形状。
- goal / conflict / turningPoint / pacing / protocol 必须写成贴合本章的具体内容，禁止照抄字段说明。
- beats / mustInclude / avoid / characterStateDeltas / interestHooks / continuityRisks 必须是字符串数组；beats 至少 3 条，每条必须是可执行剧情动作。
- characters 只能填写下方“角色ID”里的数字；没有合适角色时填空数组，不要猜 1、2、3。
- plotThreadActions / foreshadowingActions 当前没有提供可用 ID 时必须填空数组，不要猜 1。`
    },
    {
      role: 'user',
      content: `小说标题：${novel.title}\n类型：${novel.genre || '未指定'}${worldContext}${styleContext}\n章节：第${chapter.chapterNumber}章「${chapter.title}」\n本章大纲：${chapterOutline}${characterContext}${outlineContext}${existingPlanContext}`
    }
  ]
}

export type ChapterPlanSection = 'core' | 'constraints' | 'references'

export type ChapterPlanSectionContext = {
  section: ChapterPlanSection
  novel: {
    title: string
    genre?: string | null
    worldSetting?: string | null
    styleGuide?: string | null
  }
  chapter: { title: string; chapterNumber: number }
  chapterOutline: string
  characters: Array<PromptCharacter & { id: number }>
  outlines: Array<{ chapterNumber: number; description: string }>
  existingPlan?: Partial<{
    goal: string
    mustInclude: string
    avoid: string
    pacing: string
    protocol: string
  }>
  existingPartialPlan?: Partial<{
    goal: string
    conflict: string
    turningPoint: string
    beats: string[]
    interestHooks: string[]
    mustInclude: string[]
    avoid: string[]
    pacing: string
    protocol: string
    continuityRisks: string[]
  }>
  plotPoints?: Array<{ id: number; description: string }>
  foreshadowings?: Array<{ id: number; content: string }>
}

export interface ChapterPlanSectionRepairContext extends ChapterPlanSectionContext {
  failedOutput: string
  failureReason: string
}

export type ChapterPlanPromptFieldValueKind = 'text' | 'list' | 'numberList'

export interface ChapterPlanFieldContext extends Omit<
  ChapterPlanSectionContext,
  'section'
> {
  field: string
  label: string
  valueKind: ChapterPlanPromptFieldValueKind
  instruction?: string
}

export interface ChapterPlanFieldRepairContext extends ChapterPlanFieldContext {
  failedOutput: string
  failureReason: string
}

const CHAPTER_PLAN_SECTION_CONFIG: Record<
  ChapterPlanSection,
  { title: string; shape: string; fields: string[]; rules: string[] }
> = {
  core: {
    title: '剧情骨架',
    shape:
      '{"goal":"","conflict":"","turningPoint":"","beats":[],"interestHooks":[]}',
    fields: ['goal', 'conflict', 'turningPoint', 'beats', 'interestHooks'],
    rules: [
      'goal / conflict / turningPoint 必须写成贴合本章大纲的具体剧情内容。',
      'beats 必须是字符串数组，至少 3 条，每条是可执行剧情动作。',
      'interestHooks 必须是字符串数组，写出章末或段落中的悬念、爽点或反转。'
    ]
  },
  constraints: {
    title: '约束节奏',
    shape:
      '{"mustInclude":[],"avoid":[],"pacing":"","protocol":"","continuityRisks":[]}',
    fields: ['mustInclude', 'avoid', 'pacing', 'protocol', 'continuityRisks'],
    rules: [
      'mustInclude / avoid / continuityRisks 必须是字符串数组。',
      'pacing 写本章情绪与节奏要求，protocol 写称谓、身份、礼制或设定补充。',
      '如果没有连续性风险，continuityRisks 返回空数组。'
    ]
  },
  references: {
    title: '引用状态',
    shape:
      '{"characters":[],"characterStateDeltas":[],"plotThreadActions":[],"foreshadowingActions":[]}',
    fields: [
      'characters',
      'characterStateDeltas',
      'plotThreadActions',
      'foreshadowingActions'
    ],
    rules: [
      'characters 只能填写下方“角色ID”里的数字；没有合适角色时填空数组。',
      'plotThreadActions 只能填写下方“剧情线ID”里的数字；没有可用 ID 时填空数组。',
      'foreshadowingActions 只能填写下方“伏笔ID”里的数字；没有可用 ID 时填空数组。',
      'characterStateDeltas 必须是字符串数组，描述角色在本章计划中的状态变化。'
    ]
  }
}

function formatChapterPlanSectionContext(context: ChapterPlanSectionContext) {
  const { novel, chapter, chapterOutline, characters, outlines } = context
  const worldContext =
    novel.worldSetting ?
      `\n世界观设定：${novel.worldSetting.slice(0, CONTEXT_TRUNCATE_WORLD)}`
    : ''
  const styleContext =
    novel.styleGuide ? `\n写作风格：${novel.styleGuide.slice(0, 800)}` : ''
  const characterContext =
    characters.length ?
      `\n已确认出场角色：\n${characters
        .slice(0, 12)
        .map((character) => `- ${formatPromptCharacterProfile(character)}`)
        .join('\n')}`
    : '\n已确认出场角色：未选择。'
  const nearbyOutlines = outlines
    .filter(
      (outline) => Math.abs(outline.chapterNumber - chapter.chapterNumber) <= 2
    )
    .map((outline) => `第${outline.chapterNumber}章：${outline.description}`)
    .join('\n')
  const outlineContext =
    nearbyOutlines ? `\n邻近章节大纲：\n${nearbyOutlines}` : ''
  const existingPlanItems = [
    cleanChapterPlanUserText(context.existingPlan?.goal) ?
      `本章目标：${cleanChapterPlanUserText(context.existingPlan?.goal)}`
    : '',
    cleanChapterPlanUserText(context.existingPlan?.mustInclude) ?
      `必须出现：${cleanChapterPlanUserText(context.existingPlan?.mustInclude)}`
    : '',
    cleanChapterPlanUserText(context.existingPlan?.avoid) ?
      `避免出现：${cleanChapterPlanUserText(context.existingPlan?.avoid)}`
    : '',
    cleanChapterPlanUserText(context.existingPlan?.pacing) ?
      `情绪/节奏：${cleanChapterPlanUserText(context.existingPlan?.pacing)}`
    : '',
    cleanChapterPlanUserText(context.existingPlan?.protocol) ?
      `称谓或设定补充：${cleanChapterPlanUserText(context.existingPlan?.protocol)}`
    : ''
  ].filter(Boolean)
  const existingPlan =
    existingPlanItems.length ?
      `\n用户已填剧情要求：\n${existingPlanItems.join('\n')}`
    : ''
  const existingPartial = formatChapterPlanExistingPartial(
    context.existingPartialPlan
  )
  const plotPointContext =
    context.plotPoints?.length ?
      `\n可用剧情线：\n${context.plotPoints
        .map((point) => `- 剧情线ID ${point.id}：${point.description}`)
        .join('\n')}`
    : '\n可用剧情线：无。'
  const foreshadowingContext =
    context.foreshadowings?.length ?
      `\n可用伏笔：\n${context.foreshadowings
        .map(
          (foreshadowing) =>
            `- 伏笔ID ${foreshadowing.id}：${foreshadowing.content}`
        )
        .join('\n')}`
    : '\n可用伏笔：无。'
  const referenceContext =
    context.section === 'references' ?
      `${plotPointContext}${foreshadowingContext}`
    : ''

  return `小说标题：${novel.title}\n类型：${novel.genre || '未指定'}${worldContext}${styleContext}\n章节：第${chapter.chapterNumber}章「${chapter.title}」\n本章大纲：${chapterOutline}${characterContext}${outlineContext}${existingPlan}${existingPartial}${referenceContext}`
}

function cleanChapterPlanUserText(value?: string | null): string {
  const text = String(value || '').trim()
  if (!text) return ''
  if (
    text.includes('用户要求') ||
    text.includes('用户需要') ||
    text.includes('我需要') ||
    text.includes('输入框') ||
    text.includes('不要JSON') ||
    text.includes('不能使用JSON') ||
    /^首先[，,]/.test(text) ||
    /^好的[，,]/.test(text)
  ) {
    return ''
  }
  return text
}

function formatChapterPlanExistingPartial(
  existingPartialPlan: ChapterPlanSectionContext['existingPartialPlan']
) {
  if (!existingPartialPlan) return ''
  const goal = cleanChapterPlanUserText(existingPartialPlan.goal)
  const conflict = cleanChapterPlanUserText(existingPartialPlan.conflict)
  const turningPoint = cleanChapterPlanUserText(existingPartialPlan.turningPoint)
  const beats = cleanChapterPlanUserTextList(existingPartialPlan.beats)
  const interestHooks = cleanChapterPlanUserTextList(
    existingPartialPlan.interestHooks
  )
  const mustInclude = cleanChapterPlanUserTextList(
    existingPartialPlan.mustInclude
  )
  const avoid = cleanChapterPlanUserTextList(existingPartialPlan.avoid)
  const pacing = cleanChapterPlanUserText(existingPartialPlan.pacing)
  const protocol = cleanChapterPlanUserText(existingPartialPlan.protocol)
  const continuityRisks = cleanChapterPlanUserTextList(
    existingPartialPlan.continuityRisks
  )
  const lines = [
    goal ? `本章目标：${goal}` : '',
    conflict ? `核心冲突：${conflict}` : '',
    turningPoint ? `关键转折：${turningPoint}` : '',
    beats.length ? `剧情节拍：${beats.join('；')}` : '',
    interestHooks.length ? `兴趣钩子：${interestHooks.join('；')}` : '',
    mustInclude.length ? `必须出现：${mustInclude.join('；')}` : '',
    avoid.length ? `避免出现：${avoid.join('；')}` : '',
    pacing ? `情绪节奏：${pacing}` : '',
    protocol ? `称谓设定：${protocol}` : '',
    continuityRisks.length ? `连续性风险：${continuityRisks.join('；')}` : ''
  ].filter(Boolean)

  return lines.length ? `\n已生成计划片段：\n${lines.join('\n')}` : ''
}

function cleanChapterPlanUserTextList(values?: string[] | null): string[] {
  return (values || []).map(cleanChapterPlanUserText).filter(Boolean)
}

function formatChapterPlanFieldContext(context: ChapterPlanFieldContext) {
  const referenceSection: ChapterPlanSection =
    context.valueKind === 'numberList' ? 'references' : 'core'
  return formatChapterPlanSectionContext({
    ...context,
    section: referenceSection
  })
}

export function buildChapterPlanFieldPrompt(
  context: ChapterPlanFieldContext
): Array<{ role: 'system' | 'user'; content: string }> {
  const outputRule =
    context.valueKind === 'text' ? '只输出一段可直接填入输入框的中文正文。'
    : context.valueKind === 'list' ? '每行 1 条，每条都要可直接填入输入框。'
    : '只输出可用 ID，每行 1 个数字；没有合适 ID 就留空。'
  const referenceRule =
    context.valueKind === 'numberList' ?
      '\n- 只能使用用户消息里明确列出的真实 ID，不要猜测或补造 ID。'
    : ''
  const customInstruction =
    context.instruction ? `\n- ${context.instruction}` : ''

  return [
    {
      role: 'system',
      content: `你是一位专业的小说章节策划师。请只生成【${context.label}】输入框的内容。

要求：
- 只输出最终要填入该输入框的内容，不要解释、分析、标题、前言或总结。
    - 第一个字必须就是内容本身，禁止以“好的”“首先”“我需要”“用户要求”“从大纲看”等开头。
- 不要 JSON，不要代码块，不要字段名，不要 markdown 表格。
- ${outputRule}${referenceRule}${customInstruction}`
    },
    { role: 'user', content: formatChapterPlanFieldContext(context) }
  ]
}

export function buildChapterPlanFieldRepairPrompt(
  context: ChapterPlanFieldRepairContext
): Array<{ role: 'system' | 'user'; content: string }> {
  const messages = buildChapterPlanFieldPrompt(context)
  return [
    messages[0],
    {
      role: 'user',
      content: `${formatChapterPlanFieldContext(context)}

上一次输出无法写入【${context.label}】输入框。
原因：${context.failureReason}
上一次输出：
${context.failedOutput.slice(0, 1200)}

请重新生成，只输出【${context.label}】输入框内容。`
    }
  ]
}

export function buildChapterPlanSectionPrompt(
  context: ChapterPlanSectionContext
): Array<{ role: 'system' | 'user'; content: string }> {
  const config = CHAPTER_PLAN_SECTION_CONFIG[context.section]
  return [
    {
      role: 'system',
      content: `你是一位专业的小说章节策划师。请只生成章节计划的「${config.title}」部分。

要求：
- 只做剧情规划，不要写正文，不要写章节标题，不要输出解释。
- 只返回严格 JSON 对象，不要 markdown，不要代码块，不要解释文字。
- 不要输出思考过程、分析过程、步骤说明、理由、前言或总结；第一个字符必须是 {，最后一个字符必须是 }。
- 本轮只能返回这些字段：${config.fields.join(', ')}。
- JSON 形状必须严格匹配：${config.shape}
- 顶层 JSON 必须直接包含上述字段，禁止包在「${config.title}」、core、constraints、references 或其他外层字段里。
- 上面的空字符串和空数组只表示字段类型，禁止原样返回上面的空 JSON 形状。
- ${config.rules.join('\n- ')}`
    },
    { role: 'user', content: formatChapterPlanSectionContext(context) }
  ]
}

export function buildChapterPlanSectionRepairPrompt(
  context: ChapterPlanSectionRepairContext
): Array<{ role: 'system' | 'user'; content: string }> {
  const config = CHAPTER_PLAN_SECTION_CONFIG[context.section]
  return [
    {
      role: 'system',
      content: `你是一位专业的小说章节策划师。请修复章节计划的「${config.title}」部分。

要求：
- 只返回严格 JSON 对象，不要 markdown，不要代码块，不要解释文字。
- 不要输出思考过程、分析过程、步骤说明、理由、前言或总结；第一个字符必须是 {，最后一个字符必须是 }。
- 本轮只能返回这些字段：${config.fields.join(', ')}。
- JSON 形状必须严格匹配：${config.shape}
- 顶层 JSON 必须直接包含上述字段，禁止包在「${config.title}」、core、constraints、references 或其他外层字段里。
- 不要复读空模板；必须根据本章大纲和已有上下文写出可用剧情内容。
- ${config.rules.join('\n- ')}`
    },
    {
      role: 'user',
      content: `${formatChapterPlanSectionContext(context)}

## 上一次输出存在问题
解析错误：${context.failureReason}
原始输出：
${context.failedOutput.slice(0, 2000)}

请只修复并返回「${config.title}」JSON。`
    }
  ]
}

export function buildCharacterEnrichPrompt(context: {
  novel: {
    title: string
    description?: string
    genre?: string
    worldSetting?: string
    styleGuide?: string
  }
  character: {
    name: string
    description?: string
    traits?: string
    relationships?: string
    currentState?: string
    realName?: string
    displayTitle?: string
    rolePosition?: string
    storyRole?: string
  }
  existingCharacters: Array<{
    name: string
    description?: string
    traits?: string
    relationships?: string
    currentState?: string
    realName?: string
    displayTitle?: string
    rolePosition?: string
    storyRole?: string
  }>
  outlines: Array<{ chapterNumber: number; description: string }>
  fieldsToEnrich: string[]
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { novel, character, existingCharacters, outlines, fieldsToEnrich } =
    context

  const fieldDescriptions: Record<string, string> = {
    description: '简介（角色的身份、背景、定位，50-150字）',
    traits: '性格特征（用顿号分隔的性格关键词或短语，3-8个）',
    relationships: '人物关系（与其他角色的关系描述，每段关系用分号分隔）',
    currentState:
      '当前状态（写清本章前的处境、身份状态、立场或近期目标，30-100字）',
    realName:
      '本名（能从设定推断才填写；不能确定时填“本名待定”，不要硬编完整姓名）',
    displayTitle: '称呼/位分（如林美人、赵才人、张婕妤；不是本名）',
    rolePosition: '身份定位（写清阶层、阵营、职能或社会身份，20-60字）',
    storyRole:
      '剧情作用（写清这个角色在当前剧情中的独特用途，避免和其他配角重复，20-80字）'
  }

  const fieldsInstruction = fieldsToEnrich
    .map((f) => `- ${f}: ${fieldDescriptions[f]}`)
    .join('\n')

  const systemPrompt = `你是一位专业的小说角色设计师。用户已经创建了一个角色但部分字段为空，请根据角色名、已有信息和小说背景，为空白字段生成合理的内容。

## 规则
- 只生成用户指定的空白字段
- 生成内容要与小说的世界观、风格和已有角色保持一致
- 如果有其他角色信息，关系描述应与他们产生关联
- 如果角色名像「孙美人」「赵才人」「张婕妤」这类称谓/位分，不要把称谓当成本名；简介和当前状态必须写清“这是称呼/位分，以及真实身份或待定本名”
- 宫廷/古代语境下要区分本名、称呼、位分、主仆关系和尊卑边界
- realName 与 displayTitle 必须分开：称谓/位分只能放 displayTitle；不能确定真实姓名时 realName 填“本名待定”，不要为了完整而硬编
- 同类配角必须差异化：rolePosition、storyRole、traits 不要与已有角色重复；要明确她与其他同位分/同阵营角色的不同作用
- 返回严格 JSON 对象，只包含需要填充的字段
- 不要包含 Markdown 代码块标记，直接返回 JSON`

  let userPrompt = `## 小说信息\n标题：${novel.title}\n`
  if (novel.genre) userPrompt += `类型：${novel.genre}\n`
  if (novel.description) userPrompt += `简介：${novel.description}\n`
  if (novel.worldSetting)
    userPrompt += `\n## 世界观设定\n${novel.worldSetting.slice(0, 2000)}\n`
  if (novel.styleGuide)
    userPrompt += `\n## 风格指南\n${novel.styleGuide.slice(0, 1000)}\n`

  userPrompt += `\n## 当前角色\n名字：${character.name}\n`
  if (character.realName) userPrompt += `已有本名：${character.realName}\n`
  if (character.displayTitle)
    userPrompt += `已有称呼/位分：${character.displayTitle}\n`
  if (character.rolePosition)
    userPrompt += `已有身份定位：${character.rolePosition}\n`
  if (character.storyRole)
    userPrompt += `已有剧情作用：${character.storyRole}\n`
  if (character.description)
    userPrompt += `已有简介：${character.description}\n`
  if (character.traits) userPrompt += `已有性格：${character.traits}\n`
  if (character.relationships)
    userPrompt += `已有关系：${character.relationships}\n`
  if (character.currentState)
    userPrompt += `已有当前状态：${character.currentState}\n`

  if (existingCharacters.length > 0) {
    userPrompt += `\n## 其他角色\n`
    for (const c of existingCharacters.slice(0, 15)) {
      userPrompt += `- ${c.name}`
      if (c.realName) userPrompt += `（本名：${c.realName}）`
      if (c.displayTitle) userPrompt += `（称呼/位分：${c.displayTitle}）`
      if (c.description) userPrompt += `：${c.description}`
      if (c.traits) userPrompt += `（${c.traits}）`
      if (c.currentState) userPrompt += `；当前：${c.currentState}`
      if (c.rolePosition) userPrompt += `；身份：${c.rolePosition}`
      if (c.storyRole) userPrompt += `；作用：${c.storyRole}`
      userPrompt += '\n'
    }
  }

  if (outlines.length > 0) {
    userPrompt += `\n## 章节大纲\n`
    for (const o of outlines.slice(0, 10)) {
      userPrompt += `- 第${o.chapterNumber}章：${o.description}\n`
    }
  }

  userPrompt += `\n## 需要生成的字段\n${fieldsInstruction}\n`
  userPrompt += `\n请返回 JSON 对象，只包含 key：${fieldsToEnrich.join('、')}。`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
}

/**
 * 剧情线索 / 伏笔抽取（后处理，廉价 extraction 模型）：从本章正文里抽出长期记忆相关的线索，
 * 供 extract_plot_threads 任务按签名 upsert 进 Foreshadowing / PlotPoint，避免 AI 自埋的伏笔悬空。
 * 传入「已有活跃伏笔/线索」让模型优先匹配回收/推进而非重复新建。只要严格 JSON，解析失败时上层丢弃。
 */
export function buildPlotThreadExtractionPrompt(context: {
  chapterNumber: number
  chapterContent: string
  activeForeshadowing: Array<{ content: string }>
  activePlotPoints: Array<{ description: string }>
}): Array<{ role: 'system' | 'user'; content: string }> {
  const {
    chapterNumber,
    chapterContent,
    activeForeshadowing,
    activePlotPoints
  } = context
  const fsList =
    activeForeshadowing.length ?
      activeForeshadowing.map((f, i) => `${i + 1}. ${f.content}`).join('\n')
    : '（暂无）'
  const ppList =
    activePlotPoints.length ?
      activePlotPoints.map((p, i) => `${i + 1}. ${p.description}`).join('\n')
    : '（暂无）'

  return [
    {
      role: 'system',
      content: `你是一位严谨的小说情节编辑。请从「当前章节」中抽取与长期剧情记忆相关的线索，便于后续章节呼应、避免伏笔悬空。

只关注**真正承载剧情的线索**（新埋的伏笔、新开的悬念/矛盾、对已有线索的推进或回收）；忽略日常过场与纯氛围描写。

每条输出一个对象，字段：
- kind：只能是 foreshadow_setup（本章新埋下的伏笔）| foreshadow_payoff（本章回收/揭晓了某条已有伏笔）| plot_open（本章新开启的剧情线索/悬念/矛盾）| plot_advance（本章推进了某条已有线索）| plot_resolve（本章了结了某条已有线索）
- summary：一句话概括该线索（20-50字），用作长期记忆
- groundQuote：本章中体现它的原文片段（10-40字，必须逐字摘录）
- relatedTo：当 kind 为 payoff/advance/resolve 时必填，填下方「已有伏笔/线索」清单里被呼应的那一条的原文摘要；setup/open 时省略

举证要求（违反则该条作废）：
- 给不出 groundQuote（本章真实原文）的条目一律不要输出
- payoff/advance/resolve 必须能在下方清单里找到对应项，找不到就改判为 setup/open

以 JSON 数组返回，不要解释、不要 Markdown。没有可抽取的线索时返回 []。`
    },
    {
      role: 'user',
      content: `## 已有待回收伏笔\n${fsList}\n\n## 已有活跃剧情线索\n${ppList}\n\n## 当前章节（第${chapterNumber}章，groundQuote 必须摘自这里）\n${chapterContent.slice(0, CONTEXT_TRUNCATE_FULL)}`
    }
  ]
}

/**
 * 检索 query 规划（v1 query-only 档用）：给轻量地板 + 任务意图，让模型产出一组检索查询语，
 * 用于到"小说记忆库"按需取料。只要严格 JSON 字符串数组，解析失败时调用方回落 seed-only。
 */
export function buildQueryPlanningPrompt(context: {
  intent: string
  seed?: string
  novel?: { title: string; genre?: string | null; description?: string | null }
  characterNames?: string[]
  foreshadowingTitles?: string[]
  recentSummaries?: string[]
}): Array<{ role: 'system' | 'user'; content: string }> {
  const {
    intent,
    seed,
    novel,
    characterNames,
    foreshadowingTitles,
    recentSummaries
  } = context

  let userPrompt = ''
  if (novel) {
    userPrompt += `小说：${novel.title}`
    if (novel.genre) userPrompt += `（${novel.genre}）`
    userPrompt += '\n'
    if (novel.description) userPrompt += `简介：${novel.description}\n`
  }
  userPrompt += `\n本次任务：${intent}\n`
  if (seed?.trim()) userPrompt += `任务要点：${seed.slice(0, 400)}\n`
  if (characterNames?.length)
    userPrompt += `\n已知角色：${characterNames.slice(0, 30).join('、')}\n`
  if (foreshadowingTitles?.length)
    userPrompt += `\n待回收伏笔：${foreshadowingTitles
      .slice(0, 12)
      .map((t) => t.slice(0, 30))
      .join('；')}\n`
  if (recentSummaries?.length)
    userPrompt += `\n近章摘要：\n${recentSummaries.slice(-6).join('\n')}\n`

  return [
    {
      role: 'system',
      content: `你是检索规划助手。为了写好接下来的内容，需要从「小说记忆库」（角色档案、角色历程、剧情线索、伏笔、世界观、章节摘要）里调取最相关的资料。
请根据任务，列出 2-5 条**检索查询语句**，覆盖你认为写这段内容最需要确认的上下文（如：某角色的当前状态/关系、某条伏笔的埋设细节、首次提及的设定等）。
要求：
- 每条 query 是一句简短的中文检索语，聚焦一个具体的人/事/设定
- 只返回严格 JSON 字符串数组，不要解释、不要 Markdown
示例：["主角林川与师父的恩怨", "黑塔伏笔的最初描写", "女主角当前的处境与目标"]`
    },
    { role: 'user', content: userPrompt }
  ]
}
