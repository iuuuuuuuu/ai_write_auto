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

export interface AiConfig {
  [OptionalProps]?:
    | 'id'
    | 'temperature'
    | 'maxTokens'
    | 'isDefault'
    | 'enabled'
    | 'createdAt'
    | 'updatedAt'
  id: number
  user: User
  name: string
  purpose: 'generation' | 'extraction' | 'consistency_check' | 'style_analysis'
  apiUrl: string
  apiKey: string
  model: string
  temperature: string | null
  maxTokens: number | null
  isDefault: boolean
  enabled: boolean
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
    | 'aiExtraPrompt'
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
  aiExtraPrompt: string | null
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
  status: 'pending' | 'running' | 'paused' | 'cancelled' | 'completed' | 'failed'
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
  [OptionalProps]?: 'id' | 'lastUsedAt' | 'createdAt'
  id: number
  user: User
  name: string
  tokenHash: string
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
  [OptionalProps]?: 'id' | 'dismissed' | 'createdAt'
  id: number
  chapter: Chapter
  type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  dismissed: boolean
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

export const AiConfigSchema = new EntitySchema<AiConfig>({
  name: 'AiConfig',
  tableName: 'ai_configs',
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    name: { type: 'string', default: '默认模型' },
    purpose: { type: 'string' },
    apiUrl: { type: 'string', fieldName: 'api_url' },
    apiKey: { type: 'string', fieldName: 'api_key' },
    model: { type: 'string' },
    temperature: { type: 'string', nullable: true, default: '0.7' },
    maxTokens: {
      type: 'number',
      fieldName: 'max_tokens',
      nullable: true,
      default: 4096
    },
    isDefault: { type: 'boolean', fieldName: 'is_default', default: false },
    enabled: { type: 'boolean', default: true },
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
    aiExtraPrompt: {
      type: 'string',
      nullable: true,
      fieldName: 'ai_extra_prompt'
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

export const WritingStatSchema = new EntitySchema<WritingStat>({
  name: 'WritingStat',
  tableName: 'writing_stats',
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
  properties: {
    id: { type: 'number', primary: true, autoincrement: true },
    user: { kind: 'm:1', entity: () => 'User', fieldName: 'user_id' },
    model: { type: 'string' },
    inputCostPer1k: { type: 'string', fieldName: 'input_cost_per_1k', default: '0' },
    outputCostPer1k: { type: 'string', fieldName: 'output_cost_per_1k', default: '0' },
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
    dismissed: { type: 'boolean', default: false },
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
  PlotPointSchema,
  StoryArcSchema,
  GenerationTaskSchema,
  TokenUsageSchema,
  PromptTemplateSchema,
  WritingStatSchema,
  UserPreferenceSchema,
  SchemaMigrationSchema,
  ApiTokenSchema,
  ModelCostRateSchema,
  ConsistencyIssueSchema
]
