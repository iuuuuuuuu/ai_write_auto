import { describe, expect, it } from 'vitest'
import {
  getBuiltinModelPreset,
  isModelOperational,
  resolveAiRequestParameters,
  validateSamplingParams,
  type AiRequestParameterInput
} from '../server/utils/ai-model-capabilities'

function baseInput(
  overrides: Partial<AiRequestParameterInput> = {}
): AiRequestParameterInput {
  return {
    model: 'mimo-v2.5-pro',
    modelCapabilities: getBuiltinModelPreset('mimo-v2.5-pro'),
    config: {
      temperature: '0.8',
      topP: '0.9',
      thinkingEnabled: true,
      reasoningEffort: 'medium'
    },
    novel: {
      temperature: '0.6',
      topP: '0.7',
      thinkingEnabled: false,
      reasoningEffort: 'low'
    },
    request: {
      temperature: 0.4,
      topP: 0.5,
      thinkingEnabled: true,
      reasoningEffort: 'high'
    },
    ...overrides
  }
}

describe('ai-model-capabilities', () => {
  it('uses mimo builtin preset without making the feature provider-specific', () => {
    const preset = getBuiltinModelPreset('mimo-v2.5-pro')

    expect(preset.temperatureDefault).toBe(1)
    expect(preset.temperatureMin).toBe(0)
    expect(preset.temperatureMax).toBe(1.5)
    expect(preset.topPDefault).toBe(0.95)
    expect(preset.topPMin).toBe(0.01)
    expect(preset.topPMax).toBe(1)
    expect(preset.supportsThinking).toBe(true)
    expect(preset.samplingLockedWhenThinking).toBe(true)
  })

  it('resolves request override before novel override before config before model defaults', () => {
    const resolved = resolveAiRequestParameters(baseInput())

    expect(resolved.temperature).toBe(1)
    expect(resolved.topP).toBe(0.95)
    expect(resolved.thinkingEnabled).toBe(true)
    expect(resolved.reasoningEffort).toBe('high')
    expect(resolved.samplingLocked).toBe(true)
  })

  it('falls back through novel and config layers when request omits overrides', () => {
    const resolved = resolveAiRequestParameters(
      baseInput({
        model: 'custom-writing-model',
        modelCapabilities: { supportsThinking: true },
        request: {},
        novel: {
          temperature: '0.6',
          topP: '0.7',
          thinkingEnabled: true,
          reasoningEffort: 'low'
        }
      })
    )

    expect(resolved.temperature).toBe(0.6)
    expect(resolved.topP).toBe(0.7)
    expect(resolved.thinkingEnabled).toBe(true)
    expect(resolved.reasoningEffort).toBe('low')
    expect(resolved.samplingLocked).toBe(false)
  })

  it('validates sampling params against model capability ranges', () => {
    const capability = getBuiltinModelPreset('mimo-v2-flash')

    expect(
      validateSamplingParams(capability, { temperature: 0.3, topP: 0.95 })
    ).toEqual([])
    expect(
      validateSamplingParams(capability, { temperature: 2, topP: 0 })
    ).toEqual([
      'temperature 必须在 0 到 1.5 之间',
      'top_p 必须在 0.01 到 1 之间'
    ])
  })

  it('treats enabled but failed models as unavailable', () => {
    expect(
      isModelOperational({
        enabled: true,
        lastCheckAvailable: false,
        provider: { enabled: true }
      })
    ).toBe(false)

    expect(
      isModelOperational({
        enabled: true,
        lastCheckAvailable: true,
        provider: { enabled: true }
      })
    ).toBe(true)
  })
})
