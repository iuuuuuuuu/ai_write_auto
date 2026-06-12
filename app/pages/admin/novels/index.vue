<script setup lang="ts">
import { h } from 'vue'
import { NTag, NButton } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { getNovelGenreLabelKey } from '~~/shared/novel-catalog'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminNovelListItem {
  id: number
  userId: number
  title: string
  description: string | null
  genre: string | null
  status: 'draft' | 'in_progress' | 'completed'
  deletedAt: string | null
  updatedAt: string
  user: { id: number; username: string; role: string } | null
  chapterCount: number
  wordCount: number
}

const search = shallowRef('')
const statusFilter = shallowRef('all')

const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (search.value.trim()) params.search = search.value.trim()
  if (statusFilter.value !== 'all') params.status = statusFilter.value
  return params
})

const {
  items: novels,
  loading: pending,
  page,
  total,
  totalPages,
  pageSize,
  goToPage,
  refresh
} = usePagination<AdminNovelListItem>({
  url: '/api/admin/novels',
  params: queryParams
})

const { confirmDelete } = useConfirmDialog()
const { t } = useI18n()
const { removeNovelHistory } = useReadingHistory()

async function deleteNovel(novel: AdminNovelListItem) {
  const confirmed = await confirmDelete(novel.title)
  if (!confirmed) return
  await $fetch(`/api/admin/novels/${novel.id}`, { method: 'DELETE' })
  removeNovelHistory(novel.id)
  refresh()
}

const statusItems = [
  { label: '全部状态', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '连载中', value: 'in_progress' },
  { label: '已完结', value: 'completed' }
]

function statusLabel(status: string) {
  if (status === 'draft') return '草稿'
  if (status === 'in_progress') return '连载中'
  if (status === 'completed') return '已完结'
  return status
}

function statusType(status: string) {
  if (status === 'completed') return 'success'
  if (status === 'in_progress') return 'info'
  return 'default'
}

const tableColumns = [
  {
    title: '标题',
    key: 'title',
    ellipsis: { tooltip: true },
    render(row: AdminNovelListItem) {
      const children: any[] = [
        h(
          resolveComponent('NuxtLink') as any,
          {
            to: `/admin/novels/${row.id}`,
            class:
              'font-medium text-(--ui-text-highlighted) hover:text-primary-500'
          },
          () => row.title
        )
      ]
      if (row.deletedAt) {
        children.push(
          h(
            NTag,
            { type: 'warning', size: 'tiny', class: 'ml-2' },
            () => '回收站'
          )
        )
      }
      return h('div', { class: 'flex items-center gap-1' }, children)
    }
  },
  {
    title: '作者',
    key: 'user',
    width: 110,
    render(row: AdminNovelListItem) {
      return row.user?.username || '未知'
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render(row: AdminNovelListItem) {
      return h(NTag, { type: statusType(row.status), size: 'small' }, () =>
        statusLabel(row.status)
      )
    }
  },
  {
    title: '类型',
    key: 'genre',
    width: 90,
    render(row: AdminNovelListItem) {
      if (!row.genre) return '-'
      return t(getNovelGenreLabelKey(row.genre))
    }
  },
  {
    title: '章节',
    key: 'chapterCount',
    width: 70,
    align: 'right' as const,
    render(row: AdminNovelListItem) {
      return Number(row.chapterCount) || 0
    }
  },
  {
    title: '字数',
    key: 'wordCount',
    width: 90,
    align: 'right' as const,
    render(row: AdminNovelListItem) {
      return (Number(row.wordCount) || 0).toLocaleString()
    }
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 170,
    render(row: AdminNovelListItem) {
      return new Date(row.updatedAt).toLocaleString()
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 80,
    align: 'center' as const,
    render(row: AdminNovelListItem) {
      return h('div', { class: 'flex gap-1 justify-center' }, [
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            round: true,
            onClick: () => navigateTo(`/admin/novels/${row.id}`)
          },
          {
            icon: () => h(Icon, { icon: 'lucide:eye' })
          }
        ),
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            round: true,
            type: 'error',
            onClick: () => deleteNovel(row)
          },
          {
            icon: () => h(Icon, { icon: 'lucide:trash-2' })
          }
        )
      ])
    }
  }
]
</script>

<template>
  <div class="flex flex-col gap-4 h-full overflow-hidden">
    <section class="card-glass relative overflow-hidden p-5 md:p-6 shrink-0">
      <div
        class="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p class="text-sm text-(--ui-text-muted)">Admin / Novels</p>
          <h1
            class="mt-1 text-2xl font-semibold tracking-tight text-(--ui-text-highlighted)"
          >
            小说查阅
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-(--ui-text-muted)">
            按用户查阅小说、章节数量和字数，不修改用户内容。
          </p>
        </div>
        <div class="flex gap-2">
          <NInput
            v-model:value="search"
            placeholder="搜索小说或用户"
            clearable
            class="w-52"
          >
            <template #prefix>
              <Icon
                icon="lucide:search"
                class="text-(--ui-text-dimmed)"
              />
            </template>
          </NInput>
          <NSelect
            v-model:value="statusFilter"
            :options="statusItems"
            class="w-36"
          />
        </div>
      </div>
    </section>

    <div class="card-glass flex-1 min-h-0 flex flex-col overflow-hidden">
      <NDataTable
        :columns="tableColumns"
        :data="novels"
        :loading="pending"
        :bordered="false"
        :single-line="false"
        flex-height
        class="flex-1"
        style="height: 0"
      />
      <div
        v-if="total > 0"
        class="flex items-center justify-between px-4 py-3 border-t border-(--ui-border)/40 shrink-0"
      >
        <span class="text-xs text-(--ui-text-dimmed)">共 {{ total }} 条</span>
        <NPagination
          :page="page"
          :page-count="totalPages"
          :page-size="pageSize"
          show-size-picker
          :page-sizes="[10, 20, 50]"
          @update:page="goToPage"
        />
      </div>
    </div>
  </div>
</template>
