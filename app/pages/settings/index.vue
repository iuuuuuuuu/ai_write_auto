<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()

const tabs = [
  { label: t('settings.aiConfig'), value: 'ai', icon: 'lucide:brain' },
  { label: t('settings.general'), value: 'general', icon: 'lucide:settings' },
  {
    label: t('settings.database'),
    value: 'database',
    icon: 'lucide:database'
  },
  { label: t('settings.usage'), value: 'usage', icon: 'lucide:bar-chart-2' }
]

const activeTab = ref('ai')
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8 flex items-center gap-4">
      <NButton
        quaternary
        @click="navigateTo('/dashboard')"
      >
        <template #icon>
          <Icon icon="lucide:arrow-left" />
        </template>
      </NButton>
      <div>
        <p class="text-sm text-(--ui-text-muted)">{{ t('common.appName') }}</p>
        <h1 class="mt-1 text-2xl font-semibold text-(--ui-text-highlighted)">
          {{ t('settings.title') }}
        </h1>
      </div>
    </div>

    <div class="mb-6 flex flex-wrap gap-2">
      <NButton
        v-for="tab in tabs"
        :key="tab.value"
        :type="activeTab === tab.value ? 'primary' : 'default'"
        :quaternary="activeTab !== tab.value"
        size="small"
        @click="activeTab = tab.value"
      >
        <template #icon>
          <Icon :icon="tab.icon" />
        </template>
        {{ tab.label }}
      </NButton>
    </div>

    <SettingsAi v-show="activeTab === 'ai'" />
    <SettingsGeneral v-show="activeTab === 'general'" />
    <SettingsDatabase v-show="activeTab === 'database'" />
    <SettingsUsage v-show="activeTab === 'usage'" />
  </div>
</template>
