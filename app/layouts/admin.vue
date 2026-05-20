<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { user, logout } = useAuth()
const sidebarOpen = ref(false)

const adminNavGroups = computed(() => [
  {
    title: '数据管理',
    items: [
      { label: '概览', icon: 'lucide:layout-dashboard', to: '/admin' },
      { label: '用户', icon: 'lucide:users', to: '/admin/users' },
      { label: '小说', icon: 'lucide:library', to: '/admin/novels' },
      { label: '模型配置', icon: 'lucide:cpu', to: '/admin/ai-configs' },
    ],
  },
  {
    title: '运营监控',
    items: [
      { label: '生成任务', icon: 'lucide:zap', to: '/admin/tasks' },
      { label: 'Token 用量', icon: 'lucide:coins', to: '/admin/token-usage' },
      { label: '写作统计', icon: 'lucide:bar-chart-3', to: '/admin/writing-stats' },
    ],
  },
  {
    title: '系统配置',
    items: [
      { label: '提示词模板', icon: 'lucide:message-square-text', to: '/admin/prompts' },
      { label: '小说模板', icon: 'lucide:file-text', to: '/admin/templates' },
      { label: '站点设置', icon: 'lucide:settings', to: '/admin/settings' },
    ],
  },
])

function isActiveNav(to: string) {
  return to === '/admin' ? route.path === to : route.path.startsWith(to)
}
</script>

<template>
  <div class="min-h-screen bg-(--ui-bg)">
    <!-- Top bar -->
    <header class="sticky top-0 z-40 border-b border-(--ui-border)/40"
            style="background: linear-gradient(180deg, var(--ui-bg) 0%, var(--ui-bg-muted) 100%); backdrop-filter: blur(16px); box-shadow: inset 0 -1px 0 var(--ui-border);">
      <div class="mx-auto flex h-10 max-w-7xl items-center justify-between px-3">
        <div class="flex items-center gap-2">
          <button
            class="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
            @click="sidebarOpen = true"
          >
            <Icon icon="lucide:menu" class="w-4 h-4" />
          </button>
          <NuxtLink
            to="/dashboard"
            class="flex items-center gap-1 text-xs text-(--ui-text-dimmed) hover:text-(--ui-text) transition-colors"
          >
            <Icon icon="lucide:arrow-left" class="w-3.5 h-3.5" />
            <span>返回</span>
          </NuxtLink>
          <span class="text-xs text-(--ui-text-dimmed)">/</span>
          <span class="text-xs font-medium text-(--ui-text-muted)">管理端</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="hidden text-xs text-(--ui-text-dimmed) sm:inline">{{ user?.username }}</span>
          <button
            class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
            @click="logout"
          >
            <Icon icon="lucide:log-out" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>

    <div class="mx-auto flex max-w-7xl">
      <!-- Desktop Sidebar -->
      <aside class="hidden w-[210px] shrink-0 py-3 lg:block">
        <nav class="space-y-3 px-2">
          <div v-for="group in adminNavGroups" :key="group.title" class="card-surface p-2">
            <p class="mb-1 px-2 text-[10px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider">{{ group.title }}</p>
            <div class="space-y-0.5">
              <NuxtLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                class="relative flex items-center gap-2 h-7 rounded-md px-2 text-[12px] font-medium transition-all duration-200"
                :class="
                  isActiveNav(item.to)
                    ? 'text-primary-600 dark:text-primary-400 bg-primary-500/[0.06]'
                    : 'text-(--ui-text-muted) hover:bg-(--ui-bg-muted)/60 hover:text-(--ui-text)'
                "
              >
                <div
                  v-if="isActiveNav(item.to)"
                  class="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 rounded-r-full"
                  style="background: linear-gradient(180deg, var(--ui-primary-400), var(--ui-primary-600));"
                />
                <Icon :icon="item.icon" class="w-3.5 h-3.5" />
                {{ item.label }}
              </NuxtLink>
            </div>
          </div>
        </nav>
      </aside>

      <!-- Main -->
      <main class="min-w-0 flex-1 flex flex-col">
        <TabBar area="admin" class="shrink-0" />
        <div class="flex-1 min-h-0 overflow-auto px-3 py-3 sm:px-4 sm:py-3">
          <slot />
        </div>
      </main>
    </div>

    <!-- Mobile Sidebar -->
    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="sidebarOpen" class="fixed inset-0 z-50 lg:hidden">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="sidebarOpen = false" />
          <aside class="absolute inset-y-0 left-0 w-[260px] bg-(--ui-bg-muted) border-r border-(--ui-border)/40 flex flex-col">
            <div class="flex h-10 items-center justify-between px-4 border-b border-(--ui-border)/40">
              <span class="text-sm font-semibold text-(--ui-text)">管理端</span>
              <button
                class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated) transition-colors"
                @click="sidebarOpen = false"
              >
                <Icon icon="lucide:x" class="w-4 h-4" />
              </button>
            </div>
            <nav class="flex-1 space-y-3 px-2 py-3 overflow-y-auto">
              <div v-for="group in adminNavGroups" :key="group.title" class="card-surface p-2">
                <p class="mb-1 px-2 text-[10px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider">{{ group.title }}</p>
                <div class="space-y-0.5">
                  <NuxtLink
                    v-for="item in group.items"
                    :key="item.to"
                    :to="item.to"
                    class="relative flex items-center gap-2 h-8 rounded-md px-2 text-[13px] font-medium transition-colors"
                    :class="
                      isActiveNav(item.to)
                        ? 'text-primary-600 dark:text-primary-400 bg-primary-500/[0.06]'
                        : 'text-(--ui-text-muted) hover:bg-(--ui-bg-muted)/80 hover:text-(--ui-text)'
                    "
                    @click="sidebarOpen = false"
                  >
                    <div
                      v-if="isActiveNav(item.to)"
                      class="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 rounded-r-full bg-primary-500"
                    />
                    <Icon :icon="item.icon" class="w-3.5 h-3.5" />
                    {{ item.label }}
                  </NuxtLink>
                </div>
              </div>
            </nav>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
</style>