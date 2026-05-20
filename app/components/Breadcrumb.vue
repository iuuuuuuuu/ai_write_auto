<script setup lang="ts">
const route = useRoute()

interface BreadcrumbItem {
  label: string
  to?: string
}

const labelMap: Record<string, string> = {
  admin: '管理端',
  users: '用户',
  novels: '小说',
  'ai-configs': '模型配置',
  tasks: '生成任务',
  'token-usage': 'Token 用量',
  'writing-stats': '写作统计',
  prompts: '提示词模板',
  templates: '小说模板',
  settings: '设置',
  chapters: '章节',
  dashboard: '首页',
}

const items = computed<BreadcrumbItem[]>(() => {
  const parts = route.path.split('/').filter(Boolean)
  const crumbs: BreadcrumbItem[] = []
  let path = ''
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    path += '/' + part
    const isLast = i === parts.length - 1
    if (/^\d+$/.test(part)) continue
    crumbs.push({ label: labelMap[part] || part, to: isLast ? undefined : path })
  }
  return crumbs
})
</script>

<template>
  <nav v-if="items.length > 1" class="flex items-center gap-1 text-xs mb-2">
    <template v-for="(item, i) in items" :key="i">
      <span v-if="i > 0" class="text-(--ui-text-dimmed) opacity-40">/</span>
      <NuxtLink
        v-if="item.to"
        :to="item.to"
        class="text-(--ui-text-dimmed) hover:text-(--ui-text) transition-colors"
      >
        {{ item.label }}
      </NuxtLink>
      <span v-else class="text-(--ui-text) font-medium">{{ item.label }}</span>
    </template>
  </nav>
</template>