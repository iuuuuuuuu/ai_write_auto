export function useNovels() {
  const novels = useState<any[]>('novels', () => [])

  async function fetchNovels() {
    novels.value = await $fetch('/api/novels')
  }

  async function createNovel(data: { title: string; description?: string; genre?: string }) {
    const novel = await $fetch('/api/novels', {
      method: 'POST',
      body: data,
    })
    novels.value.unshift(novel)
    return novel
  }

  async function deleteNovel(id: number) {
    await $fetch(`/api/novels/${id}`, { method: 'DELETE' })
    novels.value = novels.value.filter(n => n.id !== id)
  }

  async function importNovel(title: string, content: string, format: 'txt' | 'md') {
    return await $fetch('/api/novels/import', {
      method: 'POST',
      body: { title, content, format },
    })
  }

  return {
    novels,
    fetchNovels,
    createNovel,
    deleteNovel,
    importNovel,
  }
}
