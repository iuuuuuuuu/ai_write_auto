<script setup lang="ts">
const { t } = useI18n()
const { user } = useAuth()

const colorMode = useColorMode()
const { locale, locales, setLocale } = useI18n()

const darkModeOptions = [
  { label: '跟随系统', value: 'system' },
  { label: '亮色', value: 'light' },
  { label: '暗色', value: 'dark' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-800 space-y-4">
      <h3 class="font-medium text-gray-900 dark:text-white">{{ t('settings.appearance') }}</h3>

      <UFormField :label="t('settings.darkMode')">
        <URadioGroup
          :model-value="colorMode.preference"
          :items="darkModeOptions.map(o => ({ label: o.label, value: o.value }))"
          @update:model-value="colorMode.preference = $event"
        />
      </UFormField>

      <UFormField :label="t('settings.language')">
        <URadioGroup
          :model-value="locale"
          :items="(locales as any[]).map((l: any) => ({ label: l.name, value: l.code }))"
          @update:model-value="setLocale($event)"
        />
      </UFormField>
    </div>
  </div>
</template>
