<script setup lang="ts">
import type { Tab } from '~/composables/useTabs'

const props = defineProps<{ area: 'user' | 'admin' }>()

const { tabs, activeTab, setActiveTab, removeTab, renameTab, closeOtherTabs, closeTabsToRight } = useTabs(props.area)

const renamingTabId = ref<string | null>(null)
const renameInput = ref('')

const contextMenu = ref({ show: false, x: 0, y: 0, tabId: '' })

function handleTabClick(tab: Tab) {
  if (tab.id === activeTab.value?.id) return
  setActiveTab(tab.id)
}

function handleDoubleClick(tab: Tab) {
  startRename(tab)
}

function startRename(tab: Tab) {
  renamingTabId.value = tab.id
  renameInput.value = tab.customTitle || tab.title
  nextTick(() => {
    const input = document.querySelector('.tab-rename-input') as HTMLInputElement | null
    input?.focus()
    input?.select()
  })
}

function commitRename() {
  if (renamingTabId.value && renameInput.value.trim()) {
    renameTab(renamingTabId.value, renameInput.value.trim())
  }
  renamingTabId.value = null
}

function cancelRename() {
  renamingTabId.value = null
}

function handleContextMenu(e: MouseEvent, tab: Tab) {
  e.preventDefault()
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY, tabId: tab.id }
}

function handleContextAction(key: string) {
  const tabId = contextMenu.value.tabId
  contextMenu.value.show = false
  switch (key) {
    case 'rename': {
      const tab = tabs.value.find(t => t.id === tabId)
      if (tab) startRename(tab)
      break
    }
    case 'close':
      removeTab(tabId)
      break
    case 'close-others':
      closeOtherTabs(tabId)
      break
    case 'close-right':
      closeTabsToRight(tabId)
      break
  }
}

function handleNewTab() {
  const home = props.area === 'admin' ? '/admin' : '/dashboard'
  navigateTo(home)
}

function getTabTitle(tab: Tab) {
  return tab.customTitle || tab.title
}

const contextMenuOptions = computed(() => [
  { label: '重命名', key: 'rename' },
  { label: '关闭', key: 'close' },
  { type: 'divider', key: 'd1' },
  { label: '关闭其他', key: 'close-others' },
  { label: '关闭右侧', key: 'close-right' },
])
</script>

<template>
  <ClientOnly>
    <div class="tab-bar">
      <div class="tab-bar-scroll">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ active: tab.id === activeTab?.id }"
          @click="handleTabClick(tab)"
          @dblclick="handleDoubleClick(tab)"
          @contextmenu="handleContextMenu($event, tab)"
        >
          <div class="tab-content">
            <input
              v-if="renamingTabId === tab.id"
              v-model="renameInput"
              class="tab-rename-input"
              @keydown.enter="commitRename"
              @keydown.escape="cancelRename"
              @blur="commitRename"
              @click.stop
            />
            <span v-else class="tab-title">{{ getTabTitle(tab) }}</span>
          </div>
          <button
            v-if="tab.closable"
            class="tab-close"
            @click.stop="removeTab(tab.id)"
          >
            <Icon icon="lucide:x" class="w-3 h-3" />
          </button>
        </div>

        <button class="tab-add" @click="handleNewTab">
          <Icon icon="lucide:plus" class="w-3.5 h-3.5" />
        </button>
      </div>

      <NDropdown
        :show="contextMenu.show"
        :x="contextMenu.x"
        :y="contextMenu.y"
        :options="contextMenuOptions"
        trigger="manual"
        placement="bottom-start"
        @clickoutside="contextMenu.show = false"
        @select="handleContextAction"
      />
    </div>
  </ClientOnly>
</template>

<style scoped>
.tab-bar {
  height: 40px;
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 25%, transparent);
  background: var(--ui-bg-elevated);
  padding: 0 8px;
  user-select: none;
}

.tab-bar-scroll {
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  gap: 2px;
  padding: 4px 0;
  scrollbar-width: none;
}

.tab-bar-scroll::-webkit-scrollbar {
  display: none;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  min-width: 0;
  max-width: 180px;
  height: 30px;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  color: var(--ui-text-muted);
  font-size: 12.5px;
  font-weight: 500;
  transition: color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  flex-shrink: 0;
}

.tab-item:hover {
  color: var(--ui-text);
  background: var(--ui-bg-muted);
}

.tab-item.active {
  color: var(--color-primary-600);
  background: color-mix(in oklch, var(--color-primary-50) 80%, transparent);
  box-shadow: 0 1px 2px -1px color-mix(in oklch, var(--color-primary-500) 15%, transparent);
}

:deep(.dark) .tab-item.active,
.dark .tab-item.active {
  color: var(--color-primary-400);
  background: color-mix(in oklch, var(--color-primary-500) 10%, transparent);
  box-shadow: none;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary-500);
  opacity: 0.7;
}

.tab-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-rename-input {
  width: 100%;
  background: var(--ui-bg);
  border: 1.5px solid var(--color-primary-400);
  border-radius: 6px;
  padding: 0 6px;
  font-size: 12px;
  color: var(--ui-text);
  outline: none;
  height: 22px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.tab-rename-input:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary-500) 12%, transparent);
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  color: var(--ui-text-dimmed);
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
  flex-shrink: 0;
}

.tab-item:hover .tab-close,
.tab-item.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  color: var(--ui-text);
  background: color-mix(in oklch, var(--ui-border) 40%, transparent);
}

.tab-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: auto 4px;
  border-radius: 8px;
  color: var(--ui-text-dimmed);
  border: 1.5px dashed color-mix(in oklch, var(--ui-border) 60%, transparent);
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  flex-shrink: 0;
}

.tab-add:hover {
  color: var(--color-primary-500);
  background: color-mix(in oklch, var(--color-primary-50) 60%, transparent);
  border-color: var(--color-primary-300);
}
</style>
