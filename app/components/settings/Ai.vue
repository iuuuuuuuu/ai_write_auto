<script setup lang="ts">
const { t } = useI18n()

const purposes = ['generation', 'extraction', 'consistency_check', 'style_analysis'] as const
const { data: configs, refresh } = await useFetch('/api/ai/config')

const editing = ref<string | null>(null)
const form = reactive({
  purpose: '' as string,
  apiUrl: '',
  apiKey: '',
  model: '',
  temperature: '0.7',
  maxTokens: 4096,
})
const saving = ref(false)

function startEdit(purpose: string) {
  const existing = (configs.value as any[])?.find((c: any) => c.purpose === purpose)
  editing.value = purpose
  form.purpose = purpose
  form.apiUrl = existing?.apiUrl || 'https://api.openai.com/v1/chat/completions'
  form.apiKey = existing?.apiKey || ''
  form.model = existing?.model || 'gpt-4o'
  form.temperature = existing?.temperature || '0.7'
  form.maxTokens = existing?.maxTokens || 4096
}

async function saveConfig() {
  saving.value = true
  try {
    await $fetch('/api/ai/config', {
      method: 'POST',
      body: { ...form },
    })
    editing.value = null
    await refresh()
  } finally {
    saving.value = false
  }
}

function getConfigForPurpose(purpose: string) {
  return (configs.value as any[])?.find((c: any) => c.purpose === purpose)
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('ai.config') }}
    </p>

    <div class="space-y-4">
      <div
        v-for="purpose in purposes"
        :key="purpose"
        class="p-4 rounded-lg border border-gray-200 dark:border-gray-800"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-900 dark:text-white">
              {{ t(`ai.purpose.${purpose === 'consistency_check' ? 'consistencyCheck' : purpose === 'style_analysis' ? 'styleAnalysis' : purpose}`) }}
            </p>
            <p v-if="getConfigForPurpose(purpose)" class="text-xs text-gray-400 mt-0.5">
              {{ getConfigForPurpose(purpose).model }}
            </p>
          </div>
          <UButton size="sm" variant="ghost" @click="startEdit(purpose)">
            {{ getConfigForPurpose(purpose) ? t('common.edit') : t('common.create') }}
          </UButton>
        </div>

        <div v-if="editing === purpose" class="mt-4 space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <UFormField :label="t('ai.apiUrl')">
            <UInput v-model="form.apiUrl" placeholder="https://api.openai.com/v1/chat/completions" />
          </UFormField>
          <UFormField :label="t('ai.apiKey')">
            <UInput v-model="form.apiKey" type="password" placeholder="sk-..." />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="t('ai.model')">
              <UInput v-model="form.model" placeholder="gpt-4o" />
            </UFormField>
            <UFormField :label="t('ai.temperature')">
              <UInput v-model="form.temperature" placeholder="0.7" />
            </UFormField>
          </div>
          <UFormField :label="t('ai.maxTokens')">
            <UInput v-model.number="form.maxTokens" type="number" placeholder="4096" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" size="sm" @click="editing = null">{{ t('common.cancel') }}</UButton>
            <UButton size="sm" :loading="saving" @click="saveConfig">{{ t('common.save') }}</UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
