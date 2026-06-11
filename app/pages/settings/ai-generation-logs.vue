<script setup lang="ts">
definePageMeta({ layout: 'default' })

await navigateTo('/settings/usage', { replace: true })
</script>

<template>
  <SettingsPageShell
    title="AI 用量与调用记录"
    description="正在跳转到合并后的用量与调用记录页面。"
    icon="lucide:activity"
  >
    <div class="card-glass p-5 text-sm text-(--ui-text-muted)">
      正在跳转到 AI 用量与调用记录...
    </div>
  </SettingsPageShell>
</template>
