<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <SettingsPageShell
    title="数据库与备份"
    description="管理数据库导出、备份策略和迁移状态。"
    icon="lucide:database"
  >
    <SettingsDatabase />
  </SettingsPageShell>
</template>
