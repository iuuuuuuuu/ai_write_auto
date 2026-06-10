<script setup lang="ts">
import { h } from 'vue'
import { NTag } from 'naive-ui'

definePageMeta({ layout: 'default' })

interface AiGenerationLogItem {
  id: number
  model: string
  modelType: string
  scenario: string
  status: string
  tokensInput: number
  tokensOutput: number
  estimatedCost: string | null
  inputChars: number
  embeddingItems: number
  firstTokenLatencyMs: number | null
  durationMs: number | null
  startedAt: string
  errorMessage: string | null
}

interface AiGenerationSummary {
  totalCalls: number
  successRate: number
  totalTokens: number
  totalCost: string
  embeddingCalls: number
  avgFirstTokenLatencyMs: number | null
  avgDurationMs: number | null
}

interface LogsResponse {
  summary?: AiGenerationSummary
}

const emptySummary: AiGenerationSummary = {
  totalCalls: 0,
  successRate: 0,
  totalTokens: 0,
  totalCost: '0.000000',
  embeddingCalls: 0,
  avgFirstTokenLatencyMs: null,
  avgDurationMs: null
}

const days = shallowRef('30')
const statusFilter = shallowRef('all')
const modelTypeFilter = shallowRef('all')
const includeEmbeddings = shallowRef(true)
const summary = shallowRef<AiGenerationSummary>({ ...emptySummary })

const daysOptions = [
  { label: '最近 7 天', value: '7' },
  { label: '最近 30 天', value: '30' },
  { label: '最近 90 天', value: '90' }
]

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '取消', value: 'cancelled' }
]

const modelTypeOptions = [
  { label: '全部类型', value: 'all' },
  { label: '对话生成', value: 'chat_completion' },
  { label: 'Embedding', value: 'embedding' },
  { label: '连通测试', value: 'connectivity_check' }
]

const queryParams = computed(() => {
  const params: Record<string, string> = {
    days: days.value,
    includeEmbeddings: String(includeEmbeddings.value)
  }
  if (statusFilter.value !== 'all') params.status = statusFilter.value
  if (modelTypeFilter.value !== 'all') params.modelType = modelTypeFilter.value
  return params
})

const {
  items: logs,
  loading,
  page,
  total,
  totalPages,
  pageSize,
  goToPage,
  updatePageSize
} = usePagination<AiGenerationLogItem>({
  url: '/api/stats/ai-generation-logs',
  params: queryParams
})

watch(
  [logs, queryParams],
  async () => {
    const data = await $fetch<LogsResponse>('/api/stats/ai-generation-logs', {
      params: { ...queryParams.value, page: '1', pageSize: '1' }
    })
    summary.value = data.summary || { ...emptySummary }
  },
  { immediate: true }
)

function formatNumber(value: number | null | undefined) {
  return (value || 0).toLocaleString()
}

function formatMs(value: number | null | undefined) {
  return value == null ? '-' : `${Math.round(value)} ms`
}

function formatRate(value: number | null | undefined) {
  return `${Math.round((value || 0) * 100)}%`
}

function statusTagType(status: string) {
  if (status === 'success') return 'success'
  if (status === 'failed' || status === 'cancelled') return 'error'
  return 'warning'
}

function modelTypeLabel(modelType: string) {
  if (modelType === 'embedding') return 'Embedding'
  if (modelType === 'connectivity_check') return '连通测试'
  return '对话生成'
}

const tableColumns = [
  {
    title: '状态',
    key: 'status',
    width: 85,
    render(row: AiGenerationLogItem) {
      return h(
        NTag,
        { type: statusTagType(row.status), size: 'small' },
        () => row.status
      )
    }
  },
  {
    title: '类型',
    key: 'modelType',
    width: 105,
    render(row: AiGenerationLogItem) {
      return modelTypeLabel(row.modelType)
    }
  },
  { title: '场景', key: 'scenario', width: 170, ellipsis: { tooltip: true } },
  { title: '模型', key: 'model', width: 160, ellipsis: { tooltip: true } },
  {
    title: 'Tokens',
    key: 'tokens',
    width: 110,
    render(row: AiGenerationLogItem) {
      return formatNumber(row.tokensInput + row.tokensOutput)
    }
  },
  {
    title: '首字',
    key: 'firstTokenLatencyMs',
    width: 90,
    render(row: AiGenerationLogItem) {
      return formatMs(row.firstTokenLatencyMs)
    }
  },
  {
    title: '总耗时',
    key: 'durationMs',
    width: 90,
    render(row: AiGenerationLogItem) {
      return formatMs(row.durationMs)
    }
  },
  {
    title: '时间',
    key: 'startedAt',
    width: 150,
    render(row: AiGenerationLogItem) {
      return h(
        'span',
        { class: 'text-xs' },
        new Date(row.startedAt).toLocaleString()
      )
    }
  },
  {
    title: '错误',
    key: 'errorMessage',
    width: 180,
    ellipsis: { tooltip: true }
  }
]
</script>

<template>
  <div
    class="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-4 overflow-hidden"
  >
    <section class="card-glass relative shrink-0 overflow-hidden p-5 md:p-6">
      <div
        class="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">
            Settings / AI Usage
          </p>
          <h1
            class="mt-2 text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)"
          >
            我的生成记录
          </h1>
          <p class="mt-2 text-sm text-(--ui-text-muted)">
            查看当前账号的模型调用、耗时、失败原因和 token 用量。
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <NSelect
            v-model:value="statusFilter"
            :options="statusOptions"
            size="small"
            style="width: 120px"
          />
          <NSelect
            v-model:value="modelTypeFilter"
            :options="modelTypeOptions"
            size="small"
            style="width: 130px"
          />
          <NSelect
            v-model:value="days"
            :options="daysOptions"
            size="small"
            style="width: 130px"
          />
        </div>
      </div>
    </section>

    <div class="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-5">
      <div class="liquid-panel p-3">
        <p class="text-xs text-(--ui-text-dimmed)">总调用</p>
        <p
          class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)"
        >
          {{ formatNumber(summary.totalCalls) }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <p class="text-xs text-(--ui-text-dimmed)">成功率</p>
        <p
          class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)"
        >
          {{ formatRate(summary.successRate) }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <p class="text-xs text-(--ui-text-dimmed)">总 Token</p>
        <p
          class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)"
        >
          {{ formatNumber(summary.totalTokens) }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <p class="text-xs text-(--ui-text-dimmed)">平均首字</p>
        <p
          class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)"
        >
          {{ formatMs(summary.avgFirstTokenLatencyMs) }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <p class="text-xs text-(--ui-text-dimmed)">预估费用</p>
        <p
          class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)"
        >
          ${{ summary.totalCost }}
        </p>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <NCheckbox v-model:checked="includeEmbeddings">包含 Embedding</NCheckbox>
    </div>

    <div class="card-glass flex min-h-0 flex-1 flex-col overflow-hidden">
      <NDataTable
        :columns="tableColumns"
        :data="logs"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        flex-height
        class="flex-1"
        style="height: 0"
      />
      <div
        class="flex shrink-0 items-center justify-between border-t border-(--ui-border)/40 px-4 py-3"
      >
        <span class="text-xs text-(--ui-text-dimmed)">共 {{ total }} 条</span>
        <NPagination
          :page="page"
          :page-count="totalPages"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          show-size-picker
          @update:page="goToPage"
          @update:page-size="updatePageSize"
        />
      </div>
    </div>
  </div>
</template>
