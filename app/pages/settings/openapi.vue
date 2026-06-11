<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <SettingsPageShell
    title="Open API"
    description="管理访问令牌并查看接口规范。"
    icon="lucide:key-round"
  >
    <SettingsOpenApi />
  </SettingsPageShell>
</template>
