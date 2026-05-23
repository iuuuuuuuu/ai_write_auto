<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()

function getErrorMessage(errorValue: unknown, fallback = '操作失败'): string {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = (errorValue as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return fallback
}

interface TrashNovel {
  id: number
  title: string
  description: string | null
  genre: string | null
  status: string
  wordCount: number | null
  deletedAt: string
  createdAt: string
}

interface TrashChapter {
  id: number
  title: string
  chapterNumber: number
  wordCount: number | null
  deletedAt: string
  novel: { id: number; title: string }
}

interface TrashResponse {
  novels: { items: TrashNovel[]; total: number; totalPages: number }
  chapters: { items: TrashChapter[]; total: number; totalPages: number }
}

const activeTab = ref('novels')
const page = ref(1)
const pageSize = ref(12)
const loading = ref(false)
const novels = ref<TrashNovel[]>([])
const chapters = ref<TrashChapter[]>([])
const novelsTotal = ref(0)
const chaptersTotal = ref(0)
const novelsTotalPages = ref(0)
const chaptersTotalPages = ref(0)

async function fetchTrash() {
  loading.value = true
  try {
    const data = await $fetch<TrashResponse>('/api/novels/trash', {
      params: { page: page.value, pageSize: pageSize.value }
    })
    novels.value = data.novels.items
    novelsTotal.value = data.novels.total
    novelsTotalPages.value = data.novels.totalPages
    chapters.value = data.chapters.items
    chaptersTotal.value = data.chapters.total
    chaptersTotalPages.value = data.chapters.totalPages
  } catch (e: any) {
    message.error(e?.data?.message || '加载回收站失败')
  } finally {
    loading.value = false
  }
}

onMounted(fetchTrash)

function goToPage(p: number) {
  page.value = p
  fetchTrash()
}

function formatDeletedAt(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

async function restore(type: 'novel' | 'chapter', id: number) {
  try {
    await $fetch('/api/novels/trash', {
      method: 'POST',
      body: { type, id }
    })
    message.success(type === 'novel' ? '小说已恢复' : '章节已恢复')
    await fetchTrash()
  } catch (errorValue: unknown) {
    message.error(getErrorMessage(errorValue, '恢复失败'))
  }
}

function confirmDelete(type: 'novel' | 'chapter', item: TrashNovel | TrashChapter) {
  dialog.warning({
    title: '永久删除',
    content: `确定要永久删除「${item.title}」吗？此操作不可撤销，关联数据也将被清除。`,
    positiveText: '永久删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      try {
        await $fetch('/api/novels/trash', {
          method: 'DELETE',
          body: { type, id: item.id }
        })
        message.success('已永久删除')
        await fetchTrash()
      } catch (errorValue: unknown) {
        message.error(getErrorMessage(errorValue, '删除失败'))
      }
    }
  })
}

const currentItems = computed(() => activeTab.value === 'novels' ? novels.value : chapters.value)
const currentTotal = computed(() => activeTab.value === 'novels' ? novelsTotal.value : chaptersTotal.value)
const currentTotalPages = computed(() => activeTab.value === 'novels' ? novelsTotalPages.value : chaptersTotalPages.value)

function getStatusLabel(status: string) {
  if (status === 'completed') return '已完结'
  if (status === 'in_progress') return '连载中'
  return '草稿'
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <div class="relative z-10 flex items-center gap-4">
        <div class="liquid-panel flex size-12 items-center justify-center rounded-[1.35rem]">
          <Icon
            icon="lucide:trash-2"
            class="size-5 text-red-500"
          />
        </div>
        <div>
          <p class="mb-1 text-xs uppercase tracking-[0.22em] text-red-500/75">Recovery vault</p>
          <h1 class="text-2xl font-semibold tracking-[-0.04em] text-(--ui-text-highlighted)">
            {{ t('trash.title') }}
          </h1>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
            已删除的小说和章节，30 天后将自动清理
          </p>
        </div>
      </div>
    </section>

    <section class="card-glass p-3 sm:p-4">
      <NTabs v-model:value="activeTab" type="segment" animated @update:value="page = 1; fetchTrash()">
        <NTabPane name="novels" tab="小说">
          <div v-if="loading && !novels.length" class="py-12 flex justify-center">
            <NSpin size="medium" />
          </div>
          <NEmpty v-else-if="!novels.length" description="没有已删除的小说" class="py-12" />
          <TransitionGroup v-else name="list" tag="div" class="relative mt-4 grid gap-3">
            <article
              v-for="novel in novels"
              :key="novel.id"
              class="liquid-panel flex items-start justify-between gap-4 p-4"
            >
              <div class="min-w-0 flex-1">
                <div class="mb-1.5 flex items-center gap-2">
                  <h3 class="truncate text-sm font-semibold text-(--ui-text-highlighted)">
                    {{ novel.title }}
                  </h3>
                  <span class="shrink-0 rounded-full bg-(--ui-bg-muted) px-2 py-0.5 text-[10px] text-(--ui-text-muted) ring-1 ring-(--ui-border)">
                    {{ getStatusLabel(novel.status) }}
                  </span>
                </div>
                <p v-if="novel.description" class="mb-2 line-clamp-1 text-xs text-(--ui-text-muted)">
                  {{ novel.description }}
                </p>
                <div class="flex flex-wrap items-center gap-3 text-[11px] text-(--ui-text-dimmed)">
                  <span class="flex items-center gap-1">
                    <Icon icon="lucide:clock" class="size-3" />
                    {{ formatDeletedAt(novel.deletedAt) }}删除
                  </span>
                  <span v-if="novel.wordCount" class="flex items-center gap-1">
                    <Icon icon="lucide:type" class="size-3" />
                    {{ novel.wordCount.toLocaleString() }} 字
                  </span>
                  <span v-if="novel.genre" class="flex items-center gap-1">
                    <Icon icon="lucide:tag" class="size-3" />
                    {{ novel.genre }}
                  </span>
                </div>
              </div>
              <div class="shrink-0 flex items-center gap-2">
                <NButton size="small" round @click="restore('novel', novel.id)">
                  <template #icon><Icon icon="lucide:rotate-ccw" class="size-3.5" /></template>
                  恢复
                </NButton>
                <NButton size="small" type="error" ghost circle @click="confirmDelete('novel', novel)">
                  <template #icon><Icon icon="lucide:trash-2" class="size-3.5" /></template>
                </NButton>
              </div>
            </article>
          </TransitionGroup>
        </NTabPane>

        <NTabPane name="chapters" tab="章节">
          <div v-if="loading && !chapters.length" class="py-12 flex justify-center">
            <NSpin size="medium" />
          </div>
          <NEmpty v-else-if="!chapters.length" description="没有已删除的章节" class="py-12" />
          <TransitionGroup v-else name="list" tag="div" class="relative mt-4 grid gap-3">
            <article
              v-for="chapter in chapters"
              :key="chapter.id"
              class="liquid-panel flex items-start justify-between gap-4 p-4"
            >
              <div class="min-w-0 flex-1">
                <div class="mb-1.5 flex items-center gap-2">
                  <span class="shrink-0 text-xs text-(--ui-text-dimmed)">第{{ chapter.chapterNumber }}章</span>
                  <h3 class="truncate text-sm font-semibold text-(--ui-text-highlighted)">
                    {{ chapter.title }}
                  </h3>
                </div>
                <div class="flex flex-wrap items-center gap-3 text-[11px] text-(--ui-text-dimmed)">
                  <span class="flex items-center gap-1">
                    <Icon icon="lucide:book-open" class="size-3" />
                    {{ chapter.novel.title }}
                  </span>
                  <span class="flex items-center gap-1">
                    <Icon icon="lucide:clock" class="size-3" />
                    {{ formatDeletedAt(chapter.deletedAt) }}删除
                  </span>
                  <span v-if="chapter.wordCount" class="flex items-center gap-1">
                    <Icon icon="lucide:type" class="size-3" />
                    {{ chapter.wordCount.toLocaleString() }} 字
                  </span>
                </div>
              </div>
              <div class="shrink-0 flex items-center gap-2">
                <NButton size="small" round @click="restore('chapter', chapter.id)">
                  <template #icon><Icon icon="lucide:rotate-ccw" class="size-3.5" /></template>
                  恢复
                </NButton>
                <NButton size="small" type="error" ghost circle @click="confirmDelete('chapter', chapter)">
                  <template #icon><Icon icon="lucide:trash-2" class="size-3.5" /></template>
                </NButton>
              </div>
            </article>
          </TransitionGroup>
        </NTabPane>
      </NTabs>
    </section>

    <div v-if="currentTotalPages > 1" class="flex justify-center mt-6">
      <NPagination
        v-model:page="page"
        :page-count="currentTotalPages"
        :page-size="pageSize"
        :item-count="currentTotal"
        show-size-picker
        :page-sizes="[12, 24, 48]"
        @update:page="goToPage"
        @update:page-size="(s) => { pageSize = s; page = 1; fetchTrash() }"
      />
    </div>
  </div>
</template>
