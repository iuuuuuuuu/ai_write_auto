<script setup lang="ts">
import { h } from 'vue'
import { NTag } from 'naive-ui'
import {
  AI_GENERATION_MODEL_TYPE_OPTIONS,
  getAiGenerationScenarioLabel,
  getAiGenerationScenarioOptions,
  getAiGenerationTaskTypeLabel
} from '~/utils/ai-generation-labels'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AiGenerationLogItem {
  id: number
  username: string | null
  userId: number | null
  model: string
  modelType: string
  purpose: string
  scenario: string
  source: string
  status: string
  errorMessage: string | null
  tokensInput: number
  tokensOutput: number
  estimatedCost: string | null
  inputChars: number
  outputChars: number
  embeddingItems: number
  firstTokenLatencyMs: number | null
  durationMs: number | null
  startedAt: string
  streamed: boolean
}

interface AiGenerationSummary {
  totalCalls: number
  successCalls: number
  failedCalls: number
  cancelledCalls: number
  successRate: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: string
  embeddingCalls: number
  embeddingInputChars: number
  avgFirstTokenLatencyMs: number | null
  avgDurationMs: number | null
}

interface AggregateRow {
  key: string
  label: string
  userId?: number | null
  username?: string | null
  totalCalls: number
  successCalls: number
  failedCalls: number
  successRate: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: string
  embeddingCalls: number
  avgFirstTokenLatencyMs: number | null
  avgDurationMs: number | null
  lastStartedAt: string | null
}

interface LogsResponse {
  summary?: AiGenerationSummary
  aggregates?: {
    byUser?: AggregateRow[]
    byModel?: AggregateRow[]
    byScenario?: AggregateRow[]
  }
}

interface AdminUserOptionItem {
  id: number
  username: string
}

interface AdminUsersResponse {
  items?: AdminUserOptionItem[]
}

function getFetchStatusCode(error: unknown) {
  if (!error || typeof error !== 'object') return null
  const payload = error as {
    status?: unknown
    statusCode?: unknown
    data?: { statusCode?: unknown }
  }
  if (typeof payload.status === 'number') return payload.status
  if (typeof payload.statusCode === 'number') return payload.statusCode
  if (typeof payload.data?.statusCode === 'number')
    return payload.data.statusCode
  return null
}

const emptySummary: AiGenerationSummary = {
  totalCalls: 0,
  successCalls: 0,
  failedCalls: 0,
  cancelledCalls: 0,
  successRate: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalTokens: 0,
  totalCost: '0.000000',
  embeddingCalls: 0,
  embeddingInputChars: 0,
  avgFirstTokenLatencyMs: null,
  avgDurationMs: null
}

const days = shallowRef('30')
const userFilter = shallowRef<number | null>(null)
const statusFilter = shallowRef('all')
const modelTypeFilter = shallowRef('all')
const scenarioFilter = shallowRef('')
const includeEmbeddings = shallowRef(true)
const summary = shallowRef<AiGenerationSummary>({ ...emptySummary })
const byUser = shallowRef<AggregateRow[]>([])
const byModel = shallowRef<AggregateRow[]>([])
const byScenario = shallowRef<AggregateRow[]>([])

const daysOptions = [
  { label: '最近 7 天', value: '7' },
  { label: '最近 30 天', value: '30' },
  { label: '最近 90 天', value: '90' }
]

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '取消', value: 'cancelled' },
  { label: '运行中', value: 'running' }
]

const modelTypeOptions = [...AI_GENERATION_MODEL_TYPE_OPTIONS]
const scenarioOptions = [
  { label: '全部场景', value: '' },
  ...getAiGenerationScenarioOptions()
]

const { data: userList } = await useFetch<
  AdminUsersResponse,
  AdminUserOptionItem[]
>('/api/admin/users', {
  params: { pageSize: 100 },
  transform: (data) => data.items || [],
  default: () => []
})

const userOptions = computed(() => [
  { label: '全部用户', value: null },
  ...(userList.value || []).map((user) => ({
    label: user.username,
    value: user.id
  }))
])

const queryParams = computed(() => {
  const params: Record<string, string> = {
    days: days.value,
    includeEmbeddings: String(includeEmbeddings.value)
  }
  if (userFilter.value) params.userId = String(userFilter.value)
  if (statusFilter.value !== 'all') params.status = statusFilter.value
  if (modelTypeFilter.value !== 'all') params.modelType = modelTypeFilter.value
  if (scenarioFilter.value.trim()) params.scenario = scenarioFilter.value.trim()
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
  url: '/api/admin/ai-generation-logs',
  params: queryParams
})

async function fetchSummary() {
  try {
    const data = await $fetch<LogsResponse>('/api/admin/ai-generation-logs', {
      params: { ...queryParams.value, page: '1', pageSize: '1' },
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
    })
    summary.value = data.summary || { ...emptySummary }
    byUser.value = data.aggregates?.byUser || []
    byModel.value = data.aggregates?.byModel || []
    byScenario.value = data.aggregates?.byScenario || []
  } catch (error) {
    const statusCode = getFetchStatusCode(error)
    if (statusCode !== 401 && statusCode !== 403) {
      console.warn('[admin-ai-generation-logs] summary fetch failed:', error)
    }
    summary.value = { ...emptySummary }
    byUser.value = []
    byModel.value = []
    byScenario.value = []
  }
}

watch(
  queryParams,
  async () => {
    await fetchSummary()
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

const tableColumns = [
  {
    title: '用户',
    key: 'username',
    width: 110,
    render(row: AiGenerationLogItem) {
      if (!row.username)
        return h('span', { class: 'text-xs text-(--ui-text-dimmed)' }, '-')
      return h(
        'a',
        {
          href: `/admin/users/${row.userId}`,
          class: 'text-xs text-primary-500 hover:underline'
        },
        row.username
      )
    }
  },
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
    title: '任务类型',
    key: 'modelType',
    width: 110,
    render(row: AiGenerationLogItem) {
      return h(
        'span',
        { class: 'text-xs' },
        getAiGenerationTaskTypeLabel(row.modelType, row.scenario)
      )
    }
  },
  {
    title: '具体场景',
    key: 'scenario',
    width: 190,
    ellipsis: { tooltip: true },
    render(row: AiGenerationLogItem) {
      return h(
        'span',
        { class: 'text-xs', title: row.scenario },
        getAiGenerationScenarioLabel(row.scenario)
      )
    }
  },
  {
    title: '模型',
    key: 'model',
    width: 160,
    ellipsis: { tooltip: true }
  },
  {
    title: 'Tokens',
    key: 'tokens',
    width: 120,
    render(row: AiGenerationLogItem) {
      const totalTokens = row.tokensInput + row.tokensOutput
      return h(
        'span',
        { class: 'font-mono text-xs' },
        formatNumber(totalTokens)
      )
    }
  },
  {
    title: '首字',
    key: 'firstTokenLatencyMs',
    width: 90,
    render(row: AiGenerationLogItem) {
      return h('span', { class: 'text-xs' }, formatMs(row.firstTokenLatencyMs))
    }
  },
  {
    title: '总耗时',
    key: 'durationMs',
    width: 90,
    render(row: AiGenerationLogItem) {
      return h('span', { class: 'text-xs' }, formatMs(row.durationMs))
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
    ellipsis: { tooltip: true },
    render(row: AiGenerationLogItem) {
      return row.errorMessage || '-'
    }
  }
]

const aggregateColumns = [
  { title: '维度', key: 'label', ellipsis: { tooltip: true } },
  {
    title: '调用',
    key: 'totalCalls',
    width: 90,
    render(row: AggregateRow) {
      return formatNumber(row.totalCalls)
    }
  },
  {
    title: '成功率',
    key: 'successRate',
    width: 90,
    render(row: AggregateRow) {
      return formatRate(row.successRate)
    }
  },
  {
    title: 'Tokens',
    key: 'totalTokens',
    width: 105,
    render(row: AggregateRow) {
      return formatNumber(row.totalTokens)
    }
  },
  {
    title: '费用',
    key: 'totalCost',
    width: 100,
    render(row: AggregateRow) {
      return `$${row.totalCost}`
    }
  }
]

const scenarioAggregateColumns = [
  {
    title: '维度',
    key: 'label',
    ellipsis: { tooltip: true },
    render(row: AggregateRow) {
      return h(
        'span',
        { title: row.key },
        getAiGenerationScenarioLabel(row.key)
      )
    }
  },
  ...aggregateColumns.slice(1)
]
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-hidden">
    <section class="card-glass relative shrink-0 overflow-hidden p-5 md:p-6">
      <div
        class="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">
            Admin / AI Generation Logs
          </p>
          <h1
            class="mt-2 text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)"
          >
            生成记录
          </h1>
          <p class="mt-2 max-w-2xl text-sm text-(--ui-text-muted)">
            按用户、模型、场景和状态统计所有 AI 调用。
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <NSelect
            v-model:value="userFilter"
            :options="userOptions"
            size="small"
            clearable
            placeholder="全部用户"
            style="width: 130px"
          />
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

    <div class="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-6">
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
        <p class="text-xs text-(--ui-text-dimmed)">Embedding</p>
        <p
          class="mt-2 font-mono text-xl font-semibold text-(--ui-text-highlighted)"
        >
          {{ formatNumber(summary.embeddingCalls) }}
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

    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <NSelect
        v-model:value="scenarioFilter"
        :options="scenarioOptions"
        size="small"
        clearable
        filterable
        placeholder="全部场景"
        style="width: 240px"
      />
      <label
        class="flex cursor-pointer items-center gap-2 text-sm text-(--ui-text-muted)"
      >
        <input
          v-model="includeEmbeddings"
          type="checkbox"
          class="size-4 accent-primary-500"
        />
        <span>包含 Embedding</span>
      </label>
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

    <div class="grid shrink-0 gap-3 xl:grid-cols-3">
      <div class="liquid-panel min-h-[220px] p-3">
        <p class="mb-2 text-sm font-medium text-(--ui-text-highlighted)">
          按用户
        </p>
        <NDataTable
          :columns="aggregateColumns"
          :data="byUser"
          :bordered="false"
          size="small"
          :pagination="false"
        />
      </div>
      <div class="liquid-panel min-h-[220px] p-3">
        <p class="mb-2 text-sm font-medium text-(--ui-text-highlighted)">
          按模型
        </p>
        <NDataTable
          :columns="aggregateColumns"
          :data="byModel"
          :bordered="false"
          size="small"
          :pagination="false"
        />
      </div>
      <div class="liquid-panel min-h-[220px] p-3">
        <p class="mb-2 text-sm font-medium text-(--ui-text-highlighted)">
          按场景
        </p>
        <NDataTable
          :columns="scenarioAggregateColumns"
          :data="byScenario"
          :bordered="false"
          size="small"
          :pagination="false"
        />
      </div>
    </div>
  </div>
</template>
