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

interface AiConfigItem {
  id: number
  purpose: string
  temperature: string | null
  isDefault: boolean
  enabled: boolean
  order: number
  aiModel: AiModelItem
}

type AiPurpose = 'generation' | 'extraction' | 'consistency_check' | 'style_analysis'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const { post, del: apiDel } = useApi()

/* ─────────────── Models ─────────────── */

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
  lastTestResult = {}
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
      enabled: modelForm.enabled,
      ...lastTestResult
    }, { successMessage: modelForm.id ? '模型已更新' : '模型已添加' })
    showModelForm.value = false
    lastTestResult = {}
    await refreshModels()
  } catch {
  } finally {
    savingModel.value = false
  }
}

let lastTestResult: Record<string, unknown> = {}

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
    lastTestResult = {
      lastCheckAt: new Date().toISOString(),
      lastCheckAvailable: result.available,
      lastCheckReason: result.reason
    }
    if (result.available) {
      message.success('连通性测试通过')
    } else {
      message.error(result.reason || '连通性测试失败')
    }
    if (modelForm.id) {
      await refreshModels()
    }
  } catch (e: any) {
    lastTestResult = {
      lastCheckAt: new Date().toISOString(),
      lastCheckAvailable: false,
      lastCheckReason: e?.data?.message || '测试请求失败'
    }
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

/* ─────────────── Purpose Configs ─────────────── */

const purposeOptions = computed(() => [
  { label: t('ai.purpose.generation'), value: 'generation' },
  { label: t('ai.purpose.extraction'), value: 'extraction' },
  { label: t('ai.purpose.consistencyCheck'), value: 'consistency_check' },
  { label: t('ai.purpose.styleAnalysis'), value: 'style_analysis' }
])

const purposeIcons: Record<string, string> = {
  generation: 'lucide:wand-sparkles',
  extraction: 'lucide:scan-text',
  consistency_check: 'lucide:shield-check',
  style_analysis: 'lucide:palette'
}

const { data: configs, refresh: refreshConfigs } = await useFetch<AiConfigItem[]>('/api/ai/config', { default: () => [] })

const enabledModelOptions = computed(() =>
  (models.value || []).filter(m => m.enabled).map(m => ({ label: `${m.name} (${m.model})`, value: m.id }))
)

// Models not yet used in the current editing purpose
const availableModelOptions = computed(() => {
  const usedIds = new Set(
    (configs.value || [])
      .filter(c => c.purpose === editingPurpose.value)
      .map(c => c.aiModel?.id)
  )
  return enabledModelOptions.value.filter(m => !usedIds.has(m.value))
})

const groupedConfigs = computed(() =>
  purposeOptions.value.map(purpose => ({
    ...purpose,
    icon: purposeIcons[purpose.value],
    configs: (configs.value || []).filter(c => c.purpose === purpose.value)
  }))
)

// Drag-and-drop state
const dragConfigId = ref<number | null>(null)
const dragOverConfigId = ref<number | null>(null)

function onDragStart(configId: number, e: DragEvent) {
  dragConfigId.value = configId
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(configId: number, e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverConfigId.value = configId
}

function onDragLeave() {
  dragOverConfigId.value = null
}

async function onDrop(targetConfig: AiConfigItem, e: DragEvent) {
  e.preventDefault()
  dragOverConfigId.value = null
  if (!dragConfigId.value || dragConfigId.value === targetConfig.id) return

  const purposeConfigs = (configs.value || []).filter(c => c.purpose === targetConfig.purpose)
  const fromIdx = purposeConfigs.findIndex(c => c.id === dragConfigId.value)
  const toIdx = purposeConfigs.findIndex(c => c.id === targetConfig.id)
  if (fromIdx === -1 || toIdx === -1) return

  // Reorder locally
  const reordered = [...purposeConfigs]
  const [moved] = reordered.splice(fromIdx, 1)
  if (!moved) return
  reordered.splice(toIdx, 0, moved)

  // Assign order and isDefault
  const updates = reordered.map((c, i) => ({
    id: c.id,
    aiModelId: c.aiModel.id,
    purpose: c.purpose,
    temperature: c.temperature || '0.7',
    isDefault: i === 0,
    enabled: c.enabled,
    order: i
  }))

  // Optimistic update
  const allOther = (configs.value || []).filter(c => c.purpose !== targetConfig.purpose)
  configs.value = [...allOther, ...reordered]

  // Persist
  for (const u of updates) {
    try {
      await post('/api/ai/config', u)
    } catch {}
  }
  await refreshConfigs()
  dragConfigId.value = null
}

// Inline editing state
const editingConfigId = ref<number | 'new' | null>(null)
const editingPurpose = ref<AiPurpose>('generation')
const inlineForm = reactive({
  aiModelId: null as number | null,
  temperature: '0.7',
  isDefault: false,
  enabled: true
})

function startNewConfig(purpose: AiPurpose) {
  editingConfigId.value = 'new'
  editingPurpose.value = purpose
  inlineForm.aiModelId = null
  inlineForm.temperature = '0.7'
  inlineForm.isDefault = false
  inlineForm.enabled = true
}

function startEditExistingConfig(config: AiConfigItem) {
  editingConfigId.value = config.id
  editingPurpose.value = config.purpose as AiPurpose
  inlineForm.aiModelId = config.aiModel?.id ?? null
  inlineForm.temperature = config.temperature || '0.7'
  inlineForm.isDefault = config.isDefault
  inlineForm.enabled = config.enabled
}

async function saveInlineConfig(purpose: AiPurpose) {
  if (!inlineForm.aiModelId) {
    message.error('请选择一个模型')
    return
  }
  const isNew = editingConfigId.value === 'new'
  // For edits, preserve current isDefault from server data
  const currentIsDefault = isNew
    ? false
    : (configs.value || []).find(c => c.id === editingConfigId.value)?.isDefault ?? false
  try {
    await post('/api/ai/config', {
      id: isNew ? undefined : editingConfigId.value,
      aiModelId: inlineForm.aiModelId,
      purpose,
      temperature: inlineForm.temperature?.trim() || '0.7',
      isDefault: currentIsDefault,
      enabled: inlineForm.enabled
    }, { successMessage: isNew ? '配置已创建' : '配置已更新' })
    editingConfigId.value = null
    await refreshConfigs()
  } catch {}
}

async function deleteConfig(config: AiConfigItem) {
  dialog.warning({
    title: '删除配置',
    content: `确定删除「${config.aiModel?.name || '未知模型'}」的${purposeOptions.value.find(p => p.value === config.purpose)?.label || ''}配置？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await apiDel('/api/ai/config', { query: { id: config.id }, successMessage: '配置已删除' })
        await refreshConfigs()
      } catch {}
    }
  })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Models Section -->
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
    </div>

    <!-- Divider -->
    <div class="border-t border-(--ui-border)" />

    <!-- Purpose Configs Section -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">用途配置</h3>
          <p class="mt-0.5 text-[11px] text-(--ui-text-dimmed)">为每个用途绑定模型，拖动排序，排在第一个的为默认</p>
        </div>
      </div>

      <NAlert v-if="enabledModelOptions.length === 0" type="warning" title="暂无可用模型">
        请先在上方添加并启用至少一个模型
      </NAlert>

      <div class="space-y-3">
        <div v-for="group in groupedConfigs" :key="group.value" class="card-surface overflow-hidden">
          <!-- Purpose Header -->
          <div class="flex items-center justify-between px-3 py-2 border-b border-(--ui-border)/40">
            <div class="flex items-center gap-2">
              <Icon :icon="group.icon" class="w-4 h-4 text-primary-500" />
              <span class="text-sm font-semibold text-(--ui-text)">{{ group.label }}</span>
              <span class="text-[10px] font-mono text-(--ui-text-dimmed)">{{ group.configs.length }}</span>
            </div>
            <button
              v-if="availableModelOptions.length > 0"
              class="text-[11px] text-primary-600 hover:underline font-medium"
              @click="startNewConfig(group.value as AiPurpose)"
            >添加</button>
          </div>

          <!-- Existing configs (read-only row, click to edit) -->
          <div v-if="group.configs.length" class="p-1.5 space-y-1">
            <div v-for="config in group.configs" :key="config.id">
              <!-- View mode -->
              <div
                v-if="editingConfigId !== config.id"
                draggable="true"
                class="flex items-center gap-2 px-2.5 py-2 rounded-md transition-colors cursor-grab active:cursor-grabbing"
                :class="[
                  dragOverConfigId === config.id ? 'bg-primary-500/10 ring-1 ring-primary-500/30' : 'hover:bg-(--ui-bg-muted)/50',
                  dragConfigId === config.id ? 'opacity-40' : ''
                ]"
                @dragstart="onDragStart(config.id, $event)"
                @dragover="onDragOver(config.id, $event)"
                @dragleave="onDragLeave()"
                @drop="onDrop(config, $event)"
                @click="startEditExistingConfig(config)"
              >
                <Icon icon="lucide:grip-vertical" class="w-3 h-3 shrink-0 text-(--ui-text-dimmed)/50" />
                <div class="w-1.5 h-1.5 rounded-full shrink-0" :class="config.enabled && config.aiModel?.enabled ? 'bg-emerald-500' : 'bg-(--ui-text-dimmed)/30'" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[12px] font-semibold text-(--ui-text) truncate">{{ config.aiModel?.name || '未知模型' }}</span>
                    <span v-if="config.isDefault" class="text-[9px] px-1 py-0.5 rounded bg-primary-500/10 text-primary-600 font-bold">默认</span>
                    <span v-if="config.aiModel && !config.aiModel.enabled" class="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">模型已禁用</span>
                  </div>
                  <p class="text-[10px] text-(--ui-text-dimmed) truncate">{{ config.aiModel?.model }} · 温度 {{ config.temperature || '0.7' }}</p>
                </div>
                <button class="flex items-center justify-center w-5 h-5 rounded text-(--ui-text-dimmed) hover:text-red-500 hover:bg-red-500/5 transition-colors shrink-0" @click.stop="deleteConfig(config)">
                  <Icon icon="lucide:trash-2" class="w-3 h-3" />
                </button>
              </div>

              <!-- Edit mode (inline) -->
              <div
                v-else
                class="px-2.5 py-2 rounded-md bg-(--ui-bg-muted)/60 ring-1 ring-primary-500/30 space-y-2"
              >
                <div class="flex items-center gap-2">
                  <NSelect
                    v-model:value="inlineForm.aiModelId"
                    :options="enabledModelOptions"
                    placeholder="选择模型"
                    size="small"
                    filterable
                    class="flex-1"
                  />
                  <NInput
                    v-model:value="inlineForm.temperature"
                    placeholder="0.7"
                    size="small"
                    style="width: 70px"
                  />
                  <NSwitch
                    v-model:value="inlineForm.enabled"
                    size="small"
                  />
                </div>
                <div class="flex justify-end gap-1.5">
                  <NButton size="tiny" quaternary @click="editingConfigId = null">取消</NButton>
                  <NButton size="tiny" type="primary" @click="saveInlineConfig(group.value as AiPurpose)">保存</NButton>
                </div>
              </div>
            </div>
          </div>

          <!-- New config inline form -->
          <div
            v-if="editingConfigId === 'new' && editingPurpose === group.value && availableModelOptions.length > 0"
            class="px-2.5 py-2 space-y-2"
            :class="group.configs.length ? 'border-t border-(--ui-border)/30' : ''"
          >
            <div class="flex items-center gap-2">
              <NSelect
                v-model:value="inlineForm.aiModelId"
                :options="availableModelOptions"
                placeholder="选择模型"
                size="small"
                filterable
                class="flex-1"
              />
              <NInput
                v-model:value="inlineForm.temperature"
                placeholder="0.7"
                size="small"
                style="width: 70px"
              />
              <button
                class="text-[10px] px-1.5 py-0.5 rounded transition-colors shrink-0"
                :class="inlineForm.isDefault ? 'bg-primary-500/10 text-primary-600 font-bold' : 'text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)'"
                @click="inlineForm.isDefault = !inlineForm.isDefault"
              >默认</button>
              <NSwitch
                v-model:value="inlineForm.enabled"
                size="small"
              />
            </div>
            <div class="flex justify-end gap-1.5">
              <NButton size="tiny" quaternary @click="editingConfigId = null">取消</NButton>
              <NButton size="tiny" type="primary" @click="saveInlineConfig(group.value as AiPurpose)">保存</NButton>
            </div>
          </div>

          <!-- Empty state (only when no configs AND not adding new for this purpose) -->
          <div
            v-if="!group.configs.length && !(editingConfigId === 'new' && editingPurpose === group.value)"
            class="px-3 py-4 text-center"
          >
            <p class="text-[11px] text-(--ui-text-dimmed)">暂无配置，点击「添加」</p>
          </div>
        </div>
      </div>
    </div>

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
