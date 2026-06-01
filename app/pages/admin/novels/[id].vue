<script setup lang="ts">
import { h } from 'vue'
import { NTag } from 'naive-ui'
import { getNovelGenreLabelKey } from '~~/shared/novel-catalog'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminNovelDetail {
  novel: {
    id: number
    title: string
    description: string | null
    genre: string | null
    status: string
    styleGuide: string | null
    worldSetting: string | null
    aiTemperature: string | null
    aiExtraPrompt: string | null
    updatedAt: string
    user: { id: number; username: string; role: string } | null
    chapterCount: number
    wordCount: number
  }
  chapters: Array<{
    id: number
    chapterNumber: number
    title: string
    summary: string | null
    status: string
    wordCount: number | null
    updatedAt: string
  }>
  outlines: Array<{
    id: number
    chapterNumber: number
    description: string
    sortOrder: number
  }>
  characters: Array<{
    id: number
    name: string
    description: string | null
    currentState: string | null
  }>
  plotPoints: Array<{
    id: number
    description: string
    type: string
    status: string
  }>
}

const route = useRoute()
const novelId = computed(() => Number(route.params.id))
const { t } = useI18n()

const {
  data: detail,
  pending,
  error
} = await useFetch<AdminNovelDetail>(() => `/api/admin/novels/${novelId.value}`)

function getGenreLabel(genre: string | null) {
  return t(getNovelGenreLabelKey(genre))
}

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

function chapterStatusLabel(status: string) {
  if (status === 'draft') return '草稿'
  if (status === 'completed') return '已完成'
  if (status === 'in_progress') return '写作中'
  return status
}

const chapterColumns = [
  {
    title: '章节',
    key: 'chapterNumber',
    width: 70,
    render: (row: any) => `第${row.chapterNumber}章`
  },
  { title: '标题', key: 'title', ellipsis: { tooltip: true } },
  {
    title: '字数',
    key: 'wordCount',
    width: 80,
    align: 'right' as const,
    render: (row: any) => `${row.wordCount || 0}`
  },
  {
    title: '状态',
    key: 'status',
    width: 80,
    render: (row: any) =>
      h(
        NTag,
        {
          size: 'small',
          type: row.status === 'completed' ? 'success' : 'default'
        },
        () => chapterStatusLabel(row.status)
      )
  },
  {
    title: '更新',
    key: 'updatedAt',
    width: 100,
    render: (row: any) => new Date(row.updatedAt).toLocaleDateString()
  }
]
</script>

<template>
  <div class="flex flex-col gap-4 h-full overflow-hidden">
    <div class="flex items-center gap-3 shrink-0">
      <NButton
        quaternary
        size="small"
        @click="navigateTo('/admin/novels')"
      >
        <template #icon><Icon icon="lucide:arrow-left" /></template>
        返回列表
      </NButton>
    </div>

    <NAlert
      v-if="error"
      type="error"
      title="小说详情加载失败"
    />

    <div
      v-else-if="pending"
      class="space-y-4"
    >
      <NSkeleton
        class="h-32 rounded-lg"
        text
      />
      <NSkeleton
        class="h-72 rounded-lg"
        text
      />
    </div>

    <template v-else-if="detail">
      <!-- Header -->
      <section class="card-glass p-5 shrink-0">
        <div
          class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-3">
              <h1 class="text-xl font-bold text-(--ui-text-highlighted)">
                {{ detail.novel.title }}
              </h1>
              <NTag
                :type="statusType(detail.novel.status)"
                size="small"
              >
                {{ statusLabel(detail.novel.status) }}
              </NTag>
            </div>
            <p class="mt-2 text-sm text-(--ui-text-muted)">
              {{ detail.novel.description || '暂无简介' }}
            </p>
            <div
              class="mt-3 flex flex-wrap items-center gap-4 text-xs text-(--ui-text-dimmed)"
            >
              <span class="flex items-center gap-1">
                <Icon
                  icon="lucide:user"
                  class="size-3"
                />
                {{ detail.novel.user?.username || '未知用户' }}
              </span>
              <span class="flex items-center gap-1">
                <Icon
                  icon="lucide:bookmark"
                  class="size-3"
                />
                {{ getGenreLabel(detail.novel.genre) }}
              </span>
              <span class="flex items-center gap-1">
                <Icon
                  icon="lucide:clock"
                  class="size-3"
                />
                {{ new Date(detail.novel.updatedAt).toLocaleString() }}
              </span>
            </div>
          </div>
          <div class="flex gap-4 lg:gap-6">
            <div class="text-center">
              <p
                class="text-2xl font-bold font-mono text-(--ui-text-highlighted)"
              >
                {{ detail.novel.chapterCount }}
              </p>
              <p class="text-[11px] text-(--ui-text-dimmed)">章节</p>
            </div>
            <div class="text-center">
              <p
                class="text-2xl font-bold font-mono text-(--ui-text-highlighted)"
              >
                {{ detail.novel.wordCount.toLocaleString() }}
              </p>
              <p class="text-[11px] text-(--ui-text-dimmed)">字数</p>
            </div>
            <div class="text-center">
              <p
                class="text-2xl font-bold font-mono text-(--ui-text-highlighted)"
              >
                {{ detail.characters.length }}
              </p>
              <p class="text-[11px] text-(--ui-text-dimmed)">角色</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Content -->
      <div
        class="flex-1 min-h-0 grid gap-4 lg:grid-cols-[1.5fr_1fr] overflow-hidden"
      >
        <!-- Chapters Table -->
        <div class="card-glass flex flex-col overflow-hidden">
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-(--ui-border)/40 shrink-0"
          >
            <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
              章节列表
            </h2>
            <span class="text-xs text-(--ui-text-dimmed)"
              >{{ detail.chapters.length }} 章</span
            >
          </div>
          <NDataTable
            :columns="chapterColumns"
            :data="detail.chapters"
            :bordered="false"
            :single-line="false"
            flex-height
            size="small"
            class="flex-1"
            style="height: 0"
          />
        </div>

        <!-- Right sidebar -->
        <div class="flex flex-col gap-4 overflow-y-auto">
          <!-- AI Settings -->
          <section class="card-glass p-4">
            <div class="flex items-center gap-2 mb-3">
              <Icon
                icon="lucide:sparkles"
                class="size-4 text-violet-500"
              />
              <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
                AI 设定
              </h2>
            </div>
            <div class="space-y-2.5 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-(--ui-text-muted)">温度</span>
                <span class="font-mono text-(--ui-text-highlighted)">{{
                  detail.novel.aiTemperature || '默认'
                }}</span>
              </div>
              <div v-if="detail.novel.aiExtraPrompt">
                <p class="text-(--ui-text-muted) mb-1">额外提示</p>
                <p
                  class="text-xs text-(--ui-text) bg-(--ui-bg-muted) rounded-lg p-2.5 whitespace-pre-wrap"
                >
                  {{ detail.novel.aiExtraPrompt }}
                </p>
              </div>
              <div v-if="detail.novel.styleGuide">
                <p class="text-(--ui-text-muted) mb-1">风格指南</p>
                <p
                  class="text-xs text-(--ui-text) bg-(--ui-bg-muted) rounded-lg p-2.5 whitespace-pre-wrap line-clamp-4"
                >
                  {{ detail.novel.styleGuide }}
                </p>
              </div>
              <div v-if="detail.novel.worldSetting">
                <p class="text-(--ui-text-muted) mb-1">世界观设定</p>
                <p
                  class="text-xs text-(--ui-text) bg-(--ui-bg-muted) rounded-lg p-2.5 whitespace-pre-wrap line-clamp-4"
                >
                  {{ detail.novel.worldSetting }}
                </p>
              </div>
              <p
                v-if="
                  !detail.novel.aiTemperature &&
                  !detail.novel.aiExtraPrompt &&
                  !detail.novel.styleGuide &&
                  !detail.novel.worldSetting
                "
                class="text-xs text-(--ui-text-dimmed)"
              >
                未配置 AI 设定
              </p>
            </div>
          </section>

          <!-- Characters -->
          <section class="card-glass p-4">
            <div class="flex items-center gap-2 mb-3">
              <Icon
                icon="lucide:users"
                class="size-4 text-blue-500"
              />
              <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
                角色 ({{ detail.characters.length }})
              </h2>
            </div>
            <div
              v-if="!detail.characters.length"
              class="text-xs text-(--ui-text-dimmed)"
            >
              暂无角色
            </div>
            <div
              v-else
              class="space-y-2"
            >
              <div
                v-for="character in detail.characters"
                :key="character.id"
                class="flex items-start gap-2.5 rounded-lg bg-(--ui-bg-muted) p-2.5"
              >
                <span
                  class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-xs font-bold text-primary-500"
                >
                  {{ character.name.charAt(0) }}
                </span>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-(--ui-text-highlighted)">
                    {{ character.name }}
                  </p>
                  <p class="text-xs text-(--ui-text-muted) line-clamp-2">
                    {{
                      character.description ||
                      character.currentState ||
                      '暂无描述'
                    }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Plot Points -->
          <section
            v-if="detail.plotPoints?.length"
            class="card-glass p-4"
          >
            <div class="flex items-center gap-2 mb-3">
              <Icon
                icon="lucide:milestone"
                class="size-4 text-amber-500"
              />
              <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
                情节点 ({{ detail.plotPoints.length }})
              </h2>
            </div>
            <div class="space-y-1.5">
              <div
                v-for="point in detail.plotPoints"
                :key="point.id"
                class="flex items-start gap-2 text-xs"
              >
                <NTag
                  size="tiny"
                  :type="point.status === 'resolved' ? 'success' : 'warning'"
                  >{{ point.type }}</NTag
                >
                <span class="text-(--ui-text-muted) line-clamp-2">{{
                  point.description
                }}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
