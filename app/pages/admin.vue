<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { isAdmin } = useAuth()

if (!isAdmin.value) {
  navigateTo('/dashboard')
}

const { data: siteConfig, refresh } = await useFetch('/api/settings/site')
const saving = ref(false)

const allowRegistration = computed({
  get: () => (siteConfig.value as any)?.allow_registration === 'true',
  set: () => {},
})

async function toggleRegistration() {
  saving.value = true
  try {
    await $fetch('/api/settings/site', {
      method: 'PUT',
      body: { allow_registration: allowRegistration.value ? 'false' : 'true' },
    })
    await refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-8">
      {{ t('common.admin') }}
    </h1>

    <div class="space-y-6">
      <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-800">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-900 dark:text-white">开放注册</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">允许新用户自行注册账号</p>
          </div>
          <UButton
            :variant="allowRegistration ? 'solid' : 'outline'"
            size="sm"
            :loading="saving"
            @click="toggleRegistration"
          >
            {{ allowRegistration ? '已开启' : '已关闭' }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
