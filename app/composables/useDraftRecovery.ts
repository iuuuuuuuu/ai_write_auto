export type DraftRecoveryType = 'generate' | 'expand' | 'rewrite' | 'continue'

export interface DraftRecoveryPayload {
  content: string
  type: DraftRecoveryType
  timestamp: number
}

function isDraftRecoveryType(value: unknown): value is DraftRecoveryType {
  return value === 'generate' || value === 'expand' || value === 'rewrite' || value === 'continue'
}

function isDraftRecoveryPayload(value: unknown): value is DraftRecoveryPayload {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.content === 'string' &&
    record.content.length > 0 &&
    isDraftRecoveryType(record.type) &&
    typeof record.timestamp === 'number'
  )
}

export function useDraftRecovery(
  novelId: MaybeRefOrGetter<number>,
  chapterId: MaybeRefOrGetter<number>
) {
  const draftRecoveryKey = computed(
    () => `ai_write_draft_${toValue(novelId)}_${toValue(chapterId)}`
  )
  const draftRecovery = ref<DraftRecoveryPayload | null>(null)

  function loadDraftRecovery() {
    try {
      const raw = localStorage.getItem(draftRecoveryKey.value)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!isDraftRecoveryPayload(parsed)) {
        localStorage.removeItem(draftRecoveryKey.value)
        return
      }
      if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        draftRecovery.value = parsed
        return
      }
      localStorage.removeItem(draftRecoveryKey.value)
    } catch {
      draftRecovery.value = null
    }
  }

  function saveDraftRecovery(draftContent: string, type: DraftRecoveryType) {
    try {
      const payload: DraftRecoveryPayload = {
        content: draftContent,
        type,
        timestamp: Date.now()
      }
      localStorage.setItem(draftRecoveryKey.value, JSON.stringify(payload))
    } catch {
      // localStorage 可能不可用或已满
    }
  }

  function clearDraftRecovery() {
    draftRecovery.value = null
    try {
      localStorage.removeItem(draftRecoveryKey.value)
    } catch {}
  }

  return {
    draftRecovery,
    draftRecoveryKey,
    loadDraftRecovery,
    saveDraftRecovery,
    clearDraftRecovery
  }
}
