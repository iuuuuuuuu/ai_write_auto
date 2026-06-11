<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <SettingsPageShell
    title="通用偏好"
    description="管理语言、主题和账号会话相关偏好。"
    icon="lucide:sliders-horizontal"
  >
    <SettingsGeneral />
  </SettingsPageShell>
</template>
