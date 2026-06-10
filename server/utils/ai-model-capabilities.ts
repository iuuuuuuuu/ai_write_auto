export type ReasoningEffort = 'low' | 'medium' | 'high'

export interface AiModelCapabilities {
  supportsThinking: boolean
  thinkingEnabled: boolean
  reasoningEffort: ReasoningEffort
  temperatureDefault: number
  temperatureMin: number
  temperatureMax: number
  topPDefault: number
  topPMin: number
  topPMax: number
  samplingLockedWhenThinking: boolean
}

export interface AiParameterLayer {
  temperature?: string | number | null
  topP?: string | number | null
  thinkingEnabled?: boolean | null
  reasoningEffort?: string | null
}

export interface AiRequestParameterInput {
  model: string
  modelCapabilities?: Partial<AiModelCapabilities> | null
  config?: AiParameterLayer | null
  novel?: AiParameterLayer | null
  request?: AiParameterLayer | null
}

export interface ResolvedAiRequestParameters {
  temperature: number
  topP: number
  thinkingEnabled: boolean
  reasoningEffort: ReasoningEffort | null
  samplingLocked: boolean
}

export interface OperationalModelRef {
  enabled?: boolean | null
  lastCheckAvailable?: boolean | null
  provider?: { enabled?: boolean | null } | null
}

const DEFAULT_CAPABILITIES: AiModelCapabilities = {
  supportsThinking: false,
  thinkingEnabled: false,
  reasoningEffort: 'low',
  temperatureDefault: 0.7,
  temperatureMin: 0,
  temperatureMax: 1.5,
  topPDefault: 0.95,
  topPMin: 0.01,
  topPMax: 1,
  samplingLockedWhenThinking: false
}

const MIMO_THINKING_LOCKED_MODELS = new Set([
  'mimo-v2.5-pro',
  'mimo-v2.5',
  'mimo-v2-pro',
  'mimo-v2-omni'
])

const MIMO_TTS_MODELS = new Set([
  'mimo-v2.5-tts',
  'mimo-v2.5-tts-voicedesign',
  'mimo-v2.5-tts-voiceclone',
  'mimo-v2-tts'
])

export function getKnownBuiltinModelNames(): string[] {
  return [...MIMO_THINKING_LOCKED_MODELS, ...MIMO_TTS_MODELS, 'mimo-v2-flash']
}

function normalizeModelName(model: string): string {
  return model.trim().toLowerCase()
}

function normalizeReasoningEffort(
  value: string | null | undefined
): ReasoningEffort | null {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return null
}

function parseFiniteNumber(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function firstNumber(
  ...values: Array<string | number | null | undefined>
): number | null {
  for (const value of values) {
    const parsed = parseFiniteNumber(value)
    if (parsed !== null) return parsed
  }
  return null
}

function firstBoolean(
  ...values: Array<boolean | null | undefined>
): boolean | null {
  for (const value of values) {
    if (typeof value === 'boolean') return value
  }
  return null
}

function firstReasoningEffort(
  ...values: Array<string | null | undefined>
): ReasoningEffort | null {
  for (const value of values) {
    const normalized = normalizeReasoningEffort(value)
    if (normalized) return normalized
  }
  return null
}

export function getBuiltinModelPreset(model: string): AiModelCapabilities {
  const normalized = normalizeModelName(model)

  if (MIMO_THINKING_LOCKED_MODELS.has(normalized)) {
    return {
      ...DEFAULT_CAPABILITIES,
      supportsThinking: true,
      thinkingEnabled: true,
      reasoningEffort: 'medium',
      temperatureDefault: 1,
      topPDefault: 0.95,
      samplingLockedWhenThinking: true
    }
  }

  if (MIMO_TTS_MODELS.has(normalized)) {
    return {
      ...DEFAULT_CAPABILITIES,
      temperatureDefault: 0.6,
      topPDefault: 0.95
    }
  }

  if (normalized === 'mimo-v2-flash') {
    return {
      ...DEFAULT_CAPABILITIES,
      temperatureDefault: 0.3,
      topPDefault: 0.95
    }
  }

  return DEFAULT_CAPABILITIES
}

export function normalizeModelCapabilities(
  model: string,
  capabilities?: Partial<AiModelCapabilities> | null
): AiModelCapabilities {
  return {
    ...getBuiltinModelPreset(model),
    ...capabilities
  }
}

export function validateSamplingParams(
  capabilities: AiModelCapabilities,
  params: { temperature?: number | null; topP?: number | null }
): string[] {
  const errors: string[] = []
  if (
    typeof params.temperature === 'number' &&
    (params.temperature < capabilities.temperatureMin ||
      params.temperature > capabilities.temperatureMax)
  ) {
    errors.push(
      `temperature 必须在 ${capabilities.temperatureMin} 到 ${capabilities.temperatureMax} 之间`
    )
  }
  if (
    typeof params.topP === 'number' &&
    (params.topP < capabilities.topPMin || params.topP > capabilities.topPMax)
  ) {
    errors.push(
      `top_p 必须在 ${capabilities.topPMin} 到 ${capabilities.topPMax} 之间`
    )
  }
  return errors
}

export function resolveAiRequestParameters(
  input: AiRequestParameterInput
): ResolvedAiRequestParameters {
  const capabilities = normalizeModelCapabilities(
    input.model,
    input.modelCapabilities
  )
  const requestedThinking =
    firstBoolean(
      input.request?.thinkingEnabled,
      input.novel?.thinkingEnabled,
      input.config?.thinkingEnabled,
      capabilities.thinkingEnabled
    ) ?? false
  const thinkingEnabled = capabilities.supportsThinking && requestedThinking
  const reasoningEffort =
    thinkingEnabled ?
      (firstReasoningEffort(
        input.request?.reasoningEffort,
        input.novel?.reasoningEffort,
        input.config?.reasoningEffort,
        capabilities.reasoningEffort
      ) ?? capabilities.reasoningEffort)
    : null
  const samplingLocked =
    thinkingEnabled && capabilities.samplingLockedWhenThinking

  if (samplingLocked) {
    return {
      temperature: capabilities.temperatureDefault,
      topP: capabilities.topPDefault,
      thinkingEnabled,
      reasoningEffort,
      samplingLocked
    }
  }

  const temperature =
    firstNumber(
      input.request?.temperature,
      input.novel?.temperature,
      input.config?.temperature,
      capabilities.temperatureDefault
    ) ?? capabilities.temperatureDefault
  const topP =
    firstNumber(
      input.request?.topP,
      input.novel?.topP,
      input.config?.topP,
      capabilities.topPDefault
    ) ?? capabilities.topPDefault
  const errors = validateSamplingParams(capabilities, { temperature, topP })
  if (errors.length) {
    throw createError({ statusCode: 400, message: errors[0] })
  }

  return {
    temperature,
    topP,
    thinkingEnabled,
    reasoningEffort,
    samplingLocked
  }
}

export function isModelOperational(model: OperationalModelRef): boolean {
  return (
    model.enabled !== false &&
    model.provider?.enabled !== false &&
    model.lastCheckAvailable === true
  )
}
