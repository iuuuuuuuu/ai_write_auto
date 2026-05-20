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
  <div class="space-y-4">
    <div class="card-surface p-3 space-y-3">
      <h3 class="text-sm font-bold text-(--ui-text-highlighted)">
        {{ t('settings.database') }}
      </h3>

      <div class="flex gap-3">
        <NButton
          secondary
          :loading="exporting"
          @click="exportDatabase"
        >
          <template #icon>
            <Icon icon="lucide:download" />
          </template>
          {{ t('settings.exportDb') }}
        </NButton>
      </div>
    </div>
  </div>
</template>
