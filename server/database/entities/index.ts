import { EntitySchema, type OptionalProps } from '@mikro-orm/core'
import { UnixTimestampType } from '../types/UnixTimestampType'

// ─── Interfaces ───

export interface User {
  [OptionalProps]?: 'id' | 'role' | 'createdAt'
  id: number
  username: string
  passwordHash: string
  role: 'admin' | 'user'
  createdAt: Date
}

export interface SiteConfig {
  key: string
  value: string
}

export interface AiProvider {
  [OptionalProps]?:
    | 'id'
    | 'enabled'
    | 'lastCheckAt'
    | 'lastCheckAvailable'
    | 'lastCheckReason'
    | 'createdAt'
    | 'updatedAt'
  id: number
  user: User
  name: string
  apiUrl: string
  apiKey: string
  enabled: boolean
  lastCheckAt: Date | null
  lastCheckAvailable: boolean | null
  lastCheckReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AiModel {
  [OptionalProps]?:
    | 'id'
    | 'enabled'
    | 'supportsThinking'
    | 'thinkingEnabled'
    | 'reasoningEffort'
    | 'temperatureDefault'
    | 'temperatureMin'
    | 'temperatureMax'
    | 'topPDefault'
    | 'topPMin'
    | 'topPMax'
    | 'samplingLockedWhenThinking'
    | 'lastCheckAt'
    | 'lastCheckAvailable'
    | 'lastCheckReason'
    | 'createdAt'
    | 'updatedAt'
  id: number
  user: User
  provider: AiProvider | null
  name: string
  model: string
  maxTokens: number
  enabled: boolean
  supportsThinking: boolean
  thinkingEnabled: boolean
  reasoningEffort: 'low' | 'medium' | 'high'
  temperatureDefault: number
  temperatureMin: number
  temperatureMax: number
  topPDefault: number
  topPMin: number
  topPMax: number
  samplingLockedWhenThinking: boolean
  lastCheckAt: Date | null
  lastCheckAvailable: boolean | null
  lastCheckReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AiConfig {
  [OptionalProps]?:
    | 'id'
    | 'temperature'
    | 'topP'
    | 'thinkingEnabled'
    | 'reasoningEffort'
    | 'isDefault'
    | 'enabled'
    | 'order'
    | 'createdAt'
    | 'updatedAt'
  id: number
  user: User
  aiModel: AiModel
  purpose:
    | 'generation'
    | 'extraction'
    | 'consistency_check'
    | 'style_analysis'
    | 'planning'
  temperature: string | null
  topP: string | null
  thinkingEnabled: boolean | null
  reasoningEffort: 'low' | 'medium' | 'high' | null
  isDefault: boolean
  enabled: boolean
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface Novel {
  [OptionalProps]?:
    | 'id'
    | 'description'
    | 'genre'
    | 'status'
    | 'styleGuide'
    | 'worldSetting'
    | 'aiTemperature'
    | 'aiTopP'
    | 'aiThinkingEnabled'
    | 'aiReasoningEffort'
    | 'aiExtraPrompt'
    | 'enabledSkillIds'
    | 'defaultPromptTemplateId'
    | 'aiConfig'
    | 'deletedAt'
    | 'createdAt'
    | 'updatedAt'
  id: number
  user: User
  title: string
  description: string | null
  genre: string | null
  status: 'draft' | 'in_progress' | 'completed'
  styleGuide: string | null
  worldSetting: string | null
  aiTemperature: string | null
  aiTopP: string | null
  aiThinkingEnabled: boolean | null
  aiReasoningEffort: 'low' | 'medium' | 'high' | null
  aiExtraPrompt: string | null
  /** JSON 序列化：number[] 本书默认启用的写作技能包 id */
  enabledSkillIds: string | null
  /** 章节生成默认 prompt 模板 id（需求2 自动选模板） */
  defaultPromptTemplateId: number | null
  aiConfig: AiConfig | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface NovelOutline {
  [OptionalProps]?: 'id'
  id: number
  novel: Novel
  chapterNumber: number
  description: string
  sortOrder: number
}

export interface NovelTemplate {
  [OptionalProps]?:
    | 'id'
    | 'defaultStyleGuide'
    | 'defaultAiPrompt'
    | 'defaultTemperature'
  id: number
  name: string
  genre: string
  defaultStyleGuide: string | null
  defaultAiPrompt: string | null
  defaultTemperature: string | null
}

export interface Chapter {
  [OptionalProps]?:
    | 'id'
    | 'content'
    | 'summary'
    | 'status'
    | 'wordCount'
    | 'deletedAt'
    | 'createdAt'
    | 'updatedAt'
  id: number
  novel: Novel
  chapterNumber: number
  title: string
  content: string | null
  summary: string | null
  status: 'draft' | 'generated' | 'edited' | 'final'
  wordCount: number | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ChapterVersion {
  [OptionalProps]?: 'id' | 'createdAt'
  id: number
  chapter: Chapter
  versionNumber: number
  content: string
  source: 'ai_generated' | 'user_edited'
  createdAt: Date
}

export interface ChapterNote {
  [OptionalProps]?: 'id' | 'createdAt' | 'updatedAt'
  id: number
  chapter: Chapter
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface Character {
  [OptionalProps]?:
    | 'id'
    | 'description'
    | 'traits'
    | 'relationships'
    | 'currentState'
    | 'realName'
    | 'displayTitle'
    | 'rolePosition'
    | 'storyRole'
    | 'firstAppearanceChapter'
    | 'lastAppearanceChapter'
    | 'overallArc'
    | 'createdAt'
  id: number
  novel: Novel
  name: string
  description: string | null
  traits: string | null
  relationships: string | null
  currentState: string | null
  realName: string | null
  displayTitle: string | null
  rolePosition: string | null
  storyRole: string | null
  firstAppearanceChapter: number | null
  lastAppearanceChapter: number | null
  overallArc: string | null
  createdAt: Date
}

export interface ChapterCharacter {
  [OptionalProps]?: 'id' | 'role' | 'chapterStory'
  id: number
  chapter: Chapter
  character: Character
  role: 'main' | 'supporting' | 'mentioned'
  chapterStory: string | null
}

export interface CharacterAppearance {
  [OptionalProps]?:
    | 'id'
    | 'role'
    | 'snippet'
    | 'positionStart'
    | 'positionEnd'
    | 'background'
    | 'createdAt'
  id: number
  novel: Novel
  chapter: Chapter
  character: Character
  role: 'main' | 'supporting' | 'mentioned'
  snippet: string | null
  positionStart: number | null
  positionEnd: number | null
  background: string | null
  createdAt: Date
}

export interface CharacterStateChange {
  [OptionalProps]?:
    | 'id'
    | 'relatedCharacter'
    | 'beforeValue'
    | 'reason'
    | 'evidenceQuote'
    | 'confidence'
    | 'status'
    | 'source'
    | 'contentHash'
    | 'chapterUpdatedAtSnapshot'
    | 'createdAt'
    | 'updatedAt'
  id: number
  novel: Novel
  chapter: Chapter
  character: Character
  relatedCharacter: Character | null
  changeType: string
  beforeValue: string | null
  afterValue: string
  reason: string | null
  evidenceQuote: string | null
  confidence: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'reverted'
  source: 'ai' | 'manual'
  contentHash: string | null
  chapterUpdatedAtSnapshot: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CharacterStateSnapshot {
  [OptionalProps]?:
    | 'id'
    | 'sourceChangeIds'
    | 'contentHash'
    | 'createdAt'
    | 'updatedAt'
  id: number
  novel: Novel
  chapter: Chapter
  character: Character
  stateJson: string
  sourceChangeIds: string | null
  contentHash: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PlotPoint {
  [OptionalProps]?: 'id' | 'chapter' | 'status' | 'createdAt'
  id: number
  novel: Novel
  chapter: Chapter | null
  description: string
  type: 'setup' | 'conflict' | 'resolution' | 'twist'
  status: 'introduced' | 'developing' | 'resolved'
  createdAt: Date
}

export interface StoryArc {
  [OptionalProps]?: 'id' | 'summary' | 'endChapter'
  id: number
  novel: Novel
  title: string
  summary: string | null
  startChapter: number
  endChapter: number | null
}

export interface GenerationTask {
  [OptionalProps]?:
    | 'id'
    | 'chapter'
    | 'status'
    | 'result'
    | 'error'
    | 'retryCount'
    | 'tokensUsed'
    | 'createdAt'
    | 'completedAt'
  id: number
  novel: Novel
  chapter: Chapter | null
  type: string
  status:
    | 'pending'
    | 'running'
    | 'paused'
    | 'cancelled'
    | 'completed'
    | 'failed'
  result: string | null
  error: string | null
  retryCount: number | null
  tokensUsed: number | null
  createdAt: Date
  completedAt: Date | null
}

export interface TokenUsage {
  [OptionalProps]?: 'id' | 'aiConfig' | 'estimatedCost' | 'createdAt'
  id: number
  user: User
  aiConfig: AiConfig | null
  tokensInput: number
  tokensOutput: number
  estimatedCost: string | null
  createdAt: Date
}

export interface PromptTemplate {
  [OptionalProps]?: 'id' | 'user' | 'isSystem' | 'createdAt'
  id: number
  user: User | null
  name: string
  content: string
  category:
    | 'generation'
    | 'rewrite'
    | 'expand'
    | 'character_generation'
    | 'custom'
  isSystem: boolean | null
  createdAt: Date
}

export interface WritingSkill {
  [OptionalProps]?:
    | 'id'
    | 'user'
    | 'description'
    | 'genre'
    | 'systemAddon'
    | 'fewShots'
    | 'checklist'
    | 'appliesTo'
    | 'isSystem'
    | 'enabled'
    | 'createdAt'
  id: number
  user: User | null
  name: string
  description: string | null
  /** 适用题材；null = 通用 */
  genre: string | null
  /** 注入 system prompt 的写作指令 */
  systemAddon: string | null
  /** JSON 序列化：[{ scene: string; content: string }] 范文 few-shot */
  fewShots: string | null
  /** JSON 序列化：string[] 生成后自检清单 */
  checklist: string | null
  /** JSON 序列化：string[] 适用动作，如 ['generation','rewrite']；null/空 视为全适用 */
  appliesTo: string | null
  isSystem: boolean | null
  /** 用户自建技能包是否默认启用 */
  enabled: boolean | null
  createdAt: Date
}

export interface WritingStat {
  [OptionalProps]?:
    | 'id'
    | 'wordsWritten'
    | 'chaptersCompleted'
    | 'aiGenerations'
  id: number
  user: User
  date: string
  wordsWritten: number | null
  chaptersCompleted: number | null
  aiGenerations: number | null
}

export interface UserPreference {
  [OptionalProps]?: 'id'
  id: number
  user: User
  key: string
  value: string
}

export interface SchemaMigration {
  [OptionalProps]?: 'id' | 'appliedAt'
  id: number
  version: string
  source: string
  appliedAt: Date
}

export interface ApiToken {
  [OptionalProps]?: 'id' | 'tokenPrefix' | 'lastUsedAt' | 'createdAt'
  id: number
  user: User
  name: string
  tokenHash: string
  tokenPrefix: string | null
  lastUsedAt: Date | null
  createdAt: Date
}

export interface ModelCostRate {
  [OptionalProps]?: 'id' | 'createdAt' | 'updatedAt'
  id: number
  user: User
  model: string
  inputCostPer1k: string
  outputCostPer1k: string
  createdAt: Date
  updatedAt: Date
}

export interface ConsistencyIssue {
  [OptionalProps]?:
    | 'id'
    | 'dismissed'
    | 'createdAt'
    | 'quote'
    | 'priorQuote'
    | 'priorChapter'
    | 'confidence'
    | 'signature'
  id: number
  chapter: Chapter
  type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  quote: string | null
  priorQuote: string | null
  priorChapter: number | null
  confidence: string | null
  signature: string | null
  dismissed: boolean
  createdAt: Date
}

export interface Foreshadowing {
  [OptionalProps]?: 'id' | 'status' | 'resolvedAtChapter' | 'createdAt'
  id: number
  novel: Novel
  chapter: Chapter | null
  content: string
  description: string | null
  status: 'active' | 'resolved' | 'abandoned'
  resolvedAtChapter: number | null
  createdAt: Date
}

// ─── Entity Schemas ───

export const UserSchema = new EntitySchema<User>({
  name: 'User',
  tableName: 'users',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    username: { type: 'string', unique: true },
    passwordHash: { type: 'string', fieldName: 'password_hash' },
    role: { type: 'string', default: 'user' },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const SiteConfigSchema = new EntitySchema<SiteConfig>({
  name: 'SiteConfig',
  tableName: 'site_config',
  properties: {
    key: { type: 'string', primary: true, fieldName: 'key' },
    value: { type: 'string' }
  }
})

export const AiProviderSchema = new EntitySchema<AiProvider>({
  name: 'AiProvider',
  tableName: 'ai_providers',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    name: { type: 'string' },
    apiUrl: { type: 'string', fieldName: 'api_url' },
    apiKey: { type: 'string', fieldName: 'api_key' },
    enabled: { type: 'boolean', default: true },
    lastCheckAt: {
      type: UnixTimestampType,
      fieldName: 'last_check_at',
      nullable: true,
      default: null
    },
    lastCheckAvailable: {
      type: 'boolean',
      fieldName: 'last_check_available',
      nullable: true,
      default: null
    },
    lastCheckReason: {
      type: 'string',
      fieldName: 'last_check_reason',
      nullable: true,
      default: null
    },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    },
    updatedAt: {
      type: UnixTimestampType,
      fieldName: 'updated_at',
      onCreate: () => new Date(),
      onUpdate: () => new Date()
    }
  }
})

export const AiModelSchema = new EntitySchema<AiModel>({
  name: 'AiModel',
  tableName: 'ai_models',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    provider: {
      kind: 'm:1',
      entity: () => 'AiProvider',
      fieldName: 'provider_id',
      nullable: true
    },
    name: { type: 'string' },
    model: { type: 'string' },
    maxTokens: { type: 'number', fieldName: 'max_tokens', default: 4096 },
    enabled: { type: 'boolean', default: true },
    supportsThinking: {
      type: 'boolean',
      fieldName: 'supports_thinking',
      default: false
    },
    thinkingEnabled: {
      type: 'boolean',
      fieldName: 'thinking_enabled',
      default: false
    },
    reasoningEffort: {
      type: 'string',
      fieldName: 'reasoning_effort',
      default: 'low'
    },
    temperatureDefault: {
      type: 'number',
      fieldName: 'temperature_default',
      default: 0.7
    },
    temperatureMin: {
      type: 'number',
      fieldName: 'temperature_min',
      default: 0
    },
    temperatureMax: {
      type: 'number',
      fieldName: 'temperature_max',
      default: 1.5
    },
    topPDefault: {
      type: 'number',
      fieldName: 'top_p_default',
      default: 0.95
    },
    topPMin: { type: 'number', fieldName: 'top_p_min', default: 0.01 },
    topPMax: { type: 'number', fieldName: 'top_p_max', default: 1 },
    samplingLockedWhenThinking: {
      type: 'boolean',
      fieldName: 'sampling_locked_when_thinking',
      default: false
    },
    lastCheckAt: {
      type: UnixTimestampType,
      fieldName: 'last_check_at',
      nullable: true,
      default: null
    },
    lastCheckAvailable: {
      type: 'boolean',
      fieldName: 'last_check_available',
      nullable: true,
      default: null
    },
    lastCheckReason: {
      type: 'string',
      fieldName: 'last_check_reason',
      nullable: true,
      default: null
    },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    },
    updatedAt: {
      type: UnixTimestampType,
      fieldName: 'updated_at',
      onCreate: () => new Date(),
      onUpdate: () => new Date()
    }
  }
})

export const AiConfigSchema = new EntitySchema<AiConfig>({
  name: 'AiConfig',
  tableName: 'ai_configs',
  indexes: [
    { properties: ['user', 'purpose'], name: 'idx_ai_configs_user_purpose' }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    aiModel: { kind: 'm:1', entity: () => 'AiModel', fieldName: 'ai_model_id' },
    purpose: { type: 'string' },
    temperature: { type: 'string', nullable: true, default: '0.7' },
    topP: { type: 'string', nullable: true, fieldName: 'top_p', default: null },
    thinkingEnabled: {
      type: 'boolean',
      nullable: true,
      fieldName: 'thinking_enabled',
      default: null
    },
    reasoningEffort: {
      type: 'string',
      nullable: true,
      fieldName: 'reasoning_effort',
      default: null
    },
    isDefault: { type: 'boolean', fieldName: 'is_default', default: false },
    enabled: { type: 'boolean', default: true },
    order: { type: 'number', default: 0 },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    },
    updatedAt: {
      type: UnixTimestampType,
      fieldName: 'updated_at',
      onCreate: () => new Date(),
      onUpdate: () => new Date()
    }
  }
})

export const NovelSchema = new EntitySchema<Novel>({
  name: 'Novel',
  tableName: 'novels',
  indexes: [
    { properties: ['user', 'deletedAt'], name: 'idx_novels_user_deleted' }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    genre: { type: 'string', nullable: true },
    status: { type: 'string', default: 'draft' },
    styleGuide: { type: 'string', nullable: true, fieldName: 'style_guide' },
    worldSetting: {
      type: 'string',
      nullable: true,
      fieldName: 'world_setting'
    },
    aiTemperature: {
      type: 'string',
      nullable: true,
      fieldName: 'ai_temperature'
    },
    aiTopP: {
      type: 'string',
      nullable: true,
      fieldName: 'ai_top_p'
    },
    aiThinkingEnabled: {
      type: 'boolean',
      nullable: true,
      fieldName: 'ai_thinking_enabled'
    },
    aiReasoningEffort: {
      type: 'string',
      nullable: true,
      fieldName: 'ai_reasoning_effort'
    },
    aiExtraPrompt: {
      type: 'string',
      nullable: true,
      fieldName: 'ai_extra_prompt'
    },
    enabledSkillIds: {
      type: 'string',
      nullable: true,
      fieldName: 'enabled_skill_ids'
    },
    defaultPromptTemplateId: {
      type: 'number',
      nullable: true,
      fieldName: 'default_prompt_template_id'
    },
    aiConfig: {
      kind: 'm:1',
      entity: () => 'AiConfig',
      fieldName: 'ai_config_id',
      nullable: true
    },
    deletedAt: {
      type: UnixTimestampType,
      nullable: true,
      fieldName: 'deleted_at'
    },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    },
    updatedAt: {
      type: UnixTimestampType,
      fieldName: 'updated_at',
      onCreate: () => new Date(),
      onUpdate: () => new Date()
    }
  }
})

export const NovelOutlineSchema = new EntitySchema<NovelOutline>({
  name: 'NovelOutline',
  tableName: 'novel_outlines',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    novel: { kind: 'm:1', entity: () => 'Novel', fieldName: 'novel_id' },
    chapterNumber: { type: 'number', fieldName: 'chapter_number' },
    description: { type: 'string' },
    sortOrder: { type: 'number', fieldName: 'sort_order' }
  }
})

export const NovelTemplateSchema = new EntitySchema<NovelTemplate>({
  name: 'NovelTemplate',
  tableName: 'novel_templates',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    name: { type: 'string' },
    genre: { type: 'string' },
    defaultStyleGuide: {
      type: 'string',
      nullable: true,
      fieldName: 'default_style_guide'
    },
    defaultAiPrompt: {
      type: 'string',
      nullable: true,
      fieldName: 'default_ai_prompt'
    },
    defaultTemperature: {
      type: 'string',
      nullable: true,
      fieldName: 'default_temperature',
      default: '0.7'
    }
  }
})

export const ChapterSchema = new EntitySchema<Chapter>({
  name: 'Chapter',
  tableName: 'chapters',
  indexes: [
    { properties: ['novel', 'deletedAt'], name: 'idx_chapters_novel_deleted' },
    {
      properties: ['novel', 'chapterNumber'],
      name: 'idx_chapters_novel_number'
    }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    novel: { kind: 'm:1', entity: () => 'Novel', fieldName: 'novel_id' },
    chapterNumber: { type: 'number', fieldName: 'chapter_number' },
    title: { type: 'string' },
    content: { type: 'string', nullable: true, lazy: true },
    summary: { type: 'string', nullable: true },
    status: { type: 'string', default: 'draft' },
    wordCount: {
      type: 'number',
      fieldName: 'word_count',
      nullable: true,
      default: 0
    },
    deletedAt: {
      type: UnixTimestampType,
      nullable: true,
      fieldName: 'deleted_at'
    },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    },
    updatedAt: {
      type: UnixTimestampType,
      fieldName: 'updated_at',
      onCreate: () => new Date(),
      onUpdate: () => new Date()
    }
  }
})

export const ChapterVersionSchema = new EntitySchema<ChapterVersion>({
  name: 'ChapterVersion',
  tableName: 'chapter_versions',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    chapter: { kind: 'm:1', entity: () => 'Chapter', fieldName: 'chapter_id' },
    versionNumber: { type: 'number', fieldName: 'version_number' },
    content: { type: 'string' },
    source: { type: 'string' },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const ChapterNoteSchema = new EntitySchema<ChapterNote>({
  name: 'ChapterNote',
  tableName: 'chapter_notes',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    chapter: { kind: 'm:1', entity: () => 'Chapter', fieldName: 'chapter_id' },
    content: { type: 'string' },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    },
    updatedAt: {
      type: UnixTimestampType,
      fieldName: 'updated_at',
      onCreate: () => new Date(),
      onUpdate: () => new Date()
    }
  }
})

export const CharacterSchema = new EntitySchema<Character>({
  name: 'Character',
  tableName: 'characters',
  indexes: [{ properties: ['novel'], name: 'idx_characters_novel' }],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    novel: { kind: 'm:1', entity: () => 'Novel', fieldName: 'novel_id' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    traits: { type: 'string', nullable: true },
    relationships: { type: 'string', nullable: true },
    currentState: {
      type: 'string',
      nullable: true,
      fieldName: 'current_state'
    },
    realName: { type: 'string', nullable: true, fieldName: 'real_name' },
    displayTitle: {
      type: 'string',
      nullable: true,
      fieldName: 'display_title'
    },
    rolePosition: {
      type: 'string',
      nullable: true,
      fieldName: 'role_position'
    },
    storyRole: {
      type: 'string',
      nullable: true,
      fieldName: 'story_role'
    },
    firstAppearanceChapter: {
      type: 'number',
      nullable: true,
      fieldName: 'first_appearance_chapter'
    },
    lastAppearanceChapter: {
      type: 'number',
      nullable: true,
      fieldName: 'last_appearance_chapter'
    },
    overallArc: {
      type: 'string',
      nullable: true,
      fieldName: 'overall_arc'
    },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const ChapterCharacterSchema = new EntitySchema<ChapterCharacter>({
  name: 'ChapterCharacter',
  tableName: 'chapter_characters',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    chapter: { kind: 'm:1', entity: () => 'Chapter', fieldName: 'chapter_id' },
    character: {
      kind: 'm:1',
      entity: () => 'Character',
      fieldName: 'character_id'
    },
    role: { type: 'string', default: 'supporting' },
    chapterStory: {
      type: 'string',
      nullable: true,
      fieldName: 'chapter_story'
    }
  }
})

export const CharacterAppearanceSchema = new EntitySchema<CharacterAppearance>({
  name: 'CharacterAppearance',
  tableName: 'character_appearances',
  indexes: [
    {
      properties: ['novel', 'character'],
      name: 'idx_char_appearances_novel_character'
    }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    novel: { kind: 'm:1', entity: () => 'Novel', fieldName: 'novel_id' },
    chapter: { kind: 'm:1', entity: () => 'Chapter', fieldName: 'chapter_id' },
    character: {
      kind: 'm:1',
      entity: () => 'Character',
      fieldName: 'character_id'
    },
    role: { type: 'string', default: 'supporting' },
    snippet: { type: 'string', nullable: true },
    positionStart: {
      type: 'number',
      nullable: true,
      fieldName: 'position_start'
    },
    positionEnd: { type: 'number', nullable: true, fieldName: 'position_end' },
    background: { type: 'string', nullable: true },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const CharacterStateChangeSchema =
  new EntitySchema<CharacterStateChange>({
    name: 'CharacterStateChange',
    tableName: 'character_state_changes',
    indexes: [
      {
        properties: ['novel', 'chapter'],
        name: 'idx_character_state_changes_novel_chapter'
      },
      {
        properties: ['character', 'status'],
        name: 'idx_character_state_changes_character_status'
      },
      {
        properties: ['novel', 'contentHash'],
        name: 'idx_character_state_changes_novel_hash'
      }
    ],
    properties: {
      id: { type: 'number', primary: true, autoincrement: true },
      novel: { kind: 'm:1', entity: () => 'Novel', fieldName: 'novel_id' },
      chapter: {
        kind: 'm:1',
        entity: () => 'Chapter',
        fieldName: 'chapter_id'
      },
      character: {
        kind: 'm:1',
        entity: () => 'Character',
        fieldName: 'character_id'
      },
      relatedCharacter: {
        kind: 'm:1',
        entity: () => 'Character',
        fieldName: 'related_character_id',
        nullable: true
      },
      changeType: { type: 'string', fieldName: 'change_type' },
      beforeValue: {
        type: 'string',
        nullable: true,
        fieldName: 'before_value'
      },
      afterValue: { type: 'string', fieldName: 'after_value' },
      reason: { type: 'string', nullable: true },
      evidenceQuote: {
        type: 'string',
        nullable: true,
        fieldName: 'evidence_quote'
      },
      confidence: { type: 'string', nullable: true },
      status: { type: 'string', default: 'pending' },
      source: { type: 'string', default: 'ai' },
      contentHash: {
        type: 'string',
        nullable: true,
        fieldName: 'content_hash'
      },
      chapterUpdatedAtSnapshot: {
        type: UnixTimestampType,
        nullable: true,
        fieldName: 'chapter_updated_at_snapshot'
      },
      createdAt: {
        type: UnixTimestampType,
        fieldName: 'created_at',
        onCreate: () => new Date()
      },
      updatedAt: {
        type: UnixTimestampType,
        fieldName: 'updated_at',
        onCreate: () => new Date(),
        onUpdate: () => new Date()
      }
    }
  })

export const CharacterStateSnapshotSchema =
  new EntitySchema<CharacterStateSnapshot>({
    name: 'CharacterStateSnapshot',
    tableName: 'character_state_snapshots',
    indexes: [
      {
        properties: ['novel', 'chapter'],
        name: 'idx_character_state_snapshots_novel_chapter'
      },
      {
        properties: ['character', 'chapter'],
        name: 'idx_character_state_snapshots_character_chapter'
      }
    ],
    uniques: [
      {
        properties: ['character', 'chapter'],
        name: 'uq_character_state_snapshots_character_chapter'
      }
    ],
    properties: {
      id: { type: 'number', primary: true, autoincrement: true },
      novel: { kind: 'm:1', entity: () => 'Novel', fieldName: 'novel_id' },
      chapter: {
        kind: 'm:1',
        entity: () => 'Chapter',
        fieldName: 'chapter_id'
      },
      character: {
        kind: 'm:1',
        entity: () => 'Character',
        fieldName: 'character_id'
      },
      stateJson: { type: 'string', fieldName: 'state_json' },
      sourceChangeIds: {
        type: 'string',
        nullable: true,
        fieldName: 'source_change_ids'
      },
      contentHash: {
        type: 'string',
        nullable: true,
        fieldName: 'content_hash'
      },
      createdAt: {
        type: UnixTimestampType,
        fieldName: 'created_at',
        onCreate: () => new Date()
      },
      updatedAt: {
        type: UnixTimestampType,
        fieldName: 'updated_at',
        onCreate: () => new Date(),
        onUpdate: () => new Date()
      }
    }
  })

export const PlotPointSchema = new EntitySchema<PlotPoint>({
  name: 'PlotPoint',
  tableName: 'plot_points',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    novel: { kind: 'm:1', entity: () => 'Novel', fieldName: 'novel_id' },
    chapter: {
      kind: 'm:1',
      entity: () => 'Chapter',
      fieldName: 'chapter_id',
      nullable: true
    },
    description: { type: 'string' },
    type: { type: 'string' },
    status: { type: 'string', default: 'introduced' },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const StoryArcSchema = new EntitySchema<StoryArc>({
  name: 'StoryArc',
  tableName: 'story_arcs',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    novel: { kind: 'm:1', entity: () => 'Novel', fieldName: 'novel_id' },
    title: { type: 'string' },
    summary: { type: 'string', nullable: true },
    startChapter: { type: 'number', fieldName: 'start_chapter' },
    endChapter: { type: 'number', nullable: true, fieldName: 'end_chapter' }
  }
})

export const GenerationTaskSchema = new EntitySchema<GenerationTask>({
  name: 'GenerationTask',
  tableName: 'generation_tasks',
  indexes: [
    {
      properties: ['novel', 'status'],
      name: 'idx_generation_tasks_novel_status'
    }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    novel: { kind: 'm:1', entity: () => 'Novel', fieldName: 'novel_id' },
    chapter: {
      kind: 'm:1',
      entity: () => 'Chapter',
      fieldName: 'chapter_id',
      nullable: true
    },
    type: { type: 'string' },
    status: { type: 'string', default: 'pending' },
    result: { type: 'string', nullable: true },
    error: { type: 'string', nullable: true },
    retryCount: {
      type: 'number',
      fieldName: 'retry_count',
      nullable: true,
      default: 0
    },
    tokensUsed: { type: 'number', fieldName: 'tokens_used', nullable: true },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    },
    completedAt: {
      type: UnixTimestampType,
      fieldName: 'completed_at',
      nullable: true
    }
  }
})

export const TokenUsageSchema = new EntitySchema<TokenUsage>({
  name: 'TokenUsage',
  tableName: 'token_usage',
  indexes: [
    { properties: ['user', 'createdAt'], name: 'idx_token_usage_user_created' }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    aiConfig: {
      kind: 'm:1',
      entity: () => 'AiConfig',
      fieldName: 'ai_config_id',
      nullable: true
    },
    tokensInput: { type: 'number', fieldName: 'tokens_input' },
    tokensOutput: { type: 'number', fieldName: 'tokens_output' },
    estimatedCost: {
      type: 'string',
      nullable: true,
      fieldName: 'estimated_cost'
    },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const PromptTemplateSchema = new EntitySchema<PromptTemplate>({
  name: 'PromptTemplate',
  tableName: 'prompt_templates',
  indexes: [
    {
      properties: ['user', 'isSystem'],
      name: 'idx_prompt_templates_user_system'
    }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: {
      kind: 'm:1',
      entity: () => 'User',
      fieldName: 'user_id',
      nullable: true
    },
    name: { type: 'string' },
    content: { type: 'string' },
    category: { type: 'string' },
    isSystem: {
      type: 'boolean',
      fieldName: 'is_system',
      nullable: true,
      default: false
    },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const WritingSkillSchema = new EntitySchema<WritingSkill>({
  name: 'WritingSkill',
  tableName: 'writing_skills',
  indexes: [
    { properties: ['user', 'isSystem'], name: 'idx_writing_skills_user_system' }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: {
      kind: 'm:1',
      entity: () => 'User',
      fieldName: 'user_id',
      nullable: true
    },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    genre: { type: 'string', nullable: true },
    systemAddon: {
      type: 'string',
      nullable: true,
      fieldName: 'system_addon'
    },
    fewShots: { type: 'string', nullable: true, fieldName: 'few_shots' },
    checklist: { type: 'string', nullable: true },
    appliesTo: { type: 'string', nullable: true, fieldName: 'applies_to' },
    isSystem: {
      type: 'boolean',
      fieldName: 'is_system',
      nullable: true,
      default: false
    },
    enabled: { type: 'boolean', nullable: true, default: true },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const WritingStatSchema = new EntitySchema<WritingStat>({
  name: 'WritingStat',
  tableName: 'writing_stats',
  indexes: [
    { properties: ['user', 'date'], name: 'idx_writing_stats_user_date' }
  ],
  uniques: [
    { properties: ['user', 'date'], name: 'uq_writing_stats_user_date' }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    date: { type: 'string' },
    wordsWritten: {
      type: 'number',
      fieldName: 'words_written',
      nullable: true,
      default: 0
    },
    chaptersCompleted: {
      type: 'number',
      fieldName: 'chapters_completed',
      nullable: true,
      default: 0
    },
    aiGenerations: {
      type: 'number',
      fieldName: 'ai_generations',
      nullable: true,
      default: 0
    }
  }
})

export const UserPreferenceSchema = new EntitySchema<UserPreference>({
  name: 'UserPreference',
  tableName: 'user_preferences',
  indexes: [
    { properties: ['user', 'key'], name: 'idx_user_preferences_user_key' }
  ],
  uniques: [
    { properties: ['user', 'key'], name: 'uq_user_preferences_user_key' }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    key: { type: 'string', fieldName: 'key' },
    value: { type: 'string' }
  }
})

export const SchemaMigrationSchema = new EntitySchema<SchemaMigration>({
  name: 'SchemaMigration',
  tableName: 'schema_migrations',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    version: { type: 'string', unique: true },
    source: { type: 'string' },
    appliedAt: {
      type: UnixTimestampType,
      fieldName: 'applied_at',
      onCreate: () => new Date()
    }
  }
})

export const ApiTokenSchema = new EntitySchema<ApiToken>({
  name: 'ApiToken',
  tableName: 'api_tokens',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    name: { type: 'string' },
    tokenHash: { type: 'string', fieldName: 'token_hash' },
    tokenPrefix: { type: 'string', nullable: true, fieldName: 'token_prefix' },
    lastUsedAt: {
      type: UnixTimestampType,
      nullable: true,
      fieldName: 'last_used_at'
    },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const ModelCostRateSchema = new EntitySchema<ModelCostRate>({
  name: 'ModelCostRate',
  tableName: 'model_cost_rates',
  indexes: [
    { properties: ['user', 'model'], name: 'idx_model_cost_rates_user_model' }
  ],
  uniques: [
    { properties: ['user', 'model'], name: 'uq_model_cost_rates_user_model' }
  ],
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    model: { type: 'string' },
    inputCostPer1k: {
      type: 'string',
      fieldName: 'input_cost_per_1k',
      default: '0'
    },
    outputCostPer1k: {
      type: 'string',
      fieldName: 'output_cost_per_1k',
      default: '0'
    },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    },
    updatedAt: {
      type: UnixTimestampType,
      fieldName: 'updated_at',
      onCreate: () => new Date(),
      onUpdate: () => new Date()
    }
  }
})

export const ConsistencyIssueSchema = new EntitySchema<ConsistencyIssue>({
  name: 'ConsistencyIssue',
  tableName: 'consistency_issues',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    chapter: { kind: 'm:1', entity: () => 'Chapter', fieldName: 'chapter_id' },
    type: { type: 'string' },
    severity: { type: 'string', default: 'medium' },
    description: { type: 'string' },
    quote: { type: 'string', nullable: true },
    priorQuote: { type: 'string', fieldName: 'prior_quote', nullable: true },
    priorChapter: {
      type: 'number',
      fieldName: 'prior_chapter',
      nullable: true
    },
    confidence: { type: 'string', nullable: true },
    signature: { type: 'string', nullable: true },
    dismissed: { type: 'boolean', default: false },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const ForeshadowingSchema = new EntitySchema<Foreshadowing>({
  name: 'Foreshadowing',
  tableName: 'foreshadowings',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    novel: { kind: 'm:1', entity: () => 'Novel', fieldName: 'novel_id' },
    chapter: {
      kind: 'm:1',
      entity: () => 'Chapter',
      fieldName: 'chapter_id',
      nullable: true
    },
    content: { type: 'string' },
    description: { type: 'string', nullable: true },
    status: { type: 'string', default: 'active' },
    resolvedAtChapter: {
      type: 'number',
      nullable: true,
      fieldName: 'resolved_at_chapter'
    },
    createdAt: {
      type: UnixTimestampType,
      fieldName: 'created_at',
      onCreate: () => new Date()
    }
  }
})

export const allEntities = [
  UserSchema,
  SiteConfigSchema,
  AiProviderSchema,
  AiModelSchema,
  AiConfigSchema,
  NovelSchema,
  NovelOutlineSchema,
  NovelTemplateSchema,
  ChapterSchema,
  ChapterVersionSchema,
  ChapterNoteSchema,
  CharacterSchema,
  ChapterCharacterSchema,
  CharacterAppearanceSchema,
  CharacterStateChangeSchema,
  CharacterStateSnapshotSchema,
  PlotPointSchema,
  StoryArcSchema,
  GenerationTaskSchema,
  TokenUsageSchema,
  PromptTemplateSchema,
  WritingSkillSchema,
  WritingStatSchema,
  UserPreferenceSchema,
  SchemaMigrationSchema,
  ApiTokenSchema,
  ModelCostRateSchema,
  ConsistencyIssueSchema,
  ForeshadowingSchema
]
