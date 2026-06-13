export interface AiTitleUsage {
  inputTokens: number
  outputTokens: number
}

export interface ChapterOutlineIdeaInput {
  chapterNumber: number
  chapterTitle?: string | null
}

export function cleanAiChapterTitle(rawTitle: string) {
  let title = rawTitle.trim()

  if (title.includes('data:')) {
    const chunks: string[] = []
    for (const line of title.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      try {
        const data = JSON.parse(trimmed.slice(5).trim()) as {
          title?: string
          content?: string
          fullContent?: string
        }
        if (data.title) chunks.push(data.title)
        else if (data.fullContent) chunks.push(data.fullContent)
        else if (data.content) chunks.push(data.content)
      } catch {}
    }
    if (chunks.length) title = chunks.join('')
  }

  const firstLine = title
    .replace(/^\s*(章节名|章节标题|标题)[:：]\s*/u, '')
    .replace(/^第[\d一二三四五六七八九十百千万]+章\s*/u, '')
    .replace(/["“”'‘’《》【】]/g, '')

  return (firstLine.split(/[。！？!?，,；;\n\r]/u)[0] || '').trim().slice(0, 20)
}

export function formatAiTitleUsage(usage: AiTitleUsage | null) {
  if (!usage) return ''
  const total = usage.inputTokens + usage.outputTokens
  return `本次消耗 ${total} tokens（输入 ${usage.inputTokens} / 输出 ${usage.outputTokens}）`
}

export function buildDefaultChapterOutlineIdea(input: ChapterOutlineIdeaInput) {
  const title = stripChapterNumberPrefix(input.chapterTitle)
  const chapterLabel = `第 ${input.chapterNumber} 章${title ? `「${title}」` : ''}`

  if (input.chapterNumber <= 1) {
    return `${chapterLabel}是小说的开篇章节，需要快速建立世界观、引入主角、制造悬念。开头要有吸引力，让读者想继续读下去。避免大段背景介绍，用行动和对话展现世界。`
  }

  return `${chapterLabel}需要承接前文推进主线，延续已建立的人物关系和冲突。请围绕本章标题规划新的剧情进展、情绪变化和结尾钩子，避免重复开篇介绍。`
}

/** 去掉标题里冗余的「第N章」前缀，取出真正的标题文字（可能为空）。 */
export function stripChapterNumberPrefix(
  title: string | null | undefined
): string {
  return (title || '')
    .replace(/^\s*第[\d一二三四五六七八九十百千万]+章\s*[:：、.\-]?\s*/u, '')
    .trim()
}

/**
 * 章节目录显示名：序号按「当前位置」动态生成（删章后自动顺延，不会乱），
 * 真实标题（若有，已去掉冗余「第N章」前缀）附在序号之后。
 * @param title 存储的标题
 * @param position 1-based 位置序号（在已排序章节列表中的位置）
 */
export function displayChapterTitle(
  title: string | null | undefined,
  position: number
): string {
  const real = stripChapterNumberPrefix(title)
  return real ? `第${position}章 ${real}` : `第${position}章`
}
