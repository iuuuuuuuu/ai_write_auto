export interface AiTitleUsage {
  inputTokens: number
  outputTokens: number
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
