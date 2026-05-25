<script setup lang="ts">
import { h } from 'vue'
import { NSwitch, NButton as NBtn, NTag, NTooltip } from 'naive-ui'

interface AiModelItem {
  id: number
  name: string
  apiUrl: string
  maskedApiKey: string
  model: string
  maxTokens: number
  enabled: boolean
  lastCheckAt: string | null
  lastCheckAvailable: boolean | null
  lastCheckReason: string | null
}

const { t } = useI18n()
const message = useMessage()
const { post, del: apiDel } = useApi()

const { data: models, refresh: refreshModels } = await useFetch<AiModelItem[]>('/api/ai/models', { default: () => [] })
const showModelForm = ref(false)
const savingModel = ref(false)
const checkingModelId = ref<number | null>(null)
const checkingAll = ref(false)

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return ''
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

async function checkModelConnectivity(model: AiModelItem) {
  checkingModelId.value = model.id
  try {
    await $fetch('/api/ai/models-check', { params: { id: model.id } })
    await refreshModels()
  } catch {
    message.error(`${model.name} 检测失败`)
  } finally {
    checkingModelId.value = null
  }
}

async function checkAllModels() {
  checkingAll.value = true
  const enabledModels = (models.value || []).filter(m => m.enabled)
  for (const model of enabledModels) {
    checkingModelId.value = model.id
    try {
      await $fetch('/api/ai/models-check', { params: { id: model.id } })
    } catch {}
  }
  checkingModelId.value = null
  await refreshModels()
  checkingAll.value = false
  const passed = enabledModels.filter(m => {
    const updated = models.value?.find(x => x.id === m.id)
    return updated?.lastCheckAvailable
  }).length
  message.info(`检测完成：${passed}/${enabledModels.length} 个模型可用`)
}

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
const modelFilterEnabled = ref<string>('all')

const sortedModels = computed(() => {
  let list = models.value || []
  if (modelFilterEnabled.value === 'true') {
    list = list.filter(m => m.enabled)
  } else if (modelFilterEnabled.value === 'false') {
    list = list.filter(m => !m.enabled)
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

const testingModel = ref(false)
async function testModelForm() {
  if (!modelForm.apiUrl.trim() || !modelForm.model.trim()) {
    message.error('请先填写 API 地址和模型标识')
    return
  }
  if (!modelForm.id && !modelForm.apiKey.trim()) {
    message.error('请先填写 API 密钥')
    return
  }
  testingModel.value = true
  try {
    const result = await $fetch<{ available: boolean; reason: string | null }>('/api/ai/models-test', {
      method: 'POST',
      body: {
        apiUrl: modelForm.apiUrl.trim(),
        apiKey: modelForm.apiKey.trim() || '__use_existing__',
        model: modelForm.model.trim(),
        existingModelId: modelForm.id
      }
    })
    if (result.available) {
      message.success('连通性测试通过')
    } else {
      message.error(result.reason || '连通性测试失败')
    }
    if (modelForm.id) {
      await refreshModels()
    }
  } catch (e: any) {
    message.error(e?.data?.message || '测试请求失败')
  } finally {
    testingModel.value = false
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

const tableColumns = computed(() => {
  const _checkingId = checkingModelId.value
  return [
    {
      title: '状态',
      key: 'enabled',
      width: 70,
      render(row: AiModelItem) {
        return h(NSwitch, { size: 'small', value: row.enabled, onUpdateValue: () => toggleModelEnabled(row) })
      }
    },
    {
      title: '连通',
      key: 'connectivity',
      width: 90,
      render(row: AiModelItem) {
        if (_checkingId === row.id) {
          return h('span', { class: 'text-xs text-(--ui-text-dimmed) animate-pulse' }, '检测中...')
        }
        if (row.lastCheckAt === null) {
          return h('span', { class: 'text-xs text-(--ui-text-dimmed)' }, '未检测')
        }
        const statusIcon = row.lastCheckAvailable ? '✓' : '✗'
        const statusClass = row.lastCheckAvailable ? 'text-emerald-500' : 'text-red-500'
        const ago = timeAgo(row.lastCheckAt)
        return h(NTooltip, null, {
          trigger: () => h('span', { class: `text-xs ${statusClass} cursor-default` }, `${statusIcon} ${ago}`),
          default: () => row.lastCheckAvailable ? '连通正常' : (row.lastCheckReason || '不可用')
        })
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
      width: 130,
      render(row: AiModelItem) {
        return h('div', { class: 'flex items-center gap-1' }, [
          h(NBtn, {
            size: 'tiny',
            quaternary: true,
            loading: _checkingId === row.id,
            onClick: () => checkModelConnectivity(row)
          }, { icon: () => h(resolveComponent('Icon'), { icon: 'lucide:wifi', class: 'w-3.5 h-3.5' }) }),
          h(NBtn, { size: 'tiny', quaternary: true, onClick: () => startEditModel(row) }, { icon: () => h(resolveComponent('Icon'), { icon: 'lucide:pencil', class: 'w-3.5 h-3.5' }) }),
          h(NBtn, { size: 'tiny', quaternary: true, onClick: () => deleteModel(row) }, { icon: () => h(resolveComponent('Icon'), { icon: 'lucide:trash-2', class: 'w-3.5 h-3.5 text-red-500' }) })
        ])
      }
    }
  ]
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <NSelect v-model:value="modelFilterEnabled" size="small" :options="[{ label: '全部状态', value: 'all' }, { label: '启用', value: 'true' }, { label: '禁用', value: 'false' }]" style="width: 100px" />
        <NButton size="small" secondary :loading="checkingAll" @click="checkAllModels">
          <template #icon><Icon icon="lucide:wifi" /></template>
          检测全部
        </NButton>
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
        <div class="flex justify-between">
          <NButton size="small" secondary :loading="testingModel" @click="testModelForm">
            <template #icon><Icon icon="lucide:wifi" /></template>
            测试连通
          </NButton>
          <div class="flex gap-2">
            <NButton size="small" @click="showModelForm = false">取消</NButton>
            <NButton size="small" type="primary" :loading="savingModel" @click="saveModel">保存</NButton>
          </div>
        </div>
      </template>
    </NModal>
  </div>
</template>
