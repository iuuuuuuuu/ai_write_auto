<script setup lang="ts">
import type { Tab } from '~/composables/useTabs'

const props = defineProps<{ area: 'user' | 'admin' }>()

const { tabs, activeTab, setActiveTab, removeTab, renameTab, closeOtherTabs, closeTabsToRight, reorderTabs } = useTabs(props.area)

const renamingTabId = ref<string | null>(null)
const renameInput = ref('')
const isRefreshing = ref(false)

function handleRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  const key = useState<number>('page-refresh-key', () => 0)
  key.value++
  setTimeout(() => { isRefreshing.value = false }, 600)
}

const contextMenu = ref({ show: false, x: 0, y: 0, tabId: '' })

const dragState = ref<{ dragging: boolean; fromIndex: number; overIndex: number }>({
  dragging: false,
  fromIndex: -1,
  overIndex: -1,
})

function handleDragStart(e: DragEvent, index: number) {
  dragState.value = { dragging: true, fromIndex: index, overIndex: index }
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function handleDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragState.value.overIndex = index
}

function handleDrop(e: DragEvent, index: number) {
  e.preventDefault()
  reorderTabs(dragState.value.fromIndex, index)
  dragState.value = { dragging: false, fromIndex: -1, overIndex: -1 }
}

function handleDragEnd() {
  dragState.value = { dragging: false, fromIndex: -1, overIndex: -1 }
}

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
        <TransitionGroup name="tab-transition">
          <div
            v-for="(tab, index) in tabs"
            :key="tab.id"
            class="tab-item"
            :class="{
              active: tab.id === activeTab?.id,
              'drag-over': dragState.dragging && dragState.overIndex === index && dragState.fromIndex !== index,
            }"
            draggable="true"
            @dragstart="handleDragStart($event, index)"
            @dragover="handleDragOver($event, index)"
            @drop="handleDrop($event, index)"
            @dragend="handleDragEnd"
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
        </TransitionGroup>
      </div>

      <button
        class="tab-refresh"
        :class="{ 'is-spinning': isRefreshing }"
        title="刷新当前页面"
        @click="handleRefresh"
      >
        <Icon icon="lucide:refresh-cw" class="w-3.5 h-3.5" />
      </button>

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
  border-bottom: 1px solid var(--ui-border);
  background: transparent;
  padding: 0 8px;
  user-select: none;
}

.tab-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: auto 4px;
  border-radius: 6px;
  color: var(--ui-text-dimmed);
  transition: all 0.15s;
  flex-shrink: 0;
}

.tab-refresh:hover {
  background: var(--ui-bg-muted);
  color: var(--ui-text);
}

.tab-refresh.is-spinning :deep(svg) {
  animation: spin-refresh 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes spin-refresh {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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

.tab-item.drag-over {
  background: color-mix(in oklch, var(--color-primary-100) 50%, transparent);
  border-radius: 8px;
  box-shadow: inset 0 0 0 1.5px var(--color-primary-300);
}

.tab-item[draggable="true"] {
  cursor: pointer;
}

.tab-item[draggable="true"]:active {
  cursor: grabbing;
}

.tab-transition-enter-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-transition-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-transition-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.9);
}

.tab-transition-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

.tab-transition-move {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
