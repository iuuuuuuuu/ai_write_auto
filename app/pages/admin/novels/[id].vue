<script setup lang="ts">
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

const {
  data: detail,
  pending,
  error
} = await useFetch<AdminNovelDetail>(() => `/api/admin/novels/${novelId.value}`)
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <NButton quaternary @click="navigateTo('/admin/novels')">
      <template #icon>
        <Icon icon="lucide:arrow-left" />
      </template>
      返回小说列表
    </NButton>

    <NAlert
      v-if="error"
      type="error"
      title="小说详情加载失败"
    />

    <div
      v-else-if="pending"
      class="space-y-4"
    >
      <NSkeleton class="h-32 rounded-lg" text />
      <NSkeleton class="h-72 rounded-lg" text />
    </div>

    <template v-else-if="detail">
      <section
        class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-5"
      >
        <div
          class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
        >
          <div class="min-w-0">
            <p class="text-sm text-(--ui-text-muted)">
              作者 {{ detail.novel.user?.username || '未知用户' }} ·
              {{ detail.novel.genre || '未分类' }}
            </p>
            <h1
              class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)"
            >
              {{ detail.novel.title }}
            </h1>
            <p class="mt-3 max-w-3xl text-sm leading-6 text-(--ui-text-muted)">
              {{ detail.novel.description || '暂无简介' }}
            </p>
          </div>
          <div class="grid grid-cols-3 gap-3 lg:w-80">
            <div class="rounded-lg bg-(--ui-bg-elevated) p-3 text-center">
              <p class="text-xs text-(--ui-text-dimmed)">章节</p>
              <p class="mt-1 font-semibold">{{ detail.novel.chapterCount }}</p>
            </div>
            <div class="rounded-lg bg-(--ui-bg-elevated) p-3 text-center">
              <p class="text-xs text-(--ui-text-dimmed)">字数</p>
              <p class="mt-1 font-semibold">{{ detail.novel.wordCount }}</p>
            </div>
            <div class="rounded-lg bg-(--ui-bg-elevated) p-3 text-center">
              <p class="text-xs text-(--ui-text-dimmed)">状态</p>
              <p class="mt-1 font-semibold">{{ detail.novel.status }}</p>
            </div>
          </div>
        </div>
      </section>

      <div class="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section
          class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-5"
        >
          <h2 class="font-semibold text-(--ui-text-highlighted)">章节</h2>
          <div
            v-if="!detail.chapters.length"
            class="py-8 text-sm text-(--ui-text-muted)"
          >
            暂无章节
          </div>
          <div
            v-else
            class="mt-4 divide-y divide-(--ui-border)"
          >
            <article
              v-for="chapter in detail.chapters"
              :key="chapter.id"
              class="py-4"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-xs text-(--ui-text-dimmed)">
                    第 {{ chapter.chapterNumber }} 章
                  </p>
                  <h3 class="mt-1 font-medium text-(--ui-text-highlighted)">
                    {{ chapter.title }}
                  </h3>
                  <p class="mt-2 line-clamp-2 text-sm text-(--ui-text-muted)">
                    {{ chapter.summary || '暂无摘要' }}
                  </p>
                </div>
                <div class="shrink-0 text-right text-sm text-(--ui-text-muted)">
                  <p>{{ chapter.wordCount || 0 }} 字</p>
                  <p class="mt-1 text-xs text-(--ui-text-dimmed)">
                    {{ chapter.status }}
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <div class="space-y-4">
          <section
            class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-5"
          >
            <h2 class="font-semibold text-(--ui-text-highlighted)">AI 设定</h2>
            <dl class="mt-4 space-y-3 text-sm">
              <div class="flex justify-between gap-4">
                <dt class="text-(--ui-text-muted)">Temperature</dt>
                <dd>{{ detail.novel.aiTemperature || '未设置' }}</dd>
              </div>
              <div>
                <dt class="text-(--ui-text-muted)">额外提示</dt>
                <dd class="mt-1 whitespace-pre-wrap text-(--ui-text)">
                  {{ detail.novel.aiExtraPrompt || '未设置' }}
                </dd>
              </div>
            </dl>
          </section>

          <section
            class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-5"
          >
            <h2 class="font-semibold text-(--ui-text-highlighted)">角色</h2>
            <div
              v-if="!detail.characters.length"
              class="mt-4 text-sm text-(--ui-text-muted)"
            >
              暂无角色
            </div>
            <div
              v-else
              class="mt-4 space-y-3"
            >
              <div
                v-for="character in detail.characters"
                :key="character.id"
                class="rounded-lg bg-(--ui-bg-elevated) p-3"
              >
                <p class="font-medium">{{ character.name }}</p>
                <p class="mt-1 line-clamp-2 text-sm text-(--ui-text-muted)">
                  {{
                    character.description ||
                    character.currentState ||
                    '暂无描述'
                  }}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
