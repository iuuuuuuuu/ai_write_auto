<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <SettingsPageShell
    title="写作技能"
    description="维护 AI 写作技能、提示策略和可用能力。"
    icon="lucide:sparkles"
  >
    <SettingsWritingSkills />
  </SettingsPageShell>
</template>
