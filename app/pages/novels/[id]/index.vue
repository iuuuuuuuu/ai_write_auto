<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const novelId = computed(() => Number(route.params.id))

interface NovelDetail {
  id: number
  title: string
  description: string | null
  genre: string | null
  status: string
  wordCount: number | null
  styleGuide: string | null
  worldSetting: string | null
  aiTemperature: string | null
  aiExtraPrompt: string | null
  createdAt: string
  updatedAt: string
  aiConfigId: number | null
  aiConfigName: string | null
}

interface ChapterItem {
  id: number
  chapterNumber: number
  title: string
  summary: string | null
  status: string
  wordCount: number | null
  updatedAt: string
}

const { data: novel } = await useFetch<NovelDetail>(
  `/api/novels/${novelId.value}`
)
const { data: chapters } = await useFetch<ChapterItem[]>(
  `/api/novels/${novelId.value}/chapters`
)
const { confirmDelete } = useConfirmDialog()

async function deleteNovel() {
  const confirmed = await confirmDelete(novel.value?.title || '此小说')
  if (!confirmed) return
  await $fetch(`/api/novels/${novelId.value}`, { method: 'DELETE' })
  navigateTo('/dashboard')
}

const statusLabel = computed(() => {
  const s = novel.value?.status
  if (s === 'completed') return '已完结'
  if (s === 'in_progress') return '连载中'
  return '草稿'
})

const statusColor = computed(() => {
  const s = novel.value?.status
  if (s === 'completed') return 'success'
  if (s === 'in_progress') return 'info'
  return 'default'
})

const genreColor = (genre: string | null) => {
  const colors: Record<string, string> = {
    fantasy: '#d97706',
    scifi: '#0891b2',
    romance: '#e11d48',
    mystery: '#4f46e5',
    horror: '#dc2626',
    historical: '#c2410c',
    wuxia: '#059669',
    urban: '#475569',
    other: '#94a3b8'
  }
  return colors[genre || ''] || colors.other
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

const totalWords = computed(() => {
  return chapters.value?.reduce((sum, c) => sum + (c.wordCount || 0), 0) || 0
})
</script>

<template>
  <div
    v-if="novel"
    class="max-w-6xl mx-auto space-y-5"
  >
    <!-- Header Card -->
    <section class="card-surface p-5">
      <div
        class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="inline-block w-1 h-5 rounded-full"
              :style="{ backgroundColor: genreColor(novel.genre) }"
            />
            <NTag
              size="small"
              :type="statusColor"
              >{{ statusLabel }}</NTag
            >
            <span class="text-xs text-(--ui-text-dimmed)">{{
              novel.genre || '未分类'
            }}</span>
          </div>
          <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">
            {{ novel.title }}
          </h1>
          <p
            class="mt-2 text-sm text-(--ui-text-muted) leading-relaxed max-w-2xl"
          >
            {{ novel.description || '暂无简介' }}
          </p>
          <p class="mt-2 text-xs text-(--ui-text-dimmed)">
            创建于 {{ formatDate(novel.createdAt) }}
            <span v-if="novel.aiConfigName"
              >· 使用 {{ novel.aiConfigName }}</span
            >
          </p>
        </div>
        <div class="flex gap-2 shrink-0">
          <NButton
            secondary
            size="small"
            @click="
              navigateTo(
                `/novels/${novel.id}/chapters/${chapters?.[0]?.id || 1}`
              )
            "
          >
            <template #icon><Icon icon="lucide:pen-tool" /></template>
            继续写作
          </NButton>
          <NButton
            quaternary
            size="small"
            type="error"
            @click="deleteNovel"
          >
            <template #icon><Icon icon="lucide:trash-2" /></template>
          </NButton>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="mt-5 grid grid-cols-3 sm:grid-cols-5 gap-3">
        <div class="card-bezel p-3 text-center">
          <p class="text-xs text-(--ui-text-dimmed)">章节</p>
          <p class="mt-1 text-lg font-bold font-mono">
            {{ chapters?.length || 0 }}
          </p>
        </div>
        <div class="card-bezel p-3 text-center">
          <p class="text-xs text-(--ui-text-dimmed)">字数</p>
          <p class="mt-1 text-lg font-bold font-mono">
            {{ totalWords.toLocaleString() }}
          </p>
        </div>
        <div class="card-bezel p-3 text-center">
          <p class="text-xs text-(--ui-text-dimmed)">状态</p>
          <p class="mt-1 text-sm font-semibold">{{ statusLabel }}</p>
        </div>
        <div class="card-bezel p-3 text-center">
          <p class="text-xs text-(--ui-text-dimmed)">Temperature</p>
          <p class="mt-1 text-lg font-bold font-mono">
            {{ novel.aiTemperature || '默认' }}
          </p>
        </div>
        <div class="card-bezel p-3 text-center">
          <p class="text-xs text-(--ui-text-dimmed)">更新</p>
          <p class="mt-1 text-sm font-semibold">
            {{ formatDate(novel.updatedAt) }}
          </p>
        </div>
      </div>
    </section>

    <div class="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <!-- Chapters -->
      <section class="card-surface p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <Icon
              icon="lucide:book-open"
              class="size-4 text-primary-500"
            />
            <h2 class="font-semibold text-(--ui-text-highlighted)">章节列表</h2>
          </div>
          <NButton
            size="tiny"
            type="primary"
            @click="
              navigateTo(
                `/novels/${novel.id}/chapters/${chapters?.[0]?.id || 1}`
              )
            "
          >
            <template #icon><Icon icon="lucide:plus" /></template>
            新建章节
          </NButton>
        </div>
        <div
          v-if="!chapters?.length"
          class="py-8 text-center text-sm text-(--ui-text-muted)"
        >
          还没有章节，点击上方按钮开始写作
        </div>
        <div
          v-else
          class="space-y-2"
        >
          <NuxtLink
            v-for="chapter in chapters"
            :key="chapter.id"
            :to="`/novels/${novel.id}/chapters/${chapter.id}`"
            class="group flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-(--ui-bg-elevated)/60"
          >
            <div
              class="flex size-8 items-center justify-center rounded-lg bg-primary-400/10 text-xs font-bold font-mono text-primary-500 shrink-0"
            >
              {{ chapter.chapterNumber }}
            </div>
            <div class="min-w-0 flex-1">
              <p
                class="text-sm font-medium text-(--ui-text-highlighted) truncate"
              >
                {{ chapter.title }}
              </p>
              <p class="text-xs text-(--ui-text-muted) mt-0.5">
                {{ chapter.wordCount || 0 }} 字 ·
                {{ formatDate(chapter.updatedAt) }}
              </p>
            </div>
            <Icon
              icon="lucide:chevron-right"
              class="size-4 text-(--ui-text-dimmed) opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            />
          </NuxtLink>
        </div>
      </section>

      <!-- Right Column -->
      <div class="space-y-5">
        <!-- AI Settings -->
        <section class="card-surface p-5">
          <div class="flex items-center gap-2 mb-3">
            <Icon
              icon="lucide:sparkles"
              class="size-4 text-violet-500"
            />
            <h2 class="font-semibold text-(--ui-text-highlighted)">AI 设定</h2>
          </div>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-(--ui-text-muted)">Temperature</span>
              <span class="font-mono">{{ novel.aiTemperature || '默认' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-(--ui-text-muted)">模型</span>
              <span>{{ novel.aiConfigName || '未设置' }}</span>
            </div>
            <div v-if="novel.aiExtraPrompt">
              <span class="text-(--ui-text-muted)">额外提示</span>
              <p class="mt-1 text-(--ui-text) whitespace-pre-wrap text-xs">
                {{ novel.aiExtraPrompt }}
              </p>
            </div>
          </div>
        </section>

        <!-- Style Guide -->
        <section
          v-if="novel.styleGuide"
          class="card-surface p-5"
        >
          <div class="flex items-center gap-2 mb-3">
            <Icon
              icon="lucide:palette"
              class="size-4 text-amber-500"
            />
            <h2 class="font-semibold text-(--ui-text-highlighted)">风格指南</h2>
          </div>
          <p class="text-sm text-(--ui-text-muted) whitespace-pre-wrap">
            {{ novel.styleGuide }}
          </p>
        </section>

        <!-- World Setting -->
        <section
          v-if="novel.worldSetting"
          class="card-surface p-5"
        >
          <div class="flex items-center gap-2 mb-3">
            <Icon
              icon="lucide:globe"
              class="size-4 text-blue-500"
            />
            <h2 class="font-semibold text-(--ui-text-highlighted)">世界观</h2>
          </div>
          <p class="text-sm text-(--ui-text-muted) whitespace-pre-wrap">
            {{ novel.worldSetting }}
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
