<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { user, logout, isAdmin } = useAuth()

const sidebarOpen = ref(false)

const navItems = computed(() => [
  {
    label: t('dashboard.title'),
    icon: 'lucide:layout-dashboard',
    to: '/dashboard'
  },
  { label: '回收站', icon: 'lucide:trash-2', to: '/trash' },
  { label: t('common.settings'), icon: 'lucide:settings', to: '/settings' }
])
</script>

<template>
  <div class="min-h-screen bg-(--ui-bg)">
    <!-- Mobile Header -->
    <div
      class="lg:hidden flex items-center justify-between px-4 py-3 border-b border-(--ui-border) bg-(--ui-bg-muted) sticky top-0 z-40"
    >
      <NButton
        quaternary
        @click="sidebarOpen = true"
      >
        <template #icon>
          <Icon icon="lucide:menu" />
        </template>
      </NButton>
      <div class="flex items-center gap-2">
        <Icon
          icon="lucide:pen-tool"
          class="w-4 h-4 text-primary-400"
        />
        <span class="text-sm font-medium text-(--ui-text)">{{
          t('common.appName')
        }}</span>
      </div>
      <NButton
        quaternary
        size="small"
      >
        <template #icon>
          <Icon icon="lucide:user" />
        </template>
      </NButton>
    </div>

    <div class="flex">
      <!-- Sidebar -->
      <aside
        class="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 border-r border-(--ui-border) bg-(--ui-bg-muted)"
      >
        <div class="flex items-center gap-2.5 px-5 py-5">
          <div
            class="w-7 h-7 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center"
          >
            <Icon
              icon="lucide:pen-tool"
              class="w-3.5 h-3.5 text-primary-400"
            />
          </div>
          <span class="text-sm font-semibold text-(--ui-text)">{{
            t('common.appName')
          }}</span>
        </div>

        <nav class="flex-1 px-3 space-y-1 mt-2">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors"
            :class="
              route.path.startsWith(item.to) ?
                'bg-primary-500/10 text-primary-600 dark:text-primary-300'
              : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)'
            "
          >
            <Icon
              :icon="item.icon"
              class="w-4 h-4"
            />
            {{ item.label }}
          </NuxtLink>

          <div
            v-if="isAdmin"
            class="pt-4"
          >
            <p class="px-3 pb-2 text-xs text-(--ui-text-dimmed)">Admin</p>
            <NuxtLink
              to="/admin"
              class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm text-(--ui-text-muted) transition-colors hover:bg-(--ui-bg-elevated) hover:text-(--ui-text)"
            >
              <Icon
                icon="lucide:shield-check"
                class="w-4 h-4"
              />
              {{ t('common.admin') }}
            </NuxtLink>
          </div>
        </nav>

        <div class="px-3 py-4 border-t border-(--ui-border)">
          <div class="flex items-center gap-2.5 px-3">
            <div
              class="w-7 h-7 rounded-full bg-(--ui-bg-elevated) flex items-center justify-center"
            >
              <span class="text-xs font-medium text-(--ui-text-muted)">
                {{ user?.username?.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-(--ui-text) truncate">
                {{ user?.username }}
              </p>
            </div>
            <NButton
              quaternary
              size="tiny"
              @click="logout"
            >
              <template #icon>
                <Icon icon="lucide:log-out" />
              </template>
            </NButton>
          </div>
        </div>
      </aside>

      <!-- Main -->
      <main class="flex-1 lg:pl-60">
        <slot />
      </main>
    </div>

    <!-- Mobile Sidebar -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="sidebarOpen"
          class="lg:hidden fixed inset-0 z-50"
        >
          <div
            class="absolute inset-0 bg-black/60"
            @click="sidebarOpen = false"
          />
          <aside
            class="absolute left-0 top-0 bottom-0 w-60 bg-(--ui-bg-muted) border-r border-(--ui-border)"
          >
            <div class="flex items-center justify-between px-5 py-5">
              <div class="flex items-center gap-2.5">
                <Icon
                  icon="lucide:pen-tool"
                  class="w-4 h-4 text-primary-400"
                />
                <span class="text-sm font-semibold text-(--ui-text)">{{
                  t('common.appName')
                }}</span>
              </div>
              <NButton
                quaternary
                size="small"
                @click="sidebarOpen = false"
              >
                <template #icon>
                  <Icon icon="lucide:x" />
                </template>
              </NButton>
            </div>
            <nav class="px-3 space-y-1">
              <NuxtLink
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors"
                :class="
                  route.path.startsWith(item.to) ?
                    'bg-primary-500/10 text-primary-600 dark:text-primary-300'
                  : 'text-(--ui-text-muted) hover:text-(--ui-text) hover:bg-(--ui-bg-elevated)'
                "
                @click="sidebarOpen = false"
              >
                <Icon
                  :icon="item.icon"
                  class="w-4 h-4"
                />
                {{ item.label }}
              </NuxtLink>
              <NuxtLink
                v-if="isAdmin"
                to="/admin"
                class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm text-(--ui-text-muted) transition-colors hover:bg-(--ui-bg-elevated) hover:text-(--ui-text)"
                @click="sidebarOpen = false"
              >
                <Icon
                  icon="lucide:shield-check"
                  class="w-4 h-4"
                />
                {{ t('common.admin') }}
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
