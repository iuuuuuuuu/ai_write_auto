export interface GenerationContextSelection {
  includedKeys: string[]
  excludedKeys: string[]
}

export interface GenerationContextPreviewItem {
  key: string
  type: string
  title: string
  summary: string
  content: string
  required: boolean
  selectedByDefault: boolean
  tokenEstimate: number
  meta: Record<string, unknown>
}

export interface GenerationContextPreviewSection {
  key: string
  title: string
  items: GenerationContextPreviewItem[]
}

export function useGenerationContextSelection() {
  const selectedKeys = ref<Set<string>>(new Set())
  const requiredKeys = ref<Set<string>>(new Set())

  function initializeFromSections(sections: GenerationContextPreviewSection[]) {
    const nextSelected = new Set<string>()
    const nextRequired = new Set<string>()
    for (const section of sections) {
      for (const item of section.items) {
        if (item.required) nextRequired.add(item.key)
        if (item.required || item.selectedByDefault) nextSelected.add(item.key)
      }
    }
    selectedKeys.value = nextSelected
    requiredKeys.value = nextRequired
  }

  function isSelected(key: string): boolean {
    return selectedKeys.value.has(key)
  }

  function setSelected(key: string, selected: boolean) {
    const next = new Set(selectedKeys.value)
    if (requiredKeys.value.has(key)) {
      next.add(key)
    } else if (selected) {
      next.add(key)
    } else {
      next.delete(key)
    }
    selectedKeys.value = next
  }

  function setSectionSelected(
    section: GenerationContextPreviewSection,
    selected: boolean
  ) {
    const next = new Set(selectedKeys.value)
    for (const item of section.items) {
      if (item.required || selected) next.add(item.key)
      else next.delete(item.key)
    }
    selectedKeys.value = next
  }

  function toPayload(
    sections: GenerationContextPreviewSection[]
  ): GenerationContextSelection {
    const allOptionalKeys = sections
      .flatMap((section) => section.items)
      .filter((item) => !item.required)
      .map((item) => item.key)
    return {
      includedKeys: Array.from(selectedKeys.value),
      excludedKeys: allOptionalKeys.filter(
        (key) => !selectedKeys.value.has(key)
      )
    }
  }

  function countSelectedTokens(
    sections: GenerationContextPreviewSection[]
  ): number {
    return sections
      .flatMap((section) => section.items)
      .filter((item) => selectedKeys.value.has(item.key))
      .reduce((sum, item) => sum + item.tokenEstimate, 0)
  }

  return {
    selectedKeys,
    initializeFromSections,
    isSelected,
    setSelected,
    setSectionSelected,
    toPayload,
    countSelectedTokens
  }
}
