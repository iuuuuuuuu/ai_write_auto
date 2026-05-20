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
        class="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 border-r border-(--ui-border)/40 z-30 overflow-hidden"
        :class="sidebarExpanded ? 'lg:w-[210px]' : 'lg:w-[60px]'"
        style="background: linear-gradient(180deg, var(--ui-bg-muted) 0%, color-mix(in oklch, var(--ui-bg-muted) 96%, var(--ui-primary-500)) 100%); backdrop-filter: blur(12px);"
      >
        <!-- Logo & Toggle -->
        <div
          class="flex items-center h-11 px-2.5 shrink-0"
          :class="sidebarExpanded ? 'justify-between' : 'justify-center'"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden"
                 style="background: linear-gradient(135deg, var(--ui-primary-400), var(--ui-primary-600));">
              <Icon icon="lucide:pen-tool" class="w-3.5 h-3.5 text-white relative z-10" />
              <div class="absolute inset-0 bg-white/10" />
            </div>
            <span
              class="text-sm font-semibold text-(--ui-text) whitespace-nowrap transition-all duration-300"
              :class="sidebarExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'"
            >
              {{ t('common.appName') }}
            </span>
          </div>
          <button
            v-if="sidebarExpanded"
            class="flex items-center justify-center w-6 h-6 rounded-md text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/60 transition-all duration-200 shrink-0"
            @click="toggleSidebar"
          >
            <Icon icon="lucide:panel-left-close" class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Nav Items -->
        <nav class="flex-1 px-1.5 mt-1.5 space-y-0.5">
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
                class="group relative flex items-center h-8 rounded-lg px-2 transition-all duration-200"
                :class="[
                  isActive(item.to)
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/50'
                ]"
                :style="{ transitionDelay: sidebarExpanded ? `${index * 15}ms` : '0ms' }"
              >
                <div
                  v-if="isActive(item.to)"
                  class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full transition-all duration-300"
                  style="background: linear-gradient(180deg, var(--ui-primary-400), var(--ui-primary-600)); box-shadow: 0 0 8px var(--ui-glow);"
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
                  class="ml-2 text-[13px] font-medium whitespace-nowrap transition-all duration-300"
                  :class="sidebarExpanded ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'"
                  :style="{ transitionDelay: sidebarExpanded ? `${(index + 1) * 20}ms` : '0ms' }"
                >
                  {{ item.label }}
                </span>
              </NuxtLink>
            </template>
            {{ item.label }}
          </NTooltip>

          <template v-if="isAdmin">
            <div class="my-1.5 mx-2 h-px bg-(--ui-border)/40" />
            <NTooltip placement="right" :disabled="sidebarExpanded" :show-arrow="false">
              <template #trigger>
                <NuxtLink
                  to="/admin"
                  class="group relative flex items-center h-8 rounded-lg px-2 transition-all duration-200"
                  :class="[
                    isActive('/admin')
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/50'
                  ]"
                >
                  <div
                    v-if="isActive('/admin')"
                    class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                    style="background: linear-gradient(180deg, var(--ui-primary-400), var(--ui-primary-600)); box-shadow: 0 0 8px var(--ui-glow);"
                  />
                  <Icon
                    icon="lucide:shield-check"
                    class="w-4 h-4 shrink-0"
                    :class="!sidebarExpanded && 'mx-auto'"
                  />
                  <span
                    class="ml-2 text-[13px] font-medium whitespace-nowrap transition-all duration-300"
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

        <button
          v-if="!sidebarExpanded"
          class="mx-auto mb-1.5 flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/50 transition-colors"
          @click="toggleSidebar"
        >
          <Icon icon="lucide:panel-left-open" class="w-3.5 h-3.5" />
        </button>

        <div class="px-1.5 py-2.5 border-t border-(--ui-border)/40">
          <div
            class="flex items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-(--ui-bg-elevated)/50 cursor-pointer"
            :class="sidebarExpanded ? 'gap-2' : 'justify-center'"
          >
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 relative overflow-hidden"
              style="background: linear-gradient(135deg, var(--ui-primary-300), var(--ui-primary-500));"
            >
              <span class="text-xs font-bold text-white relative z-10">
                {{ user?.username?.charAt(0).toUpperCase() }}
              </span>
            </div>
            <template v-if="sidebarExpanded">
              <div class="flex-1 min-w-0">
                <p class="text-[12px] font-medium text-(--ui-text) truncate">{{ user?.username }}</p>
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

      <main
        class="flex-1 min-w-0 transition-[padding-left] duration-300"
        :class="sidebarExpanded ? 'lg:pl-[210px]' : 'lg:pl-[60px]'"
      >
        <div class="px-3 py-3 lg:px-4 lg:py-3">
          <slot />
        </div>
      </main>
    </div>

    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="sidebarOpen" class="lg:hidden fixed inset-0 z-50">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="sidebarOpen = false" />
          <Transition name="drawer">
            <aside
              v-if="sidebarOpen"
              class="absolute left-0 top-0 bottom-0 w-[260px] flex flex-col"
              style="background: linear-gradient(180deg, var(--ui-bg-muted) 0%, var(--ui-bg) 100%); border-right: 1px solid var(--ui-border);"
            >
              <div class="flex items-center justify-between px-4 h-11">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center"
                       style="background: linear-gradient(135deg, var(--ui-primary-400), var(--ui-primary-600));">
                    <Icon icon="lucide:pen-tool" class="w-3.5 h-3.5 text-white" />
                  </div>
                  <span class="text-sm font-semibold text-(--ui-text)">{{ t('common.appName') }}</span>
                </div>
                <button
                  class="flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/50 transition-colors"
                  @click="sidebarOpen = false"
                >
                  <Icon icon="lucide:x" class="w-4 h-4" />
                </button>
              </div>

              <nav class="flex-1 px-2.5 mt-1.5 space-y-0.5">
                <NuxtLink
                  v-for="item in navItems"
                  :key="item.to"
                  :to="item.to"
                  class="relative flex items-center h-9 gap-2 rounded-lg px-3 text-[13px] font-medium transition-all duration-200"
                  :class="[
                    isActive(item.to)
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/50'
                  ]"
                  @click="sidebarOpen = false"
                >
                  <div
                    v-if="isActive(item.to)"
                    class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                    style="background: linear-gradient(180deg, var(--ui-primary-400), var(--ui-primary-600));"
                  />
                  <Icon :icon="item.icon" class="w-4 h-4" />
                  {{ item.label }}
                </NuxtLink>

                <template v-if="isAdmin">
                  <div class="my-1.5 mx-2.5 h-px bg-(--ui-border)/40" />
                  <NuxtLink
                    to="/admin"
                    class="relative flex items-center h-9 gap-2 rounded-lg px-3 text-[13px] font-medium transition-all duration-200"
                    :class="[
                      isActive('/admin')
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)/50'
                    ]"
                    @click="sidebarOpen = false"
                  >
                    <div
                      v-if="isActive('/admin')"
                      class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                      style="background: linear-gradient(180deg, var(--ui-primary-400), var(--ui-primary-600));"
                    />
                    <Icon icon="lucide:shield-check" class="w-4 h-4" />
                    {{ t('common.admin') }}
                  </NuxtLink>
                </template>
              </nav>

              <div class="px-2.5 py-2.5 border-t border-(--ui-border)/40">
                <div class="flex items-center gap-2 px-3 py-1.5">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center"
                       style="background: linear-gradient(135deg, var(--ui-primary-300), var(--ui-primary-500));">
                    <span class="text-xs font-bold text-white">{{ user?.username?.charAt(0).toUpperCase() }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[12px] font-medium text-(--ui-text) truncate">{{ user?.username }}</p>
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
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
.drawer-enter-active { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-leave-active { transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-enter-from, .drawer-leave-to { transform: translateX(-100%); }
</style>