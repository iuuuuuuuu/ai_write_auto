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

const {
  data: novels,
  pending,
  error
} = await useFetch<AdminNovelListItem[]>('/api/admin/novels', {
  default: () => []
})

const search = ref('')
const statusFilter = ref('all')

const statusItems = [
  { label: '全部状态', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '连载中', value: 'in_progress' },
  { label: '已完结', value: 'completed' }
]

const filteredNovels = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return novels.value.filter((novel) => {
    const matchesStatus =
      statusFilter.value === 'all' || novel.status === statusFilter.value
    const matchesKeyword =
      !keyword ||
      novel.title.toLowerCase().includes(keyword) ||
      (novel.user?.username.toLowerCase().includes(keyword) ?? false)

    return matchesStatus && matchesKeyword
  })
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div
      class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <p class="text-sm text-(--ui-text-muted)">Admin / Novels</p>
        <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
          小说查阅
        </h1>
        <p class="mt-2 text-sm text-(--ui-text-muted)">
          按用户查阅小说、章节数量和字数，不修改用户内容。
        </p>
      </div>
      <div class="grid gap-2 sm:grid-cols-[220px_220px]">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="搜索小说或用户"
        />
        <USelectMenu
          v-model="statusFilter"
          :items="statusItems"
          value-key="value"
        />
      </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="小说列表加载失败"
    />

    <div
      v-if="pending"
      class="space-y-3"
    >
      <USkeleton
        v-for="item in 6"
        :key="item"
        class="h-24 rounded-lg"
      />
    </div>
    <div
      v-else-if="!filteredNovels.length"
      class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-10 text-center text-sm text-(--ui-text-muted)"
    >
      暂无匹配小说
    </div>
    <div
      v-else
      class="grid gap-3"
    >
      <NuxtLink
        v-for="novel in filteredNovels"
        :key="novel.id"
        :to="`/admin/novels/${novel.id}`"
        class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-4 transition-colors hover:bg-(--ui-bg-elevated)"
      >
        <div
          class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-semibold text-(--ui-text-highlighted)">
                {{ novel.title }}
              </h2>
              <UBadge variant="subtle">{{ novel.status }}</UBadge>
              <UBadge
                v-if="novel.deletedAt"
                color="warning"
                variant="subtle"
              >
                回收站
              </UBadge>
            </div>
            <p class="mt-2 line-clamp-2 text-sm text-(--ui-text-muted)">
              {{ novel.description || '暂无简介' }}
            </p>
            <p class="mt-2 text-xs text-(--ui-text-dimmed)">
              作者 {{ novel.user?.username || '未知用户' }} ·
              {{ novel.genre || '未分类' }}
            </p>
          </div>
          <div class="grid grid-cols-3 gap-3 text-right md:w-72">
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
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
