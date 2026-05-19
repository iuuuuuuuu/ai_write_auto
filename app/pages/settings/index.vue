<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()

const tabs = [
  { label: t('settings.aiConfig'), value: 'ai', icon: 'i-lucide-brain' },
  { label: t('settings.general'), value: 'general', icon: 'i-lucide-settings' },
  { label: t('settings.database'), value: 'database', icon: 'i-lucide-database' },
  { label: t('settings.usage'), value: 'usage', icon: 'i-lucide-bar-chart-2' },
]

const activeTab = ref('ai')
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex items-center gap-4 mb-8">
      <UButton variant="ghost" icon="i-lucide-arrow-left" to="/dashboard" />
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('settings.title') }}
      </h1>
    </div>

    <div class="flex gap-2 mb-6">
      <UButton
        v-for="tab in tabs"
        :key="tab.value"
        :variant="activeTab === tab.value ? 'solid' : 'ghost'"
        :icon="tab.icon"
        size="sm"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </UButton>
    </div>

    <SettingsAi v-if="activeTab === 'ai'" />
    <SettingsGeneral v-else-if="activeTab === 'general'" />
    <SettingsDatabase v-else-if="activeTab === 'database'" />
    <SettingsUsage v-else-if="activeTab === 'usage'" />
  </div>
</template>
