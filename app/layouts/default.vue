<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { user, logout, isAdmin } = useAuth()

const sidebarOpen = ref(false)
const sidebarExpanded = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('sidebar-expanded')
  if (saved === 'true') sidebarExpanded.value = true
})

function toggleSidebar() {
  sidebarExpanded.value = !sidebarExpanded.value
  localStorage.setItem('sidebar-expanded', String(sidebarExpanded.value))
}

const navItems = computed(() => [
  {
    label: t('dashboard.title'),
    icon: 'lucide:layout-dashboard',
    to: '/dashboard'
  },
  { label: '回收站', icon: 'lucide:trash-2', to: '/trash' },
  { label: t('common.settings'), icon: 'lucide:settings', to: '/settings' }
])

function isActive(to: string) {
  return route.path.startsWith(to)
}
</script>

<template>
  <div class="min-h-screen bg-(--ui-bg)">
    <!-- Mobile Header -->
    <div
      class="lg:hidden flex items-center justify-between px-4 h-12 border-b border-(--ui-border)/60 bg-(--ui-bg)/80 backdrop-blur-xl sticky top-0 z-40"
    >
      <button
        class="flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
        @click="sidebarOpen = true"
      >
        <Icon icon="lucide:menu" class="w-4 h-4" />
      </button>
      <div class="flex items-center gap-2">
        <div class="w-5 h-5 rounded-md bg-primary-500/15 flex items-center justify-center">
          <Icon icon="lucide:pen-tool" class="w-3 h-3 text-primary-500" />
        </div>
        <span class="text-sm font-medium text-(--ui-text)">{{ t('common.appName') }}</span>
      </div>
      <div class="w-8" />
    </div>

    <div class="flex">
      <!-- Desktop Sidebar -->
      <aside
        class="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 border-r border-(--ui-border)/40 bg-(--ui-bg-muted)/50 backdrop-blur-sm transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] z-30 overflow-hidden"
        :class="sidebarExpanded ? 'lg:w-[220px]' : 'lg:w-[56px]'"
      >
        <!-- Logo & Toggle -->
        <div
          class="flex items-center h-12 px-3 shrink-0"
          :class="sidebarExpanded ? 'justify-between' : 'justify-center'"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-7 h-7 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
              <Icon icon="lucide:pen-tool" class="w-3.5 h-3.5 text-primary-500" />
            </div>
            <span
              class="text-sm font-semibold text-(--ui-text) whitespace-nowrap transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
              :class="sidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'"
            >
              {{ t('common.appName') }}
            </span>
          </div>
          <button
            class="flex items-center justify-center w-6 h-6 rounded-md text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated) transition-all duration-200 shrink-0"
            :class="sidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'"
            @click="toggleSidebar"
          >
            <Icon icon="lucide:panel-left-close" class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Nav Items -->
        <nav class="flex-1 px-2 mt-2 space-y-0.5">
          <NTooltip
            v-for="(item, index) in navItems"
            :key="item.to"
            placement="right"
            :disabled="sidebarExpanded"
            :show-arrow="false"
          >
            <template #trigger>
              <NuxtLink
                :to="item.to"
                class="group relative flex items-center h-9 rounded-lg px-2.5 transition-all duration-200"
                :class="[
                  isActive(item.to)
                    ? 'bg-primary-500/8 text-primary-600 dark:text-primary-400'
                    : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/80'
                ]"
                :style="{ transitionDelay: sidebarExpanded ? `${index * 20}ms` : '0ms' }"
              >
                <!-- Active indicator pill -->
                <div
                  v-if="isActive(item.to)"
                  class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary-500 transition-transform duration-200"
                />
                <Icon
                  :icon="item.icon"
                  class="w-4 h-4 shrink-0 transition-transform duration-200"
                  :class="[
                    !sidebarExpanded && 'mx-auto',
                    isActive(item.to) ? 'text-primary-600 dark:text-primary-400' : ''
                  ]"
                />
                <span
                  class="ml-2.5 text-[13px] font-medium whitespace-nowrap transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                  :class="sidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none w-0'"
                  :style="{ transitionDelay: sidebarExpanded ? `${(index + 1) * 30}ms` : '0ms' }"
                >
                  {{ item.label }}
                </span>
              </NuxtLink>
            </template>
            {{ item.label }}
          </NTooltip>

          <!-- Admin Link -->
          <template v-if="isAdmin">
            <div class="my-2 mx-2.5 h-px bg-(--ui-border)/40" />
            <NTooltip placement="right" :disabled="sidebarExpanded" :show-arrow="false">
              <template #trigger>
                <NuxtLink
                  to="/admin"
                  class="group relative flex items-center h-9 rounded-lg px-2.5 transition-all duration-200"
                  :class="[
                    isActive('/admin')
                      ? 'bg-primary-500/8 text-primary-600 dark:text-primary-400'
                      : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/80'
                  ]"
                >
                  <div
                    v-if="isActive('/admin')"
                    class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary-500"
                  />
                  <Icon
                    icon="lucide:shield-check"
                    class="w-4 h-4 shrink-0"
                    :class="!sidebarExpanded && 'mx-auto'"
                  />
                  <span
                    class="ml-2.5 text-[13px] font-medium whitespace-nowrap transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                    :class="sidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none w-0'"
                  >
                    {{ t('common.admin') }}
                  </span>
                </NuxtLink>
              </template>
              {{ t('common.admin') }}
            </NTooltip>
          </template>
        </nav>

        <!-- Expand toggle (when collapsed) -->
        <button
          v-if="!sidebarExpanded"
          class="mx-auto mb-2 flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated) transition-colors"
          @click="toggleSidebar"
        >
          <Icon icon="lucide:panel-left-open" class="w-3.5 h-3.5" />
        </button>

        <!-- User Section -->
        <div class="px-2 py-3 border-t border-(--ui-border)/40">
          <div
            class="flex items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-(--ui-bg-elevated)/60"
            :class="sidebarExpanded ? 'gap-2.5' : 'justify-center'"
          >
            <div
              class="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400/20 to-primary-600/20 border border-primary-500/20 flex items-center justify-center shrink-0"
            >
              <span class="text-xs font-semibold text-primary-600 dark:text-primary-400">
                {{ user?.username?.charAt(0).toUpperCase() }}
              </span>
            </div>
            <template v-if="sidebarExpanded">
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-medium text-(--ui-text) truncate">
                  {{ user?.username }}
                </p>
              </div>
              <button
                class="flex items-center justify-center w-6 h-6 rounded-md text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
                @click="logout"
              >
                <Icon icon="lucide:log-out" class="w-3.5 h-3.5" />
              </button>
            </template>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main
        class="flex-1 min-w-0 transition-[padding-left] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        :class="sidebarExpanded ? 'lg:pl-[220px]' : 'lg:pl-[56px]'"
      >
        <slot />
      </main>
    </div>

    <!-- Mobile Sidebar Overlay -->
    <Teleport to="body">
      <Transition name="overlay">
        <div
          v-if="sidebarOpen"
          class="lg:hidden fixed inset-0 z-50"
        >
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="sidebarOpen = false"
          />
          <Transition name="drawer">
            <aside
              v-if="sidebarOpen"
              class="absolute left-0 top-0 bottom-0 w-[260px] bg-(--ui-bg-muted) border-r border-(--ui-border)/40 flex flex-col"
            >
              <!-- Mobile Header -->
              <div class="flex items-center justify-between px-4 h-12">
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <Icon icon="lucide:pen-tool" class="w-3.5 h-3.5 text-primary-500" />
                  </div>
                  <span class="text-sm font-semibold text-(--ui-text)">{{ t('common.appName') }}</span>
                </div>
                <button
                  class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated) transition-colors"
                  @click="sidebarOpen = false"
                >
                  <Icon icon="lucide:x" class="w-4 h-4" />
                </button>
              </div>

              <!-- Mobile Nav -->
              <nav class="flex-1 px-3 mt-2 space-y-0.5">
                <NuxtLink
                  v-for="item in navItems"
                  :key="item.to"
                  :to="item.to"
                  class="relative flex items-center h-10 gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors"
                  :class="[
                    isActive(item.to)
                      ? 'bg-primary-500/8 text-primary-600 dark:text-primary-400'
                      : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/80'
                  ]"
                  @click="sidebarOpen = false"
                >
                  <div
                    v-if="isActive(item.to)"
                    class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary-500"
                  />
                  <Icon :icon="item.icon" class="w-4 h-4" />
                  {{ item.label }}
                </NuxtLink>

                <template v-if="isAdmin">
                  <div class="my-2 mx-3 h-px bg-(--ui-border)/40" />
                  <NuxtLink
                    to="/admin"
                    class="relative flex items-center h-10 gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors"
                    :class="[
                      isActive('/admin')
                        ? 'bg-primary-500/8 text-primary-600 dark:text-primary-400'
                        : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/80'
                    ]"
                    @click="sidebarOpen = false"
                  >
                    <div
                      v-if="isActive('/admin')"
                      class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary-500"
                    />
                    <Icon icon="lucide:shield-check" class="w-4 h-4" />
                    {{ t('common.admin') }}
                  </NuxtLink>
                </template>
              </nav>

              <!-- Mobile User -->
              <div class="px-3 py-3 border-t border-(--ui-border)/40">
                <div class="flex items-center gap-2.5 px-3 py-1.5">
                  <div class="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400/20 to-primary-600/20 border border-primary-500/20 flex items-center justify-center">
                    <span class="text-xs font-semibold text-primary-600 dark:text-primary-400">
                      {{ user?.username?.charAt(0).toUpperCase() }}
                    </span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-medium text-(--ui-text) truncate">{{ user?.username }}</p>
                  </div>
                  <button
                    class="flex items-center justify-center w-7 h-7 rounded-md text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted) transition-colors"
                    @click="logout"
                  >
                    <Icon icon="lucide:log-out" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </aside>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.drawer-enter-active {
  transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}
.drawer-leave-active {
  transition: transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
}
</style>
