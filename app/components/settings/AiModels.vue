<script setup lang="ts">
import { h } from 'vue'
import { NSwitch, NButton as NBtn, NTag } from 'naive-ui'

interface AiModelItem {
  id: number
  name: string
  apiUrl: string
  maskedApiKey: string
  model: string
  maxTokens: number
  enabled: boolean
}

const { t } = useI18n()
const message = useMessage()
const { post, del: apiDel } = useApi()

const { data: models, refresh: refreshModels } = await useFetch<AiModelItem[]>('/api/ai/models', { default: () => [] })
const showModelForm = ref(false)
const savingModel = ref(false)
const modelForm = reactive({
  id: undefined as number | undefined,
  name: '',
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  apiKey: '',
  model: '',
  maxTokens: 4096,
  enabled: true
})

const modelSortBy = ref<'name' | 'maxTokens' | 'createdAt'>('name')
const modelFilterEnabled = ref<boolean | null>(null)

const sortedModels = computed(() => {
  let list = models.value || []
  if (modelFilterEnabled.value !== null) {
    list = list.filter(m => m.enabled === modelFilterEnabled.value)
  }
  return [...list].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    if (modelSortBy.value === 'maxTokens') return b.maxTokens - a.maxTokens
    if (modelSortBy.value === 'name') return a.name.localeCompare(b.name)
    return 0
  })
})

function resetModelForm() {
  modelForm.id = undefined
  modelForm.name = ''
  modelForm.apiUrl = 'https://openrouter.ai/api/v1/chat/completions'
  modelForm.apiKey = ''
  modelForm.model = ''
  modelForm.maxTokens = 4096
  modelForm.enabled = true
}

function startCreateModel() {
  resetModelForm()
  showModelForm.value = true
}

function startEditModel(model: AiModelItem) {
  modelForm.id = model.id
  modelForm.name = model.name
  modelForm.apiUrl = model.apiUrl
  modelForm.apiKey = ''
  modelForm.model = model.model
  modelForm.maxTokens = model.maxTokens
  modelForm.enabled = model.enabled
  showModelForm.value = true
}

async function saveModel() {
  if (!modelForm.name.trim() || !modelForm.apiUrl.trim() || !modelForm.model.trim()) {
    message.error('请填写必填字段')
    return
  }
  if (!modelForm.id && !modelForm.apiKey.trim()) {
    message.error('请输入 API 密钥')
    return
  }
  savingModel.value = true
  try {
    await post('/api/ai/models', {
      id: modelForm.id,
      name: modelForm.name.trim(),
      apiUrl: modelForm.apiUrl.trim(),
      apiKey: modelForm.apiKey.trim() || undefined,
      model: modelForm.model.trim(),
      maxTokens: modelForm.maxTokens,
      enabled: modelForm.enabled
    }, { successMessage: modelForm.id ? '模型已更新' : '模型已添加' })
    showModelForm.value = false
    await refreshModels()
  } catch {
  } finally {
    savingModel.value = false
  }
}

async function toggleModelEnabled(model: AiModelItem) {
  try {
    await post('/api/ai/models', {
      id: model.id,
      name: model.name,
      apiUrl: model.apiUrl,
      model: model.model,
      maxTokens: model.maxTokens,
      enabled: !model.enabled
    }, { successMessage: model.enabled ? '模型已禁用' : '模型已启用' })
    await refreshModels()
  } catch {}
}

async function deleteModel(model: AiModelItem) {
  try {
    await apiDel('/api/ai/models', { query: { id: model.id }, successMessage: '模型已删除' })
    await refreshModels()
  } catch {}
}

const tableColumns = computed(() => [
  {
    title: '状态',
    key: 'enabled',
    width: 70,
    render(row: AiModelItem) {
      return h(NSwitch, { size: 'small', value: row.enabled, onUpdateValue: () => toggleModelEnabled(row) })
    }
  },
  {
    title: '名称',
    key: 'name',
    ellipsis: { tooltip: true },
    sorter: (a: AiModelItem, b: AiModelItem) => a.name.localeCompare(b.name)
  },
  {
    title: '模型标识',
    key: 'model',
    ellipsis: { tooltip: true }
  },
  {
    title: 'API 地址',
    key: 'apiUrl',
    ellipsis: { tooltip: true }
  },
  {
    title: '密钥',
    key: 'maskedApiKey',
    width: 150,
    ellipsis: { tooltip: true }
  },
  {
    title: 'Max Tokens',
    key: 'maxTokens',
    width: 120,
    sorter: (a: AiModelItem, b: AiModelItem) => a.maxTokens - b.maxTokens,
    render(row: AiModelItem) {
      return h(NTag, { size: 'small', bordered: false }, () => row.maxTokens.toLocaleString())
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row: AiModelItem) {
      return h('div', { class: 'flex items-center gap-1' }, [
        h(NBtn, { size: 'tiny', quaternary: true, onClick: () => startEditModel(row) }, { icon: () => h(resolveComponent('Icon'), { icon: 'lucide:pencil', class: 'w-3.5 h-3.5' }) }),
        h(NBtn, { size: 'tiny', quaternary: true, onClick: () => deleteModel(row) }, { icon: () => h(resolveComponent('Icon'), { icon: 'lucide:trash-2', class: 'w-3.5 h-3.5 text-red-500' }) })
      ])
    }
  }
])
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <NSelect v-model:value="modelFilterEnabled" size="small" :options="[{ label: '全部状态', value: null }, { label: '启用', value: true }, { label: '禁用', value: false }]" style="width: 100px" />
      </div>
      <NButton size="small" type="primary" @click="startCreateModel">
        <template #icon><Icon icon="lucide:plus" /></template>
        添加模型
      </NButton>
    </div>

    <NDataTable
      :columns="tableColumns"
      :data="sortedModels"
      :bordered="false"
      size="small"
      :row-key="(row: AiModelItem) => row.id"
    >
      <template #empty>
        <div class="py-8 text-center">
          <Icon icon="lucide:brain" class="size-10 text-(--ui-text-dimmed)/30 mx-auto mb-3" />
          <p class="text-sm text-(--ui-text-dimmed)">暂无模型，点击上方添加</p>
        </div>
      </template>
    </NDataTable>

    <!-- Model Form Modal -->
    <NModal v-model:show="showModelForm" preset="card" :title="modelForm.id ? '编辑模型' : '添加模型'" style="max-width: 520px">
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <NFormItem label="模型名称" required>
            <NInput v-model:value="modelForm.name" placeholder="例如：GPT-4o" size="small" />
          </NFormItem>
          <NFormItem label="模型标识" required>
            <NInput v-model:value="modelForm.model" placeholder="gpt-4o" size="small" :input-props="{ spellcheck: 'false' }" />
          </NFormItem>
        </div>
        <NFormItem label="API 地址" required>
          <NInput v-model:value="modelForm.apiUrl" placeholder="https://api.openai.com/v1/chat/completions" size="small" :input-props="{ spellcheck: 'false' }" />
        </NFormItem>
        <NFormItem :label="t('ai.apiKey')" :required="!modelForm.id">
          <NInput v-model:value="modelForm.apiKey" type="password" show-password-on="click" :placeholder="modelForm.id ? '留空则不修改' : '请输入 API 密钥'" size="small" />
        </NFormItem>
        <div class="grid gap-4 sm:grid-cols-2">
          <NFormItem label="最大 Tokens">
            <NInputNumber v-model:value="modelForm.maxTokens" :min="256" :max="2000000" :step="1024" size="small" />
          </NFormItem>
          <NFormItem label="状态">
            <NCheckbox v-model:checked="modelForm.enabled" label="启用" />
          </NFormItem>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="showModelForm = false">取消</NButton>
          <NButton size="small" type="primary" :loading="savingModel" @click="saveModel">保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
