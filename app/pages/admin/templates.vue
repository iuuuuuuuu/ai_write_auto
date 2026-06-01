<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import { NOVEL_GENRES, getNovelGenreLabelKey } from '~~/shared/novel-catalog'

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
  refresh
} = usePagination<NovelTemplate>({ url: '/api/admin/templates' })

const { post, put, del: apiDel } = useApi()
const { t } = useI18n()

const showModal = ref(false)
const editing = ref<NovelTemplate | null>(null)
const formRef = useTemplateRef<FormInst>('formRef')
const form = ref({
  name: '',
  genre: '',
  defaultStyleGuide: '',
  defaultAiPrompt: '',
  defaultTemperature: '0.7'
})
const saving = ref(false)
const syncingDefaults = shallowRef(false)

const genreOptions = computed(() =>
  NOVEL_GENRES.map((genre) => ({
    label: t(genre.labelKey),
    value: genre.value
  }))
)

function getGenreLabel(genre: string) {
  return t(getNovelGenreLabelKey(genre))
}

function openCreate() {
  editing.value = null
  form.value = {
    name: '',
    genre: '',
    defaultStyleGuide: '',
    defaultAiPrompt: '',
    defaultTemperature: '0.7'
  }
  showModal.value = true
}

function openEdit(t: NovelTemplate) {
  editing.value = t
  form.value = {
    name: t.name,
    genre: t.genre,
    defaultStyleGuide: t.defaultStyleGuide || '',
    defaultAiPrompt: t.defaultAiPrompt || '',
    defaultTemperature: t.defaultTemperature || '0.7'
  }
  showModal.value = true
}

async function save() {
  try {
    await formRef.value?.validate()
  } catch (error) {
    if (Array.isArray(error)) {
      const firstError = error.flat().find((item) => item?.message)
      messageError(firstError?.message || '表单校验未通过')
      return
    }
    messageError('表单校验未通过')
    return
  }

  saving.value = true
  try {
    const body = {
      ...form.value,
      defaultStyleGuide: form.value.defaultStyleGuide || null,
      defaultAiPrompt: form.value.defaultAiPrompt || null,
      defaultTemperature: form.value.defaultTemperature || null
    }
    if (editing.value) {
      await put(`/api/admin/templates/${editing.value.id}`, body)
    } else {
      await post('/api/admin/templates', body)
    }
    showModal.value = false
    refresh()
  } finally {
    saving.value = false
  }
}

async function syncDefaultTemplates() {
  syncingDefaults.value = true
  try {
    await post('/api/admin/templates/sync-defaults', undefined, {
      successMessage: '默认模板已同步'
    })
    refresh()
  } finally {
    syncingDefaults.value = false
  }
}

function messageError(content: string) {
  const message = useMessage()
  message.error(content)
}

const deleting = ref<number | null>(null)
async function deleteTemplate(id: number) {
  deleting.value = id
  try {
    await apiDel(`/api/admin/templates/${id}`)
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
  <div class="space-y-5">
    <section class="card-glass relative overflow-hidden p-6 sm:p-7">
      <div
        class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-primary-500/80">
            Admin / Templates
          </p>
          <h1
            class="mt-2 text-3xl font-semibold tracking-[-0.05em] text-(--ui-text-highlighted)"
          >
            小说模板
          </h1>
          <p class="mt-3 text-sm text-(--ui-text-muted)">
            管理创建小说时可选的模板。
          </p>
        </div>
        <NButton
          type="primary"
          round
          @click="openCreate"
        >
          <template #icon><Icon icon="lucide:plus" /></template>
          新建模板
        </NButton>
        <NButton
          round
          secondary
          :loading="syncingDefaults"
          @click="syncDefaultTemplates"
        >
          <template #icon><Icon icon="lucide:refresh-cw" /></template>
          同步默认模板
        </NButton>
      </div>
    </section>

    <div
      v-if="loading"
      class="space-y-3"
    >
      <NSkeleton
        v-for="i in 4"
        :key="i"
        class="h-20 rounded-[1.4rem]"
        text
      />
    </div>
    <div
      v-else-if="!templates.length"
      class="card-glass p-10 text-center text-sm text-(--ui-text-muted)"
    >
      暂无模板，点击上方按钮创建
    </div>
    <template v-else>
      <div class="grid gap-3 lg:grid-cols-2">
        <article
          v-for="templateItem in templates"
          :key="templateItem.id"
          class="liquid-panel group p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h3 class="truncate font-semibold text-(--ui-text-highlighted)">
                {{ templateItem.name }}
              </h3>
              <p class="mt-1 text-sm text-(--ui-text-muted)">
                {{ getGenreLabel(templateItem.genre) }} · Temperature
                {{ templateItem.defaultTemperature || '0.7' }}
              </p>
            </div>
            <div class="flex gap-1">
              <NButton
                size="small"
                quaternary
                circle
                @click="openEdit(templateItem)"
              >
                <template #icon><Icon icon="lucide:pencil" /></template>
              </NButton>
              <NButton
                size="small"
                quaternary
                circle
                type="error"
                :loading="deleting === templateItem.id"
                @click="deleteTemplate(templateItem.id)"
              >
                <template #icon><Icon icon="lucide:trash-2" /></template>
              </NButton>
            </div>
          </div>
          <p
            v-if="templateItem.defaultStyleGuide"
            class="mt-3 line-clamp-2 text-xs leading-5 text-(--ui-text-dimmed)"
          >
            {{ templateItem.defaultStyleGuide }}
          </p>
        </article>
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

    <NModal
      v-model:show="showModal"
      preset="card"
      :title="editing ? '编辑模板' : '新建模板'"
      style="max-width: 500px"
    >
      <NForm
        ref="formRef"
        :model="form"
        label-placement="top"
      >
        <div class="space-y-4">
          <NFormItem
            label="模板名称"
            path="name"
            :rule="{
              required: true,
              message: '请输入模板名称',
              trigger: ['blur', 'input']
            }"
          >
            <NInput
              v-model:value="form.name"
              placeholder="如：都市修仙"
            />
          </NFormItem>
          <NFormItem
            label="类型"
            path="genre"
            :rule="{
              required: true,
              message: '请选择类型',
              trigger: ['change']
            }"
          >
            <NSelect
              v-model:value="form.genre"
              :options="genreOptions"
              placeholder="选择模板类型"
              filterable
            />
          </NFormItem>
          <NFormItem
            label="默认风格指南"
            path="defaultStyleGuide"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-(--ui-text)"
                >默认风格指南</span
              >
              <NButton
                size="tiny"
                quaternary
                round
                :loading="aiProcessing"
                :disabled="!form.defaultStyleGuide?.trim()"
                @click="aiExpandField('defaultStyleGuide')"
              >
                <template #icon><Icon icon="lucide:sparkles" /></template>
                AI 扩写
              </NButton>
            </div>
            <NInput
              v-model:value="form.defaultStyleGuide"
              type="textarea"
              :rows="3"
              placeholder="可选"
            />
          </NFormItem>
          <NFormItem
            label="默认 AI 提示词"
            path="defaultAiPrompt"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-(--ui-text)"
                >默认 AI 提示词</span
              >
              <NButton
                size="tiny"
                quaternary
                round
                :loading="aiProcessing"
                :disabled="!form.defaultAiPrompt?.trim()"
                @click="aiExpandField('defaultAiPrompt')"
              >
                <template #icon><Icon icon="lucide:sparkles" /></template>
                AI 扩写
              </NButton>
            </div>
            <NInput
              v-model:value="form.defaultAiPrompt"
              type="textarea"
              :rows="3"
              placeholder="可选"
            />
          </NFormItem>
          <NFormItem
            label="默认 Temperature"
            path="defaultTemperature"
          >
            <NInput
              v-model:value="form.defaultTemperature"
              placeholder="0.7"
            />
          </NFormItem>
        </div>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton
            round
            @click="showModal = false"
            >取消</NButton
          >
          <NButton
            type="primary"
            round
            :loading="saving"
            :disabled="!form.name || !form.genre"
            @click="save"
          >
            {{ editing ? '保存' : '创建' }}
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
