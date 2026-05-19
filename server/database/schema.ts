import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const siteConfig = sqliteTable('site_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const aiConfigs = sqliteTable('ai_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  purpose: text('purpose', { enum: ['generation', 'extraction', 'consistency_check', 'style_analysis'] }).notNull(),
  apiUrl: text('api_url').notNull(),
  apiKey: text('api_key').notNull(),
  model: text('model').notNull(),
  temperature: text('temperature').default('0.7'),
  maxTokens: integer('max_tokens').default(4096),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const novels = sqliteTable('novels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  genre: text('genre'),
  status: text('status', { enum: ['draft', 'in_progress', 'completed'] }).notNull().default('draft'),
  styleGuide: text('style_guide'),
  worldSetting: text('world_setting'),
  aiTemperature: text('ai_temperature'),
  aiExtraPrompt: text('ai_extra_prompt'),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const novelOutlines = sqliteTable('novel_outlines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  novelId: integer('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterNumber: integer('chapter_number').notNull(),
  description: text('description').notNull(),
  sortOrder: integer('sort_order').notNull(),
})

export const novelTemplates = sqliteTable('novel_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  genre: text('genre').notNull(),
  defaultStyleGuide: text('default_style_guide'),
  defaultAiPrompt: text('default_ai_prompt'),
  defaultTemperature: text('default_temperature').default('0.7'),
})

export const chapters = sqliteTable('chapters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  novelId: integer('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterNumber: integer('chapter_number').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  summary: text('summary'),
  status: text('status', { enum: ['draft', 'generated', 'edited', 'final'] }).notNull().default('draft'),
  wordCount: integer('word_count').default(0),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const chapterVersions = sqliteTable('chapter_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chapterId: integer('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  content: text('content').notNull(),
  source: text('source', { enum: ['ai_generated', 'user_edited'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const characters = sqliteTable('characters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  novelId: integer('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  traits: text('traits'),
  relationships: text('relationships'),
  currentState: text('current_state'),
  firstAppearanceChapter: integer('first_appearance_chapter'),
  lastAppearanceChapter: integer('last_appearance_chapter'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const plotPoints = sqliteTable('plot_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  novelId: integer('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterId: integer('chapter_id').references(() => chapters.id),
  description: text('description').notNull(),
  type: text('type', { enum: ['setup', 'conflict', 'resolution', 'twist'] }).notNull(),
  status: text('status', { enum: ['introduced', 'developing', 'resolved'] }).notNull().default('introduced'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const storyArcs = sqliteTable('story_arcs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  novelId: integer('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  summary: text('summary'),
  startChapter: integer('start_chapter').notNull(),
  endChapter: integer('end_chapter'),
})

export const generationTasks = sqliteTable('generation_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  novelId: integer('novel_id').notNull().references(() => novels.id),
  chapterId: integer('chapter_id').references(() => chapters.id),
  type: text('type').notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull().default('pending'),
  result: text('result'),
  error: text('error'),
  retryCount: integer('retry_count').default(0),
  tokensUsed: integer('tokens_used'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
})

export const tokenUsage = sqliteTable('token_usage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  aiConfigId: integer('ai_config_id').references(() => aiConfigs.id),
  tokensInput: integer('tokens_input').notNull(),
  tokensOutput: integer('tokens_output').notNull(),
  estimatedCost: text('estimated_cost'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const chapterNotes = sqliteTable('chapter_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chapterId: integer('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const promptTemplates = sqliteTable('prompt_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  name: text('name').notNull(),
  content: text('content').notNull(),
  category: text('category', { enum: ['generation', 'rewrite', 'expand', 'custom'] }).notNull(),
  isSystem: integer('is_system', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const writingStats = sqliteTable('writing_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  wordsWritten: integer('words_written').default(0),
  chaptersCompleted: integer('chapters_completed').default(0),
  aiGenerations: integer('ai_generations').default(0),
})

export const userPreferences = sqliteTable('user_preferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  key: text('key').notNull(),
  value: text('value').notNull(),
})
