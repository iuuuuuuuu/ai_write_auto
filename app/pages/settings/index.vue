<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()

const tabs = [
  { label: t('settings.aiConfig'), value: 'ai', icon: 'lucide:brain' },
  { label: t('settings.general'), value: 'general', icon: 'lucide:settings' },
  { label: t('settings.database'), value: 'database', icon: 'lucide:database' },
  { label: t('settings.usage'), value: 'usage', icon: 'lucide:bar-chart-2' }
]

const activeTab = ref('ai')
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <!-- Header -->
    <div class="flex items-center gap-2.5 mb-6">
      <button
        class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
        @click="navigateTo('/dashboard')"
      >
        <Icon icon="lucide:arrow-left" class="w-4 h-4" />
      </button>
      <h1 class="text-lg font-semibold text-(--ui-text-highlighted)">
        {{ t('settings.title') }}
      </h1>
    </div>

    <!-- Tab Navigation -->
    <div class="flex items-center gap-1 p-1 rounded-lg bg-(--ui-bg-muted)/50 border border-(--ui-border)/40 w-fit mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
        :class="activeTab === tab.value
          ? 'bg-(--ui-bg-elevated) text-(--ui-text-highlighted) shadow-sm'
          : 'text-(--ui-text-muted) hover:text-(--ui-text)'"
        @click="activeTab = tab.value"
      >
        <Icon :icon="tab.icon" class="w-3.5 h-3.5" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Content -->
    <SettingsAi v-show="activeTab === 'ai'" />
    <SettingsGeneral v-show="activeTab === 'general'" />
    <SettingsDatabase v-show="activeTab === 'database'" />
    <SettingsUsage v-show="activeTab === 'usage'" />
  </div>
</template>
