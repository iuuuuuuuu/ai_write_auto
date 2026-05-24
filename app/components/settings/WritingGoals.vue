<script setup lang="ts">
const message = useMessage()
const { put } = useApi()

const { data: prefs, refresh } = await useFetch<Record<string, string>>('/api/settings/preferences', {
  default: () => ({})
})

const dailyGoal = shallowRef(2000)
const chapterGoal = shallowRef(3000)
const saving = shallowRef(false)

watch(
  () => prefs.value,
  (value) => {
    dailyGoal.value = Number(value.writing_daily_goal || 2000)
    chapterGoal.value = Number(value.writing_chapter_goal || 3000)
  },
  { immediate: true }
)

async function savePreference(key: string, value: number) {
  await put('/api/settings/preferences', { key, value: String(value) }, { silent: true })
}

async function saveGoals() {
  saving.value = true
  try {
    await Promise.all([
      savePreference('writing_daily_goal', dailyGoal.value),
      savePreference('writing_chapter_goal', chapterGoal.value)
    ])
    message.success('写作目标已保存')
    await refresh()
  } catch {
    message.error('保存写作目标失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="card-glass p-4 space-y-4">
    <div>
      <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">写作目标</h3>
      <p class="mt-1 text-xs text-(--ui-text-dimmed)">
        设置每日和单章目标，用于仪表盘与编辑器进度追踪。
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <NFormItem label="每日目标字数">
        <NInputNumber
          v-model:value="dailyGoal"
          :min="0"
          :max="200000"
          :step="500"
          class="w-full"
        />
      </NFormItem>
      <NFormItem label="每章目标字数">
        <NInputNumber
          v-model:value="chapterGoal"
          :min="0"
          :max="200000"
          :step="500"
          class="w-full"
        />
      </NFormItem>
    </div>

    <div class="flex justify-end">
      <NButton
        size="small"
        type="primary"
        :loading="saving"
        @click="saveGoals"
      >
        保存目标
      </NButton>
    </div>
  </div>
</template>
