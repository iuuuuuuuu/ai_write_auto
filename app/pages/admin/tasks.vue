<script setup lang="ts">
import { h } from 'vue'
import { NTag, NButton } from 'naive-ui'

definePageMeta({ layout: 'admin', middleware: 'admin' })

type TaskStatus = 'pending' | 'running' | 'paused' | 'cancelled' | 'completed' | 'failed'
type TaskAction = 'retry' | 'cancel' | 'pause' | 'resume'

type TaskStatusCounts = Record<TaskStatus, number>

type TasksResponse = {
  statusCounts?: Partial<TaskStatusCounts>
}

interface TaskItem {
  id: number
  type: string
  status: TaskStatus
  error: string | null
  retryCount: number | null
  tokensUsed: number | null
  novel: { id: number; title: string } | null
  createdAt: string
  completedAt: string | null
}

const message = useMessage()
const statusFilter = ref('all')
const typeFilter = ref('all')

const queryParams = computed(() => {
  const p: Record<string, string> = {}
  if (statusFilter.value !== 'all') p.status = statusFilter.value
  if (typeFilter.value !== 'all') p.type = typeFilter.value
  return p
})

const {
  items: tasks,
  loading,
  page,
  total,
  totalPages,
  pageSize,
  goToPage,
  updatePageSize,
  refresh
} = usePagination<TaskItem>({
  url: '/api/admin/tasks',
  params: queryParams
})

const statusCounts = ref<TaskStatusCounts>({
  pending: 0,
  running: 0,
  paused: 0,
  cancelled: 0,
  completed: 0,
  failed: 0
})

watch(
  tasks,
  async () => {
    const data = await $fetch<TasksResponse>('/api/admin/tasks', {
      params: { page: 1, pageSize: 1 }
    })
    if (data.statusCounts) {
      statusCounts.value = { ...statusCounts.value, ...data.statusCounts }
    }
  },
  { immediate: true }
)

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '任务操作失败'
}

function actionLabel(action: TaskAction) {
  const labels: Record<TaskAction, string> = {
    retry: '重试',
    cancel: '取消',
    pause: '暂停',
    resume: '继续'
  }
  return labels[action]
}

const operating = ref<number | null>(null)

async function handleAction(taskId: number, action: TaskAction) {
  operating.value = taskId
  try {
    await $fetch(`/api/admin/tasks/${taskId}`, {
      method: 'PUT',
      body: { action }
    })
    await refresh()
    message.success(`任务已${actionLabel(action)}`)
  } catch (error: unknown) {
    message.error(getErrorMessage(error))
  } finally {
    operating.value = null
  }
}

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '等待中', value: 'pending' },
  { label: '运行中', value: 'running' },
  { label: '已暂停', value: 'paused' },
  { label: '已取消', value: 'cancelled' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' }
]

const typeOptions = [
  { label: '全部类型', value: 'all' },
  { label: '生成', value: 'generate' },
  { label: '批量生成', value: 'batch_generate' },
  { label: '摘要提取', value: 'extract_summary' },
  { label: '角色提取', value: 'extract_characters' }
]

function statusColor(status: TaskStatus) {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'info'
  if (status === 'failed' || status === 'cancelled') return 'error'
  return 'warning'
}

const tableColumns = [
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row: TaskItem) {
      return h(NTag, { type: statusColor(row.status), size: 'small' }, () => row.status)
    }
  },
  {
    title: '类型',
    key: 'type',
    width: 140
  },
  {
    title: '关联小说',
    key: 'novel',
    ellipsis: { tooltip: true },
    render(row: TaskItem) {
      return row.novel?.title || '-'
    }
  },
  {
    title: 'Tokens',
    key: 'tokensUsed',
    width: 100,
    render(row: TaskItem) {
      return row.tokensUsed ? row.tokensUsed.toLocaleString() : '-'
    }
  },
  {
    title: '重试',
    key: 'retryCount',
    width: 60,
    render(row: TaskItem) {
      return row.retryCount || 0
    }
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 170,
    render(row: TaskItem) {
      return new Date(row.createdAt).toLocaleString()
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    align: 'right' as const,
    render(row: TaskItem) {
      const buttons: any[] = []
      if (row.status === 'failed' || row.status === 'cancelled') {
        buttons.push(h(NButton, { size: 'small', secondary: true, round: true, loading: operating.value === row.id, onClick: () => handleAction(row.id, 'retry') }, () => '重试'))
      }
      if (row.status === 'running') {
        buttons.push(h(NButton, { size: 'small', secondary: true, round: true, loading: operating.value === row.id, onClick: () => handleAction(row.id, 'pause') }, () => '暂停'))
      }
      if (row.status === 'paused') {
        buttons.push(h(NButton, { size: 'small', secondary: true, round: true, loading: operating.value === row.id, onClick: () => handleAction(row.id, 'resume') }, () => '继续'))
      }
      if (['pending', 'running', 'paused'].includes(row.status)) {
        buttons.push(h(NButton, { size: 'small', quaternary: true, type: 'error', round: true, loading: operating.value === row.id, onClick: () => handleAction(row.id, 'cancel') }, () => '取消'))
      }
      return h('div', { class: 'flex gap-1 justify-end' }, buttons)
    }
  }
]
</script>

<template>
  <div class="flex flex-col gap-4 h-full overflow-hidden">
    <section class="card-glass relative overflow-hidden p-5 md:p-6 shrink-0">
      <div class="relative z-10">
        <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">Admin / Tasks</p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)">
          生成任务
        </h1>
        <p class="mt-2 max-w-2xl text-sm text-(--ui-text-muted)">
          监控 AI 生成任务状态，重试失败任务。
        </p>
      </div>
    </section>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-6 shrink-0">
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full bg-amber-400" />
          <p class="text-xs text-(--ui-text-dimmed)">等待中</p>
        </div>
        <p class="mt-1 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ statusCounts.pending }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full bg-blue-400" />
          <p class="text-xs text-(--ui-text-dimmed)">运行中</p>
        </div>
        <p class="mt-1 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ statusCounts.running }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full bg-yellow-400" />
          <p class="text-xs text-(--ui-text-dimmed)">已暂停</p>
        </div>
        <p class="mt-1 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ statusCounts.paused }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full bg-slate-400" />
          <p class="text-xs text-(--ui-text-dimmed)">已取消</p>
        </div>
        <p class="mt-1 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ statusCounts.cancelled }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full bg-emerald-400" />
          <p class="text-xs text-(--ui-text-dimmed)">已完成</p>
        </div>
        <p class="mt-1 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ statusCounts.completed }}
        </p>
      </div>
      <div class="liquid-panel p-3">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full bg-red-400" />
          <p class="text-xs text-(--ui-text-dimmed)">失败</p>
        </div>
        <p class="mt-1 font-mono text-xl font-semibold text-(--ui-text-highlighted)">
          {{ statusCounts.failed }}
        </p>
      </div>
    </div>

    <div class="flex gap-2 shrink-0">
      <NSelect v-model:value="statusFilter" :options="statusOptions" class="w-40" />
      <NSelect v-model:value="typeFilter" :options="typeOptions" class="w-40" />
    </div>

    <div class="card-glass flex-1 min-h-0 flex flex-col overflow-hidden">
      <NDataTable
        :columns="tableColumns"
        :data="tasks"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        flex-height
        class="flex-1"
        style="height: 0"
      />
      <div
        class="flex items-center justify-between px-4 py-3 border-t border-(--ui-border)/40 shrink-0"
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
