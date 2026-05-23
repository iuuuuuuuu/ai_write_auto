<script setup lang="ts">
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent])

const chartReady = ref(false)
onMounted(() => { setTimeout(() => { chartReady.value = true }, 150) })

const { t } = useI18n()
const message = useMessage()

const days = ref(30)
const { data: usage, refresh } = await useFetch('/api/stats/token-usage', {
  query: { days }
})

const totalInput = computed(() => (usage.value as any)?.totalInput || 0)
const totalOutput = computed(() => (usage.value as any)?.totalOutput || 0)
const totalTokens = computed(() => (usage.value as any)?.totalTokens || 0)
const totalEstimatedCost = computed(() => (usage.value as any)?.totalEstimatedCost || null)
const records = computed(() => (usage.value as any)?.usage || [])

/* ─── Cost Rates ─── */
const { data: costRates, refresh: refreshCostRates } = await useFetch<any[]>('/api/settings/cost-rates', { default: () => [] })
const showCostForm = ref(false)
const costForm = ref({ id: undefined as number | undefined, model: '', inputCostPer1k: '0', outputCostPer1k: '0' })
const savingCost = ref(false)

function openCostForm(rate?: any) {
  if (rate) {
    costForm.value = { id: rate.id, model: rate.model, inputCostPer1k: rate.inputCostPer1k, outputCostPer1k: rate.outputCostPer1k }
  } else {
    costForm.value = { id: undefined, model: '', inputCostPer1k: '0', outputCostPer1k: '0' }
  }
  showCostForm.value = true
}

async function saveCostRate() {
  savingCost.value = true
  try {
    await $fetch('/api/settings/cost-rates', { method: 'PUT', body: costForm.value })
    showCostForm.value = false
    await refreshCostRates()
    message.success('保存成功')
  } catch (e: any) {
    message.error(e?.data?.message || '保存失败')
  } finally {
    savingCost.value = false
  }
}

async function deleteCostRate(id: number) {
  try {
    await $fetch('/api/settings/cost-rates', { method: 'DELETE', query: { id } })
    await refreshCostRates()
    message.success('已删除')
  } catch (e: any) {
    message.error(e?.data?.message || '删除失败')
  }
}

const chartOption = computed(() => {
  const data = [...records.value].reverse()
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 12 },
    },
    legend: {
      data: ['Input Tokens', 'Output Tokens'],
      bottom: 0,
      textStyle: { fontSize: 11, color: '#888' },
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { top: 10, right: 16, bottom: 36, left: 50 },
    xAxis: {
      type: 'category',
      data: data.map((r: any) => {
        const d = new Date(r.createdAt)
        return `${d.getMonth() + 1}/${d.getDate()}`
      }),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { fontSize: 10, color: '#999' },
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
        },
      },
    },
    series: [
      {
        name: 'Input Tokens',
        type: 'bar',
        stack: 'total',
        data: data.map((r: any) => r.tokensInput || 0),
        itemStyle: { color: '#60a5fa', borderRadius: [0, 0, 0, 0] },
        barMaxWidth: 20,
      },
      {
        name: 'Output Tokens',
        type: 'bar',
        stack: 'total',
        data: data.map((r: any) => r.tokensOutput || 0),
        itemStyle: { color: '#a78bfa', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 20,
      },
    ],
  }
})

function formatNumber(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

watch(days, () => refresh())
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-(--ui-text-muted)">{{ t('ai.tokenUsage') }}</p>
      <div class="flex gap-1">
        <NButton
          size="tiny"
          :type="days === 7 ? 'primary' : 'default'"
          :quaternary="days !== 7"
          @click="days = 7"
          >7天</NButton
        >
        <NButton
          size="tiny"
          :type="days === 30 ? 'primary' : 'default'"
          :quaternary="days !== 30"
          @click="days = 30"
          >30天</NButton
        >
        <NButton
          size="tiny"
          :type="days === 90 ? 'primary' : 'default'"
          :quaternary="days !== 90"
          @click="days = 90"
          >90天</NButton
        >
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
        <p class="text-[11px] text-(--ui-text-dimmed) mt-1">{{ t('ai.estimatedCost') }}</p>
      </div>
    </div>

    <div v-if="records.length" class="card-glass p-4">
      <ClientOnly>
        <VChart v-if="chartReady" :option="chartOption" autoresize style="height: 220px; width: 100%" />
      </ClientOnly>
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
              日期
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
              {{ t('ai.estimatedCost') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-(--ui-border)">
          <tr
            v-for="record in records"
            :key="record.id"
            class="hover:bg-(--ui-bg-muted) transition-colors"
          >
            <td class="px-3 py-2 text-(--ui-text) text-[12px]">
              {{ new Date(record.createdAt).toLocaleDateString() }}
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
              ${{ record.estimatedCost?.toFixed(4) || '0.0000' }}
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
        <NButton size="tiny" @click="openCostForm()">
          <template #icon><Icon icon="lucide:plus" /></template>
          添加
        </NButton>
      </div>
      <p class="text-xs text-(--ui-text-dimmed)">配置每个模型的 token 单价，用于自动计算费用估算</p>
      <div v-if="costRates?.length" class="space-y-2">
        <div
          v-for="rate in costRates"
          :key="rate.id"
          class="flex items-center justify-between px-3 py-2 rounded-lg bg-(--ui-bg-muted)"
        >
          <div>
            <p class="text-sm font-medium text-(--ui-text)">{{ rate.model }}</p>
            <p class="text-[11px] text-(--ui-text-dimmed)">
              Input: ${{ rate.inputCostPer1k }}/1K · Output: ${{ rate.outputCostPer1k }}/1K
            </p>
          </div>
          <div class="flex gap-1">
            <NButton size="tiny" quaternary @click="openCostForm(rate)">
              <template #icon><Icon icon="lucide:pencil" /></template>
            </NButton>
            <NButton size="tiny" quaternary @click="deleteCostRate(rate.id)">
              <template #icon><Icon icon="lucide:trash-2" /></template>
            </NButton>
          </div>
        </div>
      </div>
      <p v-else class="text-xs text-(--ui-text-dimmed) text-center py-2">暂无配置，费用将不会被计算</p>
    </div>

    <!-- Cost Rate Form Modal -->
    <NModal v-model:show="showCostForm" preset="card" title="模型单价" style="max-width: 400px">
      <div class="space-y-3">
        <NFormItem label="模型名称" required>
          <NInput v-model:value="costForm.model" placeholder="如 gpt-4o, claude-sonnet-4-6" />
        </NFormItem>
        <NFormItem label="Input 单价 ($/1K tokens)">
          <NInput v-model:value="costForm.inputCostPer1k" placeholder="0.003" />
        </NFormItem>
        <NFormItem label="Output 单价 ($/1K tokens)">
          <NInput v-model:value="costForm.outputCostPer1k" placeholder="0.015" />
        </NFormItem>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showCostForm = false">取消</NButton>
          <NButton type="primary" :loading="savingCost" @click="saveCostRate">保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
