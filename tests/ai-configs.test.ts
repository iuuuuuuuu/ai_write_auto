import { describe, expect, it } from 'vitest'
import {
  selectAiStatusConfig,
  type AiStatusConfigCandidate
} from '../server/utils/ai-configs'

function candidate(
  overrides: Partial<AiStatusConfigCandidate> = {}
): AiStatusConfigCandidate {
  return {
    id: 1,
    enabled: true,
    isDefault: false,
    aiModel: {
      enabled: true,
      lastCheckAvailable: true,
      provider: { enabled: true }
    },
    ...overrides
  }
}

describe('ai-configs', () => {
  it('selects another operational generation config when the default one is stale', () => {
    const selected = selectAiStatusConfig([
      candidate({
        id: 1,
        isDefault: true,
        aiModel: {
          enabled: true,
          lastCheckAvailable: false,
          provider: { enabled: true }
        }
      }),
      candidate({ id: 2, isDefault: false })
    ])

    expect(selected?.id).toBe(2)
  })

  it('allows retrying the requested config even when its previous check failed', () => {
    const selected = selectAiStatusConfig(
      [
        candidate({ id: 1, isDefault: true }),
        candidate({
          id: 2,
          aiModel: {
            enabled: true,
            lastCheckAvailable: false,
            provider: { enabled: true }
          }
        })
      ],
      { requestedConfigId: 2, allowUnchecked: true }
    )

    expect(selected?.id).toBe(2)
  })
})
