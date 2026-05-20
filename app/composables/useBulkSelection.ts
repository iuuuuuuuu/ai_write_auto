export function useBulkSelection<T extends { id: number }>() {
  const selectedIds = ref<Set<number>>(new Set())
  const allSelected = ref(false)

  function toggle(id: number) {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id)
    } else {
      selectedIds.value.add(id)
    }
    selectedIds.value = new Set(selectedIds.value)
  }

  function selectAll(items: T[]) {
    if (allSelected.value) {
      selectedIds.value = new Set()
      allSelected.value = false
    } else {
      selectedIds.value = new Set(items.map((i) => i.id))
      allSelected.value = true
    }
  }

  function clear() {
    selectedIds.value = new Set()
    allSelected.value = false
  }

  function isSelected(id: number) {
    return selectedIds.value.has(id)
  }

  const count = computed(() => selectedIds.value.size)
  const hasSelection = computed(() => selectedIds.value.size > 0)

  return {
    selectedIds,
    allSelected,
    count,
    hasSelection,
    toggle,
    selectAll,
    clear,
    isSelected,
  }
}
