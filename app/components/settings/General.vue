<script setup lang="ts">
const { t } = useI18n()
const { user } = useAuth()

const { colorModePreference } = useNaiveColorMode()
const { locale, locales, setLocale } = useI18n()

const darkModeOptions = [
  { label: '跟随系统', value: 'system' },
  { label: '亮色', value: 'light' },
  { label: '暗色', value: 'dark' }
]

const languageOptions = computed(() =>
  (locales.value as any[]).map((l: any) => ({ label: l.name, value: l.code }))
)
</script>

<template>
  <div class="space-y-4">
    <div class="card-surface p-3 space-y-3">
      <h3 class="text-sm font-bold text-(--ui-text-highlighted)">
        {{ t('settings.appearance') }}
      </h3>

      <NFormItem :label="t('settings.darkMode')">
        <NRadioGroup
          :value="colorModePreference.get()"
          @update:value="colorModePreference.set($event)"
        >
          <NRadio
            v-for="option in darkModeOptions"
            :key="option.value"
            :value="option.value"
            :label="option.label"
          />
        </NRadioGroup>
      </NFormItem>

      <NFormItem :label="t('settings.language')">
        <NRadioGroup
          :value="locale"
          @update:value="setLocale($event)"
        >
          <NRadio
            v-for="option in languageOptions"
            :key="option.value"
            :value="option.value"
            :label="option.label"
          />
        </NRadioGroup>
      </NFormItem>
    </div>
  </div>
</template>
