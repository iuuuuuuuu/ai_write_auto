<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const novelId = computed(() => Number(route.params.id))

interface NovelReadDetail {
  id: number
  title: string
  description: string | null
}

interface ReadChapterItem {
  id: number
  chapterNumber: number
  title: string
  content: string | null
  wordCount: number | null
  updatedAt: string
}

const { data: novel } = await useFetch<NovelReadDetail>(
  `/api/novels/${novelId.value}`
)
const { data: chapters } = await useFetch<ReadChapterItem[]>(
  `/api/novels/${novelId.value}/chapters`,
  { default: () => [] }
)

const { recordReading } = useReadingHistory()

const activeChapterId = shallowRef<number | null>(null)
const readMode = shallowRef<'scroll' | 'page'>('scroll')
const currentPage = shallowRef(1)
const charsPerPage = 1200
const historyKey = computed(() => `novel_read_history_${novelId.value}`)

const sortedChapters = computed(() => {
  return [...(chapters.value || [])].sort((left, right) => {
    return left.chapterNumber - right.chapterNumber
  })
})

const activeChapter = computed(() => {
  return sortedChapters.value.find((chapter) => chapter.id === activeChapterId.value) || sortedChapters.value[0] || null
})

const activeChapterIndex = computed(() => {
  if (!activeChapter.value) return -1
  return sortedChapters.value.findIndex((chapter) => chapter.id === activeChapter.value?.id)
})

const previousChapter = computed(() => {
  const index = activeChapterIndex.value
  return index > 0 ? sortedChapters.value[index - 1] : null
})

const nextChapter = computed(() => {
  const index = activeChapterIndex.value
  return index >= 0 && index < sortedChapters.value.length - 1 ? sortedChapters.value[index + 1] : null
})

const pagedContent = computed(() => {
  const content = activeChapter.value?.content || ''
  const pages: string[] = []
  for (let i = 0; i < content.length; i += charsPerPage) {
    pages.push(content.slice(i, i + charsPerPage))
  }
  return pages.length ? pages : ['']
})

const activePageContent = computed(() => pagedContent.value[currentPage.value - 1] || '')

function goPreviousPage() {
  if (readMode.value === 'page' && currentPage.value > 1) {
    currentPage.value -= 1
    return
  }
  if (previousChapter.value) {
    selectChapter(previousChapter.value.id)
    nextTick(() => {
      currentPage.value = readMode.value === 'page' ? pagedContent.value.length : 1
    })
  }
}

function goNextPage() {
  if (readMode.value === 'page' && currentPage.value < pagedContent.value.length) {
    currentPage.value += 1
    return
  }
  if (nextChapter.value) {
    selectChapter(nextChapter.value.id)
  }
}

function handleReaderKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goPreviousPage()
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    goNextPage()
  }
}

const readingProgress = computed(() => {
  if (!sortedChapters.value.length || activeChapterIndex.value < 0) return 0
  const chapterProgress = activeChapterIndex.value / sortedChapters.value.length
  const pageProgress = readMode.value === 'page' ? currentPage.value / Math.max(pagedContent.value.length, 1) / sortedChapters.value.length : 1 / sortedChapters.value.length
  return Math.round((chapterProgress + pageProgress) * 100)
})

function saveReadingHistory(chapterId: number) {
  try {
    localStorage.setItem(
      historyKey.value,
      JSON.stringify({ chapterId, readAt: Date.now() })
    )
  } catch {
    // localStorage 可能不可用
  }

  const chapter = sortedChapters.value.find((c) => c.id === chapterId)
  if (chapter && novel.value) {
    recordReading({
      novelId: novelId.value,
      novelTitle: novel.value.title,
      chapterId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title
    })
  }
}

function loadReadingHistory() {
  try {
    const raw = localStorage.getItem(historyKey.value)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<{ chapterId: number }>
    return typeof parsed.chapterId === 'number' ? parsed.chapterId : null
  } catch {
    return null
  }
}

function selectChapter(chapterId: number) {
  activeChapterId.value = chapterId
  currentPage.value = 1
  saveReadingHistory(chapterId)
}

onMounted(() => {
  const lastChapterId = loadReadingHistory()
  const initialChapter = sortedChapters.value.find((chapter) => chapter.id === lastChapterId) || sortedChapters.value[0]
  if (initialChapter) {
    activeChapterId.value = initialChapter.id
  }
  window.addEventListener('keydown', handleReaderKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleReaderKeydown)
})

watch(activeChapterId, (chapterId) => {
  if (chapterId) saveReadingHistory(chapterId)
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <section class="card-glass relative overflow-hidden p-4 md:p-5">
      <div class="liquid-orb -right-16 -top-20 h-44 w-44 bg-primary-400/20" />
      <div class="liquid-highlight" />
      <div class="relative z-10 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="min-w-0">
          <NButton
            size="tiny"
            quaternary
            round
            @click="navigateTo(`/novels/${novelId}`)"
          >
            <template #icon><Icon icon="lucide:arrow-left" /></template>
            返回作品
          </NButton>
          <h1 class="mt-2 text-2xl font-semibold text-(--ui-text-highlighted)">
            {{ novel?.title || '阅读' }}
          </h1>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
            {{ novel?.description || '暂无简介' }}
          </p>
        </div>
        <div class="flex flex-col gap-3 items-end">
          <NRadioGroup v-model:value="readMode" size="small">
            <NRadioButton value="scroll">滚动</NRadioButton>
            <NRadioButton value="page">翻页</NRadioButton>
          </NRadioGroup>
          <div class="liquid-panel min-w-[180px] p-3">
            <p class="text-xs text-(--ui-text-dimmed)">阅读进度</p>
            <p class="mt-1 font-mono text-xl text-(--ui-text-highlighted)">
              {{ readingProgress }}%
            </p>
            <NProgress
              class="mt-2"
              type="line"
              :percentage="readingProgress"
              :show-indicator="false"
            />
          </div>
        </div>
      </div>
    </section>

    <div class="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside class="card-glass max-h-[calc(100dvh-160px)] overflow-y-auto p-3">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">目录</h2>
          <span class="text-xs text-(--ui-text-dimmed)">{{ sortedChapters.length }} 章</span>
        </div>
        <div class="space-y-1">
          <button
            v-for="chapter in sortedChapters"
            :key="chapter.id"
            type="button"
            class="w-full rounded-lg px-3 py-2 text-left transition-colors"
            :class="chapter.id === activeChapter?.id ? 'bg-white/18 text-primary-500 ring-1 ring-white/15' : 'text-(--ui-text-muted) hover:bg-white/10 hover:text-(--ui-text)'"
            @click="selectChapter(chapter.id)"
          >
            <p class="truncate text-xs font-mono">Ch.{{ chapter.chapterNumber }}</p>
            <p class="mt-0.5 truncate text-sm font-medium">{{ chapter.title }}</p>
          </button>
        </div>
      </aside>

      <article class="card-glass min-h-[640px] p-5 md:p-8">
        <template v-if="activeChapter">
          <div class="mb-6 border-b border-white/15 pb-4">
            <p class="text-xs font-mono text-primary-500">
              Chapter {{ activeChapter.chapterNumber }}
            </p>
            <h2 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
              {{ activeChapter.title }}
            </h2>
            <p class="mt-2 text-xs text-(--ui-text-dimmed)">
              {{ activeChapter.wordCount || 0 }} 字
            </p>
          </div>
          <div class="whitespace-pre-wrap text-base leading-[2.2] text-(--ui-text)">
            {{ readMode === 'page' ? activePageContent : activeChapter.content || '本章暂无内容。' }}
          </div>
          <div v-if="readMode === 'page'" class="mt-4 text-center text-xs text-(--ui-text-dimmed)">
            第 {{ currentPage }} / {{ pagedContent.length }} 页 · 可使用左右方向键翻页
          </div>
          <div class="mt-8 flex items-center justify-between border-t border-white/15 pt-4">
            <NButton
              :disabled="readMode === 'page' ? (!previousChapter && currentPage <= 1) : !previousChapter"
              secondary
              round
              @click="readMode === 'page' ? goPreviousPage() : previousChapter && selectChapter(previousChapter.id)"
            >
              <template #icon><Icon icon="lucide:chevron-left" /></template>
              {{ readMode === 'page' ? '上一页' : '上一章' }}
            </NButton>
            <NButton
              type="primary"
              round
              @click="navigateTo(`/novels/${novelId}/chapters/${activeChapter.id}`)"
            >
              <template #icon><Icon icon="lucide:pencil" /></template>
              编辑本章
            </NButton>
            <NButton
              :disabled="readMode === 'page' ? (!nextChapter && currentPage >= pagedContent.length) : !nextChapter"
              secondary
              round
              @click="readMode === 'page' ? goNextPage() : nextChapter && selectChapter(nextChapter.id)"
            >
              {{ readMode === 'page' ? '下一页' : '下一章' }}
              <template #icon><Icon icon="lucide:chevron-right" /></template>
            </NButton>
          </div>
        </template>
        <div
          v-else
          class="flex min-h-[420px] items-center justify-center text-sm text-(--ui-text-muted)"
        >
          暂无可阅读章节
        </div>
      </article>
    </div>
  </div>
</template>
