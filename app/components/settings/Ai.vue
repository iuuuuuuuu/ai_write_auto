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

const { t } = useI18n()
const message = useMessage()

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
        type="primary"
        @click="startCreate()"
      >
        <template #icon><Icon icon="lucide:plus" /></template>
        新增
      </NButton>
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
