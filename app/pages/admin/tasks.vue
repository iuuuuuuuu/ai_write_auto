<script setup lang="ts">
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
</script>

<template>
  <div class="space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <div class="relative z-10">
        <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">Admin / Tasks</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-[-0.05em] text-(--ui-text-highlighted)">
          生成任务
        </h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-(--ui-text-muted)">
          监控 AI 生成任务状态，重试失败任务。
        </p>
      </div>
    </section>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-6">
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

    <section class="card-glass p-3 sm:p-4">
      <div class="grid gap-2 sm:grid-cols-[200px_200px]">
        <NSelect
          v-model:value="statusFilter"
          :options="statusOptions"
        />
        <NSelect
          v-model:value="typeFilter"
          :options="typeOptions"
        />
      </div>
    </section>

    <div
      v-if="loading"
      class="space-y-3"
    >
      <NSkeleton
        v-for="i in 6"
        :key="i"
        class="h-16 rounded-[1.4rem]"
        text
      />
    </div>
    <div
      v-else-if="!tasks.length"
      class="card-glass p-10 text-center text-sm text-(--ui-text-muted)"
    >
      暂无任务
    </div>
    <template v-else>
      <div class="space-y-2">
        <article
          v-for="task in tasks"
          :key="task.id"
          class="liquid-panel group flex items-center justify-between gap-4 p-4"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <NTag
                :type="statusColor(task.status)"
                size="small"
                >{{ task.status }}</NTag
              >
              <span class="text-sm font-medium text-(--ui-text-highlighted)">{{
                task.type
              }}</span>
              <span
                v-if="task.novel"
                class="text-xs text-(--ui-text-dimmed)"
                >· {{ task.novel.title }}</span
              >
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-(--ui-text-dimmed)">
              <span>{{ new Date(task.createdAt).toLocaleString() }}</span>
              <span v-if="task.tokensUsed">{{ task.tokensUsed }} tokens</span>
              <span v-if="task.retryCount">重试 {{ task.retryCount }} 次</span>
            </div>
            <p
              v-if="task.error"
              class="mt-1 truncate text-xs text-red-400"
            >
              {{ task.error }}
            </p>
          </div>
          <div class="flex gap-2">
            <NButton
              v-if="task.status === 'failed' || task.status === 'cancelled'"
              size="small"
              secondary
              round
              :loading="operating === task.id"
              @click="handleAction(task.id, 'retry')"
            >
              重试
            </NButton>
            <NButton
              v-if="task.status === 'running'"
              size="small"
              secondary
              round
              :loading="operating === task.id"
              @click="handleAction(task.id, 'pause')"
            >
              暂停
            </NButton>
            <NButton
              v-if="task.status === 'paused'"
              size="small"
              secondary
              round
              :loading="operating === task.id"
              @click="handleAction(task.id, 'resume')"
            >
              继续
            </NButton>
            <NButton
              v-if="
                task.status === 'pending' ||
                task.status === 'running' ||
                task.status === 'paused'
              "
              size="small"
              quaternary
              type="error"
              round
              :loading="operating === task.id"
              @click="handleAction(task.id, 'cancel')"
            >
              取消
            </NButton>
          </div>
        </article>
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
