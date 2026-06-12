export interface ReadingHistoryItem {
  novelId: number
  novelTitle: string
  chapterId: number
  chapterNumber: number
  chapterTitle: string
  readAt: number
}

const STORAGE_KEY = 'reading_history_v1'
const MAX_HISTORY = 20

function loadHistory(): ReadingHistoryItem[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed as ReadingHistoryItem[]
  } catch {
    // ignore
  }
  return []
}

function saveHistory(list: ReadingHistoryItem[]) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function useReadingHistory() {
  const history = useState<ReadingHistoryItem[]>('reading-history', () =>
    loadHistory()
  )

  const recentHistory = computed(() => {
    return history.value
      .filter(
        (item, index, self) =>
          index === self.findIndex((t) => t.chapterId === item.chapterId)
      )
      .slice(0, 10)
  })

  function recordReading(item: Omit<ReadingHistoryItem, 'readAt'>) {
    const newItem: ReadingHistoryItem = { ...item, readAt: Date.now() }
    const filtered = history.value.filter(
      (h) => !(h.novelId === item.novelId && h.chapterId === item.chapterId)
    )
    const updated = [newItem, ...filtered].slice(0, MAX_HISTORY)
    history.value = updated
    saveHistory(updated)
  }

  function removeHistory(chapterId: number) {
    const updated = history.value.filter((h) => h.chapterId !== chapterId)
    history.value = updated
    saveHistory(updated)
  }

  function removeNovelHistory(novelId: number) {
    const updated = history.value.filter((h) => h.novelId !== novelId)
    history.value = updated
    saveHistory(updated)
    if (!import.meta.client) return
    try {
      localStorage.removeItem(`novel_read_history_${novelId}`)
    } catch {
      // ignore
    }
  }

  function clearHistory() {
    history.value = []
    saveHistory([])
  }

  return {
    history: readonly(history),
    recentHistory,
    recordReading,
    removeHistory,
    removeNovelHistory,
    clearHistory
  }
}
