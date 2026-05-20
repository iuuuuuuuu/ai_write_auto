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
  { label: t('dashboard.title'), icon: 'lucide:layout-dashboard', to: '/dashboard' },
  { label: '回收站', icon: 'lucide:trash-2', to: '/trash' },
  { label: t('common.settings'), icon: 'lucide:settings', to: '/settings' }
])

function isActive(to: string) {
  return route.path.startsWith(to)
}
</script>

<template>
  <div class="min-h-screen bg-(--ui-bg)">
    <!-- Mobile Floating Header -->
    <div
      class="lg:hidden fixed top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-full card-glass shadow-lg"
    >
      <button
        class="flex items-center justify-center w-7 h-7 rounded-md text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/60 transition-colors"
        @click="sidebarOpen = true"
      >
        <Icon icon="lucide:menu" class="w-4 h-4" />
      </button>
      <div class="flex items-center gap-2">
        <div class="w-5 h-5 rounded-md bg-primary-500/15 flex items-center justify-center">
          <Icon icon="lucide:pen-tool" class="w-3 h-3 text-primary-500" />
        </div>
        <span class="text-sm font-semibold text-(--ui-text)">{{ t('common.appName') }}</span>
      </div>
      <div class="w-7" />
    </div>

    <div class="flex">
      <!-- Desktop Sidebar -->
      <aside
        class="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-30 overflow-visible transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        :class="sidebarExpanded ? 'lg:w-[220px]' : 'lg:w-[60px]'"
        :style="{
          background: 'var(--ui-bg-elevated)',
          boxShadow: '4px 0 24px -2px rgba(0, 0, 0, 0.03), 1px 0 0 rgba(0, 0, 0, 0.02)'
        }"
      >
        <!-- Collapse/Expand Toggle (right edge, vertically centered) -->
        <button
          class="absolute -right-3 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-6 h-6 rounded-full bg-(--ui-bg-elevated) border border-(--ui-border)/40 text-(--ui-text-dimmed) hover:text-primary-500 hover:border-primary-300 hover:shadow-[0_2px_8px_-2px_var(--ui-glow)] transition-all duration-200 cursor-pointer"
          @click="toggleSidebar"
        >
          <Icon
            :icon="sidebarExpanded ? 'lucide:chevron-left' : 'lucide:chevron-right'"
            class="w-3.5 h-3.5"
          />
        </button>
        <!-- Logo -->
        <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div
          class="flex items-center h-[52px] px-3 shrink-0"
          :class="sidebarExpanded ? 'justify-start' : 'justify-center'"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 shadow-[0_2px_8px_-1px_var(--ui-glow)]"
              style="background: linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600));"
            >
              <Icon icon="lucide:pen-tool" class="w-4 h-4 text-white" />
            </div>
            <span
              class="text-[14px] font-semibold text-(--ui-text-highlighted) whitespace-nowrap tracking-[-0.01em] transition-all duration-300"
              :class="sidebarExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'"
            >
              {{ t('common.appName') }}
            </span>
          </div>
        </div>

        <!-- Nav Items -->
        <nav class="flex-1 px-2 mt-2 space-y-1">
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
                class="group relative flex items-center h-9 rounded-[10px] px-2.5 transition-all duration-200"
                :class="[
                  isActive(item.to)
                    ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-[0_1px_3px_-1px_var(--ui-glow)]'
                    : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70'
                ]"
                :style="{ transitionDelay: sidebarExpanded ? `${index * 20}ms` : '0ms' }"
              >
                <Icon
                  :icon="item.icon"
                  class="w-[18px] h-[18px] shrink-0 transition-all duration-200"
                  :class="[
                    !sidebarExpanded && 'mx-auto',
                    isActive(item.to) ? 'text-primary-500 dark:text-primary-400' : 'group-hover:text-(--ui-text)'
                  ]"
                />
                <span
                  class="ml-2.5 text-[13px] font-medium whitespace-nowrap transition-all duration-300"
                  :class="sidebarExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'"
                  :style="{ transitionDelay: sidebarExpanded ? `${(index + 1) * 25}ms` : '0ms' }"
                >
                  {{ item.label }}
                </span>
              </NuxtLink>
            </template>
            {{ item.label }}
          </NTooltip>

          <template v-if="isAdmin">
            <div class="my-2 mx-2.5 h-px bg-(--ui-border)/30" />
            <NTooltip placement="right" :disabled="sidebarExpanded" :show-arrow="false">
              <template #trigger>
                <NuxtLink
                  to="/admin"
                  class="group relative flex items-center h-9 rounded-[10px] px-2.5 transition-all duration-200"
                  :class="[
                    isActive('/admin')
                      ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-[0_1px_3px_-1px_var(--ui-glow)]'
                      : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70'
                  ]"
                >
                  <Icon
                    icon="lucide:shield-check"
                    class="w-[18px] h-[18px] shrink-0 transition-colors duration-200"
                    :class="[
                      !sidebarExpanded && 'mx-auto',
                      isActive('/admin') ? 'text-primary-500 dark:text-primary-400' : 'group-hover:text-(--ui-text)'
                    ]"
                  />
                  <span
                    class="ml-2.5 text-[13px] font-medium whitespace-nowrap transition-all duration-300"
                    :class="sidebarExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'"
                  >
                    {{ t('common.admin') }}
                  </span>
                </NuxtLink>
              </template>
              {{ t('common.admin') }}
            </NTooltip>
          </template>
        </nav>

        <!-- User Section -->
        <div class="px-2 py-3 border-t border-(--ui-border)/20">
          <div
            class="flex items-center rounded-[10px] px-2.5 py-2 transition-all duration-200 hover:bg-(--ui-bg-muted)/70 cursor-pointer"
            :class="sidebarExpanded ? 'gap-2.5' : 'justify-center'"
          >
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ring-2 ring-primary-100 dark:ring-primary-800/30 transition-all duration-200"
              style="background: linear-gradient(135deg, var(--color-primary-300), var(--color-primary-500));"
            >
              <span class="text-xs font-bold text-white">
                {{ user?.username?.charAt(0).toUpperCase() }}
              </span>
            </div>
            <template v-if="sidebarExpanded">
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-medium text-(--ui-text) truncate">{{ user?.username }}</p>
              </div>
              <button
                class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                @click="logout"
              >
                <Icon icon="lucide:log-out" class="w-4 h-4" />
              </button>
            </template>
          </div>
        </div>
        </div>
      </aside>

      <main
        class="flex-1 min-w-0 flex flex-col h-screen transition-[padding-left] duration-300"
        :class="sidebarExpanded ? 'lg:pl-[220px]' : 'lg:pl-[60px]'"
      >
        <TabBar area="user" class="shrink-0" />
        <div class="flex-1 min-h-0 overflow-auto px-3 py-3 lg:px-4 lg:py-3">
          <slot />
        </div>
      </main>
    </div>

    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="sidebarOpen" class="lg:hidden fixed inset-0 z-50">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="sidebarOpen = false" />
          <Transition name="drawer">
            <aside
              v-if="sidebarOpen"
              class="absolute left-0 top-0 bottom-0 w-[270px] flex flex-col bg-(--ui-bg-elevated)"
              style="box-shadow: 8px 0 32px -4px rgba(0, 0, 0, 0.08);"
            >
              <div class="flex items-center justify-between px-4 h-[52px]">
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-8 h-8 rounded-[10px] flex items-center justify-center shadow-[0_2px_8px_-1px_var(--ui-glow)]"
                    style="background: linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600));"
                  >
                    <Icon icon="lucide:pen-tool" class="w-4 h-4 text-white" />
                  </div>
                  <span class="text-[14px] font-semibold text-(--ui-text-highlighted)">{{ t('common.appName') }}</span>
                </div>
                <button
                  class="flex items-center justify-center w-8 h-8 rounded-[10px] text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70 transition-colors"
                  @click="sidebarOpen = false"
                >
                  <Icon icon="lucide:x" class="w-4 h-4" />
                </button>
              </div>

              <nav class="flex-1 px-2.5 mt-2 space-y-1">
                <NuxtLink
                  v-for="item in navItems"
                  :key="item.to"
                  :to="item.to"
                  class="group flex items-center h-10 gap-2.5 rounded-[10px] px-3 text-[13px] font-medium transition-all duration-200"
                  :class="[
                    isActive(item.to)
                      ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-[0_1px_3px_-1px_var(--ui-glow)]'
                      : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70'
                  ]"
                  @click="sidebarOpen = false"
                >
                  <Icon
                    :icon="item.icon"
                    class="w-[18px] h-[18px]"
                    :class="isActive(item.to) ? 'text-primary-500 dark:text-primary-400' : ''"
                  />
                  {{ item.label }}
                </NuxtLink>

                <template v-if="isAdmin">
                  <div class="my-2 mx-2.5 h-px bg-(--ui-border)/30" />
                  <NuxtLink
                    to="/admin"
                    class="group flex items-center h-10 gap-2.5 rounded-[10px] px-3 text-[13px] font-medium transition-all duration-200"
                    :class="[
                      isActive('/admin')
                        ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-[0_1px_3px_-1px_var(--ui-glow)]'
                        : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70'
                    ]"
                    @click="sidebarOpen = false"
                  >
                    <Icon
                      icon="lucide:shield-check"
                      class="w-[18px] h-[18px]"
                      :class="isActive('/admin') ? 'text-primary-500 dark:text-primary-400' : ''"
                    />
                    {{ t('common.admin') }}
                  </NuxtLink>
                </template>
              </nav>

              <div class="px-2.5 py-3 border-t border-(--ui-border)/20">
                <div class="flex items-center gap-2.5 px-3 py-2">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-primary-100 dark:ring-primary-800/30"
                    style="background: linear-gradient(135deg, var(--color-primary-300), var(--color-primary-500));"
                  >
                    <span class="text-xs font-bold text-white">{{ user?.username?.charAt(0).toUpperCase() }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-medium text-(--ui-text) truncate">{{ user?.username }}</p>
                  </div>
                  <button
                    class="flex items-center justify-center w-8 h-8 rounded-lg text-(--ui-text-dimmed) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    @click="logout"
                  >
                    <Icon icon="lucide:log-out" class="w-4 h-4" />
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
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
.drawer-enter-active { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-leave-active { transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-enter-from, .drawer-leave-to { transform: translateX(-100%); }
</style>