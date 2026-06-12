interface NovelCreateInput {
  title: string
  description?: string
  genre?: string
  styleGuide?: string
  worldSetting?: string
  aiTemperature?: string
  aiExtraPrompt?: string
}

interface NovelSummary {
  id: number
  title: string
  description: string | null
  genre: string | null
  status: string
  wordCount: number | null
  createdAt: string
  updatedAt: string
}

export function useNovels() {
  const novels = useState<NovelSummary[]>('novels', () => [])
  const { removeNovelHistory } = useReadingHistory()

  async function fetchNovels() {
    const data = await $fetch<{ items: NovelSummary[] }>('/api/novels')
    novels.value = data.items
  }

  async function createNovel(data: NovelCreateInput) {
    const novel = await $fetch<NovelSummary>('/api/novels', {
      method: 'POST',
      body: data
    })
    novels.value.unshift(novel)
    return novel
  }

  async function deleteNovel(id: number) {
    await $fetch(`/api/novels/${id}`, { method: 'DELETE' })
    novels.value = novels.value.filter((n) => n.id !== id)
    removeNovelHistory(id)
  }

  async function importNovel(
    title: string,
    content: string,
    format: 'txt' | 'md'
  ) {
    return await $fetch('/api/novels/import', {
      method: 'POST',
      body: { title, content, format }
    })
  }

  return {
    novels,
    fetchNovels,
    createNovel,
    deleteNovel,
    importNovel
  }
}
