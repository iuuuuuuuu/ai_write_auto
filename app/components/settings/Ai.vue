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
const toast = useToast()

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
    toast.add({ title: errorMessage, color: 'error' })
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
    toast.add({
      title: editingId.value ? '模型配置已更新' : '模型配置已创建',
      color: 'success'
    })
    showForm.value = false
    await refresh()
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存模型配置失败'
    toast.add({ title: message, color: 'error' })
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
    toast.add({ title: '默认模型已更新', color: 'success' })
    await refresh()
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新默认模型失败'
    toast.add({ title: message, color: 'error' })
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
    toast.add({ title: '模型配置已删除', color: 'success' })
    await refresh()
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除模型配置失败'
    toast.add({ title: message, color: 'error' })
  } finally {
    deletingId.value = null
  }
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
      <UButton
        icon="i-lucide-plus"
        @click="startCreate()"
        >新增模型</UButton
      >
    </div>

    <UAlert
      v-if="formError"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="formError"
    />

    <div
      v-if="showForm"
      class="rounded-xl border border-(--ui-border) bg-(--ui-bg-muted) p-5"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <UFormField
          label="配置名称"
          required
        >
          <UInput
            v-model="form.name"
            placeholder="例如：OpenAI 主力模型"
          />
        </UFormField>
        <UFormField
          label="用途"
          required
        >
          <USelectMenu
            v-model="form.purpose"
            :items="purposeOptions"
            value-key="value"
          />
        </UFormField>
        <UFormField
          :label="t('ai.apiUrl')"
          required
        >
          <UInput
            v-model="form.apiUrl"
            placeholder="https://api.openai.com/v1/chat/completions"
          />
        </UFormField>
        <UFormField
          :label="t('ai.model')"
          required
        >
          <UInput
            v-model="form.model"
            placeholder="gpt-4o"
          />
        </UFormField>
        <UFormField
          :label="t('ai.apiKey')"
          :required="!editingId"
        >
          <UInput
            v-model="form.apiKey"
            type="password"
            :placeholder="editingId ? '留空则不修改密钥' : 'sk-...'"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField
            :label="t('ai.temperature')"
            required
          >
            <UInput
              v-model="form.temperature"
              placeholder="0.7"
            />
          </UFormField>
          <UFormField
            :label="t('ai.maxTokens')"
            required
          >
            <UInput
              v-model.number="form.maxTokens"
              type="number"
              placeholder="4096"
            />
          </UFormField>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-4">
        <UCheckbox
          v-model="form.isDefault"
          label="设为该用途默认模型"
        />
        <UCheckbox
          v-model="form.enabled"
          label="启用此配置"
        />
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          @click="showForm = false"
          >{{ t('common.cancel') }}</UButton
        >
        <UButton
          :loading="saving"
          @click="saveConfig"
          >{{ t('common.save') }}</UButton
        >
      </div>
    </div>

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
          <UButton
            size="sm"
            variant="soft"
            icon="i-lucide-plus"
            @click="startCreate(group.value as AiPurpose)"
          >
            添加
          </UButton>
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
                  <UBadge
                    v-if="config.isDefault"
                    color="primary"
                    variant="subtle"
                    size="xs"
                    >默认</UBadge
                  >
                  <UBadge
                    :color="config.enabled ? 'success' : 'neutral'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ config.enabled ? '启用' : '停用' }}
                  </UBadge>
                </div>
                <p class="mt-1 truncate text-sm text-(--ui-text-muted)">
                  {{ config.model }}
                </p>
                <p class="mt-1 truncate text-xs text-(--ui-text-dimmed)">
                  {{ config.maskedApiKey || '未保存密钥' }}
                </p>
              </div>
              <UDropdownMenu
                :items="[
                  [
                    {
                      label: '编辑',
                      icon: 'i-lucide-pencil',
                      onSelect: () => startEdit(config)
                    }
                  ],
                  [
                    {
                      label: '设为默认',
                      icon: 'i-lucide-star',
                      disabled: config.isDefault,
                      onSelect: () => setDefault(config)
                    }
                  ],
                  [
                    {
                      label: '删除',
                      icon: 'i-lucide-trash-2',
                      color: 'error',
                      onSelect: () => deleteConfig(config)
                    }
                  ]
                ]"
              >
                <UButton
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-more-horizontal"
                  :loading="deletingId === config.id"
                />
              </UDropdownMenu>
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
