export function useChapters(novelId: Ref<number> | ComputedRef<number>) {
  const chapters = ref<any[]>([])
  const loading = ref(false)

  async function fetchChapters() {
    loading.value = true
    try {
      const data = await $fetch<any[]>(`/api/novels/${unref(novelId)}/chapters`)
      chapters.value = data || []
    } finally {
      loading.value = false
    }
  }

  async function createChapter(title: string) {
    const chapter = await $fetch(`/api/novels/${unref(novelId)}/chapters`, {
      method: 'POST',
      body: { title },
    })
    chapters.value.push(chapter)
    return chapter
  }

  async function updateChapter(chapterId: number, body: Record<string, any>) {
    const updated = await $fetch(`/api/novels/${unref(novelId)}/chapters/${chapterId}`, {
      method: 'PUT',
      body,
    })
    const idx = chapters.value.findIndex((c) => c.id === chapterId)
    if (idx !== -1) chapters.value[idx] = { ...chapters.value[idx], ...updated }
    return updated
  }

  async function deleteChapter(chapterId: number) {
    await $fetch(`/api/novels/${unref(novelId)}/chapters/${chapterId}`, {
      method: 'DELETE',
    })
    chapters.value = chapters.value.filter((c) => c.id !== chapterId)
  }

  async function reorderChapters(orderedIds: number[]) {
    await $fetch(`/api/novels/${unref(novelId)}/chapters/reorder`, {
      method: 'PUT',
      body: { orderedIds },
    })
    await fetchChapters()
  }

  return {
    chapters,
    loading,
    fetchChapters,
    createChapter,
    updateChapter,
    deleteChapter,
    reorderChapters,
  }
}
