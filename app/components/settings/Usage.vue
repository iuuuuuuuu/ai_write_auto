<script setup lang="ts">
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent])

const { t } = useI18n()

const days = ref(30)
const { data: usage, refresh } = await useFetch('/api/stats/token-usage', {
  query: { days }
})

const totalInput = computed(() => (usage.value as any)?.totalInput || 0)
const totalOutput = computed(() => (usage.value as any)?.totalOutput || 0)
const totalTokens = computed(() => (usage.value as any)?.totalTokens || 0)
const records = computed(() => (usage.value as any)?.usage || [])

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

    <div class="grid grid-cols-3 gap-2">
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
    </div>

    <div v-if="records.length" class="card-glass p-4">
      <ClientOnly>
        <VChart :option="chartOption" autoresize style="height: 220px; width: 100%" />
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
  </div>
</template>
