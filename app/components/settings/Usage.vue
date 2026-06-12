<script setup lang="ts">
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent
} from 'echarts/components'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent
])

interface Props {
  days?: number
}

interface UsageBucket {
  bucket: string
  tokensInput: number
  tokensOutput: number
  tokensTotal: number
  cost: number
  calls: number
}

interface ModelUsageItem {
  model: string
  modelName: string
  tokensInput: number
  tokensOutput: number
  tokensTotal: number
  cost: number
  calls: number
}

const props = withDefaults(defineProps<Props>(), {
  days: 30
})

const chartReady = ref(false)
const chartContainer = useTemplateRef<HTMLElement>('chartContainer')
let chartFrame = 0

onMounted(() => {
  const renderWhenMeasured = () => {
    const rect = chartContainer.value?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      chartReady.value = true
      return
    }
    chartFrame = window.requestAnimationFrame(renderWhenMeasured)
  }
  chartFrame = window.requestAnimationFrame(renderWhenMeasured)
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(chartFrame)
})

const { t } = useI18n()
const message = useMessage()
const { put, del: apiDel } = useApi()

const days = computed(() => props.days)
const granularity = ref<'day' | 'hour'>('day')
const { data: usage, refresh } = await useFetch('/api/stats/token-usage', {
  query: { days, granularity }
})

const totalInput = computed(() => (usage.value as any)?.totalInput || 0)
const totalOutput = computed(() => (usage.value as any)?.totalOutput || 0)
const totalTokens = computed(() => (usage.value as any)?.totalTokens || 0)
const totalCalls = computed(() => (usage.value as any)?.totalCalls || 0)
const totalEstimatedCost = computed(
  () => (usage.value as any)?.totalEstimatedCost || null
)
const records = computed<UsageBucket[]>(() =>
  Array.isArray((usage.value as any)?.usage) ? (usage.value as any).usage : []
)
const modelUsage = computed<ModelUsageItem[]>(() =>
  Array.isArray((usage.value as any)?.modelUsage) ?
    (usage.value as any).modelUsage
  : []
)
const modelChartData = computed(() => [...modelUsage.value].reverse())

// 聚合桶标签：天→MM/DD，小时→DD HH:00
function bucketLabel(bucket: string) {
  if (!bucket) return ''
  if (granularity.value === 'hour') {
    const m = bucket.match(/(\d{2})-(\d{2}) (\d{2})/)
    return m ? `${m[2]} ${m[3]}:00` : bucket
  }
  const parts = bucket.split('-')
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : bucket
}

/* ─── Cost Rates ─── */
const { data: costRates, refresh: refreshCostRates } = await useFetch<any[]>(
  '/api/settings/cost-rates',
  { default: () => [] }
)
const showCostForm = ref(false)
const costForm = ref({
  id: undefined as number | undefined,
  model: '',
  inputCostPer1k: '0',
  outputCostPer1k: '0'
})
const savingCost = ref(false)

function openCostForm(rate?: any) {
  if (rate) {
    costForm.value = {
      id: rate.id,
      model: rate.model,
      inputCostPer1k: rate.inputCostPer1k,
      outputCostPer1k: rate.outputCostPer1k
    }
  } else {
    costForm.value = {
      id: undefined,
      model: '',
      inputCostPer1k: '0',
      outputCostPer1k: '0'
    }
  }
  showCostForm.value = true
}

async function saveCostRate() {
  savingCost.value = true
  try {
    await put('/api/settings/cost-rates', costForm.value, {
      successMessage: '保存成功'
    })
    showCostForm.value = false
    await refreshCostRates()
  } catch {
    // useApi handles error display
  } finally {
    savingCost.value = false
  }
}

async function deleteCostRate(id: number) {
  try {
    await apiDel('/api/settings/cost-rates', {
      query: { id },
      successMessage: '已删除'
    })
    await refreshCostRates()
  } catch {
    // useApi handles error display
  }
}

const chartOption = computed(() => {
  const data = records.value
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 12 }
    },
    legend: {
      data: ['Input Tokens', 'Output Tokens'],
      bottom: 0,
      textStyle: { fontSize: 11, color: '#888' },
      itemWidth: 12,
      itemHeight: 8,
      icon: 'roundRect'
    },
    grid: { top: 10, right: 16, bottom: 36, left: 50 },
    xAxis: {
      type: 'category',
      data: data.map((r: any) => bucketLabel(r.bucket)),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { fontSize: 10, color: '#999' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
      axisLabel: {
        fontSize: 10,
        color: '#999',
        formatter: (v: number) => {
          if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
          if (v >= 1000) return (v / 1000).toFixed(0) + 'K'
          return v
        }
      }
    },
    series: [
      {
        name: 'Input Tokens',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: data.length <= 24,
        data: data.map((r: any) => r.tokensInput || 0),
        lineStyle: { color: '#2563eb', width: 3 },
        itemStyle: { color: '#2563eb' },
        areaStyle: { color: 'rgba(37, 99, 235, 0.12)' },
        emphasis: { focus: 'series' }
      },
      {
        name: 'Output Tokens',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: data.length <= 24,
        data: data.map((r: any) => r.tokensOutput || 0),
        lineStyle: { color: '#06b6d4', width: 3 },
        itemStyle: { color: '#06b6d4' },
        areaStyle: { color: 'rgba(6, 182, 212, 0.1)' },
        emphasis: { focus: 'series' }
      }
    ]
  }
})

const modelChartOption = computed(() => {
  const data = modelChartData.value
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 12 },
      formatter(params: unknown) {
        const items = Array.isArray(params) ? params : []
        const first = items[0] as { dataIndex?: number; axisValue?: string }
        const item = data[first?.dataIndex ?? 0]
        if (!item) return ''
        return `${first.axisValue || item.modelName}<br/>总量：${formatNumber(item.tokensTotal)} tokens<br/>Input：${formatNumber(item.tokensInput)}<br/>Output：${formatNumber(item.tokensOutput)}<br/>调用：${item.calls} 次<br/>费用：$${item.cost ? item.cost.toFixed(4) : '0.0000'}`
      }
    },
    grid: { top: 8, right: 24, bottom: 20, left: 110 },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
      axisLabel: {
        fontSize: 10,
        color: '#999',
        formatter: (v: number) => {
          if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
          if (v >= 1000) return (v / 1000).toFixed(0) + 'K'
          return v
        }
      }
    },
    yAxis: {
      type: 'category',
      data: data.map((item) => item.modelName || item.model),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 11,
        color: '#64748b',
        width: 96,
        overflow: 'truncate'
      }
    },
    series: [
      {
        name: 'Tokens',
        type: 'bar',
        data: data.map((item) => item.tokensTotal),
        barMaxWidth: 16,
        itemStyle: {
          color: '#2563eb',
          borderRadius: [0, 6, 6, 0]
        },
        label: {
          show: true,
          position: 'right',
          color: '#475569',
          fontSize: 11,
          formatter: (params: { value: number }) => formatNumber(params.value)
        }
      }
    ]
  }
})

function formatNumber(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

watch([days, granularity], () => refresh())
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-(--ui-text-muted)">{{ t('ai.tokenUsage') }}</p>
      <div class="flex items-center gap-2">
        <div class="flex gap-1">
          <NButton
            size="tiny"
            :type="granularity === 'day' ? 'primary' : 'default'"
            :quaternary="granularity !== 'day'"
            @click="granularity = 'day'"
            >按天</NButton
          >
          <NButton
            size="tiny"
            :type="granularity === 'hour' ? 'primary' : 'default'"
            :quaternary="granularity !== 'hour'"
            @click="granularity = 'hour'"
            >按小时</NButton
          >
        </div>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-2">
      <div class="card-glass p-3 text-center">
        <p class="text-xl font-bold font-mono text-(--ui-text-highlighted)">
          {{ formatNumber(totalInput) }}
        </p>
        <p class="text-[11px] text-(--ui-text-dimmed) mt-1">Input Tokens</p>
      </div>
      <div class="card-glass p-3 text-center">
        <p class="text-xl font-bold font-mono text-(--ui-text-highlighted)">
          {{ formatNumber(totalOutput) }}
        </p>
        <p class="text-[11px] text-(--ui-text-dimmed) mt-1">Output Tokens</p>
      </div>
      <div class="card-glass p-3 text-center">
        <p class="text-xl font-bold font-mono text-primary-600">
          {{ formatNumber(totalTokens) }}
        </p>
        <p class="text-[11px] text-(--ui-text-dimmed) mt-1">Total</p>
      </div>
      <div class="card-glass p-3 text-center">
        <p class="text-xl font-bold font-mono text-amber-600">
          ${{ totalEstimatedCost || '0.00' }}
        </p>
        <p class="text-[11px] text-(--ui-text-dimmed) mt-1">
          {{ t('ai.estimatedCost') }}
        </p>
      </div>
    </div>

    <div
      v-if="records.length"
      ref="chartContainer"
      class="card-glass min-h-[252px] p-4"
    >
      <ClientOnly>
        <VChart
          v-if="chartReady"
          :option="chartOption"
          autoresize
          style="height: 220px; width: 100%"
        />
      </ClientOnly>
    </div>

    <div
      v-if="modelUsage.length"
      class="card-glass p-4"
    >
      <div
        class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p class="text-sm font-medium text-(--ui-text-highlighted)">
            模型使用量排行
          </p>
          <p class="mt-1 text-xs text-(--ui-text-muted)">
            按当前时间范围内的总 token 排序，展示各模型调用量、输入输出和费用。
          </p>
        </div>
        <p class="text-xs text-(--ui-text-dimmed)">
          Top {{ modelUsage.length }}
        </p>
      </div>

      <div
        class="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"
      >
        <ClientOnly>
          <VChart
            :option="modelChartOption"
            autoresize
            style="height: 260px; width: 100%"
          />
        </ClientOnly>

        <div class="space-y-2">
          <div
            v-for="model in modelUsage.slice(0, 6)"
            :key="model.model"
            class="rounded-lg border border-(--ui-border)/50 bg-(--ui-bg-muted)/40 px-3 py-2"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p
                  class="truncate text-sm font-medium text-(--ui-text-highlighted)"
                >
                  {{ model.modelName || model.model }}
                </p>
                <p class="mt-0.5 truncate text-[11px] text-(--ui-text-dimmed)">
                  {{ model.model }}
                </p>
              </div>
              <p
                class="shrink-0 font-mono text-sm font-semibold text-primary-600"
              >
                {{ formatNumber(model.tokensTotal) }}
              </p>
            </div>
            <div
              class="mt-2 grid grid-cols-3 gap-2 text-[11px] text-(--ui-text-muted)"
            >
              <span>Input {{ formatNumber(model.tokensInput) }}</span>
              <span>Output {{ formatNumber(model.tokensOutput) }}</span>
              <span class="text-right">{{ model.calls }} 次</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="records.length"
      class="card-glass overflow-hidden"
    >
      <table class="w-full text-sm">
        <thead class="bg-(--ui-bg-muted)">
          <tr>
            <th
              class="px-3 py-2 text-left text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider"
            >
              时段
            </th>
            <th
              class="px-3 py-2 text-right text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider"
            >
              Input
            </th>
            <th
              class="px-3 py-2 text-right text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider"
            >
              Output
            </th>
            <th
              class="px-3 py-2 text-right text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider"
            >
              调用
            </th>
            <th
              class="px-3 py-2 text-right text-[11px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider"
            >
              {{ t('ai.estimatedCost') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-(--ui-border)">
          <tr
            v-for="record in [...records].reverse()"
            :key="record.bucket"
            class="hover:bg-(--ui-bg-muted) transition-colors"
          >
            <td class="px-3 py-2 text-(--ui-text) text-[12px]">
              {{ bucketLabel(record.bucket) }}
            </td>
            <td
              class="px-3 py-2 text-right font-mono text-(--ui-text-muted) text-[12px]"
            >
              {{ formatNumber(record.tokensInput) }}
            </td>
            <td
              class="px-3 py-2 text-right font-mono text-(--ui-text-muted) text-[12px]"
            >
              {{ formatNumber(record.tokensOutput) }}
            </td>
            <td
              class="px-3 py-2 text-right font-mono text-(--ui-text-muted) text-[12px]"
            >
              {{ record.calls }}
            </td>
            <td
              class="px-3 py-2 text-right font-mono text-(--ui-text-muted) text-[12px]"
            >
              ${{ record.cost ? record.cost.toFixed(4) : '0.0000' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState
      v-else
      icon="lucide:bar-chart-2"
      :title="t('common.noData')"
    />

    <!-- Cost Rate Configuration -->
    <div class="card-glass p-4 space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium text-(--ui-text)">模型单价配置</p>
        <NButton
          size="tiny"
          @click="openCostForm()"
        >
          <template #icon><Icon icon="lucide:plus" /></template>
          添加
        </NButton>
      </div>
      <p class="text-xs text-(--ui-text-dimmed)">
        配置每个模型的 token 单价，用于自动计算费用估算
      </p>
      <div
        v-if="costRates?.length"
        class="space-y-2"
      >
        <div
          v-for="rate in costRates"
          :key="rate.id"
          class="flex items-center justify-between px-3 py-2 rounded-lg bg-(--ui-bg-muted)"
        >
          <div>
            <p class="text-sm font-medium text-(--ui-text)">{{ rate.model }}</p>
            <p class="text-[11px] text-(--ui-text-dimmed)">
              Input: ${{ rate.inputCostPer1k }}/1K · Output: ${{
                rate.outputCostPer1k
              }}/1K
            </p>
          </div>
          <div class="flex gap-1">
            <NButton
              size="tiny"
              quaternary
              @click="openCostForm(rate)"
            >
              <template #icon><Icon icon="lucide:pencil" /></template>
            </NButton>
            <NButton
              size="tiny"
              quaternary
              @click="deleteCostRate(rate.id)"
            >
              <template #icon><Icon icon="lucide:trash-2" /></template>
            </NButton>
          </div>
        </div>
      </div>
      <p
        v-else
        class="text-xs text-(--ui-text-dimmed) text-center py-2"
      >
        暂无配置，费用将不会被计算
      </p>
    </div>

    <!-- Cost Rate Form Modal -->
    <NModal
      v-model:show="showCostForm"
      preset="card"
      title="模型单价"
      style="max-width: 400px"
    >
      <div class="space-y-3">
        <NFormItem
          label="模型名称"
          required
        >
          <NInput
            v-model:value="costForm.model"
            placeholder="如 gpt-4o, claude-sonnet-4-6"
          />
        </NFormItem>
        <NFormItem label="Input 单价 ($/1K tokens)">
          <NInput
            v-model:value="costForm.inputCostPer1k"
            placeholder="0.003"
          />
        </NFormItem>
        <NFormItem label="Output 单价 ($/1K tokens)">
          <NInput
            v-model:value="costForm.outputCostPer1k"
            placeholder="0.015"
          />
        </NFormItem>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showCostForm = false">取消</NButton>
          <NButton
            type="primary"
            :loading="savingCost"
            @click="saveCostRate"
            >保存</NButton
          >
        </div>
      </template>
    </NModal>
  </div>
</template>
