<script setup lang="ts">
interface AiModelItem {
  id: number
  name: string
  model: string
  maxTokens: number
  enabled: boolean
}

interface AiConfigItem {
  id: number
  purpose: string
  temperature: string | null
  isDefault: boolean
  enabled: boolean
  aiModel: AiModelItem
}

type AiPurpose = 'generation' | 'extraction' | 'consistency_check' | 'style_analysis' | 'planning'

const { t } = useI18n()
const message = useMessage()
const { post, del: apiDel } = useApi()

const purposeOptions = computed(() => [
  { label: t('ai.purpose.generation'), value: 'generation' },
  { label: t('ai.purpose.extraction'), value: 'extraction' },
  { label: t('ai.purpose.consistencyCheck'), value: 'consistency_check' },
  { label: t('ai.purpose.styleAnalysis'), value: 'style_analysis' },
  { label: t('ai.purpose.planning'), value: 'planning' }
])

const purposeIcons: Record<string, string> = {
  generation: 'lucide:wand-sparkles',
  extraction: 'lucide:scan-text',
  consistency_check: 'lucide:shield-check',
  style_analysis: 'lucide:palette',
  planning: 'lucide:list-search'
}

const { data: models } = await useFetch<AiModelItem[]>('/api/ai/models', { default: () => [] })
const { data: configs, refresh: refreshConfigs } = await useFetch<AiConfigItem[]>('/api/ai/config', { default: () => [] })

const showConfigForm = ref(false)
const savingConfig = ref(false)
const configForm = reactive({
  id: undefined as number | undefined,
  aiModelId: null as number | null,
  purpose: 'generation' as AiPurpose,
  temperature: '0.7',
  isDefault: false,
  enabled: true
})

const enabledModelOptions = computed(() =>
  (models.value || []).filter(m => m.enabled).map(m => ({ label: `${m.name} (${m.model})`, value: m.id }))
)

const groupedConfigs = computed(() =>
  purposeOptions.value.map(purpose => ({
    ...purpose,
    icon: purposeIcons[purpose.value],
    configs: (configs.value || []).filter(c => c.purpose === purpose.value)
  }))
)

// Connectivity
const checkingConnectivity = ref(false)
const connectivityStatus = ref<{ available: boolean; checkedAt: string; reason: string | null } | null>(null)

async function checkConnectivity(showSuccess = true) {
  checkingConnectivity.value = true
  try {
    const result = await $fetch<{ available: boolean; checkedAt: string; checkedConnectivity: boolean; reason: string | null }>('/api/ai/status', { params: { check: true } })
    connectivityStatus.value = result
    if (result.available) {
      if (showSuccess) message.success('AI 连通性检测通过')
    } else {
      message.error(result.reason || 'AI 当前不可用')
    }
  } catch {
    connectivityStatus.value = { available: false, checkedAt: new Date().toISOString(), reason: 'AI 连通性检测失败' }
    message.error('AI 连通性检测失败')
  } finally {
    checkingConnectivity.value = false
  }
}

function startCreateConfig(purpose: AiPurpose = 'generation') {
  configForm.id = undefined
  configForm.aiModelId = null
  configForm.purpose = purpose
  configForm.temperature = '0.7'
  configForm.isDefault = (configs.value || []).filter(c => c.purpose === purpose).length === 0
  configForm.enabled = true
  showConfigForm.value = true
}

function startEditConfig(config: AiConfigItem) {
  configForm.id = config.id
  configForm.aiModelId = config.aiModel?.id ?? null
  configForm.purpose = config.purpose as AiPurpose
  configForm.temperature = config.temperature || '0.7'
  configForm.isDefault = config.isDefault
  configForm.enabled = config.enabled
  showConfigForm.value = true
}

async function saveConfig() {
  if (!configForm.aiModelId) {
    message.error('请选择一个模型')
    return
  }
  savingConfig.value = true
  try {
    await post('/api/ai/config', {
      id: configForm.id,
      aiModelId: configForm.aiModelId,
      purpose: configForm.purpose,
      temperature: configForm.temperature?.trim() || '0.7',
      isDefault: configForm.isDefault,
      enabled: configForm.enabled
    }, { successMessage: configForm.id ? '配置已更新' : '配置已创建' })
    showConfigForm.value = false
    await refreshConfigs()
  } catch {
  } finally {
    savingConfig.value = false
  }
}

async function deleteConfig(config: AiConfigItem) {
  try {
    await apiDel('/api/ai/config', { query: { id: config.id }, successMessage: '配置已删除' })
    await refreshConfigs()
  } catch {}
}

async function setDefault(config: AiConfigItem) {
  try {
    await post('/api/ai/config', {
      id: config.id,
      aiModelId: config.aiModel.id,
      purpose: config.purpose,
      temperature: config.temperature || '0.7',
      isDefault: true,
      enabled: config.enabled
    }, { successMessage: '默认配置已更新' })
    await refreshConfigs()
  } catch {}
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-(--ui-text-highlighted)">{{ t('ai.config') }}</h2>
        <p class="mt-0.5 text-xs text-(--ui-text-dimmed)">为每个用途选择模型并调整参数</p>
      </div>
      <NButton size="small" secondary :loading="checkingConnectivity" @click="checkConnectivity()">
        <template #icon><Icon icon="lucide:wifi" /></template>
        检测连通性
      </NButton>
    </div>

    <NAlert v-if="connectivityStatus" :type="connectivityStatus.available ? 'success' : 'warning'" :title="connectivityStatus.available ? 'AI 连接可用' : 'AI 当前不可用'">
      {{ connectivityStatus.reason || '内容生成模型连通性正常。' }}
      <span class="ml-2 text-xs text-(--ui-text-dimmed)">{{ new Date(connectivityStatus.checkedAt).toLocaleString() }}</span>
    </NAlert>

    <NAlert v-if="enabledModelOptions.length === 0" type="warning" title="暂无可用模型">
      请先在<NuxtLink to="/models" class="text-primary-500 hover:underline mx-1">模型库</NuxtLink>中添加并启用模型
    </NAlert>

    <!-- Purpose Configs -->
    <div class="space-y-3">
      <section v-for="group in groupedConfigs" :key="group.value" class="card-surface overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 border-b border-(--ui-border)/40">
          <div class="flex items-center gap-2">
            <Icon :icon="group.icon" class="w-4 h-4 text-primary-500" />
            <span class="text-sm font-semibold text-(--ui-text)">{{ group.label }}</span>
            <span class="text-[10px] font-mono text-(--ui-text-dimmed)">{{ group.configs.length }}</span>
          </div>
          <button class="text-[11px] text-primary-600 hover:underline font-medium" @click="startCreateConfig(group.value as AiPurpose)">添加</button>
        </div>
        <div v-if="group.configs.length" class="p-1.5 space-y-0.5">
          <div v-for="config in group.configs" :key="config.id" class="flex items-center gap-2 px-2.5 py-2 rounded-md transition-colors hover:bg-(--ui-bg-muted)/50">
            <div class="w-1.5 h-1.5 rounded-full shrink-0" :class="config.enabled && config.aiModel?.enabled ? 'bg-emerald-500' : 'bg-(--ui-text-dimmed)/30'" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-[12px] font-semibold text-(--ui-text) truncate">{{ config.aiModel?.name || '未知模型' }}</span>
                <span v-if="config.isDefault" class="text-[9px] px-1 py-0.5 rounded bg-primary-500/10 text-primary-600 font-bold">默认</span>
                <span v-if="config.aiModel && !config.aiModel.enabled" class="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">模型已禁用</span>
              </div>
              <p class="text-[10px] text-(--ui-text-dimmed) truncate">{{ config.aiModel?.model }} · 温度 {{ config.temperature || '0.7' }}</p>
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
              <button v-if="!config.isDefault" class="text-[10px] text-(--ui-text-dimmed) hover:text-(--ui-text) px-1.5 py-0.5 rounded hover:bg-(--ui-bg-muted) transition-colors" @click="setDefault(config)">默认</button>
              <button class="flex items-center justify-center w-5 h-5 rounded text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors" @click="startEditConfig(config)">
                <Icon icon="lucide:pencil" class="w-3 h-3" />
              </button>
              <button class="flex items-center justify-center w-5 h-5 rounded text-(--ui-text-dimmed) hover:text-red-500 hover:bg-red-500/5 transition-colors" @click="deleteConfig(config)">
                <Icon icon="lucide:trash-2" class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        <div v-else class="px-3 py-4 text-center">
          <p class="text-[11px] text-(--ui-text-dimmed)">暂无配置</p>
        </div>
      </section>
    </div>

    <!-- Config Form Modal -->
    <NModal v-model:show="showConfigForm" preset="card" :title="configForm.id ? '编辑用途配置' : '新增用途配置'" style="max-width: 420px">
      <div class="space-y-4">
        <NFormItem label="选择模型" required>
          <NSelect v-model:value="configForm.aiModelId" :options="enabledModelOptions" placeholder="从模型库中选择" filterable />
        </NFormItem>
        <NFormItem label="用途" required>
          <NSelect v-model:value="configForm.purpose" :options="purposeOptions" />
        </NFormItem>
        <NFormItem :label="t('ai.temperature')">
          <NInput v-model:value="configForm.temperature" placeholder="0.7" size="small" />
        </NFormItem>
        <div class="flex items-center gap-4">
          <NCheckbox v-model:checked="configForm.isDefault" label="设为默认" />
          <NCheckbox v-model:checked="configForm.enabled" label="启用" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="showConfigForm = false">取消</NButton>
          <NButton size="small" type="primary" :loading="savingConfig" @click="saveConfig">保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
