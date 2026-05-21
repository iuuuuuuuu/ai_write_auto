<script setup lang="ts">
export interface ShortcutItem {
  label: string
  keys: string
  action?: string
}

const props = defineProps<{
  show: boolean
  title?: string
  shortcuts: ShortcutItem[]
  storageKey?: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  change: [shortcuts: ShortcutItem[]]
}>()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const editing = shallowRef(false)
const editingAction = shallowRef<string | null>(null)
const customShortcuts = ref<Record<string, string>>({})

const displayShortcuts = computed(() => {
  return props.shortcuts.map((shortcut) => ({
    ...shortcut,
    keys: shortcut.action ? customShortcuts.value[shortcut.action] || shortcut.keys : shortcut.keys
  }))
})

function loadCustomShortcuts() {
  if (!props.storageKey) return
  try {
    customShortcuts.value = JSON.parse(localStorage.getItem(props.storageKey) || '{}')
  } catch {
    customShortcuts.value = {}
  }
}

function saveCustomShortcuts() {
  if (!props.storageKey) return
  localStorage.setItem(props.storageKey, JSON.stringify(customShortcuts.value))
  emit('change', displayShortcuts.value)
}

function normalizeShortcut(event: KeyboardEvent) {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
  if (!['Control', 'Meta', 'Shift', 'Alt'].includes(key)) parts.push(key)
  return parts.join(' + ')
}

function startEdit(shortcut: ShortcutItem) {
  if (!shortcut.action) return
  editingAction.value = shortcut.action
}

function handleShortcutInput(event: KeyboardEvent) {
  if (!editingAction.value) return
  event.preventDefault()
  const value = normalizeShortcut(event)
  if (!value || !value.includes('Ctrl')) return
  customShortcuts.value = {
    ...customShortcuts.value,
    [editingAction.value]: value
  }
  editingAction.value = null
  saveCustomShortcuts()
}

function resetShortcuts() {
  customShortcuts.value = {}
  saveCustomShortcuts()
}

watch(visible, (show) => {
  if (show) loadCustomShortcuts()
}, { immediate: true })
</script>

<template>
  <NModal
    v-model:show="visible"
    preset="card"
    :title="title || '快捷键'"
    style="max-width: 560px"
  >
    <div class="mb-3 flex items-center justify-between gap-2">
      <p class="text-xs text-(--ui-text-dimmed)">
        {{ editing ? '点击快捷键项后按下新的组合键，需包含 Ctrl / Cmd。' : '查看当前可用快捷键。' }}
      </p>
      <div class="flex gap-1">
        <NButton size="tiny" quaternary @click="editing = !editing">
          {{ editing ? '完成' : '自定义' }}
        </NButton>
        <NButton v-if="editing" size="tiny" quaternary @click="resetShortcuts">
          重置
        </NButton>
      </div>
    </div>

    <div class="space-y-2 text-sm" @keydown="handleShortcutInput">
      <button
        v-for="(shortcut, index) in displayShortcuts"
        :key="shortcut.action || index"
        type="button"
        class="flex w-full items-center justify-between rounded-lg bg-(--ui-bg-muted)/40 px-3 py-2 text-left transition-colors"
        :class="editing && shortcut.action ? 'hover:bg-(--ui-bg-elevated)' : ''"
        :disabled="!editing || !shortcut.action"
        @click="startEdit(shortcut)"
      >
        <span class="text-(--ui-text-muted)">{{ shortcut.label }}</span>
        <kbd
          class="font-mono text-xs"
          :class="editingAction === shortcut.action ? 'text-primary-500' : 'text-(--ui-text-highlighted)'"
        >
          {{ editingAction === shortcut.action ? '按下新快捷键...' : shortcut.keys }}
        </kbd>
      </button>
    </div>
  </NModal>
</template>
