<script setup lang="ts">
import { h } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface WritingStatItem {
  id: number
  user: { id: number; username: string } | null
  wordsWritten: number | null
  chaptersCompleted: number | null
  aiGenerations: number | null
  date: string
}

interface WritingStatsSummary {
  totalWords: number
  totalChapters: number
  totalGenerations: number
}

interface WritingStatsResponse {
  summary?: WritingStatsSummary
}

const days = shallowRef('30')
const daysOptions = [
  { label: '最近 7 天', value: '7' },
  { label: '最近 30 天', value: '30' },
  { label: '最近 90 天', value: '90' }
]

const queryParams = computed(() => ({ days: days.value }))

const {
  items: stats,
  loading,
  page,
  total,
  totalPages,
  pageSize,
  goToPage
} = usePagination<WritingStatItem>({
  url: '/api/admin/writing-stats',
  params: queryParams
})

const summary = ref({ totalWords: 0, totalChapters: 0, totalGenerations: 0 })

watch(
  [stats, days],
  async () => {
    const data = await $fetch<WritingStatsResponse>('/api/admin/writing-stats', {
      params: { days: days.value, page: 1, pageSize: 1 }
    })
    if (data.summary) summary.value = data.summary
  },
  { immediate: true }
)

const tableColumns = [
  {
    title: '用户',
    key: 'user',
    render(row: WritingStatItem) {
      if (!row.user) return '未知用户'
      return h(resolveComponent('NuxtLink') as any, { to: `/admin/users/${row.user.id}`, class: 'text-sm font-medium text-primary-500 hover:text-primary-400' }, () => row.user!.username)
    }
  },
  {
    title: '字数',
    key: 'wordsWritten',
    width: 110,
    render(row: WritingStatItem) {
      return `${(row.wordsWritten || 0).toLocaleString()} 字`
    }
  },
  {
    title: '完成章节',
    key: 'chaptersCompleted',
    width: 100,
    render(row: WritingStatItem) {
      return `${row.chaptersCompleted || 0} 章`
    }
  },
  {
    title: 'AI 生成',
    key: 'aiGenerations',
    width: 100,
    render(row: WritingStatItem) {
      return `${row.aiGenerations || 0} 次`
    }
  },
  {
    title: '日期',
    key: 'date',
    width: 120
  }
]
</script>

<template>
  <div class="flex flex-col gap-4 h-full overflow-hidden">
    <section class="card-glass relative overflow-hidden p-5 md:p-6 shrink-0">
      <div class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">Admin / Writing Stats</p>
          <h1 class="mt-2 text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)">
            写作统计
          </h1>
          <p class="mt-2 text-sm text-(--ui-text-muted)">全站写作数据汇总。</p>
        </div>
        <NSelect v-model:value="days" :options="daysOptions" class="w-40" />
      </div>
    </section>

    <div class="grid grid-cols-3 gap-3 shrink-0">
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-primary-400/10">
            <Icon icon="lucide:pen-tool" class="size-3.5 text-primary-500" />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">总字数</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ summary.totalWords.toLocaleString() }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-blue-400/10">
            <Icon icon="lucide:book-open" class="size-3.5 text-blue-500" />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">完成章节</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ summary.totalChapters }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-violet-400/10">
            <Icon icon="lucide:sparkles" class="size-3.5 text-violet-500" />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">AI 生成次数</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ summary.totalGenerations }}
        </p>
      </div>
    </div>

    <div class="card-glass flex-1 min-h-0 flex flex-col overflow-hidden">
      <NDataTable
        :columns="tableColumns"
        :data="stats"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        flex-height
        class="flex-1"
        style="height: 0"
      />
    </div>
  </div>
</template>
