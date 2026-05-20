<script setup lang="ts">
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

const search = ref('')
const statusFilter = ref('all')

const queryParams = computed(() => {
  const p: Record<string, any> = {}
  if (search.value.trim()) p.search = search.value.trim()
  if (statusFilter.value !== 'all') p.status = statusFilter.value
  return p
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

async function deleteNovel(novel: AdminNovelListItem) {
  const confirmed = await confirmDelete(novel.title)
  if (!confirmed) return
  await $fetch(`/api/admin/novels/${novel.id}`, { method: 'DELETE' })
  refresh()
}

const statusItems = [
  { label: '全部状态', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '连载中', value: 'in_progress' },
  { label: '已完结', value: 'completed' }
]
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <p class="text-sm text-(--ui-text-muted)">Admin / Novels</p>
        <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
          小说查阅
        </h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">
          按用户查阅小说、章节数量和字数，不修改用户内容。
        </p>
      </div>
      <div class="grid gap-2 sm:grid-cols-[220px_220px]">
        <NInput
          v-model:value="search"
          placeholder="搜索小说或用户"
          clearable
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
        />
      </div>
    </div>

    <div
      v-if="pending"
      class="space-y-3"
    >
      <NSkeleton
        v-for="item in 6"
        :key="item"
        class="h-24 rounded-lg"
        text
      />
    </div>
    <div
      v-else-if="!novels.length"
      class="card-surface p-10 text-center text-sm text-(--ui-text-muted)"
    >
      暂无匹配小说
    </div>
    <template v-else>
      <div class="grid gap-3">
        <div
          v-for="novel in novels"
          :key="novel.id"
          class="card-surface group p-4 transition-colors hover:bg-(--ui-bg-elevated)/60"
        >
          <div
            class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
          >
            <NuxtLink
              :to="`/admin/novels/${novel.id}`"
              class="min-w-0 flex-1"
            >
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="font-semibold text-(--ui-text-highlighted)">
                  {{ novel.title }}
                </h2>
                <NTag size="small">{{ novel.status }}</NTag>
                <NTag
                  v-if="novel.deletedAt"
                  type="warning"
                  size="small"
                >
                  回收站
                </NTag>
              </div>
              <p class="mt-2 line-clamp-2 text-sm text-(--ui-text-muted)">
                {{ novel.description || '暂无简介' }}
              </p>
              <p class="mt-2 text-xs text-(--ui-text-dimmed)">
                作者 {{ novel.user?.username || '未知用户' }} ·
                {{ novel.genre || '未分类' }}
              </p>
            </NuxtLink>
            <div class="flex items-center gap-4">
              <div class="grid grid-cols-3 gap-3 text-right md:w-56">
                <div>
                  <p class="text-xs text-(--ui-text-dimmed)">章节</p>
                  <p class="mt-1 font-semibold">{{ novel.chapterCount }}</p>
                </div>
                <div>
                  <p class="text-xs text-(--ui-text-dimmed)">字数</p>
                  <p class="mt-1 font-semibold">{{ novel.wordCount }}</p>
                </div>
                <div>
                  <p class="text-xs text-(--ui-text-dimmed)">更新</p>
                  <p class="mt-1 text-sm">
                    {{ new Date(novel.updatedAt).toLocaleDateString() }}
                  </p>
                </div>
              </div>
              <NButton
                size="small"
                quaternary
                type="error"
                @click.prevent="deleteNovel(novel)"
              >
                <template #icon><Icon icon="lucide:trash-2" /></template>
              </NButton>
            </div>
          </div>
        </div>
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
