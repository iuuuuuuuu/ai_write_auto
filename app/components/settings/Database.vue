<script setup lang="ts">
const { t } = useI18n()

const exporting = ref(false)

async function exportDatabase() {
  exporting.value = true
  try {
    const response = await fetch('/api/settings/export-db')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `novel-db-backup-${new Date().toISOString().split('T')[0]}.db`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-800 space-y-4">
      <h3 class="font-medium text-gray-900 dark:text-white">{{ t('settings.database') }}</h3>

      <div class="flex gap-3">
        <UButton variant="soft" icon="i-lucide-download" :loading="exporting" @click="exportDatabase">
          {{ t('settings.exportDb') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
