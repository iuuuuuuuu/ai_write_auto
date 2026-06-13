<script setup lang="ts">
import { h } from 'vue'
import { NTag, NButton as NBtn, NSwitch } from 'naive-ui'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminAiConfig {
  id: number
  userId: number
  username: string | null
  purpose: string
  temperature: string | null
  isDefault: boolean
  enabled: boolean
  modelName: string
  model: string
  apiUrl: string
  maskedApiKey: string
  maxTokens: number | null
  modelEnabled: boolean
}

const search = shallowRef('')
const filterUserId = shallowRef<number | null>(null)
const message = useMessage()
const dialog = useDialog()

const { data: userList } = await useFetch<Array<{ id: number; username: string }>>('/api/admin/users', {
  params: { pageSize: 100 },
  transform: (data: any) => data.items || data,
  default: () => []
})

const userOptions = computed(() => [
  { label: '全部用户', value: null },
  ...(userList.value || []).map((u: any) => ({ label: u.username, value: u.id }))
])

const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (search.value.trim()) params.search = search.value.trim()
  if (filterUserId.value) params.userId = String(filterUserId.value)
  return params
})

const {
  items: configs,
  loading: pending,
  page,
  total,
  totalPages,
  pageSize,
  goToPage,
  refresh
} = usePagination<AdminAiConfig>({
  url: '/api/admin/ai-configs',
  params: queryParams
})

const purposeLabels: Record<string, string> = {
  generation: '内容生成',
  extraction: '信息提取',
  consistency_check: '一致性检查',
  style_analysis: '风格分析',
  planning: '检索规划'
}

async function toggleEnabled(config: AdminAiConfig) {
  await $fetch(`/api/admin/ai-configs/${config.id}`, {
    method: 'PUT',
    body: { enabled: !config.enabled }
  })
  refresh()
}

function deleteConfig(config: AdminAiConfig) {
  dialog.warning({
    title: '删除配置',
    content: `确定要删除此配置吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await $fetch(`/api/admin/ai-configs/${config.id}`, { method: 'DELETE' })
      refresh()
    }
  })
}

const columns = computed(() => [
  {
    title: '状态',
    key: 'enabled',
    width: 70,
    render(row: AdminAiConfig) {
      return h(NSwitch, { size: 'small', value: row.enabled, onUpdateValue: () => toggleEnabled(row) })
    }
  },
  {
    title: '用途',
    key: 'purpose',
    width: 110,
    render(row: AdminAiConfig) {
      return h('div', { class: 'space-y-0.5' }, [
        h('span', { class: 'text-xs' }, purposeLabels[row.purpose] || row.purpose),
        row.isDefault ? h(NTag, { size: 'small', bordered: false, type: 'info' }, () => '默认') : null
      ])
    }
  },
  {
    title: '模型',
    key: 'model',
    ellipsis: { tooltip: true },
    render(row: AdminAiConfig) {
      return h('div', { class: 'space-y-0.5' }, [
        h('p', { class: 'text-xs font-medium' }, row.modelName || row.model),
        h('p', { class: 'text-[11px] text-(--ui-text-dimmed) truncate' }, row.model)
      ])
    }
  },
  {
    title: '用户',
    key: 'username',
    width: 100,
    render(row: AdminAiConfig) {
      if (row.username) {
        return h('a', { href: `/admin/users/${row.userId}`, class: 'text-xs text-primary-500 hover:underline' }, row.username)
      }
      return h('span', { class: 'text-xs text-(--ui-text-dimmed)' }, `ID:${row.userId}`)
    }
  },
  {
    title: 'Temperature',
    key: 'temperature',
    width: 100,
    render(row: AdminAiConfig) {
      return h('span', { class: 'text-xs' }, row.temperature || '默认')
    }
  },
  {
    title: '最大输出 Tokens',
    key: 'maxTokens',
    width: 100,
    render(row: AdminAiConfig) {
      return h('span', { class: 'text-xs' }, row.maxTokens ? row.maxTokens.toLocaleString() : '-')
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 70,
    render(row: AdminAiConfig) {
      return h(NBtn, { size: 'tiny', quaternary: true, onClick: () => deleteConfig(row) }, {
        icon: () => h(resolveComponent('Icon'), { icon: 'lucide:trash-2', class: 'w-3.5 h-3.5 text-red-500' })
      })
    }
  }
])
</script>

<template>
  <div class="flex flex-col h-full space-y-4">
    <section class="card-glass relative overflow-hidden p-5 md:p-6">
      <div class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm text-(--ui-text-muted)">Admin / AI</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)">
            模型配置
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-(--ui-text-muted)">
            查阅用户配置的模型、用途和启用状态。
          </p>
        </div>
        <div class="flex items-center gap-2 sm:w-auto w-full">
          <NSelect
            v-model:value="filterUserId"
            :options="userOptions"
            size="small"
            placeholder="全部用户"
            clearable
            style="width: 140px"
          />
          <NInput
            v-model:value="search"
            class="flex-1 sm:w-60"
            size="small"
            placeholder="搜索模型或用途"
            clearable
          >
            <template #prefix>
              <Icon icon="lucide:search" class="text-(--ui-text-dimmed)" />
            </template>
          </NInput>
        </div>
      </div>
    </section>

    <section class="card-glass p-3 sm:p-4 flex-1 flex flex-col min-h-0">
      <NDataTable
        :columns="columns"
        :data="configs"
        :loading="pending"
        :bordered="false"
        size="small"
        :row-key="(row: AdminAiConfig) => row.id"
        flex-height
        class="flex-1"
      >
        <template #empty>
          <div class="py-8 text-center">
            <Icon icon="lucide:settings" class="size-10 text-(--ui-text-dimmed)/30 mx-auto mb-3" />
            <p class="text-sm text-(--ui-text-dimmed)">暂无模型配置</p>
          </div>
        </template>
      </NDataTable>

      <div class="flex items-center justify-between pt-3 border-t border-(--ui-border) mt-3">
        <span class="text-xs text-(--ui-text-dimmed)">共 {{ total }} 条</span>
        <NPagination
          :page="page"
          :page-count="totalPages"
          :page-size="pageSize"
          @update:page="goToPage"
        />
      </div>
    </section>
  </div>
</template>
