<script setup lang="ts">
type AiPurpose =
  | 'generation'
  | 'extraction'
  | 'consistency_check'
  | 'style_analysis'

interface AiConfigItem {
  id: number
  name: string
  purpose: AiPurpose
  apiUrl: string
  apiKey: string
  maskedApiKey: string
  model: string
  temperature: string | null
  maxTokens: number | null
  isDefault: boolean
  enabled: boolean
}

type AiStatusResponse = {
  available: boolean
  checkedAt: string
  checkedConnectivity: boolean
  reason: string | null
}

const { t } = useI18n()
const message = useMessage()

const checkingConnectivity = ref(false)
const connectivityStatus = ref<AiStatusResponse | null>(null)

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

const { data: configs, refresh } = await useFetch<AiConfigItem[]>(
  '/api/ai/config',
  { default: () => [] }
)

const editingId = ref<number | null>(null)
const showForm = ref(false)
const saving = ref(false)
const deletingId = ref<number | null>(null)
const applyingPreset = ref<string | null>(null)

interface CustomPreset {
  id: string
  name: string
  temperature: string
  maxTokens: number
  configId?: number
}

const customPresets = ref<CustomPreset[]>([])
const showCustomPresetForm = ref(false)
const newPreset = reactive({
  name: '',
  temperature: 0.7,
  maxTokens: 4096,
  configId: undefined as number | undefined
})

async function loadCustomPresets() {
  try {
    const prefs = await $fetch<Record<string, string>>('/api/settings/preferences')
    if (prefs.ai_custom_presets) {
      customPresets.value = JSON.parse(prefs.ai_custom_presets)
    }
  } catch {}
}

async function saveCustomPresets() {
  await $fetch('/api/settings/preferences', {
    method: 'PUT',
    body: { key: 'ai_custom_presets', value: JSON.stringify(customPresets.value) }
  })
}

async function addCustomPreset() {
  if (!newPreset.name.trim()) return
  customPresets.value.push({
    id: Date.now().toString(36),
    name: newPreset.name.trim(),
    temperature: String(newPreset.temperature),
    maxTokens: newPreset.maxTokens,
    configId: newPreset.configId
  })
  await saveCustomPresets()
  showCustomPresetForm.value = false
  newPreset.name = ''
  newPreset.temperature = 0.7
  newPreset.maxTokens = 4096
  newPreset.configId = undefined
  message.success('预设已保存')
}

async function deleteCustomPreset(id: string) {
  customPresets.value = customPresets.value.filter(p => p.id !== id)
  await saveCustomPresets()
}

async function applyCustomPreset(preset: CustomPreset) {
  const targetConfig = preset.configId
    ? configs.value.find(c => c.id === preset.configId)
    : defaultGenerationConfig.value
  if (!targetConfig) {
    message.warning('预设关联的模型配置不存在')
    return
  }
  applyingPreset.value = preset.id
  try {
    await $fetch('/api/ai/config', {
      method: 'POST',
      body: {
        id: targetConfig.id,
        name: targetConfig.name,
        purpose: targetConfig.purpose,
        apiUrl: targetConfig.apiUrl,
        model: targetConfig.model,
        temperature: preset.temperature,
        maxTokens: preset.maxTokens,
        isDefault: true,
        enabled: targetConfig.enabled
      }
    })
    message.success(`已切换至「${preset.name}」`)
    await refresh()
  } catch {
    message.error('切换预设失败')
  } finally {
    applyingPreset.value = null
  }
}

const generationConfigs = computed(() =>
  configs.value.filter(c => c.purpose === 'generation')
)

loadCustomPresets()

const defaultGenerationConfig = computed(() => {
  return configs.value.find((c) => c.purpose === 'generation' && c.isDefault)
})

async function applyPreset(preset: 'creative' | 'balanced' | 'precise') {
  const config = defaultGenerationConfig.value
  if (!config) {
    message.warning('请先添加一个内容生成模型并设为默认')
    return
  }

  applyingPreset.value = preset
  try {
    const presets = {
      creative: { temperature: '0.9', maxTokens: 4096 },
      balanced: { temperature: '0.7', maxTokens: 4096 },
      precise: { temperature: '0.3', maxTokens: 2048 }
    }
    const p = presets[preset]

    await $fetch('/api/ai/config', {
      method: 'POST',
      body: {
        id: config.id,
        name: config.name,
        purpose: config.purpose,
        apiUrl: config.apiUrl,
        model: config.model,
        temperature: p.temperature,
        maxTokens: p.maxTokens,
        isDefault: true,
        enabled: config.enabled
      }
    })
    message.success(`已切换至${preset === 'creative' ? '创意' : preset === 'balanced' ? '平衡' : '精确'}模式`)
    await refresh()
  } catch {
    message.error('切换预设失败')
  } finally {
    applyingPreset.value = null
  }
}

const form = reactive({
  id: undefined as number | undefined,
  name: '',
  purpose: 'generation' as AiPurpose,
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: '',
  temperature: '0.7',
  maxTokens: 4096,
  isDefault: false,
  enabled: true
})

const groupedConfigs = computed(() =>
  purposeOptions.value.map((purpose) => ({
    ...purpose,
    icon: purposeIcons[purpose.value],
    configs: configs.value.filter((config) => config.purpose === purpose.value)
  }))
)

// PLACEHOLDER_REST

function resetForm(purpose: AiPurpose = 'generation') {
  editingId.value = null
  form.id = undefined
  form.name = ''
  form.purpose = purpose
  form.apiUrl = 'https://api.openai.com/v1/chat/completions'
  form.apiKey = ''
  form.model = ''
  form.temperature = '0.7'
  form.maxTokens = 4096
  form.isDefault =
    configs.value.filter((config) => config.purpose === purpose).length === 0
  form.enabled = true
}

function startCreate(purpose: AiPurpose = 'generation') {
  resetForm(purpose)
  showForm.value = true
}

function startEdit(config: AiConfigItem) {
  editingId.value = config.id
  form.id = config.id
  form.name = config.name
  form.purpose = config.purpose
  form.apiUrl = config.apiUrl
  form.apiKey = ''
  form.model = config.model
  form.temperature = config.temperature || '0.7'
  form.maxTokens = config.maxTokens || 4096
  form.isDefault = config.isDefault
  form.enabled = config.enabled
  showForm.value = true
}

async function checkConnectivity(showSuccess = true) {
  checkingConnectivity.value = true
  try {
    const result = await $fetch<AiStatusResponse>('/api/ai/status', {
      params: { check: true }
    })
    connectivityStatus.value = result
    if (result.available) {
      if (showSuccess) message.success('AI 连通性检测通过')
    } else {
      message.error(result.reason || 'AI 当前不可用')
    }
  } catch {
    connectivityStatus.value = {
      available: false,
      checkedAt: new Date().toISOString(),
      checkedConnectivity: true,
      reason: 'AI 连通性检测失败'
    }
    message.error('AI 连通性检测失败')
  } finally {
    checkingConnectivity.value = false
  }
}

async function saveConfig() {
  if (!form.name.trim() || !form.apiUrl.trim() || !form.model.trim()) {
    message.error('请填写必填字段')
    return
  }
  if (!editingId.value && !form.apiKey.trim()) {
    message.error('请输入 API 密钥')
    return
  }

  saving.value = true
  try {
    await $fetch('/api/ai/config', {
      method: 'POST',
      body: {
        id: form.id,
        name: form.name.trim(),
        purpose: form.purpose,
        apiUrl: form.apiUrl.trim(),
        apiKey: form.apiKey.trim() || undefined,
        model: form.model.trim(),
        temperature: form.temperature.trim(),
        maxTokens: form.maxTokens,
        isDefault: form.isDefault,
        enabled: form.enabled
      }
    })
    message.success(editingId.value ? '配置已更新' : '配置已创建')
    showForm.value = false
    await refresh()
    await checkConnectivity(false)
  } catch (error) {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function setDefault(config: AiConfigItem) {
  try {
    await $fetch('/api/ai/config', {
      method: 'POST',
      body: {
        id: config.id,
        name: config.name,
        purpose: config.purpose,
        apiUrl: config.apiUrl,
        model: config.model,
        temperature: config.temperature || '0.7',
        maxTokens: config.maxTokens || 4096,
        isDefault: true,
        enabled: config.enabled
      }
    })
    message.success('默认模型已更新')
    await refresh()
    await checkConnectivity(false)
  } catch {
    message.error('更新失败')
  }
}

async function deleteConfig(config: AiConfigItem) {
  deletingId.value = config.id
  try {
    await $fetch('/api/ai/config', {
      method: 'DELETE',
      query: { id: config.id }
    })
    message.success('配置已删除')
    await refresh()
    await checkConnectivity(false)
  } catch {
    message.error('删除失败')
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-(--ui-text-highlighted)">
          {{ t('ai.config') }}
        </h2>
        <p class="mt-0.5 text-xs text-(--ui-text-dimmed)">
          管理你的 AI 模型配置，每个用途可设置一个默认模型
        </p>
      </div>
      <NButton
        size="small"
        secondary
        :loading="checkingConnectivity"
        @click="checkConnectivity()"
      >
        <template #icon><Icon icon="lucide:wifi" /></template>
        检测连通性
      </NButton>
      <NButton
        size="small"
        type="primary"
        @click="startCreate()"
      >
        <template #icon><Icon icon="lucide:plus" /></template>
        新增
      </NButton>
    </div>

    <NAlert
      v-if="connectivityStatus"
      :type="connectivityStatus.available ? 'success' : 'warning'"
      :title="connectivityStatus.available ? 'AI 连接可用' : 'AI 当前不可用'"
    >
      {{ connectivityStatus.reason || '内容生成模型连通性正常。' }}
      <span class="ml-2 text-xs text-(--ui-text-dimmed)">
        {{ new Date(connectivityStatus.checkedAt).toLocaleString() }}
      </span>
    </NAlert>

    <!-- Presets -->
    <div class="space-y-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-(--ui-text-dimmed)">快速切换：</span>
        <NButton
          size="tiny"
          :loading="applyingPreset === 'creative'"
          :type="defaultGenerationConfig?.temperature === '0.9' ? 'primary' : 'default'"
          @click="applyPreset('creative')"
        >
          <template #icon><Icon icon="lucide:flame" /></template>
          创意模式
        </NButton>
        <NButton
          size="tiny"
          :loading="applyingPreset === 'balanced'"
          :type="defaultGenerationConfig?.temperature === '0.7' ? 'primary' : 'default'"
          @click="applyPreset('balanced')"
        >
          <template #icon><Icon icon="lucide:scale" /></template>
          平衡模式
        </NButton>
        <NButton
          size="tiny"
          :loading="applyingPreset === 'precise'"
          :type="defaultGenerationConfig?.temperature === '0.3' ? 'primary' : 'default'"
          @click="applyPreset('precise')"
        >
          <template #icon><Icon icon="lucide:crosshair" /></template>
          精确模式
        </NButton>
        <NButton
          v-for="cp in customPresets"
          :key="cp.id"
          size="tiny"
          :loading="applyingPreset === cp.id"
          @click="applyCustomPreset(cp)"
        >
          <template #icon><Icon icon="lucide:bookmark" /></template>
          {{ cp.name }}
        </NButton>
        <NButton size="tiny" quaternary @click="showCustomPresetForm = !showCustomPresetForm">
          <template #icon><Icon icon="lucide:plus" /></template>
        </NButton>
      </div>

      <!-- Custom Preset Form -->
      <div v-if="showCustomPresetForm" class="card-surface p-3 space-y-2">
        <div class="flex gap-2">
          <NInput v-model:value="newPreset.name" size="small" placeholder="预设名称" class="flex-1" />
          <NSelect
            v-model:value="newPreset.configId"
            size="small"
            :options="generationConfigs.map(c => ({ label: c.model, value: c.id }))"
            placeholder="关联模型（可选）"
            clearable
            style="width: 180px"
          />
        </div>
        <div class="flex gap-2 items-center">
          <span class="text-xs text-(--ui-text-dimmed) shrink-0">温度:</span>
          <NSlider v-model:value="newPreset.temperature" :min="0" :max="2" :step="0.1" :format-tooltip="(v: number) => String(v)" class="flex-1" />
          <span class="text-xs w-6 text-center">{{ newPreset.temperature }}</span>
          <span class="text-xs text-(--ui-text-dimmed) shrink-0 ml-2">Tokens:</span>
          <NInputNumber v-model:value="newPreset.maxTokens" size="tiny" :min="512" :max="128000" :step="256" style="width: 100px" />
        </div>
        <div class="flex justify-between items-center">
          <div class="flex gap-1 flex-wrap">
            <NTag
              v-for="cp in customPresets"
              :key="cp.id"
              size="small"
              closable
              @close="deleteCustomPreset(cp.id)"
            >
              {{ cp.name }} ({{ cp.temperature }})
            </NTag>
          </div>
          <div class="flex gap-1">
            <NButton size="tiny" @click="showCustomPresetForm = false">取消</NButton>
            <NButton size="tiny" type="primary" :disabled="!newPreset.name.trim()" @click="addCustomPreset">保存</NButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Config Groups -->
    <div class="space-y-3">
      <section
        v-for="group in groupedConfigs"
        :key="group.value"
        class="card-surface overflow-hidden"
      >
        <div
          class="flex items-center justify-between px-3 py-2 border-b border-(--ui-border)/40"
        >
          <div class="flex items-center gap-2">
            <div
              class="w-5 h-5 rounded flex items-center justify-center"
              style="
                background: linear-gradient(
                  135deg,
                  var(--ui-primary-300),
                  var(--ui-primary-500)
                );
              "
            >
              <Icon
                :icon="group.icon"
                class="w-3 h-3 text-white"
              />
            </div>
            <span class="text-sm font-semibold text-(--ui-text)">{{
              group.label
            }}</span>
            <span class="text-[10px] font-mono text-(--ui-text-dimmed)">{{
              group.configs.length
            }}</span>
          </div>
          <button
            class="text-[11px] text-primary-600 hover:underline font-medium"
            @click="startCreate(group.value as AiPurpose)"
          >
            添加
          </button>
        </div>

        <div
          v-if="group.configs.length"
          class="p-1.5 space-y-0.5"
        >
          <div
            v-for="config in group.configs"
            :key="config.id"
            class="flex items-center gap-2 px-2.5 py-2 rounded-md transition-colors hover:bg-(--ui-bg-muted)/50"
          >
            <div
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="
                config.enabled ? 'bg-emerald-500' : 'bg-(--ui-text-dimmed)/30'
              "
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span
                  class="text-[12px] font-semibold text-(--ui-text) truncate"
                  >{{ config.name }}</span
                >
                <span
                  v-if="config.isDefault"
                  class="text-[9px] px-1 py-0.5 rounded bg-primary-500/10 text-primary-600 font-bold"
                  >默认</span
                >
              </div>
              <p class="text-[10px] text-(--ui-text-dimmed) truncate">
                {{ config.model }} · {{ config.maskedApiKey || '未保存密钥' }}
              </p>
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
              <button
                v-if="!config.isDefault"
                class="text-[10px] text-(--ui-text-dimmed) hover:text-(--ui-text) px-1.5 py-0.5 rounded hover:bg-(--ui-bg-muted) transition-colors"
                @click="setDefault(config)"
              >
                默认
              </button>
              <button
                class="flex items-center justify-center w-5 h-5 rounded text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
                @click="startEdit(config)"
              >
                <Icon
                  icon="lucide:pencil"
                  class="w-3 h-3"
                />
              </button>
              <button
                class="flex items-center justify-center w-5 h-5 rounded text-(--ui-text-dimmed) hover:text-red-500 hover:bg-red-500/5 transition-colors"
                :disabled="deletingId === config.id"
                @click="deleteConfig(config)"
              >
                <Icon
                  icon="lucide:trash-2"
                  class="w-3 h-3"
                />
              </button>
            </div>
          </div>
        </div>
        <div
          v-else
          class="px-3 py-4 text-center"
        >
          <p class="text-[11px] text-(--ui-text-dimmed)">暂无配置</p>
        </div>
      </section>
    </div>

    <!-- Create/Edit Modal -->
    <NModal
      v-model:show="showForm"
      preset="card"
      :title="editingId ? '编辑模型配置' : '新增模型配置'"
      style="max-width: 520px"
    >
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <NFormItem
            label="配置名称"
            required
          >
            <NInput
              v-model:value="form.name"
              placeholder="例如：GPT-4o"
              size="small"
            />
          </NFormItem>
          <NFormItem
            label="用途"
            required
          >
            <NSelect
              v-model:value="form.purpose"
              :options="purposeOptions"
              size="small"
            />
          </NFormItem>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <NFormItem
            :label="t('ai.apiUrl')"
            required
          >
            <NInput
              v-model:value="form.apiUrl"
              placeholder="https://api.openai.com/v1/chat/completions"
              size="small"
            />
          </NFormItem>
          <NFormItem
            :label="t('ai.model')"
            required
          >
            <NInput
              v-model:value="form.model"
              placeholder="gpt-4o"
              size="small"
            />
          </NFormItem>
        </div>
        <NFormItem
          :label="t('ai.apiKey')"
          :required="!editingId"
        >
          <NInput
            v-model:value="form.apiKey"
            type="password"
            show-password-on="click"
            :placeholder="editingId ? '留空则不修改' : 'sk-...'"
            size="small"
          />
        </NFormItem>
        <div class="grid gap-4 sm:grid-cols-2">
          <NFormItem :label="t('ai.temperature')">
            <NInput
              v-model:value="form.temperature"
              placeholder="0.7"
              size="small"
            />
          </NFormItem>
          <NFormItem :label="t('ai.maxTokens')">
            <NInputNumber
              v-model:value="form.maxTokens"
              placeholder="4096"
              :show-button="false"
              size="small"
            />
          </NFormItem>
        </div>
        <div class="flex items-center gap-4">
          <NCheckbox
            v-model:checked="form.isDefault"
            label="设为默认"
          />
          <NCheckbox
            v-model:checked="form.enabled"
            label="启用"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton
            size="small"
            @click="showForm = false"
            >取消</NButton
          >
          <NButton
            size="small"
            type="primary"
            :loading="saving"
            @click="saveConfig"
            >保存</NButton
          >
        </div>
      </template>
    </NModal>
  </div>
</template>
