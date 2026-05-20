<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const days = ref('30')
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
    const data = await $fetch<any>('/api/admin/writing-stats', {
      params: { days: days.value, page: 1, pageSize: 1 }
    })
    if (data.summary) summary.value = data.summary
  },
  { immediate: true }
)
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="text-sm text-(--ui-text-muted)">Admin / Writing Stats</p>
        <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
          写作统计
        </h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">全站写作数据汇总。</p>
      </div>
      <NSelect
        v-model:value="days"
        :options="daysOptions"
        class="w-40"
      />
    </div>

    <!-- Summary -->
    <div class="grid grid-cols-3 gap-3">
      <div class="card-surface p-3">
        <div class="flex items-center gap-2">
          <div
            class="flex size-6 items-center justify-center rounded-md bg-primary-400/10"
          >
            <Icon
              icon="lucide:pen-tool"
              class="size-3.5 text-primary-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">总字数</p>
        </div>
        <p
          class="text-xl font-bold font-mono text-(--ui-text-highlighted) mt-1"
        >
          {{ summary.totalWords.toLocaleString() }}
        </p>
      </div>
      <div class="card-surface p-3">
        <div class="flex items-center gap-2">
          <div
            class="flex size-6 items-center justify-center rounded-md bg-blue-400/10"
          >
            <Icon
              icon="lucide:book-open"
              class="size-3.5 text-blue-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">完成章节</p>
        </div>
        <p
          class="text-xl font-bold font-mono text-(--ui-text-highlighted) mt-1"
        >
          {{ summary.totalChapters }}
        </p>
      </div>
      <div class="card-surface p-3">
        <div class="flex items-center gap-2">
          <div
            class="flex size-6 items-center justify-center rounded-md bg-violet-400/10"
          >
            <Icon
              icon="lucide:sparkles"
              class="size-3.5 text-violet-500"
            />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">AI 生成次数</p>
        </div>
        <p
          class="text-xl font-bold font-mono text-(--ui-text-highlighted) mt-1"
        >
          {{ summary.totalGenerations }}
        </p>
      </div>
    </div>

    <!-- Stats List -->
    <div
      v-if="loading"
      class="space-y-3"
    >
      <NSkeleton
        v-for="i in 6"
        :key="i"
        class="h-12 rounded-lg"
        text
      />
    </div>
    <div
      v-else-if="!stats.length"
      class="card-surface p-10 text-center text-sm text-(--ui-text-muted)"
    >
      暂无统计数据
    </div>
    <template v-else>
      <div class="card-surface overflow-hidden">
        <div class="divide-y divide-(--ui-border)/40">
          <div
            v-for="stat in stats"
            :key="stat.id"
            class="grid gap-2 p-3 md:grid-cols-[1fr_100px_100px_100px_120px] md:items-center"
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
          </div>
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
