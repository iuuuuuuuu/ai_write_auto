<script setup lang="ts">
import { h } from 'vue'
import { NTag } from 'naive-ui'
import {
  AI_GENERATION_MODEL_TYPE_OPTIONS,
  getAiGenerationScenarioLabel,
  getAiGenerationTaskTypeLabel
} from '~/utils/ai-generation-labels'

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

interface Props {
  days?: string
}

const props = withDefaults(defineProps<Props>(), {
  days: '30'
})

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
  successRate: 0,
  totalTokens: 0,
  totalCost: '0.000000',
  embeddingCalls: 0,
  avgFirstTokenLatencyMs: null,
  avgDurationMs: null
}

const selectedDays = computed(() => props.days)
const statusFilter = shallowRef('all')
const modelTypeFilter = shallowRef('all')
const includeEmbeddings = shallowRef(true)
const summary = shallowRef<AiGenerationSummary>({ ...emptySummary })

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '取消', value: 'cancelled' }
]

const modelTypeOptions = [...AI_GENERATION_MODEL_TYPE_OPTIONS]

const queryParams = computed(() => {
  const params: Record<string, string> = {
    days: selectedDays.value,
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

async function fetchSummary() {
  try {
    const data = await $fetch<LogsResponse>('/api/stats/ai-generation-logs', {
      params: { ...queryParams.value, page: '1', pageSize: '1' },
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
    })
    summary.value = data.summary || { ...emptySummary }
  } catch (error) {
    const statusCode = getFetchStatusCode(error)
    if (statusCode !== 401 && statusCode !== 403) {
      console.warn('[ai-generation-logs] summary fetch failed:', error)
    }
    summary.value = { ...emptySummary }
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
      return getAiGenerationTaskTypeLabel(row.modelType, row.scenario)
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
        { title: row.scenario },
        getAiGenerationScenarioLabel(row.scenario)
      )
    }
  },
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
  <div class="space-y-4">
    <section class="space-y-3">
      <div
        class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <h2 class="text-base font-semibold text-(--ui-text-highlighted)">
            调用记录
          </h2>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
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
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
    </section>

    <div class="card-glass flex min-h-[520px] flex-col overflow-hidden">
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
