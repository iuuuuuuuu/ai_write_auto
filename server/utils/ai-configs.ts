import { and, eq } from 'drizzle-orm'
import { schema, type Database } from '../database'

export type AiConfigPurpose =
  | 'generation'
  | 'extraction'
  | 'consistency_check'
  | 'style_analysis'

export interface UserAiConfig {
  id: number
  userId: number
  name: string
  purpose: AiConfigPurpose
  apiUrl: string
  apiKey: string
  model: string
  temperature: string | null
  maxTokens: number | null
  isDefault: boolean
  enabled: boolean
}

export async function resolveUserAiConfig(
  db: Database,
  userId: number,
  purpose: AiConfigPurpose,
  aiConfigId?: number
): Promise<UserAiConfig> {
  const configs = await db
    .select()
    .from(schema.aiConfigs)
    .where(
      and(
        eq(schema.aiConfigs.userId, userId),
        eq(schema.aiConfigs.purpose, purpose)
      )
    )

  const enabledConfigs = (configs as UserAiConfig[]).filter(
    (config) => config.enabled !== false
  )
  const config =
    aiConfigId ?
      enabledConfigs.find((item) => item.id === aiConfigId)
    : enabledConfigs.find((item) => item.isDefault) || enabledConfigs[0]

  if (!config) {
    throw createError({
      statusCode: 400,
      message: `No AI config found for ${purpose}`
    })
  }

  return config
}

export function maskApiKey(apiKey: string) {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '********'
  return `${apiKey.slice(0, 4)}********${apiKey.slice(-4)}`
}
