<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface NovelTemplate {
  id: number
  name: string
  genre: string
  defaultStyleGuide: string | null
  defaultAiPrompt: string | null
  defaultTemperature: string | null
}

const {
  items: templates,
  loading,
  page,
  total,
  totalPages,
  pageSize,
  goToPage,
  refresh,
} = usePagination<NovelTemplate>({ url: '/api/admin/templates' })

const showModal = ref(false)
const editing = ref<NovelTemplate | null>(null)
const form = ref({ name: '', genre: '', defaultStyleGuide: '', defaultAiPrompt: '', defaultTemperature: '0.7' })
const saving = ref(false)

function openCreate() {
  editing.value = null
  form.value = { name: '', genre: '', defaultStyleGuide: '', defaultAiPrompt: '', defaultTemperature: '0.7' }
  showModal.value = true
}

function openEdit(t: NovelTemplate) {
  editing.value = t
  form.value = {
    name: t.name,
    genre: t.genre,
    defaultStyleGuide: t.defaultStyleGuide || '',
    defaultAiPrompt: t.defaultAiPrompt || '',
    defaultTemperature: t.defaultTemperature || '0.7',
  }
  showModal.value = true
}

async function save() {
  saving.value = true
  try {
    const body = {
      ...form.value,
      defaultStyleGuide: form.value.defaultStyleGuide || null,
      defaultAiPrompt: form.value.defaultAiPrompt || null,
      defaultTemperature: form.value.defaultTemperature || null,
    }
    if (editing.value) {
      await $fetch(`/api/admin/templates/${editing.value.id}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/admin/templates', { method: 'POST', body })
    }
    showModal.value = false
    refresh()
  } finally {
    saving.value = false
  }
}

const deleting = ref<number | null>(null)
async function deleteTemplate(id: number) {
  deleting.value = id
  try {
    await $fetch(`/api/admin/templates/${id}`, { method: 'DELETE' })
    refresh()
  } finally {
    deleting.value = null
  }
}

const aiProcessing = ref(false)

async function aiExpandField(field: 'defaultStyleGuide' | 'defaultAiPrompt') {
  const text = form.value[field]
  if (!text?.trim()) return
  aiProcessing.value = true
  let result = ''
  try {
    const response = await fetch('/api/ai/text-expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.content) result += data.content
          if (data.done) break
        } catch {}
      }
    }
    if (result) form.value[field] = result
  } finally {
    aiProcessing.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm text-(--ui-text-muted)">Admin / Templates</p>
        <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">小说模板</h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">管理创建小说时可选的模板。</p>
      </div>
      <NButton type="primary" @click="openCreate">
        <template #icon><Icon icon="lucide:plus" /></template>
        新建模板
      </NButton>
    </div>

    <div v-if="loading" class="space-y-3">
      <NSkeleton v-for="i in 4" :key="i" class="h-20 rounded-lg" text />
    </div>
    <div v-else-if="!templates.length" class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-10 text-center text-sm text-(--ui-text-muted)">
      暂无模板，点击上方按钮创建
    </div>
    <template v-else>
      <div class="grid gap-3 lg:grid-cols-2">
        <div
          v-for="t in templates"
          :key="t.id"
          class="rounded-lg border border-(--ui-border) bg-(--ui-bg-muted) p-4"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-semibold text-(--ui-text-highlighted)">{{ t.name }}</h3>
              <p class="mt-1 text-sm text-(--ui-text-muted)">{{ t.genre }} · Temperature {{ t.defaultTemperature || '0.7' }}</p>
            </div>
            <div class="flex gap-1">
              <NButton size="small" quaternary @click="openEdit(t)">
                <template #icon><Icon icon="lucide:pencil" /></template>
              </NButton>
              <NButton size="small" quaternary type="error" :loading="deleting === t.id" @click="deleteTemplate(t.id)">
                <template #icon><Icon icon="lucide:trash-2" /></template>
              </NButton>
            </div>
          </div>
          <p v-if="t.defaultStyleGuide" class="mt-2 text-xs text-(--ui-text-dimmed) line-clamp-2">{{ t.defaultStyleGuide }}</p>
        </div>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-between pt-2">
        <span class="text-xs text-(--ui-text-dimmed)">共 {{ total }} 条</span>
        <NPagination :page="page" :page-count="totalPages" :page-size="pageSize" @update:page="goToPage" />
      </div>
    </template>

    <!-- Create/Edit Modal -->
    <NModal v-model:show="showModal" preset="card" :title="editing ? '编辑模板' : '新建模板'" style="max-width: 500px;">
      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">模板名称</label>
          <NInput v-model:value="form.name" placeholder="如：都市修仙" />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">类型</label>
          <NInput v-model:value="form.genre" placeholder="如：fantasy" />
        </div>
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-(--ui-text)">默认风格指南</label>
            <NButton size="tiny" quaternary :loading="aiProcessing" :disabled="!form.defaultStyleGuide?.trim()" @click="aiExpandField('defaultStyleGuide')">
              <template #icon><Icon icon="lucide:sparkles" /></template>
              AI 扩写
            </NButton>
          </div>
          <NInput v-model:value="form.defaultStyleGuide" type="textarea" :rows="3" placeholder="可选" />
        </div>
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-(--ui-text)">默认 AI 提示词</label>
            <NButton size="tiny" quaternary :loading="aiProcessing" :disabled="!form.defaultAiPrompt?.trim()" @click="aiExpandField('defaultAiPrompt')">
              <template #icon><Icon icon="lucide:sparkles" /></template>
              AI 扩写
            </NButton>
          </div>
          <NInput v-model:value="form.defaultAiPrompt" type="textarea" :rows="3" placeholder="可选" />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-(--ui-text)">默认 Temperature</label>
          <NInput v-model:value="form.defaultTemperature" placeholder="0.7" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="saving" :disabled="!form.name || !form.genre" @click="save">
            {{ editing ? '保存' : '创建' }}
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
