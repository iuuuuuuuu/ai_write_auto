<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface TaskItem {
  id: number
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  error: string | null
  retryCount: number | null
  tokensUsed: number | null
  novel: { id: number; title: string } | null
  createdAt: string
  completedAt: string | null
}

const statusFilter = ref('all')
const typeFilter = ref('all')

const queryParams = computed(() => {
  const p: Record<string, any> = {}
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
  refresh,
} = usePagination<TaskItem>({
  url: '/api/admin/tasks',
  params: queryParams,
})

const statusCounts = ref({ pending: 0, running: 0, completed: 0, failed: 0 })

watch(tasks, async () => {
  const data = await $fetch<any>('/api/admin/tasks', { params: { page: 1, pageSize: 1 } })
  if (data.statusCounts) statusCounts.value = data.statusCounts
}, { immediate: true })

const operating = ref<number | null>(null)

async function handleAction(taskId: number, action: 'retry' | 'cancel') {
  operating.value = taskId
  try {
    await $fetch(`/api/admin/tasks/${taskId}`, {
      method: 'PUT',
      body: { action },
    })
    refresh()
  } finally {
    operating.value = null
  }
}

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '等待中', value: 'pending' },
  { label: '运行中', value: 'running' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
]

const typeOptions = [
  { label: '全部类型', value: 'all' },
  { label: '生成', value: 'generate' },
  { label: '摘要提取', value: 'extract_summary' },
  { label: '角色提取', value: 'extract_characters' },
]

function statusColor(status: string) {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'info'
  if (status === 'failed') return 'error'
  return 'warning'
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="text-sm text-(--ui-text-muted)">Admin / Tasks</p>
      <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">生成任务</h1>
      <p class="mt-1 text-sm text-(--ui-text-muted)">监控 AI 生成任务状态，重试失败任务。</p>
    </div>

    <!-- Status Summary -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <div class="p-3 rounded-lg bg-(--ui-bg-muted) border border-(--ui-border)">
        <p class="text-xs text-(--ui-text-dimmed)">等待中</p>
        <p class="text-lg font-semibold text-amber-500 mt-1">{{ statusCounts.pending }}</p>
      </div>
      <div class="p-3 rounded-lg bg-(--ui-bg-muted) border border-(--ui-border)">
        <p class="text-xs text-(--ui-text-dimmed)">运行中</p>
        <p class="text-lg font-semibold text-blue-500 mt-1">{{ statusCounts.running }}</p>
      </div>
      <div class="p-3 rounded-lg bg-(--ui-bg-muted) border border-(--ui-border)">
        <p class="text-xs text-(--ui-text-dimmed)">已完成</p>
        <p class="text-lg font-semibold text-green-500 mt-1">{{ statusCounts.completed }}</p>
      </div>
      <div class="p-3 rounded-lg bg-(--ui-bg-muted) border border-(--ui-border)">
        <p class="text-xs text-(--ui-text-dimmed)">失败</p>
        <p class="text-lg font-semibold text-red-500 mt-1">{{ statusCounts.failed }}</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="grid gap-2 sm:grid-cols-[200px_200px]">
      <NSelect v-model:value="statusFilter" :options="statusOptions" />
      <NSelect v-model:value="typeFilter" :options="typeOptions" />
    </div>

    <!-- Task List -->
    <div v-if="loading" class="space-y-3">
      <NSkeleton v-for="i in 6" :key="i" class="h-16 rounded-lg" text />
    </div>
    <div v-else-if="!tasks.length" class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-10 text-center text-sm text-(--ui-text-muted)">
      暂无任务
    </div>
    <template v-else>
      <div class="space-y-2">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="flex items-center justify-between gap-4 p-4 rounded-lg border border-(--ui-border) bg-(--ui-bg-muted)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <NTag :type="statusColor(task.status)" size="small">{{ task.status }}</NTag>
              <span class="text-sm font-medium text-(--ui-text-highlighted)">{{ task.type }}</span>
              <span v-if="task.novel" class="text-xs text-(--ui-text-dimmed)">· {{ task.novel.title }}</span>
            </div>
            <div class="mt-1 flex items-center gap-3 text-xs text-(--ui-text-dimmed)">
              <span>{{ new Date(task.createdAt).toLocaleString() }}</span>
              <span v-if="task.tokensUsed">{{ task.tokensUsed }} tokens</span>
              <span v-if="task.retryCount">重试 {{ task.retryCount }} 次</span>
            </div>
            <p v-if="task.error" class="mt-1 text-xs text-red-400 truncate">{{ task.error }}</p>
          </div>
          <div class="flex gap-2">
            <NButton
              v-if="task.status === 'failed'"
              size="small"
              secondary
              :loading="operating === task.id"
              @click="handleAction(task.id, 'retry')"
            >
              重试
            </NButton>
            <NButton
              v-if="task.status === 'pending' || task.status === 'running'"
              size="small"
              quaternary
              type="error"
              :loading="operating === task.id"
              @click="handleAction(task.id, 'cancel')"
            >
              取消
            </NButton>
          </div>
        </div>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-between pt-2">
        <span class="text-xs text-(--ui-text-dimmed)">共 {{ total }} 条</span>
        <NPagination :page="page" :page-count="totalPages" :page-size="pageSize" @update:page="goToPage" />
      </div>
    </template>
  </div>
</template>
