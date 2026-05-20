<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface PromptTemplate {
  id: number
  name: string
  content: string
  category: 'generation' | 'rewrite' | 'expand' | 'custom'
  createdAt: string
}

const categoryFilter = ref('all')
const categoryOptions = [
  { label: '全部分类', value: 'all' },
  { label: '生成', value: 'generation' },
  { label: '改写', value: 'rewrite' },
  { label: '扩写', value: 'expand' },
  { label: '自定义', value: 'custom' }
]

const queryParams = computed(() => {
  const p: Record<string, any> = {}
  if (categoryFilter.value !== 'all') p.category = categoryFilter.value
  return p
})

const {
  items: prompts,
  loading,
  page,
  total,
  totalPages,
  pageSize,
  goToPage,
  refresh
} = usePagination<PromptTemplate>({
  url: '/api/admin/prompts',
  params: queryParams
})

const showModal = ref(false)
const editing = ref<PromptTemplate | null>(null)
const form = ref({ name: '', content: '', category: 'generation' as string })
const saving = ref(false)

function openCreate() {
  editing.value = null
  form.value = { name: '', content: '', category: 'generation' }
  showModal.value = true
}

function openEdit(p: PromptTemplate) {
  editing.value = p
  form.value = { name: p.name, content: p.content, category: p.category }
  showModal.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/admin/prompts/${editing.value.id}`, {
        method: 'PUT',
        body: form.value
      })
    } else {
      await $fetch('/api/admin/prompts', { method: 'POST', body: form.value })
    }
    showModal.value = false
    refresh()
  } finally {
    saving.value = false
  }
}

const deleting = ref<number | null>(null)
async function deletePrompt(id: number) {
  deleting.value = id
  try {
    await $fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' })
    refresh()
  } finally {
    deleting.value = null
  }
}

function categoryLabel(cat: string) {
  return categoryOptions.find((o) => o.value === cat)?.label || cat
}

const aiProcessing = ref(false)
const aiResult = ref('')

async function aiAction(type: 'expand' | 'rewrite') {
  if (!form.value.content.trim()) return
  aiProcessing.value = true
  aiResult.value = ''
  try {
    const response = await fetch(
      `/api/ai/text-${type === 'expand' ? 'expand' : 'rewrite'}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: form.value.content })
      }
    )
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.content) aiResult.value += data.content
          if (data.done) break
        } catch {}
      }
    }
    if (aiResult.value) {
      form.value.content = aiResult.value
    }
  } finally {
    aiProcessing.value = false
    aiResult.value = ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="text-sm text-(--ui-text-muted)">Admin / Prompts</p>
        <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
          提示词模板
        </h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">
          管理系统级提示词模板，所有用户可见。
        </p>
      </div>
      <div class="flex gap-2">
        <NSelect
          v-model:value="categoryFilter"
          :options="categoryOptions"
          class="w-36"
        />
        <NButton
          type="primary"
          @click="openCreate"
        >
          <template #icon><Icon icon="lucide:plus" /></template>
          新建
        </NButton>
      </div>
    </div>

    <div
      v-if="loading"
      class="space-y-3"
    >
      <NSkeleton
        v-for="i in 4"
        :key="i"
        class="h-20 rounded-lg"
        text
      />
    </div>
    <div
      v-else-if="!prompts.length"
      class="card-surface p-10 text-center text-sm text-(--ui-text-muted)"
    >
      暂无提示词模板
    </div>
    <template v-else>
      <div class="space-y-3">
        <div
          v-for="p in prompts"
          :key="p.id"
          class="card-surface group p-4"
        >
          <div class="flex items-start justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-(--ui-text-highlighted)">
                  {{ p.name }}
                </h3>
                <NTag size="small">{{ categoryLabel(p.category) }}</NTag>
              </div>
              <p
                class="mt-2 text-sm text-(--ui-text-muted) line-clamp-2 whitespace-pre-wrap"
              >
                {{ p.content }}
              </p>
            </div>
            <div class="ml-4 flex gap-1">
              <NButton
                size="small"
                quaternary
                @click="openEdit(p)"
              >
                <template #icon><Icon icon="lucide:pencil" /></template>
              </NButton>
              <NButton
                size="small"
                quaternary
                type="error"
                :loading="deleting === p.id"
                @click="deletePrompt(p.id)"
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

    <!-- Create/Edit Modal -->
    <NModal
      v-model:show="showModal"
      preset="card"
      :title="editing ? '编辑提示词' : '新建提示词'"
      style="max-width: 600px"
    >
      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">名称</label>
          <NInput
            v-model:value="form.name"
            placeholder="如：章节生成 - 武侠风格"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">分类</label>
          <NSelect
            v-model:value="form.category"
            :options="categoryOptions.slice(1)"
          />
        </div>
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-(--ui-text)">内容</label>
            <div class="flex gap-1">
              <NButton
                size="tiny"
                quaternary
                :loading="aiProcessing"
                :disabled="!form.content.trim()"
                @click="aiAction('expand')"
              >
                <template #icon><Icon icon="lucide:expand" /></template>
                AI 扩写
              </NButton>
              <NButton
                size="tiny"
                quaternary
                :loading="aiProcessing"
                :disabled="!form.content.trim()"
                @click="aiAction('rewrite')"
              >
                <template #icon><Icon icon="lucide:refresh-cw" /></template>
                AI 改写
              </NButton>
            </div>
          </div>
          <NInput
            v-model:value="form.content"
            type="textarea"
            :rows="8"
            placeholder="提示词内容..."
          />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showModal = false">取消</NButton>
          <NButton
            type="primary"
            :loading="saving"
            :disabled="!form.name || !form.content"
            @click="save"
          >
            {{ editing ? '保存' : '创建' }}
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
