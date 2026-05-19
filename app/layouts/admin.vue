<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { user, logout } = useAuth()

const sidebarOpen = ref(false)

const adminNavItems = computed(() => [
  { label: '概览', icon: 'lucide:layout-dashboard', to: '/admin' },
  { label: '用户', icon: 'lucide:users', to: '/admin/users' },
  { label: '小说', icon: 'lucide:library', to: '/admin/novels' },
  { label: '模型配置', icon: 'lucide:cpu', to: '/admin/ai-configs' }
])

function isActiveNav(to: string) {
  return to === '/admin' ? route.path === to : route.path.startsWith(to)
}
</script>

<template>
  <div class="min-h-screen bg-(--ui-bg)">
    <header
      class="sticky top-0 z-40 border-b border-(--ui-border) bg-(--ui-bg)/95 backdrop-blur"
    >
      <div
        class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <div class="flex items-center gap-3">
          <NButton
            class="lg:hidden"
            quaternary
            @click="sidebarOpen = true"
          >
            <template #icon>
              <Icon icon="lucide:menu" />
            </template>
          </NButton>
          <NuxtLink
            to="/dashboard"
            class="flex items-center gap-2 text-sm text-(--ui-text-muted) hover:text-(--ui-text)"
          >
            <Icon
              icon="lucide:arrow-left"
              class="size-4"
            />
            <span>用户端</span>
          </NuxtLink>
        </div>

        <div class="flex items-center gap-3">
          <span class="hidden text-sm text-(--ui-text-muted) sm:inline">{{
            user?.username
          }}</span>
          <NButton
            quaternary
            @click="logout"
          >
            <template #icon>
              <Icon icon="lucide:log-out" />
            </template>
          </NButton>
        </div>
      </div>
    </header>

    <div class="mx-auto flex max-w-7xl">
      <aside
        class="hidden w-64 shrink-0 border-r border-(--ui-border) px-4 py-6 lg:block"
      >
        <div class="mb-6 px-2">
          <p class="text-xs text-(--ui-text-dimmed)">Admin</p>
          <h1 class="mt-1 text-lg font-semibold text-(--ui-text-highlighted)">
            管理端
          </h1>
        </div>
        <nav class="space-y-1">
          <NuxtLink
            v-for="item in adminNavItems"
            :key="item.to"
            :to="item.to"
            class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors"
            :class="
              isActiveNav(item.to) ?
                'bg-primary-500/10 text-primary-400'
              : 'text-(--ui-text-muted) hover:bg-(--ui-bg-muted) hover:text-(--ui-text)'
            "
          >
            <Icon
              :icon="item.icon"
              class="size-4"
            />
            {{ item.label }}
          </NuxtLink>
        </nav>
      </aside>

      <main class="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <slot />
      </main>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="sidebarOpen"
          class="fixed inset-0 z-50 lg:hidden"
        >
          <div
            class="absolute inset-0 bg-black/50"
            @click="sidebarOpen = false"
          />
          <aside
            class="absolute inset-y-0 left-0 w-72 border-r border-(--ui-border) bg-(--ui-bg)"
          >
            <div class="flex h-14 items-center justify-between px-4">
              <span class="text-sm font-medium text-(--ui-text-highlighted)"
                >管理端</span
              >
              <NButton
                quaternary
                @click="sidebarOpen = false"
              >
                <template #icon>
                  <Icon icon="lucide:x" />
                </template>
              </NButton>
            </div>
            <nav class="space-y-1 px-4 py-3">
              <NuxtLink
                v-for="item in adminNavItems"
                :key="item.to"
                :to="item.to"
                class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors"
                :class="
                  isActiveNav(item.to) ?
                    'bg-primary-500/10 text-primary-400'
                  : 'text-(--ui-text-muted) hover:bg-(--ui-bg-muted) hover:text-(--ui-text)'
                "
                @click="sidebarOpen = false"
              >
                <Icon
                  :icon="item.icon"
                  class="size-4"
                />
                {{ item.label }}
              </NuxtLink>
            </nav>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
