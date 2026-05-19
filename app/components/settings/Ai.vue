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

const { data: configs, refresh } = await useFetch<AiConfigItem[]>(
  '/api/ai/config',
  { default: () => [] }
)

const editingId = ref<number | null>(null)
const showForm = ref(false)
const saving = ref(false)
const deletingId = ref<number | null>(null)
const formError = ref('')

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
    configs: configs.value.filter((config) => config.purpose === purpose.value)
  }))
)

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
  formError.value = ''
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
  formError.value = ''
  showForm.value = true
}

function validateForm() {
  if (!form.name.trim()) return '请输入配置名称'
  if (!form.apiUrl.trim()) return '请输入 API 地址'
  if (!form.model.trim()) return '请输入模型名称'
  if (!editingId.value && !form.apiKey.trim()) return '请输入 API 密钥'
  if (!form.temperature.trim()) return '请输入 Temperature'
  if (!form.maxTokens || form.maxTokens <= 0) return '请输入有效的最大 Token 数'
  return ''
}

async function saveConfig() {
  const errorMessage = validateForm()
  if (errorMessage) {
    formError.value = errorMessage
    message.error(errorMessage)
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
    message.success(editingId.value ? '模型配置已更新' : '模型配置已创建')
    showForm.value = false
    await refresh()
  } catch (error) {
    const msg = error instanceof Error ? error.message : '保存模型配置失败'
    message.error(msg)
  } finally {
    saving.value = false
  }
}

async function setDefault(config: AiConfigItem) {
  saving.value = true
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : '更新默认模型失败'
    message.error(msg)
  } finally {
    saving.value = false
  }
}

async function deleteConfig(config: AiConfigItem) {
  deletingId.value = config.id
  try {
    await $fetch('/api/ai/config', {
      method: 'DELETE',
      query: { id: config.id }
    })
    message.success('模型配置已删除')
    await refresh()
  } catch (error) {
    const msg = error instanceof Error ? error.message : '删除模型配置失败'
    message.error(msg)
  } finally {
    deletingId.value = null
  }
}

function getDropdownOptions(config: AiConfigItem) {
  return [
    { label: '编辑', key: 'edit', icon: 'lucide:pencil' },
    { label: '设为默认', key: 'default', icon: 'lucide:star', disabled: config.isDefault },
    { label: '删除', key: 'delete', icon: 'lucide:trash-2' }
  ]
}

function handleDropdownSelect(key: string, config: AiConfigItem) {
  if (key === 'edit') startEdit(config)
  else if (key === 'default') setDefault(config)
  else if (key === 'delete') deleteConfig(config)
}
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
          {{ t('ai.config') }}
        </h2>
        <p class="mt-1 text-sm text-(--ui-text-muted)">
          每个用户独立维护自己的模型配置，生成时可选择启用的内容生成模型。
        </p>
      </div>
      <NButton type="primary" @click="startCreate()">
        <template #icon>
          <Icon icon="lucide:plus" />
        </template>
        新增模型
      </NButton>
    </div>

    <NAlert
      v-if="formError"
      type="error"
      :title="formError"
    />

    <!-- Form -->
    <div
      v-if="showForm"
      class="rounded-xl border border-(--ui-border) bg-(--ui-bg-muted) p-5"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <NFormItem label="配置名称" required>
          <NInput v-model:value="form.name" placeholder="例如：OpenAI 主力模型" />
        </NFormItem>
        <NFormItem label="用途" required>
          <NSelect v-model:value="form.purpose" :options="purposeOptions" />
        </NFormItem>
        <NFormItem :label="t('ai.apiUrl')" required>
          <NInput v-model:value="form.apiUrl" placeholder="https://api.openai.com/v1/chat/completions" />
        </NFormItem>
        <NFormItem :label="t('ai.model')" required>
          <NInput v-model:value="form.model" placeholder="gpt-4o" />
        </NFormItem>
        <NFormItem :label="t('ai.apiKey')" :required="!editingId">
          <NInput v-model:value="form.apiKey" type="password" show-password-on="click" :placeholder="editingId ? '留空则不修改密钥' : 'sk-...'" />
        </NFormItem>
        <div class="grid grid-cols-2 gap-3">
          <NFormItem :label="t('ai.temperature')" required>
            <NInput v-model:value="form.temperature" placeholder="0.7" />
          </NFormItem>
          <NFormItem :label="t('ai.maxTokens')" required>
            <NInputNumber v-model:value="form.maxTokens" placeholder="4096" :show-button="false" />
          </NFormItem>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-4">
        <NCheckbox v-model:checked="form.isDefault" label="设为该用途默认模型" />
        <NCheckbox v-model:checked="form.enabled" label="启用此配置" />
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <NButton @click="showForm = false">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="saving" @click="saveConfig">{{ t('common.save') }}</NButton>
      </div>
    </div>

    <!-- Config List -->
    <div class="space-y-5">
      <section
        v-for="group in groupedConfigs"
        :key="group.value"
        class="rounded-xl border border-(--ui-border) bg-(--ui-bg-muted) p-5"
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 class="font-medium text-(--ui-text-highlighted)">
              {{ group.label }}
            </h3>
            <p class="mt-1 text-sm text-(--ui-text-muted)">
              {{ group.configs.length }} 个模型配置
            </p>
          </div>
          <NButton size="small" secondary @click="startCreate(group.value as AiPurpose)">
            <template #icon>
              <Icon icon="lucide:plus" />
            </template>
            添加
          </NButton>
        </div>

        <div
          v-if="group.configs.length"
          class="grid gap-3 lg:grid-cols-2"
        >
          <article
            v-for="config in group.configs"
            :key="config.id"
            class="rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="truncate font-medium text-(--ui-text-highlighted)">
                    {{ config.name }}
                  </h4>
                  <NTag v-if="config.isDefault" type="info" size="small">默认</NTag>
                  <NTag :type="config.enabled ? 'success' : 'default'" size="small">
                    {{ config.enabled ? '启用' : '停用' }}
                  </NTag>
                </div>
                <p class="mt-1 truncate text-sm text-(--ui-text-muted)">
                  {{ config.model }}
                </p>
                <p class="mt-1 truncate text-xs text-(--ui-text-dimmed)">
                  {{ config.maskedApiKey || '未保存密钥' }}
                </p>
              </div>
              <NDropdown
                :options="getDropdownOptions(config)"
                @select="(key: string) => handleDropdownSelect(key, config)"
              >
                <NButton quaternary :loading="deletingId === config.id">
                  <template #icon>
                    <Icon icon="lucide:more-horizontal" />
                  </template>
                </NButton>
              </NDropdown>
            </div>
          </article>
        </div>

        <div
          v-else
          class="rounded-lg border border-dashed border-(--ui-border) px-4 py-8 text-center"
        >
          <p class="text-sm text-(--ui-text-muted)">暂无该用途模型配置</p>
        </div>
      </section>
    </div>
  </div>
</template>
