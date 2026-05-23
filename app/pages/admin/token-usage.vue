<script setup lang="ts">
import { h } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface TokenUsageItem {
  id: number
  user: { id: number; username: string } | null
  tokensInput: number
  tokensOutput: number
  estimatedCost: string | null
  createdAt: string
}

interface TokenUsageSummary {
  totalInput: number
  totalOutput: number
  totalTokens: number
  totalCost: string
  totalRecords: number
}

interface TokenUsageResponse {
  summary?: TokenUsageSummary
}

const days = shallowRef('30')
const daysOptions = [
  { label: '最近 7 天', value: '7' },
  { label: '最近 30 天', value: '30' },
  { label: '最近 90 天', value: '90' }
]

const queryParams = computed(() => ({ days: days.value }))

const {
  items: usage,
  loading,
  page,
  total,
  totalPages,
  pageSize,
  goToPage
} = usePagination<TokenUsageItem>({
  url: '/api/admin/token-usage',
  params: queryParams
})

const summary = ref({
  totalInput: 0,
  totalOutput: 0,
  totalTokens: 0,
  totalCost: '0',
  totalRecords: 0
})

watch(
  [usage, days],
  async () => {
    const data = await $fetch<TokenUsageResponse>('/api/admin/token-usage', {
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
    render(row: TokenUsageItem) {
      if (!row.user) return '未知用户'
      return h(resolveComponent('NuxtLink') as any, { to: `/admin/users/${row.user.id}`, class: 'text-sm font-medium text-primary-500 hover:text-primary-400' }, () => row.user!.username)
    }
  },
  {
    title: '输入 Tokens',
    key: 'tokensInput',
    width: 120,
    render(row: TokenUsageItem) {
      return row.tokensInput.toLocaleString()
    }
  },
  {
    title: '输出 Tokens',
    key: 'tokensOutput',
    width: 120,
    render(row: TokenUsageItem) {
      return row.tokensOutput.toLocaleString()
    }
  },
  {
    title: '费用',
    key: 'estimatedCost',
    width: 90,
    render(row: TokenUsageItem) {
      return `$${row.estimatedCost || '0'}`
    }
  },
  {
    title: '时间',
    key: 'createdAt',
    width: 170,
    render(row: TokenUsageItem) {
      return new Date(row.createdAt).toLocaleString()
    }
  }
]
</script>

<template>
  <div class="flex flex-col gap-4 h-full overflow-hidden">
    <section class="card-glass relative overflow-hidden p-5 md:p-6 shrink-0">
      <div class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">Admin / Token Usage</p>
          <h1 class="mt-2 text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)">
            Token 用量
          </h1>
          <p class="mt-2 text-sm text-(--ui-text-muted)">跨用户 token 消耗统计。</p>
        </div>
        <NSelect v-model:value="days" :options="daysOptions" class="w-40" />
      </div>
    </section>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 shrink-0">
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-primary-400/10">
            <Icon icon="lucide:hash" class="size-3.5 text-primary-500" />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">总 Token</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ summary.totalTokens.toLocaleString() }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-blue-400/10">
            <Icon icon="lucide:arrow-down" class="size-3.5 text-blue-500" />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">输入</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ summary.totalInput.toLocaleString() }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-emerald-400/10">
            <Icon icon="lucide:arrow-up" class="size-3.5 text-emerald-500" />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">输出</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ summary.totalOutput.toLocaleString() }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-xl bg-amber-400/10">
            <Icon icon="lucide:dollar-sign" class="size-3.5 text-amber-500" />
          </div>
          <p class="text-xs text-(--ui-text-dimmed)">预估费用</p>
        </div>
        <p class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          ${{ summary.totalCost }}
        </p>
      </div>
    </div>

    <div class="card-glass flex-1 min-h-0 flex flex-col overflow-hidden">
      <NDataTable
        :columns="tableColumns"
        :data="usage"
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
