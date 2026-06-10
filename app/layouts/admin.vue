<script setup lang="ts">
const route = useRoute()
const { user, logout } = useAuth()
const sidebarOpen = ref(false)

useBackupNotification()

const adminNavGroups = computed(() => [
  {
    title: '数据管理',
    items: [
      { label: '概览', icon: 'lucide:layout-dashboard', to: '/admin' },
      { label: '用户', icon: 'lucide:users', to: '/admin/users' },
      { label: '小说', icon: 'lucide:library', to: '/admin/novels' },
      { label: '模型配置', icon: 'lucide:cpu', to: '/admin/ai-configs' }
    ]
  },
  {
    title: '运营监控',
    items: [
      { label: '生成任务', icon: 'lucide:zap', to: '/admin/tasks' },
      {
        label: '生成记录',
        icon: 'lucide:activity',
        to: '/admin/ai-generation-logs'
      },
      { label: 'Token 用量', icon: 'lucide:coins', to: '/admin/token-usage' },
      {
        label: '写作统计',
        icon: 'lucide:bar-chart-3',
        to: '/admin/writing-stats'
      }
    ]
  },
  {
    title: '系统配置',
    items: [
      {
        label: '提示词模板',
        icon: 'lucide:message-square-text',
        to: '/admin/prompts'
      },
      { label: '小说模板', icon: 'lucide:file-text', to: '/admin/templates' },
      { label: '站点设置', icon: 'lucide:settings', to: '/admin/settings' }
    ]
  }
])

const currentPageTitle = computed(() => {
  for (const group of adminNavGroups.value) {
    for (const item of group.items) {
      if (isActiveNav(item.to)) return item.label
    }
  }
  return '管理端'
})

function isActiveNav(to: string) {
  return to === '/admin' ? route.path === to : route.path.startsWith(to)
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-(--ui-bg)">
    <!-- Desktop Sidebar -->
    <aside
      class="admin-sidebar group hidden lg:flex flex-col shrink-0 border-r border-(--ui-border) bg-(--ui-bg-elevated) overflow-hidden"
    >
      <!-- Top: Logo area -->
      <div
        class="flex h-12 items-center justify-center shrink-0 border-b border-(--ui-border)/50"
      >
        <div class="flex items-center gap-2 overflow-hidden">
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-500/10"
          >
            <Icon
              icon="lucide:shield"
              class="size-4 text-primary-500"
            />
          </div>
          <span
            class="admin-sidebar-text text-sm font-semibold text-(--ui-text-highlighted) whitespace-nowrap"
          >
            管理端
          </span>
        </div>
      </div>

      <!-- Nav items -->
      <nav class="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2">
        <template
          v-for="(group, gIdx) in adminNavGroups"
          :key="group.title"
        >
          <div
            v-if="gIdx > 0"
            class="my-2 mx-2 h-px bg-(--ui-border)/60"
          />
          <div class="space-y-0.5">
            <NuxtLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              class="admin-nav-item relative flex items-center rounded-xl transition-all duration-200"
              :class="
                isActiveNav(item.to) ?
                  'bg-primary-500/10 text-primary-500'
                : 'text-(--ui-text-muted) hover:bg-(--ui-bg-muted) hover:text-(--ui-text)'
              "
            >
              <div
                v-if="isActiveNav(item.to)"
                class="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full bg-primary-500"
              />
              <div class="flex size-9 shrink-0 items-center justify-center">
                <Icon
                  :icon="item.icon"
                  class="size-[18px]"
                />
              </div>
              <span
                class="admin-sidebar-text text-[13px] font-medium whitespace-nowrap"
              >
                {{ item.label }}
              </span>
            </NuxtLink>
          </div>
        </template>
      </nav>

      <!-- Bottom: Back + User -->
      <div class="shrink-0 border-t border-(--ui-border)/50 p-2 space-y-0.5">
        <NuxtLink
          to="/dashboard"
          class="admin-nav-item flex items-center rounded-xl text-(--ui-text-dimmed) hover:bg-(--ui-bg-muted) hover:text-(--ui-text) transition-colors"
        >
          <div class="flex size-9 shrink-0 items-center justify-center">
            <Icon
              icon="lucide:arrow-left"
              class="size-[18px]"
            />
          </div>
          <span
            class="admin-sidebar-text text-[13px] font-medium whitespace-nowrap"
            >返回前台</span
          >
        </NuxtLink>
        <button
          class="admin-nav-item w-full flex items-center rounded-xl text-(--ui-text-dimmed) hover:bg-(--ui-bg-muted) hover:text-(--ui-text) transition-colors"
          @click="logout"
        >
          <div class="flex size-9 shrink-0 items-center justify-center">
            <Icon
              icon="lucide:log-out"
              class="size-[18px]"
            />
          </div>
          <span
            class="admin-sidebar-text text-[13px] font-medium whitespace-nowrap"
            >退出登录</span
          >
        </button>
      </div>
    </aside>

    <!-- Main area -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Top bar -->
      <header
        class="flex h-10 shrink-0 items-center justify-between border-b border-(--ui-border) px-4"
      >
        <div class="flex items-center gap-3">
          <button
            class="lg:hidden flex items-center justify-center size-7 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
            @click="sidebarOpen = true"
          >
            <Icon
              icon="lucide:menu"
              class="size-4"
            />
          </button>
          <span class="text-sm font-medium text-(--ui-text)">{{
            currentPageTitle
          }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-(--ui-text-dimmed)">{{
            user?.username
          }}</span>
          <button
            class="hidden lg:flex items-center justify-center size-7 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
            @click="logout"
          >
            <Icon
              icon="lucide:log-out"
              class="size-3.5"
            />
          </button>
        </div>
      </header>

      <!-- TabBar -->
      <TabBar
        area="admin"
        class="shrink-0"
      />

      <!-- Page content -->
      <div
        class="flex-1 min-h-0 flex flex-col px-4 py-4 sm:px-5 overflow-hidden"
      >
        <slot />
      </div>
    </div>

    <!-- Mobile Sidebar -->
    <Teleport to="body">
      <Transition name="overlay">
        <div
          v-if="sidebarOpen"
          class="fixed inset-0 z-50 lg:hidden"
        >
          <div
            class="absolute inset-0 bg-black/40 backdrop-blur-sm"
            @click="sidebarOpen = false"
          />
          <aside
            class="absolute inset-y-0 left-0 w-[260px] bg-(--ui-bg-elevated) border-r border-(--ui-border) flex flex-col"
          >
            <div
              class="flex h-12 items-center justify-between px-4 border-b border-(--ui-border)/50"
            >
              <div class="flex items-center gap-2">
                <div
                  class="flex size-7 items-center justify-center rounded-lg bg-primary-500/10"
                >
                  <Icon
                    icon="lucide:shield"
                    class="size-3.5 text-primary-500"
                  />
                </div>
                <span class="text-sm font-semibold text-(--ui-text-highlighted)"
                  >管理端</span
                >
              </div>
              <button
                class="flex items-center justify-center size-7 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
                @click="sidebarOpen = false"
              >
                <Icon
                  icon="lucide:x"
                  class="size-4"
                />
              </button>
            </div>
            <nav class="flex-1 overflow-y-auto py-3 px-3">
              <template
                v-for="(group, gIdx) in adminNavGroups"
                :key="group.title"
              >
                <div
                  v-if="gIdx > 0"
                  class="my-2.5 mx-1 h-px bg-(--ui-border)/60"
                />
                <p
                  class="mb-1 px-2 text-[10px] font-semibold text-(--ui-text-dimmed) uppercase tracking-wider"
                >
                  {{ group.title }}
                </p>
                <div class="space-y-0.5">
                  <NuxtLink
                    v-for="item in group.items"
                    :key="item.to"
                    :to="item.to"
                    class="relative flex items-center gap-3 h-9 rounded-xl px-3 text-[13px] font-medium transition-colors"
                    :class="
                      isActiveNav(item.to) ?
                        'bg-primary-500/10 text-primary-500'
                      : 'text-(--ui-text-muted) hover:bg-(--ui-bg-muted) hover:text-(--ui-text)'
                    "
                    @click="sidebarOpen = false"
                  >
                    <div
                      v-if="isActiveNav(item.to)"
                      class="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full bg-primary-500"
                    />
                    <Icon
                      :icon="item.icon"
                      class="size-[18px] shrink-0"
                    />
                    {{ item.label }}
                  </NuxtLink>
                </div>
              </template>
            </nav>
            <div
              class="shrink-0 border-t border-(--ui-border)/50 p-3 space-y-0.5"
            >
              <NuxtLink
                to="/dashboard"
                class="flex items-center gap-3 h-9 rounded-xl px-3 text-[13px] font-medium text-(--ui-text-dimmed) hover:bg-(--ui-bg-muted) hover:text-(--ui-text) transition-colors"
                @click="sidebarOpen = false"
              >
                <Icon
                  icon="lucide:arrow-left"
                  class="size-[18px]"
                />
                返回前台
              </NuxtLink>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.admin-sidebar {
  width: 54px;
  transition: width 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.admin-sidebar:hover {
  width: 200px;
}

.admin-nav-item {
  height: 36px;
}

.admin-sidebar-text {
  opacity: 0;
  transition: opacity 0.2s ease 0.05s;
}

.admin-sidebar:hover .admin-sidebar-text {
  opacity: 1;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
