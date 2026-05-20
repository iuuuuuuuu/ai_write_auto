<script setup lang="ts">
const { t } = useI18n()
const { settings, updateSetting, resetSettings } = useLayoutSettings()

const drawerOpen = useState('layout-settings-drawer', () => false)

const navModes = [
  { value: 'classic', label: '经典', icon: 'lucide:layout-dashboard' },
  { value: 'borderless', label: '无边框', icon: 'lucide:maximize' },
  { value: 'dock', label: 'Dock', icon: 'lucide:panel-left' },
  { value: 'card', label: '卡片', icon: 'lucide:credit-card' }
] as const

const hasSidebar = computed(() => ['classic', 'borderless', 'card'].includes(settings.value.navMode))
</script>

<template>
  <NDrawer v-model:show="drawerOpen" :width="320" placement="right">
    <NDrawerContent closable>
      <template #header>
        <div class="flex items-center gap-2">
          <span class="text-[15px] font-semibold">{{ t('layoutSettings.title') }}</span>
          <button
            class="ml-auto flex items-center justify-center w-7 h-7 rounded-lg text-(--ui-text-dimmed) hover:text-(--ui-text) hover:bg-(--ui-bg-muted)/70 transition-colors"
            @click="resetSettings"
          >
            <Icon icon="lucide:rotate-ccw" class="w-3.5 h-3.5" />
          </button>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Navigation Mode -->
        <section>
          <h3 class="text-[13px] font-semibold text-(--ui-text) mb-3">{{ t('layoutSettings.navMode') }}</h3>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="mode in navModes"
              :key="mode.value"
              class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all duration-200"
              :class="[
                settings.navMode === mode.value
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-[0_1px_4px_-1px_var(--ui-glow)]'
                  : 'border-(--ui-border)/40 text-(--ui-text-muted) hover:border-(--ui-border) hover:bg-(--ui-bg-muted)/50'
              ]"
              @click="updateSetting('navMode', mode.value)"
            >
              <Icon :icon="mode.icon" class="w-5 h-5" />
              <span class="text-[11px] font-medium">{{ mode.label }}</span>
            </button>
          </div>
        </section>

        <!-- Layout Options -->
        <section>
          <h3 class="text-[13px] font-semibold text-(--ui-text) mb-3">{{ t('layoutSettings.layoutSection') }}</h3>
          <div class="space-y-3">
            <!-- Sidebar Expanded (only for modes with sidebar) -->
            <div v-if="hasSidebar" class="flex items-center justify-between">
              <span class="text-[13px] text-(--ui-text-muted)">{{ t('layoutSettings.expandSidebar') }}</span>
              <NSwitch
                :value="settings.sidebarExpanded"
                size="small"
                @update:value="updateSetting('sidebarExpanded', $event)"
              />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-[13px] text-(--ui-text-muted)">{{ t('layoutSettings.showTabs') }}</span>
              <NSwitch
                :value="settings.showTabs"
                size="small"
                @update:value="updateSetting('showTabs', $event)"
              />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-[13px] text-(--ui-text-muted)">{{ t('layoutSettings.showBreadcrumb') }}</span>
              <NSwitch
                :value="settings.showBreadcrumb"
                size="small"
                @update:value="updateSetting('showBreadcrumb', $event)"
              />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-[13px] text-(--ui-text-muted)">{{ t('layoutSettings.showLogo') }}</span>
              <NSwitch
                :value="settings.showLogo"
                size="small"
                @update:value="updateSetting('showLogo', $event)"
              />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-[13px] text-(--ui-text-muted)">{{ t('layoutSettings.showNavButtons') }}</span>
              <NSwitch
                :value="settings.showNavButtons"
                size="small"
                @update:value="updateSetting('showNavButtons', $event)"
              />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-[13px] text-(--ui-text-muted)">{{ t('layoutSettings.showFooter') }}</span>
              <NSwitch
                :value="settings.showFooter"
                size="small"
                @update:value="updateSetting('showFooter', $event)"
              />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-[13px] text-(--ui-text-muted)">{{ t('layoutSettings.enableNavTransition') }}</span>
              <NSwitch
                :value="settings.enableNavTransition"
                size="small"
                @update:value="updateSetting('enableNavTransition', $event)"
              />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-[13px] text-(--ui-text-muted)">{{ t('layoutSettings.enableRefreshTransition') }}</span>
              <NSwitch
                :value="settings.enableRefreshTransition"
                size="small"
                @update:value="updateSetting('enableRefreshTransition', $event)"
              />
            </div>
          </div>
        </section>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>
