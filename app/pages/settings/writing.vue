<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <SettingsPageShell
    title="写作目标"
    description="设置每日和单章目标，用于仪表盘与编辑器进度追踪。"
    icon="lucide:target"
  >
    <SettingsWritingGoals />
  </SettingsPageShell>
</template>
