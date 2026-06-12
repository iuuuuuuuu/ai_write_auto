<script setup lang="ts">
import { h } from 'vue'
import { NTag, NButton } from 'naive-ui'

definePageMeta({ layout: 'admin', middleware: 'admin' })

type TaskStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'failed'
type TaskAction = 'cancel' | 'pause' | 'resume'
type TaskStatusCounts = Record<TaskStatus, number>
type TasksResponse = { statusCounts?: Partial<TaskStatusCounts> }

interface TaskItem {
  id: number
  type: string
  status: TaskStatus
  result: string | null
  error: string | null
  retryCount: number | null
  tokensUsed: number | null
  novel: { id: number; title: string } | null
  chapter: { id: number; title: string; chapterNumber: number } | null
  username: string | null
  userId: number | null
  createdAt: string
  completedAt: string | null
}

const message = useMessage()
const dialog = useDialog()
const { put } = useApi()
const statusFilter = ref('all')
const typeFilter = ref('all')
const userFilter = ref<number | null>(null)

const { data: userList } = await useFetch<any>('/api/admin/users', {
  params: { pageSize: 100 },
  transform: (data: any) => data.items || data,
  default: () => []
})

const userOptions = computed(() => [
  { label: '全部用户', value: null },
  ...(userList.value || []).map((u: any) => ({
    label: u.username,
    value: u.id
  }))
])

const queryParams = computed(() => {
  const p: Record<string, string> = {}
  if (statusFilter.value !== 'all') p.status = statusFilter.value
  if (typeFilter.value !== 'all') p.type = typeFilter.value
  if (userFilter.value) p.userId = String(userFilter.value)
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
} = usePagination<TaskItem>({ url: '/api/admin/tasks', params: queryParams })

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
    if (data.statusCounts)
      statusCounts.value = { ...statusCounts.value, ...data.statusCounts }
  },
  { immediate: true }
)

const operating = ref<number | null>(null)
async function handleAction(taskId: number, action: TaskAction) {
  operating.value = taskId
  try {
    await put(
      `/api/admin/tasks/${taskId}`,
      { action },
      {
        successMessage: `任务已${
          action === 'cancel' ? '取消'
          : action === 'pause' ? '暂停'
          : '继续'
        }`
      }
    )
    await refresh()
  } catch {
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
  { label: '内容生成', value: 'generate' },
  { label: '旧批量生成（已下线）', value: 'batch_generate' },
  { label: '重新生成', value: 'regenerate' },
  { label: '摘要提取', value: 'extract_summary' },
  { label: '角色提取', value: 'extract_characters' },
  { label: '一致性检查', value: 'consistency_check' },
  { label: '故事弧线', value: 'generate_arc' },
  { label: '风格分析', value: 'style_analysis' }
]

const typeLabels: Record<string, string> = {
  generate: '内容生成',
  batch_generate: '旧批量生成（已下线）',
  regenerate: '重新生成',
  extract_summary: '摘要提取',
  extract_characters: '角色提取',
  consistency_check: '一致性检查',
  generate_arc: '故事弧线',
  style_analysis: '风格分析'
}
const statusLabels: Record<string, string> = {
  pending: '等待中',
  running: '运行中',
  paused: '已暂停',
  cancelled: '已取消',
  completed: '已完成',
  failed: '失败'
}

function statusColor(status: TaskStatus) {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'info'
  if (status === 'failed' || status === 'cancelled') return 'error'
  return 'warning'
}

const showDetailModal = ref(false)
const detailTask = ref<TaskItem | null>(null)

function viewDetail(task: TaskItem) {
  detailTask.value = task
  showDetailModal.value = true
}

function isJsonResult(task: TaskItem): boolean {
  if (!task.result) return false
  return (
    task.type === 'extract_characters' ||
    task.type === 'consistency_check' ||
    task.result.trimStart().startsWith('[') ||
    task.result.trimStart().startsWith('{')
  )
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

const tableColumns = [
  {
    title: '状态',
    key: 'status',
    width: 80,
    render(row: TaskItem) {
      return h(
        NTag,
        { type: statusColor(row.status), size: 'small' },
        () => statusLabels[row.status] || row.status
      )
    }
  },
  {
    title: '类型',
    key: 'type',
    width: 100,
    render(row: TaskItem) {
      return h('span', { class: 'text-xs' }, typeLabels[row.type] || row.type)
    }
  },
  {
    title: '关联小说',
    key: 'novel',
    width: 120,
    ellipsis: { tooltip: true },
    render(row: TaskItem) {
      if (!row.novel) return '-'
      return h(
        'a',
        {
          href: `/novels/${row.novel.id}`,
          class: 'text-xs text-primary-500 hover:underline'
        },
        row.novel.title
      )
    }
  },
  {
    title: '章节',
    key: 'chapter',
    width: 130,
    ellipsis: { tooltip: true },
    render(row: TaskItem) {
      if (!row.chapter || !row.novel) return '-'
      return h(
        'a',
        {
          href: `/novels/${row.novel.id}/chapters/${row.chapter.id}`,
          class: 'text-xs text-primary-500 hover:underline'
        },
        `Ch.${row.chapter.chapterNumber} ${row.chapter.title}`
      )
    }
  },
  {
    title: '用户',
    key: 'username',
    width: 80,
    render(row: TaskItem) {
      if (row.username)
        return h(
          'a',
          {
            href: `/admin/users/${row.userId}`,
            class: 'text-xs text-primary-500 hover:underline'
          },
          row.username
        )
      return h('span', { class: 'text-xs text-(--ui-text-dimmed)' }, '-')
    }
  },
  {
    title: 'Tokens',
    key: 'tokensUsed',
    width: 80,
    render(row: TaskItem) {
      return h(
        'span',
        { class: 'text-xs' },
        row.tokensUsed ? row.tokensUsed.toLocaleString() : '-'
      )
    }
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 145,
    render(row: TaskItem) {
      return h(
        'span',
        { class: 'text-xs' },
        new Date(row.createdAt).toLocaleString()
      )
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    align: 'right' as const,
    render(row: TaskItem) {
      const buttons: any[] = []
      if (row.result || row.error) {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              quaternary: true,
              round: true,
              onClick: () => viewDetail(row)
            },
            {
              icon: () =>
                h(resolveComponent('Icon'), {
                  icon:
                    row.status === 'failed' ?
                      'lucide:alert-circle'
                    : 'lucide:eye',
                  class: `w-3.5 h-3.5 ${row.status === 'failed' ? 'text-red-500' : ''}`
                })
            }
          )
        )
      }
      if (row.status === 'running') {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              secondary: true,
              round: true,
              loading: operating.value === row.id,
              onClick: () => handleAction(row.id, 'pause')
            },
            () => '暂停'
          )
        )
      }
      if (row.status === 'paused') {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              secondary: true,
              round: true,
              loading: operating.value === row.id,
              onClick: () => handleAction(row.id, 'resume')
            },
            () => '继续'
          )
        )
      }
      if (['pending', 'running', 'paused'].includes(row.status)) {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              quaternary: true,
              type: 'error',
              round: true,
              loading: operating.value === row.id,
              onClick: () => handleAction(row.id, 'cancel')
            },
            () => '取消'
          )
        )
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
        <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">
          Admin / Tasks
        </p>
        <h1
          class="mt-2 text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)"
        >
          生成任务
        </h1>
        <p class="mt-2 max-w-2xl text-sm text-(--ui-text-muted)">
          监控 AI 生成任务状态。
        </p>
      </div>
    </section>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-6 shrink-0">
      <div
        v-for="(key, idx) in [
          'pending',
          'running',
          'paused',
          'cancelled',
          'completed',
          'failed'
        ] as TaskStatus[]"
        :key="key"
        class="liquid-panel p-3"
      >
        <div class="flex items-center gap-2">
          <span
            class="size-2 rounded-full"
            :class="
              [
                'bg-amber-400',
                'bg-blue-400',
                'bg-yellow-400',
                'bg-slate-400',
                'bg-emerald-400',
                'bg-red-400'
              ][idx]
            "
          />
          <p class="text-xs text-(--ui-text-dimmed)">{{ statusLabels[key] }}</p>
        </div>
        <p
          class="mt-1 font-mono text-xl font-semibold text-(--ui-text-highlighted)"
        >
          {{ statusCounts[key] }}
        </p>
      </div>
    </div>

    <div class="flex gap-2 shrink-0 flex-wrap">
      <NSelect
        v-model:value="statusFilter"
        :options="statusOptions"
        size="small"
        style="width: 120px"
      />
      <NSelect
        v-model:value="typeFilter"
        :options="typeOptions"
        size="small"
        style="width: 120px"
      />
      <NSelect
        v-model:value="userFilter"
        :options="userOptions"
        size="small"
        clearable
        placeholder="全部用户"
        style="width: 130px"
      />
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

    <!-- Detail Modal -->
    <NModal
      v-model:show="showDetailModal"
      preset="card"
      :title="
        detailTask ?
          (typeLabels[detailTask.type] || detailTask.type) +
          (detailTask.status === 'failed' ? ' - 错误' : ' - 结果')
        : '详情'
      "
      style="max-width: 700px; max-height: 80vh"
    >
      <div
        v-if="detailTask"
        class="max-h-[60vh] overflow-y-auto"
      >
        <!-- Error -->
        <div
          v-if="detailTask.status === 'failed' && detailTask.error"
          class="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap"
        >
          {{ detailTask.error }}
        </div>
        <!-- JSON result -->
        <pre
          v-else-if="detailTask.result && isJsonResult(detailTask)"
          class="rounded-lg bg-(--ui-bg-muted) p-4 text-xs leading-relaxed overflow-x-auto"
        ><code>{{ formatJson(detailTask.result) }}</code></pre>
        <!-- Text result -->
        <div
          v-else-if="detailTask.result"
          class="rounded-lg bg-(--ui-bg-muted) p-4 text-sm leading-relaxed whitespace-pre-wrap text-(--ui-text)"
        >
          {{ detailTask.result }}
        </div>
        <div
          v-else
          class="py-4 text-center text-sm text-(--ui-text-dimmed)"
        >
          无内容
        </div>
      </div>
    </NModal>
  </div>
</template>
