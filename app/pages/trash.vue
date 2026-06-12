<script setup lang="ts">
import { stripChapterNumberPrefix } from '../utils/chapter-title'

definePageMeta({ layout: 'default' })

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const { get: apiGet, post, del: apiDel, put } = useApi()
const { removeNovelHistory } = useReadingHistory()

interface TrashNovel {
  id: number
  title: string
  description: string | null
  genre: string | null
  status: string
  wordCount: number | null
  deletedAt: string
  createdAt: string
}

interface TrashChapter {
  id: number
  title: string
  chapterNumber: number
  wordCount: number | null
  deletedAt: string
  novel: { id: number; title: string }
}

interface TrashResponse {
  novels: { items: TrashNovel[]; total: number; totalPages: number }
  chapters: { items: TrashChapter[]; total: number; totalPages: number }
}

const activeTab = ref('novels')
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const novels = ref<TrashNovel[]>([])
const chapters = ref<TrashChapter[]>([])
const novelsTotal = ref(0)
const chaptersTotal = ref(0)
const novelsTotalPages = ref(0)
const chaptersTotalPages = ref(0)

const retentionDays = ref(30)
const savingRetention = ref(false)

const showPreview = ref(false)
const previewLoading = ref(false)
const previewData = ref<any>(null)
const previewType = ref<'novel' | 'chapter'>('chapter')

/* ─── 批量选择 ─── */
const selectedNovels = ref<number[]>([])
const selectedChapters = ref<number[]>([])

function toggleNovel(id: number, checked: boolean) {
  const i = selectedNovels.value.indexOf(id)
  if (checked && i < 0) selectedNovels.value.push(id)
  else if (!checked && i >= 0) selectedNovels.value.splice(i, 1)
}
function toggleChapter(id: number, checked: boolean) {
  const i = selectedChapters.value.indexOf(id)
  if (checked && i < 0) selectedChapters.value.push(id)
  else if (!checked && i >= 0) selectedChapters.value.splice(i, 1)
}

const allNovelsSelected = computed(
  () =>
    novels.value.length > 0 &&
    selectedNovels.value.length === novels.value.length
)
const allChaptersSelected = computed(
  () =>
    chapters.value.length > 0 &&
    selectedChapters.value.length === chapters.value.length
)
function toggleAllNovels(checked: boolean) {
  selectedNovels.value = checked ? novels.value.map((n) => n.id) : []
}
function toggleAllChapters(checked: boolean) {
  selectedChapters.value = checked ? chapters.value.map((c) => c.id) : []
}

/** 删除的章节按所属小说分组 */
const chaptersByNovel = computed(() => {
  const groups = new Map<
    number,
    { novelId: number; novelTitle: string; items: TrashChapter[] }
  >()
  for (const ch of chapters.value) {
    const nid = ch.novel?.id ?? 0
    const g = groups.get(nid) || {
      novelId: nid,
      novelTitle: ch.novel?.title || '未知小说',
      items: []
    }
    g.items.push(ch)
    groups.set(nid, g)
  }
  return Array.from(groups.values())
})

async function fetchTrash() {
  loading.value = true
  try {
    const data = await apiGet<TrashResponse>('/api/novels/trash', {
      query: { page: page.value, pageSize: pageSize.value }
    })
    novels.value = data.novels.items
    novelsTotal.value = data.novels.total
    novelsTotalPages.value = data.novels.totalPages
    chapters.value = data.chapters.items
    chaptersTotal.value = data.chapters.total
    chaptersTotalPages.value = data.chapters.totalPages
    selectedNovels.value = []
    selectedChapters.value = []
  } catch {
  } finally {
    loading.value = false
  }
}

async function fetchRetentionDays() {
  try {
    const site = await apiGet<Record<string, string>>('/api/settings/site', {
      silent: true
    })
    retentionDays.value = parseInt(site.trash_retention_days || '30') || 30
  } catch {}
}

async function saveRetentionDays() {
  savingRetention.value = true
  try {
    await put(
      '/api/settings/site',
      { key: 'trash_retention_days', value: String(retentionDays.value) },
      { successMessage: '保留天数已更新' }
    )
  } catch {
  } finally {
    savingRetention.value = false
  }
}

async function previewItem(type: 'novel' | 'chapter', id: number) {
  previewType.value = type
  previewLoading.value = true
  showPreview.value = true
  previewData.value = null
  try {
    previewData.value = await apiGet('/api/novels/trash-preview', {
      query: { type, id },
      silent: true
    })
  } catch {
    previewData.value = null
  } finally {
    previewLoading.value = false
  }
}

onMounted(() => {
  fetchTrash()
  fetchRetentionDays()
})

function goToPage(p: number) {
  page.value = p
  fetchTrash()
}

async function handleTabChange() {
  page.value = 1
  await fetchTrash()
}

function formatDeletedAt(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

async function restore(type: 'novel' | 'chapter', id: number) {
  try {
    await post(
      '/api/novels/trash',
      { type, id },
      {
        successMessage: type === 'novel' ? '小说已恢复' : '章节已恢复'
      }
    )
    await fetchTrash()
  } catch {}
}

function confirmDelete(
  type: 'novel' | 'chapter',
  item: TrashNovel | TrashChapter
) {
  dialog.warning({
    title: '永久删除',
    content: `确定要永久删除「${item.title || '未命名'}」吗？此操作不可撤销，关联数据也将被清除。`,
    positiveText: '永久删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      try {
        await apiDel('/api/novels/trash', {
          body: { type, id: item.id },
          successMessage: '已永久删除'
        })
        if (type === 'novel') {
          removeNovelHistory(item.id)
        }
        await fetchTrash()
      } catch {}
    }
  })
}

/* ─── 批量操作 ─── */
async function batchRestore(type: 'novel' | 'chapter') {
  const ids = type === 'novel' ? selectedNovels.value : selectedChapters.value
  if (!ids.length) return
  await Promise.all(
    ids.map((id) =>
      post('/api/novels/trash', { type, id }, { silent: true }).catch(() => {})
    )
  )
  message.success(`已恢复 ${ids.length} 项`)
  await fetchTrash()
}

function confirmBatchDelete(type: 'novel' | 'chapter') {
  const ids = type === 'novel' ? selectedNovels.value : selectedChapters.value
  if (!ids.length) return
  dialog.warning({
    title: '批量永久删除',
    content: `确定要永久删除选中的 ${ids.length} 项吗？此操作不可撤销，关联数据也将被清除。`,
    positiveText: '永久删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      await Promise.all(
        ids.map((id) =>
          apiDel('/api/novels/trash', {
            body: { type, id },
            silent: true
          }).catch(() => {})
        )
      )
      if (type === 'novel') {
        ids.forEach((id) => removeNovelHistory(id))
      }
      message.success(`已永久删除 ${ids.length} 项`)
      await fetchTrash()
    }
  })
}

const currentTotalPages = computed(() =>
  activeTab.value === 'novels' ?
    novelsTotalPages.value
  : chaptersTotalPages.value
)
const currentTotal = computed(() =>
  activeTab.value === 'novels' ? novelsTotal.value : chaptersTotal.value
)

function getStatusLabel(status: string) {
  if (status === 'completed') return '已完结'
  if (status === 'in_progress') return '连载中'
  return '草稿'
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <div class="relative z-10 flex items-center gap-4">
        <div
          class="liquid-panel flex size-12 items-center justify-center rounded-[1.35rem]"
        >
          <Icon
            icon="lucide:trash-2"
            class="size-5 text-red-500"
          />
        </div>
        <div>
          <p class="mb-1 text-xs uppercase tracking-[0.22em] text-red-500/75">
            Recovery vault
          </p>
          <h1
            class="text-2xl font-semibold tracking-[-0.04em] text-(--ui-text-highlighted)"
          >
            {{ t('trash.title') }}
          </h1>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
            已删除的小说和章节，{{ retentionDays }} 天后将自动清理
          </p>
        </div>
      </div>
      <div class="relative z-10 mt-4 flex items-center gap-2">
        <span class="text-xs text-(--ui-text-muted)">自动清理天数：</span>
        <NInputNumber
          v-model:value="retentionDays"
          size="tiny"
          :min="1"
          :max="365"
          :step="1"
          style="width: 80px"
        />
        <NButton
          size="tiny"
          secondary
          :loading="savingRetention"
          @click="saveRetentionDays"
          >保存</NButton
        >
      </div>
    </section>

    <section class="card-glass p-3 sm:p-4">
      <NTabs
        v-model:value="activeTab"
        type="segment"
        animated
        @update:value="handleTabChange"
      >
        <!-- 小说 -->
        <NTabPane
          name="novels"
          tab="小说"
        >
          <div
            v-if="loading && !novels.length"
            class="py-12 flex justify-center"
          >
            <NSpin size="medium" />
          </div>
          <NEmpty
            v-else-if="!novels.length"
            description="没有已删除的小说"
            class="py-12"
          />
          <div
            v-else
            class="mt-3 space-y-3"
          >
            <!-- 批量工具条 -->
            <div class="flex items-center gap-3 px-1">
              <NCheckbox
                :checked="allNovelsSelected"
                :indeterminate="selectedNovels.length > 0 && !allNovelsSelected"
                @update:checked="toggleAllNovels"
                >全选</NCheckbox
              >
              <span class="text-xs text-(--ui-text-dimmed)"
                >已选 {{ selectedNovels.length }} / {{ novels.length }}</span
              >
              <div class="ml-auto flex gap-2">
                <NButton
                  size="tiny"
                  :disabled="!selectedNovels.length"
                  @click="batchRestore('novel')"
                >
                  <template #icon><Icon icon="lucide:rotate-ccw" /></template>
                  批量恢复
                </NButton>
                <NButton
                  size="tiny"
                  type="error"
                  :disabled="!selectedNovels.length"
                  @click="confirmBatchDelete('novel')"
                >
                  <template #icon><Icon icon="lucide:trash-2" /></template>
                  批量永久删除
                </NButton>
              </div>
            </div>
            <!-- 表格 -->
            <div class="card-glass overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-(--ui-bg-muted)">
                  <tr>
                    <th class="w-10 px-3 py-2"></th>
                    <th
                      class="px-3 py-2 text-left text-[11px] font-semibold text-(--ui-text-dimmed)"
                    >
                      标题
                    </th>
                    <th
                      class="px-3 py-2 text-left text-[11px] font-semibold text-(--ui-text-dimmed)"
                    >
                      状态
                    </th>
                    <th
                      class="px-3 py-2 text-right text-[11px] font-semibold text-(--ui-text-dimmed)"
                    >
                      字数
                    </th>
                    <th
                      class="px-3 py-2 text-left text-[11px] font-semibold text-(--ui-text-dimmed)"
                    >
                      删除时间
                    </th>
                    <th
                      class="px-3 py-2 text-right text-[11px] font-semibold text-(--ui-text-dimmed)"
                    >
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-(--ui-border)">
                  <tr
                    v-for="novel in novels"
                    :key="novel.id"
                    class="hover:bg-(--ui-bg-muted) transition-colors"
                  >
                    <td class="px-3 py-2">
                      <NCheckbox
                        :checked="selectedNovels.includes(novel.id)"
                        @update:checked="(c) => toggleNovel(novel.id, c)"
                      />
                    </td>
                    <td class="px-3 py-2">
                      <span class="font-medium text-(--ui-text-highlighted)">{{
                        novel.title || '未命名'
                      }}</span>
                    </td>
                    <td class="px-3 py-2 text-(--ui-text-muted) text-xs">
                      {{ getStatusLabel(novel.status) }}
                    </td>
                    <td
                      class="px-3 py-2 text-right font-mono text-xs text-(--ui-text-muted)"
                    >
                      {{ (novel.wordCount || 0).toLocaleString() }}
                    </td>
                    <td class="px-3 py-2 text-xs text-(--ui-text-dimmed)">
                      {{ formatDeletedAt(novel.deletedAt) }}
                    </td>
                    <td class="px-3 py-2">
                      <div class="flex justify-end gap-1">
                        <NButton
                          size="tiny"
                          quaternary
                          @click="previewItem('novel', novel.id)"
                        >
                          <template #icon><Icon icon="lucide:eye" /></template>
                        </NButton>
                        <NButton
                          size="tiny"
                          quaternary
                          @click="restore('novel', novel.id)"
                        >
                          <template #icon
                            ><Icon icon="lucide:rotate-ccw"
                          /></template>
                        </NButton>
                        <NButton
                          size="tiny"
                          quaternary
                          type="error"
                          @click="confirmDelete('novel', novel)"
                        >
                          <template #icon
                            ><Icon icon="lucide:trash-2"
                          /></template>
                        </NButton>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </NTabPane>

        <!-- 章节（按小说分组） -->
        <NTabPane
          name="chapters"
          tab="章节"
        >
          <div
            v-if="loading && !chapters.length"
            class="py-12 flex justify-center"
          >
            <NSpin size="medium" />
          </div>
          <NEmpty
            v-else-if="!chapters.length"
            description="没有已删除的章节"
            class="py-12"
          />
          <div
            v-else
            class="mt-3 space-y-4"
          >
            <!-- 批量工具条 -->
            <div class="flex items-center gap-3 px-1">
              <NCheckbox
                :checked="allChaptersSelected"
                :indeterminate="
                  selectedChapters.length > 0 && !allChaptersSelected
                "
                @update:checked="toggleAllChapters"
                >全选</NCheckbox
              >
              <span class="text-xs text-(--ui-text-dimmed)"
                >已选 {{ selectedChapters.length }} /
                {{ chapters.length }}</span
              >
              <div class="ml-auto flex gap-2">
                <NButton
                  size="tiny"
                  :disabled="!selectedChapters.length"
                  @click="batchRestore('chapter')"
                >
                  <template #icon><Icon icon="lucide:rotate-ccw" /></template>
                  批量恢复
                </NButton>
                <NButton
                  size="tiny"
                  type="error"
                  :disabled="!selectedChapters.length"
                  @click="confirmBatchDelete('chapter')"
                >
                  <template #icon><Icon icon="lucide:trash-2" /></template>
                  批量永久删除
                </NButton>
              </div>
            </div>
            <!-- 每个小说一组 -->
            <div
              v-for="group in chaptersByNovel"
              :key="group.novelId"
              class="card-glass overflow-hidden"
            >
              <div class="flex items-center gap-2 bg-(--ui-bg-muted) px-3 py-2">
                <Icon
                  icon="lucide:book-open"
                  class="size-3.5 text-(--ui-text-dimmed)"
                />
                <span
                  class="text-xs font-semibold text-(--ui-text-highlighted)"
                  >{{ group.novelTitle }}</span
                >
                <span class="text-[11px] text-(--ui-text-dimmed)"
                  >（{{ group.items.length }} 章）</span
                >
              </div>
              <table class="w-full text-sm">
                <tbody class="divide-y divide-(--ui-border)">
                  <tr
                    v-for="ch in group.items"
                    :key="ch.id"
                    class="hover:bg-(--ui-bg-muted) transition-colors"
                  >
                    <td class="w-10 px-3 py-2">
                      <NCheckbox
                        :checked="selectedChapters.includes(ch.id)"
                        @update:checked="(c) => toggleChapter(ch.id, c)"
                      />
                    </td>
                    <td
                      class="w-16 px-3 py-2 text-xs text-(--ui-text-dimmed) font-mono"
                    >
                      第{{ ch.chapterNumber }}章
                    </td>
                    <td class="px-3 py-2">
                      <span class="font-medium text-(--ui-text-highlighted)">{{
                        stripChapterNumberPrefix(ch.title) || '未命名'
                      }}</span>
                    </td>
                    <td
                      class="px-3 py-2 text-right font-mono text-xs text-(--ui-text-muted)"
                    >
                      {{ (ch.wordCount || 0).toLocaleString() }} 字
                    </td>
                    <td class="px-3 py-2 text-xs text-(--ui-text-dimmed)">
                      {{ formatDeletedAt(ch.deletedAt) }}
                    </td>
                    <td class="px-3 py-2">
                      <div class="flex justify-end gap-1">
                        <NButton
                          size="tiny"
                          quaternary
                          @click="previewItem('chapter', ch.id)"
                        >
                          <template #icon><Icon icon="lucide:eye" /></template>
                        </NButton>
                        <NButton
                          size="tiny"
                          quaternary
                          @click="restore('chapter', ch.id)"
                        >
                          <template #icon
                            ><Icon icon="lucide:rotate-ccw"
                          /></template>
                        </NButton>
                        <NButton
                          size="tiny"
                          quaternary
                          type="error"
                          @click="confirmDelete('chapter', ch)"
                        >
                          <template #icon
                            ><Icon icon="lucide:trash-2"
                          /></template>
                        </NButton>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </NTabPane>
      </NTabs>
    </section>

    <div
      v-if="currentTotalPages > 1"
      class="flex justify-center mt-6"
    >
      <NPagination
        v-model:page="page"
        :page-count="currentTotalPages"
        :page-size="pageSize"
        :item-count="currentTotal"
        show-size-picker
        :page-sizes="[20, 50, 100]"
        @update:page="goToPage"
        @update:page-size="
          (s) => {
            pageSize = s
            page = 1
            fetchTrash()
          }
        "
      />
    </div>

    <!-- Preview Modal -->
    <NModal
      v-model:show="showPreview"
      preset="card"
      :title="previewData?.title || '预览'"
      style="max-width: 700px; max-height: 80vh"
    >
      <div
        v-if="previewLoading"
        class="py-12 flex justify-center"
      >
        <NSpin size="medium" />
      </div>
      <div
        v-else-if="previewData"
        class="space-y-3"
      >
        <div
          v-if="previewType === 'novel'"
          class="space-y-2"
        >
          <p
            v-if="previewData.description"
            class="text-sm text-(--ui-text-muted)"
          >
            {{ previewData.description }}
          </p>
          <div class="flex gap-2 text-xs text-(--ui-text-dimmed)">
            <span v-if="previewData.genre">类型：{{ previewData.genre }}</span>
            <span>状态：{{ getStatusLabel(previewData.status) }}</span>
          </div>
          <div
            v-if="previewData.chapters?.length"
            class="mt-3"
          >
            <p class="text-xs font-medium text-(--ui-text-muted) mb-2">
              包含章节（{{ previewData.chapters.length }}）：
            </p>
            <div class="space-y-1 max-h-60 overflow-y-auto">
              <div
                v-for="ch in previewData.chapters"
                :key="ch.id"
                class="text-xs text-(--ui-text-dimmed) px-2 py-1 rounded bg-(--ui-bg-muted)"
              >
                第{{ ch.chapterNumber }}章
                {{ stripChapterNumberPrefix(ch.title) }}
                <span
                  v-if="ch.wordCount"
                  class="ml-2 opacity-60"
                  >{{ ch.wordCount }}字</span
                >
              </div>
            </div>
          </div>
        </div>
        <div
          v-else
          class="space-y-2"
        >
          <div class="flex gap-3 text-xs text-(--ui-text-dimmed)">
            <span>来自：{{ previewData.novelTitle }}</span>
            <span>第{{ previewData.chapterNumber }}章</span>
            <span v-if="previewData.wordCount"
              >{{ previewData.wordCount }}字</span
            >
          </div>
          <div
            class="max-h-[50vh] overflow-y-auto rounded-lg bg-(--ui-bg-muted) p-4 text-sm leading-relaxed whitespace-pre-wrap text-(--ui-text)"
          >
            {{ previewData.content || '（无内容）' }}
          </div>
        </div>
      </div>
      <div
        v-else
        class="py-8 text-center text-sm text-(--ui-text-dimmed)"
      >
        加载失败
      </div>
    </NModal>
  </div>
</template>
