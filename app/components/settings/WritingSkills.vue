<script setup lang="ts">
import { NOVEL_GENRES } from '~~/shared/novel-catalog'

interface FewShot {
  scene: string
  content: string
}
interface WritingSkill {
  id: number
  name: string
  description: string | null
  genre: string | null
  systemAddon: string | null
  fewShots: FewShot[]
  checklist: string[]
  appliesTo: string[]
  isSystem: boolean
  enabled: boolean
}

const message = useMessage()
const { t } = useI18n()
const { post, put, del } = useApi()

const {
  data: skills,
  refresh,
  pending
} = await useFetch<WritingSkill[]>('/api/ai/skills', { default: () => [] })

const systemSkills = computed(() =>
  (skills.value || []).filter((s) => s.isSystem)
)
const customSkills = computed(() =>
  (skills.value || []).filter((s) => !s.isSystem)
)

const genreOptions = computed(() => [
  { label: '通用（所有题材）', value: '' },
  ...NOVEL_GENRES.map((g) => ({ label: t(g.labelKey), value: g.value }))
])

function genreLabel(genre: string | null) {
  if (!genre) return '通用'
  const meta = NOVEL_GENRES.find((g) => g.value === genre)
  return meta ? t(meta.labelKey) : genre
}

/* ── 创建 / 编辑 ── */
const showModal = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const form = ref({
  name: '',
  description: '',
  genre: '',
  systemAddon: '',
  checklistText: '',
  fewShots: [] as FewShot[]
})

function openCreate() {
  editingId.value = null
  form.value = {
    name: '',
    description: '',
    genre: '',
    systemAddon: '',
    checklistText: '',
    fewShots: []
  }
  showModal.value = true
}

function openEdit(s: WritingSkill) {
  editingId.value = s.id
  form.value = {
    name: s.name,
    description: s.description || '',
    genre: s.genre || '',
    systemAddon: s.systemAddon || '',
    checklistText: (s.checklist || []).join('\n'),
    fewShots: (s.fewShots || []).map((f) => ({ ...f }))
  }
  showModal.value = true
}

function addFewShot() {
  form.value.fewShots.push({ scene: '', content: '' })
}
function removeFewShot(i: number) {
  form.value.fewShots.splice(i, 1)
}

async function save() {
  if (!form.value.name.trim()) {
    message.warning('请填写技能包名称')
    return
  }
  saving.value = true
  const payload = {
    name: form.value.name.trim(),
    description: form.value.description.trim() || null,
    genre: form.value.genre || null,
    systemAddon: form.value.systemAddon.trim() || null,
    checklist: form.value.checklistText
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean),
    fewShots: form.value.fewShots
      .map((f) => ({ scene: f.scene.trim(), content: f.content.trim() }))
      .filter((f) => f.content),
    appliesTo: ['generation']
  }
  try {
    if (editingId.value) {
      await put(`/api/ai/skills/${editingId.value}`, payload)
    } else {
      await post('/api/ai/skills', payload)
    }
    message.success('已保存')
    showModal.value = false
    await refresh()
  } catch {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(s: WritingSkill) {
  try {
    await del(`/api/ai/skills/${s.id}`)
    message.success('已删除')
    await refresh()
  } catch {
    message.error('删除失败')
  }
}

/* ── 查看系统预置详情 ── */
const viewing = ref<WritingSkill | null>(null)
</script>

<template>
  <div class="card-glass space-y-5 p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">
          写作技能包
        </h3>
        <p class="mt-1 text-xs text-(--ui-text-dimmed)">
          技能包把「写作手法 + 范文」注入生成提示词，帮助写出更受欢迎的小说。在章节生成对话框中按需勾选，或设为某本小说的默认。
        </p>
      </div>
      <NButton
        size="small"
        type="primary"
        @click="openCreate"
      >
        <template #icon><Icon icon="lucide:plus" /></template>
        新建技能包
      </NButton>
    </div>

    <!-- 我的技能包 -->
    <div class="space-y-2">
      <p class="text-xs font-medium text-(--ui-text-muted)">我的技能包</p>
      <NEmpty
        v-if="!customSkills.length"
        size="small"
        description="还没有自建技能包，可点右上角新建，或直接使用下方系统预置。"
      />
      <div
        v-for="s in customSkills"
        :key="s.id"
        class="liquid-panel flex items-center justify-between gap-3 rounded-xl p-3"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-medium">{{ s.name }}</span>
            <NTag
              size="tiny"
              :bordered="false"
              >{{ genreLabel(s.genre) }}</NTag
            >
          </div>
          <p class="mt-0.5 truncate text-xs text-(--ui-text-dimmed)">
            {{ s.description || '—' }}
          </p>
        </div>
        <div class="flex shrink-0 gap-1">
          <NButton
            size="tiny"
            quaternary
            @click="openEdit(s)"
          >
            <template #icon><Icon icon="lucide:pencil" /></template>
          </NButton>
          <NPopconfirm @positive-click="remove(s)">
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                type="error"
              >
                <template #icon><Icon icon="lucide:trash-2" /></template>
              </NButton>
            </template>
            确认删除「{{ s.name }}」？
          </NPopconfirm>
        </div>
      </div>
    </div>

    <!-- 系统预置 -->
    <div class="space-y-2">
      <p class="text-xs font-medium text-(--ui-text-muted)">
        系统预置（基于受欢迎小说写作要素，含范文，可直接使用）
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <button
          v-for="s in systemSkills"
          :key="s.id"
          type="button"
          class="liquid-panel rounded-xl p-3 text-left transition hover:opacity-80"
          @click="viewing = s"
        >
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-medium">{{ s.name }}</span>
            <NTag
              size="tiny"
              :bordered="false"
              >{{ genreLabel(s.genre) }}</NTag
            >
          </div>
          <p class="mt-0.5 line-clamp-2 text-xs text-(--ui-text-dimmed)">
            {{ s.description || '—' }}
          </p>
        </button>
      </div>
    </div>

    <!-- 创建 / 编辑弹窗 -->
    <NModal
      v-model:show="showModal"
      preset="card"
      :title="editingId ? '编辑技能包' : '新建技能包'"
      style="max-width: 640px"
    >
      <div class="space-y-3">
        <NFormItem label="名称">
          <NInput
            v-model:value="form.name"
            placeholder="如：悬疑布线、冷硬派叙事"
            maxlength="100"
          />
        </NFormItem>
        <NFormItem label="说明">
          <NInput
            v-model:value="form.description"
            placeholder="一句话说明这个技能包做什么"
            maxlength="500"
          />
        </NFormItem>
        <NFormItem label="适用题材">
          <NSelect
            v-model:value="form.genre"
            :options="genreOptions"
          />
        </NFormItem>
        <NFormItem label="写作指令（注入 system，核心）">
          <NInput
            v-model:value="form.systemAddon"
            type="textarea"
            :rows="6"
            placeholder="描述这个技能包要求 AI 怎么写，如：开篇要有钩子、对话推动情节、避免大段说明……"
          />
        </NFormItem>
        <NFormItem label="自检清单（每行一条，可选）">
          <NInput
            v-model:value="form.checklistText"
            type="textarea"
            :rows="3"
            placeholder="每行一条，生成后供 AI 自查"
          />
        </NFormItem>
        <div class="space-y-2">
          <div>
            <span class="text-sm">范文 few-shot（可选，建议粘贴真人写的片段）</span>
            <p class="mt-0.5 text-xs text-(--ui-text-dimmed)">
              范文用来让 AI 学习「真实优秀写作」的手法与质感。请粘贴你欣赏的、同题材的真人作品片段；不要用 AI 生成的文本（那会强化 AI 腔）。
            </p>
          </div>
          <div class="flex justify-end">
            <NButton
              size="tiny"
              quaternary
              @click="addFewShot"
            >
              <template #icon><Icon icon="lucide:plus" /></template>
              添加范文
            </NButton>
          </div>
          <div
            v-for="(fs, i) in form.fewShots"
            :key="i"
            class="liquid-panel space-y-2 rounded-xl p-2"
          >
            <div class="flex gap-2">
              <NInput
                v-model:value="fs.scene"
                placeholder="场景标签，如「开篇钩子」"
                maxlength="100"
                class="flex-1"
              />
              <NButton
                size="tiny"
                quaternary
                type="error"
                @click="removeFewShot(i)"
              >
                <template #icon><Icon icon="lucide:x" /></template>
              </NButton>
            </div>
            <NInput
              v-model:value="fs.content"
              type="textarea"
              :rows="4"
              placeholder="范文正文（示范手法、节奏与质感）"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showModal = false">取消</NButton>
          <NButton
            type="primary"
            :loading="saving"
            @click="save"
            >保存</NButton
          >
        </div>
      </template>
    </NModal>

    <!-- 系统预置详情 -->
    <NModal
      :show="!!viewing"
      preset="card"
      :title="viewing?.name"
      style="max-width: 640px"
      @update:show="(v: boolean) => { if (!v) viewing = null }"
    >
      <div
        v-if="viewing"
        class="space-y-4"
      >
        <p class="text-xs text-(--ui-text-dimmed)">
          {{ viewing.description }} · {{ genreLabel(viewing.genre) }}
        </p>
        <div v-if="viewing.systemAddon">
          <p class="mb-1 text-xs font-medium text-(--ui-text-muted)">写作指令</p>
          <pre
            class="whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-xs leading-relaxed"
            >{{ viewing.systemAddon }}</pre
          >
        </div>
        <div v-if="viewing.fewShots?.length">
          <p class="mb-1 text-xs font-medium text-(--ui-text-muted)">范文</p>
          <div
            v-for="(fs, i) in viewing.fewShots"
            :key="i"
            class="mb-2"
          >
            <p class="text-xs text-primary-500/80">【{{ fs.scene }}】</p>
            <pre
              class="whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-xs leading-relaxed"
              >{{ fs.content }}</pre
            >
          </div>
        </div>
        <div v-if="viewing.checklist?.length">
          <p class="mb-1 text-xs font-medium text-(--ui-text-muted)">自检清单</p>
          <ul class="list-inside list-disc text-xs text-(--ui-text-dimmed)">
            <li
              v-for="(c, i) in viewing.checklist"
              :key="i"
            >
              {{ c }}
            </li>
          </ul>
        </div>
      </div>
    </NModal>

    <div
      v-if="pending"
      class="text-center text-xs text-(--ui-text-dimmed)"
    >
      加载中…
    </div>
  </div>
</template>
