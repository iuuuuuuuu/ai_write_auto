<script setup lang="ts">
definePageMeta({ layout: 'default' })

const days = shallowRef('30')
const daysOptions = [
  { label: '最近 7 天', value: '7' },
  { label: '最近 30 天', value: '30' },
  { label: '最近 90 天', value: '90' }
]
</script>

<template>
  <SettingsPageShell
    eyebrow="Settings / AI Usage"
    title="AI 用量与调用记录"
    description="查看 token 趋势、费用估算、成本费率和每次模型调用明细。"
    icon="lucide:activity"
  >
    <div class="space-y-5">
      <section class="card-glass p-4 sm:p-5">
        <div
          class="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <h2 class="text-base font-semibold text-(--ui-text-highlighted)">
              用量趋势
            </h2>
            <p class="mt-1 text-sm text-(--ui-text-muted)">
              基于历史 token 用量聚合，用于观察趋势和估算费用。
            </p>
          </div>
          <NSelect
            v-model:value="days"
            :options="daysOptions"
            size="small"
            style="width: 130px"
          />
        </div>
        <SettingsUsage :days="Number(days)" />
      </section>

      <section class="card-glass p-4 sm:p-5">
        <SettingsAiGenerationLogTable :days="days" />
      </section>
    </div>
  </SettingsPageShell>
</template>
