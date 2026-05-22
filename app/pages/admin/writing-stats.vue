<script setup lang="ts">
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
} = usePagination<any>({
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
</script>

<template>
  <div class="space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <span class="liquid-orb -right-12 -top-16 h-40 w-40" />
      <span class="liquid-highlight left-8 top-4 h-10 w-56 rotate-[-8deg]" />

      <div class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">Admin / Writing Stats</p>
          <h1 class="mt-2 text-3xl font-semibold tracking-[-0.05em] text-(--ui-text-highlighted)">
            写作统计
          </h1>
          <p class="mt-3 text-sm text-(--ui-text-muted)">全站写作数据汇总。</p>
        </div>
        <NSelect
          v-model:value="days"
          :options="daysOptions"
          class="w-40"
        />
      </div>
    </section>

    <div class="grid grid-cols-3 gap-3">
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-primary-400/10">
            <Icon
              icon="lucide:pen-tool"
              class="size-3.5 text-primary-500"
            />
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
            <Icon
              icon="lucide:book-open"
              class="size-3.5 text-blue-500"
            />
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
            <Icon
              icon="lucide:sparkles"
              class="size-3.5 text-violet-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">AI 生成次数</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ summary.totalGenerations }}
        </p>
      </div>
    </div>

    <div
      v-if="loading"
      class="space-y-3"
    >
      <NSkeleton
        v-for="i in 6"
        :key="i"
        class="h-12 rounded-[1.2rem]"
        text
      />
    </div>
    <div
      v-else-if="!stats.length"
      class="card-glass p-10 text-center text-sm text-(--ui-text-muted)"
    >
      暂无统计数据
    </div>
    <template v-else>
      <div class="card-glass overflow-hidden p-2">
        <div class="space-y-2">
          <article
            v-for="stat in stats"
            :key="stat.id"
            class="liquid-panel grid gap-2 p-3 md:grid-cols-[1fr_100px_100px_100px_120px] md:items-center"
          >
            <div>
              <NuxtLink
                v-if="stat.user"
                :to="`/admin/users/${stat.user.id}`"
                class="text-sm font-medium text-primary-400 hover:text-primary-300"
              >
                {{ stat.user.username }}
              </NuxtLink>
              <span
                v-else
                class="text-sm text-(--ui-text-muted)"
                >未知用户</span
              >
            </div>
            <span class="text-sm text-(--ui-text-muted)"
              >{{ stat.wordsWritten || 0 }} 字</span
            >
            <span class="text-sm text-(--ui-text-muted)"
              >{{ stat.chaptersCompleted || 0 }} 章</span
            >
            <span class="text-sm text-(--ui-text-muted)"
              >{{ stat.aiGenerations || 0 }} 次</span
            >
            <span class="text-xs text-(--ui-text-dimmed)">{{ stat.date }}</span>
          </article>
        </div>
      </div>

      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between pt-2"
      >
        <span class="text-xs text-(--ui-text-dimmed)">共 {{ total }} 条</span>
        <NPagination
          :page="page"
          :page-count="totalPages"
          :page-size="pageSize"
          @update:page="goToPage"
        />
      </div>
    </template>
  </div>
</template>
