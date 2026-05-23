<script setup lang="ts">
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent])

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminOverview {
  users: { total: number; admins: number; regular: number }
  novels: { total: number; draft: number; inProgress: number; completed: number }
  aiConfigs: { total: number; enabled: number; disabled: number }
  usage: { requests: number; totalTokens: number }
}

interface ChartData {
  tokenUsage: Array<{ date: string; input: number; output: number }>
  writingStats: Array<{ date: string; words: number; chapters: number; generations: number }>
  userGrowth: Array<{ date: string; count: number }>
  taskStats: Array<{ date: string; completed: number; failed: number }>
}

const chartDays = ref(7)

const { data: overview, pending, error } = await useFetch<AdminOverview>('/api/admin/overview')
const { data: charts } = await useFetch<ChartData>('/api/admin/charts', {
  query: { days: chartDays },
  watch: [chartDays]
})

const userBar = computed(() => {
  const total = overview.value?.users.total || 1
  const admins = overview.value?.users.admins || 0
  return { adminPercent: Math.round((admins / total) * 100) }
})

const novelStatusBar = computed(() => {
  const novels = overview.value?.novels
  if (!novels) return []
  const total = novels.total || 1
  return [
    { label: '草稿', count: novels.draft, color: 'bg-zinc-400 dark:bg-zinc-500', percent: (novels.draft / total) * 100 },
    { label: '连载中', count: novels.inProgress, color: 'bg-primary-500', percent: (novels.inProgress / total) * 100 },
    { label: '已完结', count: novels.completed, color: 'bg-emerald-500', percent: (novels.completed / total) * 100 }
  ]
})

const quickActions = [
  { icon: 'lucide:users', label: '用户', to: '/admin/users' },
  { icon: 'lucide:library', label: '小说', to: '/admin/novels' },
  { icon: 'lucide:cpu', label: '模型', to: '/admin/ai-configs' },
  { icon: 'lucide:zap', label: '任务', to: '/admin/tasks' }
]

const chartAxisStyle = {
  axisLine: { lineStyle: { color: 'var(--ui-border)' } },
  axisLabel: { fontSize: 10, color: 'var(--ui-text-dimmed)' },
}

const chartGrid = { top: 10, right: 12, bottom: 24, left: 44 }

const tokenChartOption = computed(() => {
  const data = charts.value?.tokenUsage || []
  return {
    tooltip: { trigger: 'axis' as const },
    grid: chartGrid,
    xAxis: { type: 'category' as const, data: data.map(d => d.date.slice(5)), ...chartAxisStyle },
    yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: 'var(--ui-border-muted)' } }, axisLabel: { fontSize: 10, color: 'var(--ui-text-dimmed)', formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v } },
    series: [
      { name: 'Input', type: 'bar' as const, stack: 'total', data: data.map(d => d.input), itemStyle: { color: '#60a5fa', borderRadius: [0, 0, 0, 0] }, barMaxWidth: 16 },
      { name: 'Output', type: 'bar' as const, stack: 'total', data: data.map(d => d.output), itemStyle: { color: '#a78bfa', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 16 },
    ]
  }
})

const writingChartOption = computed(() => {
  const data = charts.value?.writingStats || []
  return {
    tooltip: { trigger: 'axis' as const },
    grid: chartGrid,
    xAxis: { type: 'category' as const, data: data.map(d => d.date.slice(5)), ...chartAxisStyle },
    yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: 'var(--ui-border-muted)' } }, axisLabel: { fontSize: 10, color: 'var(--ui-text-dimmed)' } },
    series: [
      { name: '字数', type: 'line' as const, data: data.map(d => d.words), smooth: true, symbol: 'none', areaStyle: { color: 'rgba(52,211,153,0.15)' }, lineStyle: { color: '#34d399', width: 2 } },
      { name: 'AI生成', type: 'line' as const, data: data.map(d => d.generations), smooth: true, symbol: 'none', lineStyle: { color: '#f59e0b', width: 2 } },
    ]
  }
})

const taskChartOption = computed(() => {
  const data = charts.value?.taskStats || []
  return {
    tooltip: { trigger: 'axis' as const },
    grid: chartGrid,
    xAxis: { type: 'category' as const, data: data.map(d => d.date.slice(5)), ...chartAxisStyle },
    yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: 'var(--ui-border-muted)' } }, axisLabel: { fontSize: 10, color: 'var(--ui-text-dimmed)' } },
    series: [
      { name: '完成', type: 'line' as const, data: data.map(d => d.completed), smooth: true, symbol: 'none', lineStyle: { color: '#34d399', width: 2 }, areaStyle: { color: 'rgba(52,211,153,0.1)' } },
      { name: '失败', type: 'line' as const, data: data.map(d => d.failed), smooth: true, symbol: 'none', lineStyle: { color: '#f87171', width: 2 } },
    ]
  }
})

const dayOptions = [
  { label: '7天', value: 7 },
  { label: '14天', value: 14 },
  { label: '30天', value: 30 },
]
</script>

<template>
  <div v-if="pending" class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[160px]">
    <NSkeleton v-for="i in 8" :key="i" class="rounded-2xl" :class="i === 1 ? 'md:col-span-2 lg:row-span-2' : i > 6 ? 'md:col-span-2' : ''" />
  </div>

  <NAlert v-else-if="error" type="error" title="后台数据加载失败">
    请稍后重试，或检查当前账号是否仍拥有管理员权限。
  </NAlert>

  <div v-else class="space-y-3 stagger-children">
    <!-- Top Bento: Stats -->
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[160px]">
      <!-- Users Hero (2×2) -->
      <section class="card-glass relative overflow-hidden p-5 md:col-span-2 lg:row-span-2 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[11px] uppercase tracking-[0.2em] text-primary-500/80 font-medium">Admin Overview</p>
              <h1 class="mt-1 text-lg font-semibold text-(--ui-text-highlighted)">管理概览</h1>
            </div>
            <div class="flex size-11 items-center justify-center rounded-2xl bg-primary-500/10 ring-1 ring-primary-500/20">
              <Icon icon="lucide:users" class="size-5 text-primary-500" />
            </div>
          </div>
          <p class="mt-5 font-mono text-5xl font-bold text-(--ui-text-highlighted) tracking-tight">
            {{ overview?.users.total || 0 }}
          </p>
          <p class="mt-1 text-sm text-(--ui-text-muted)">位注册用户</p>
        </div>
        <div>
          <div class="h-2.5 w-full overflow-hidden rounded-full bg-(--ui-bg-muted)">
            <div class="h-full rounded-full bg-primary-500 transition-all duration-500" :style="{ width: `${userBar.adminPercent}%` }" />
          </div>
          <div class="mt-2 flex items-center gap-4 text-xs text-(--ui-text-muted)">
            <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-primary-500" />{{ overview?.users.admins || 0 }} 管理员</span>
            <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-(--ui-bg-muted) ring-1 ring-(--ui-border)" />{{ overview?.users.regular || 0 }} 普通用户</span>
          </div>
        </div>
      </section>
      <!-- Novels -->
      <section class="liquid-panel flex flex-col justify-between p-4">
        <div class="flex items-center justify-between">
          <p class="text-[11px] uppercase tracking-[0.15em] text-(--ui-text-dimmed) font-medium">小说总数</p>
          <div class="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <Icon icon="lucide:library" class="size-3.5 text-amber-500" />
          </div>
        </div>
        <div>
          <p class="font-mono text-3xl font-bold text-(--ui-text-highlighted)">{{ overview?.novels.total || 0 }}</p>
          <p class="mt-0.5 text-xs text-(--ui-text-muted)">{{ overview?.novels.inProgress || 0 }} 本连载中</p>
        </div>
      </section>

      <!-- AI Models -->
      <section class="liquid-panel flex flex-col justify-between p-4">
        <div class="flex items-center justify-between">
          <p class="text-[11px] uppercase tracking-[0.15em] text-(--ui-text-dimmed) font-medium">模型配置</p>
          <div class="flex size-8 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
            <Icon icon="lucide:cpu" class="size-3.5 text-violet-500" />
          </div>
        </div>
        <div>
          <p class="font-mono text-3xl font-bold text-(--ui-text-highlighted)">{{ overview?.aiConfigs.total || 0 }}</p>
          <div class="mt-0.5 flex items-center gap-3 text-xs text-(--ui-text-muted)">
            <span class="flex items-center gap-1"><span class="size-1.5 rounded-full bg-emerald-400" />{{ overview?.aiConfigs.enabled || 0 }} 可用</span>
            <span class="flex items-center gap-1"><span class="size-1.5 rounded-full bg-amber-400" />{{ overview?.aiConfigs.disabled || 0 }} 停用</span>
          </div>
        </div>
      </section>

      <!-- Token Usage -->
      <section class="liquid-panel flex flex-col justify-between p-4">
        <div class="flex items-center justify-between">
          <p class="text-[11px] uppercase tracking-[0.15em] text-(--ui-text-dimmed) font-medium">Token 用量</p>
          <div class="flex size-8 items-center justify-center rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
            <Icon icon="lucide:activity" class="size-3.5 text-rose-500" />
          </div>
        </div>
        <div>
          <p class="font-mono text-3xl font-bold text-(--ui-text-highlighted)">{{ (overview?.usage.totalTokens || 0).toLocaleString() }}</p>
          <p class="mt-0.5 text-xs text-(--ui-text-muted)">{{ overview?.usage.requests || 0 }} 次请求</p>
        </div>
      </section>

      <!-- Quick Actions -->
      <section class="card-glass flex flex-col p-4">
        <p class="text-[11px] uppercase tracking-[0.15em] text-(--ui-text-dimmed) font-medium mb-3">快捷操作</p>
        <div class="grid grid-cols-2 gap-2 flex-1">
          <NuxtLink
            v-for="action in quickActions"
            :key="action.to"
            :to="action.to"
            class="liquid-panel flex flex-col items-center justify-center gap-1.5 rounded-xl transition-all hover:border-(--ui-border-accented) hover:shadow-sm"
          >
            <Icon :icon="action.icon" class="size-4 text-(--ui-text-muted)" />
            <span class="text-[11px] font-medium text-(--ui-text-muted)">{{ action.label }}</span>
          </NuxtLink>
        </div>
      </section>
    </div>

    <!-- Charts Section -->
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">数据趋势</h2>
      <div class="flex gap-1">
        <button
          v-for="opt in dayOptions"
          :key="opt.value"
          class="px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors"
          :class="chartDays === opt.value ? 'bg-primary-500/10 text-primary-500' : 'text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)'"
          @click="chartDays = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <!-- Token Usage Chart -->
      <section class="card-glass p-4 lg:col-span-1">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex size-7 items-center justify-center rounded-lg bg-blue-500/10">
            <Icon icon="lucide:bar-chart-3" class="size-3.5 text-blue-500" />
          </div>
          <p class="text-sm font-medium text-(--ui-text-highlighted)">Token 用量趋势</p>
        </div>
        <div class="h-[180px]">
          <VChart :option="tokenChartOption" autoresize class="w-full h-full" />
        </div>
      </section>

      <!-- Writing Stats Chart -->
      <section class="card-glass p-4 lg:col-span-1">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <Icon icon="lucide:pen-line" class="size-3.5 text-emerald-500" />
          </div>
          <p class="text-sm font-medium text-(--ui-text-highlighted)">写作活跃度</p>
        </div>
        <div class="h-[180px]">
          <VChart :option="writingChartOption" autoresize class="w-full h-full" />
        </div>
      </section>

      <!-- Task Stats Chart -->
      <section class="card-glass p-4 lg:col-span-1">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex size-7 items-center justify-center rounded-lg bg-amber-500/10">
            <Icon icon="lucide:zap" class="size-3.5 text-amber-500" />
          </div>
          <p class="text-sm font-medium text-(--ui-text-highlighted)">任务完成情况</p>
        </div>
        <div class="h-[180px]">
          <VChart :option="taskChartOption" autoresize class="w-full h-full" />
        </div>
      </section>

      <!-- Novel Status -->
      <section class="card-glass flex flex-col justify-between p-4 lg:col-span-1">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex size-7 items-center justify-center rounded-lg bg-violet-500/10">
            <Icon icon="lucide:book-open" class="size-3.5 text-violet-500" />
          </div>
          <p class="text-sm font-medium text-(--ui-text-highlighted)">内容创作状态</p>
        </div>
        <div class="flex-1 flex flex-col justify-center">
          <div class="h-3 w-full overflow-hidden rounded-full bg-(--ui-bg-muted) flex">
            <div
              v-for="seg in novelStatusBar"
              :key="seg.label"
              :class="seg.color"
              class="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              :style="{ width: `${seg.percent}%` }"
            />
          </div>
          <div class="mt-3 flex items-center gap-4 text-xs text-(--ui-text-muted)">
            <span v-for="seg in novelStatusBar" :key="seg.label" class="flex items-center gap-1.5">
              <span :class="seg.color" class="size-2 rounded-full" />
              {{ seg.label }} {{ seg.count }}
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
