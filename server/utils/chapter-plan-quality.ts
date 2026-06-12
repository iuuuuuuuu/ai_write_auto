import { parseJsonObjectLike } from './json-salvage'

export type ChapterPlanIssueSeverity = 'warning' | 'error'

export interface ChapterPlanIssue {
  code:
    | 'missing_goal'
    | 'missing_conflict'
    | 'missing_turning_point'
    | 'missing_beat'
    | 'missing_interest_hook'
    | 'unknown_character'
    | 'unknown_plot_point'
    | 'unknown_foreshadowing'
    | 'high_continuity_risk'
    | 'template_placeholder'
  severity: ChapterPlanIssueSeverity
  message: string
}

export interface ChapterPlanDraft {
  goal: string
  conflict: string
  turningPoint: string
  beats: string[]
  mustInclude: string[]
  avoid: string[]
  characters: number[]
  characterStateDeltas: string[]
  plotThreadActions: number[]
  foreshadowingActions: number[]
  interestHooks: string[]
  continuityRisks: string[]
  pacing: string
  protocol: string
}

export type ChapterPlanDraftField = keyof ChapterPlanDraft

export type ChapterPlanPartialDraft = Partial<ChapterPlanDraft>

export type ChapterPlanFieldValueKind = 'text' | 'list' | 'numberList'

export type ChapterPlanFieldValue = string | string[] | number[]

export interface ChapterPlanReferenceContext {
  chapterNumber: number
  characterIds: ReadonlySet<number>
  plotPointIds: ReadonlySet<number>
  foreshadowingIds: ReadonlySet<number>
}

export interface ChapterPlanValidationResult {
  blocked: boolean
  issues: ChapterPlanIssue[]
}

export interface ChapterPlanFieldFallbackContext {
  field: ChapterPlanDraftField
  chapterOutline?: string | null
  chapterNumber?: number
  chapterTitle?: string | null
  outlines?: Array<{ chapterNumber: number; description: string }>
}

const INVALID_GENERATED_PLAN_ISSUE_CODES = new Set<ChapterPlanIssue['code']>([
  'template_placeholder'
])

export function hasInvalidGeneratedPlanIssue(
  issues: readonly ChapterPlanIssue[]
): boolean {
  return issues.some((issue) =>
    INVALID_GENERATED_PLAN_ISSUE_CODES.has(issue.code)
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ?
      (value as Record<string, unknown>)
    : {}
}

const PLAN_RECORD_WRAPPER_KEYS = [
  'plan',
  '剧情计划',
  '大致剧情',
  '章节计划',
  '计划',
  '剧情骨架',
  'core',
  '约束节奏',
  'constraints',
  '引用状态',
  'references'
] as const

function selectPlanRecord(
  record: Record<string, unknown>
): Record<string, unknown> {
  for (const key of PLAN_RECORD_WRAPPER_KEYS) {
    const wrapped = record[key]
    if (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped)) {
      return selectPlanRecord(wrapped as Record<string, unknown>)
    }
  }
  return record
}

function findField(
  record: Record<string, unknown>,
  keys: readonly string[]
): unknown {
  for (const key of keys) {
    if (key in record) return record[key]
  }
  return undefined
}

function stringField(
  record: Record<string, unknown>,
  ...keys: string[]
): string {
  const value = findField(record, keys)
  return typeof value === 'string' ? value.trim() : ''
}

function stringArrayField(
  record: Record<string, unknown>,
  ...keys: string[]
): string[] {
  const value = findField(record, keys)
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }
  return []
}

function numberArrayField(
  record: Record<string, unknown>,
  ...keys: string[]
): number[] {
  const value = findField(record, keys)
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is number => Number.isInteger(item) && item > 0
  )
}

const CHAPTER_PLAN_FIELD_ALIASES = {
  goal: ['goal', '目标', '本章目标', '本章核心目标', '核心目标'],
  conflict: ['conflict', '核心冲突', '冲突', '主要冲突', '本章核心冲突'],
  turningPoint: ['turningPoint', '关键转折', '转折', '关键转折点'],
  beats: ['beats', '剧情节拍', '节拍', '情节节拍', '剧情动作', '行动节拍'],
  mustInclude: ['mustInclude', '必须出现'],
  avoid: ['avoid', '避免'],
  characters: ['characters', '角色'],
  characterStateDeltas: ['characterStateDeltas'],
  plotThreadActions: ['plotThreadActions'],
  foreshadowingActions: ['foreshadowingActions'],
  interestHooks: ['interestHooks', '兴趣钩子', '钩子', '悬念钩子', '读者钩子'],
  continuityRisks: ['continuityRisks'],
  pacing: ['pacing', '情绪与节奏', '节奏'],
  protocol: ['protocol', '称谓设定', '设定补充']
} satisfies Record<ChapterPlanDraftField, readonly string[]>

const CHAPTER_PLAN_FIELD_READERS = {
  goal: (record: Record<string, unknown>) =>
    stringField(record, ...CHAPTER_PLAN_FIELD_ALIASES.goal),
  conflict: (record: Record<string, unknown>) =>
    stringField(record, ...CHAPTER_PLAN_FIELD_ALIASES.conflict),
  turningPoint: (record: Record<string, unknown>) =>
    stringField(record, ...CHAPTER_PLAN_FIELD_ALIASES.turningPoint),
  beats: (record: Record<string, unknown>) =>
    stringArrayField(record, ...CHAPTER_PLAN_FIELD_ALIASES.beats),
  mustInclude: (record: Record<string, unknown>) =>
    stringArrayField(record, ...CHAPTER_PLAN_FIELD_ALIASES.mustInclude),
  avoid: (record: Record<string, unknown>) =>
    stringArrayField(record, ...CHAPTER_PLAN_FIELD_ALIASES.avoid),
  characters: (record: Record<string, unknown>) =>
    numberArrayField(record, ...CHAPTER_PLAN_FIELD_ALIASES.characters),
  characterStateDeltas: (record: Record<string, unknown>) =>
    stringArrayField(
      record,
      ...CHAPTER_PLAN_FIELD_ALIASES.characterStateDeltas
    ),
  plotThreadActions: (record: Record<string, unknown>) =>
    numberArrayField(record, ...CHAPTER_PLAN_FIELD_ALIASES.plotThreadActions),
  foreshadowingActions: (record: Record<string, unknown>) =>
    numberArrayField(
      record,
      ...CHAPTER_PLAN_FIELD_ALIASES.foreshadowingActions
    ),
  interestHooks: (record: Record<string, unknown>) =>
    stringArrayField(record, ...CHAPTER_PLAN_FIELD_ALIASES.interestHooks),
  continuityRisks: (record: Record<string, unknown>) =>
    stringArrayField(record, ...CHAPTER_PLAN_FIELD_ALIASES.continuityRisks),
  pacing: (record: Record<string, unknown>) =>
    stringField(record, ...CHAPTER_PLAN_FIELD_ALIASES.pacing),
  protocol: (record: Record<string, unknown>) =>
    stringField(record, ...CHAPTER_PLAN_FIELD_ALIASES.protocol)
} satisfies Record<
  ChapterPlanDraftField,
  (record: Record<string, unknown>) => string | string[] | number[]
>

function hasPartialValue(value: string | string[] | number[]): boolean {
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0
}

function countReadableFields(
  record: Record<string, unknown>,
  fields: readonly ChapterPlanDraftField[]
): number {
  return fields.reduce((total, field) => {
    const value = CHAPTER_PLAN_FIELD_READERS[field](record)
    return total + (hasPartialValue(value) ? 1 : 0)
  }, 0)
}

function selectReadablePlanRecord(
  record: Record<string, unknown>,
  fields: readonly ChapterPlanDraftField[],
  depth = 0
): Record<string, unknown> {
  const selected = selectPlanRecord(record)
  if (countReadableFields(selected, fields) > 0 || depth >= 3) {
    return selected
  }

  for (const value of Object.values(selected)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const child = selectReadablePlanRecord(
      value as Record<string, unknown>,
      fields,
      depth + 1
    )
    if (countReadableFields(child, fields) > 0) return child
  }

  return selected
}

function getPartialErrorLabel(
  fields: readonly ChapterPlanDraftField[]
): string {
  const fieldSet = new Set(fields)
  if (
    fieldSet.has('goal') ||
    fieldSet.has('conflict') ||
    fieldSet.has('turningPoint') ||
    fieldSet.has('beats') ||
    fieldSet.has('interestHooks')
  ) {
    return '剧情骨架'
  }
  if (
    fieldSet.has('mustInclude') ||
    fieldSet.has('avoid') ||
    fieldSet.has('pacing') ||
    fieldSet.has('protocol') ||
    fieldSet.has('continuityRisks')
  ) {
    return '约束节奏'
  }
  return '引用状态'
}

function isReferenceOnlyPartial(
  fields: readonly ChapterPlanDraftField[]
): boolean {
  const referenceFields = new Set<ChapterPlanDraftField>([
    'characters',
    'characterStateDeltas',
    'plotThreadActions',
    'foreshadowingActions'
  ])
  return fields.every((field) => referenceFields.has(field))
}

function normalizeLabeledItem(line: string): string {
  return line
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.)、]\s*/, '')
    .trim()
}

function findLabeledField(line: string): {
  field: ChapterPlanDraftField
  value: string
} | null {
  for (const [field, aliases] of Object.entries(CHAPTER_PLAN_FIELD_ALIASES)) {
    for (const alias of aliases) {
      const pattern = new RegExp(`^${alias}[：:]\\s*(.*)$`, 'i')
      const match = line.match(pattern)
      if (match) {
        return {
          field: field as ChapterPlanDraftField,
          value: match[1]?.trim() ?? ''
        }
      }
    }
  }
  return null
}

function parseLabeledPlanRecord(raw: string): Record<string, unknown> | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const record: Record<string, unknown> = {}
  let activeArrayField: ChapterPlanDraftField | null = null
  const arrayFields = new Set<ChapterPlanDraftField>([
    'beats',
    'mustInclude',
    'avoid',
    'characterStateDeltas',
    'interestHooks',
    'continuityRisks'
  ])

  for (const line of lines) {
    const labeled = findLabeledField(line)
    if (labeled) {
      if (arrayFields.has(labeled.field)) {
        record[labeled.field] = labeled.value ? [labeled.value] : []
        activeArrayField = labeled.field
      } else {
        record[labeled.field] = labeled.value
        activeArrayField = null
      }
      continue
    }

    if (activeArrayField && /^([-*]|\d+[.)、])\s*/.test(line)) {
      const item = normalizeLabeledItem(line)
      if (item) {
        const values = record[activeArrayField]
        record[activeArrayField] =
          Array.isArray(values) ? [...values, item] : [item]
      }
    }
  }

  return Object.keys(record).length ? record : null
}

function stripLinePrefix(line: string): string {
  return line.replace(/^[-*]\s*/, '').trim()
}

function extractQuotedSuggestion(
  raw: string,
  field: ChapterPlanDraftField
): string {
  const aliases = CHAPTER_PLAN_FIELD_ALIASES[field]
  for (const alias of aliases) {
    const pattern = new RegExp(
      `${alias}(?:[^。\n“”"]{0,30})?(?:可以是|应该是|可写为|写成|为)[：:\\s]*[“"]([^”"]+)[”"]`,
      'i'
    )
    const match = raw.match(pattern)
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return ''
}

function parseReasoningPlanRecord(raw: string): Record<string, unknown> | null {
  const record: Record<string, unknown> = {}
  const stringFields: ChapterPlanDraftField[] = [
    'goal',
    'conflict',
    'turningPoint'
  ]
  for (const field of stringFields) {
    const value = extractQuotedSuggestion(raw, field)
    if (value) record[field] = value
  }

  const hook = extractQuotedSuggestion(raw, 'interestHooks')
  if (hook) record.interestHooks = [hook]

  const lines = raw.split(/\r?\n/)
  let insideBeats = false
  const beats: string[] = []
  for (const line of lines) {
    const trimmed = stripLinePrefix(line.trim())
    if (!trimmed) continue
    if (
      /^(beats|剧情节拍|节拍|情节节拍|剧情动作|行动节拍)[：:]/i.test(trimmed)
    ) {
      insideBeats = true
      continue
    }
    if (insideBeats && /^\d+[.)、]\s*/.test(trimmed)) {
      const item = normalizeLabeledItem(trimmed)
      if (item) beats.push(item)
      continue
    }
    if (insideBeats && /^\w+[：:]|^[\u4e00-\u9fa5]{2,8}[：:]/.test(trimmed)) {
      insideBeats = false
    }
  }
  if (beats.length) record.beats = beats

  return Object.keys(record).length ? record : null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function detectMarkdownField(line: string): ChapterPlanDraftField | null {
  const normalized = line
    .trim()
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.)、]\s*/, '')
    .replace(/\*\*/g, '')
    .trim()

  for (const field of Object.keys(CHAPTER_PLAN_FIELD_ALIASES)) {
    const aliases = CHAPTER_PLAN_FIELD_ALIASES[field as ChapterPlanDraftField]
    if (
      aliases.some((alias) =>
        normalized.toLowerCase().startsWith(alias.toLowerCase())
      )
    ) {
      return field as ChapterPlanDraftField
    }
  }
  return null
}

function extractMarkdownFieldHeaderValue(
  line: string,
  field: ChapterPlanDraftField
): string {
  const normalized = line
    .trim()
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.)、]\s*/, '')
    .replace(/\*\*/g, '')
    .trim()

  for (const alias of CHAPTER_PLAN_FIELD_ALIASES[field]) {
    const pattern = new RegExp(`^${escapeRegExp(alias)}\\s*[：:]\\s*(.+)$`, 'i')
    const match = normalized.match(pattern)
    if (match?.[1]?.trim()) return match[1].trim()
  }

  return ''
}

function cleanBlockValue(value: string, field: ChapterPlanDraftField): string {
  const prefixPatterns: Partial<Record<ChapterPlanDraftField, RegExp>> = {
    goal: /^(?:本章的目标|本章目标|核心目标|目标)(?:应该)?是/,
    conflict: /^(?:本章的冲突|本章冲突|核心冲突|冲突)(?:应该)?是/,
    turningPoint:
      /^(?:本章的转折点|本章转折点|关键转折点|转折点|关键转折)(?:应该)?是/
  }
  return value.replace(prefixPatterns[field] ?? /^$/, '').trim()
}

function extractBlockValue(
  lines: string[],
  field: ChapterPlanDraftField
): string {
  for (const line of lines) {
    const normalized = stripLinePrefix(line.trim())
    const specific = normalized.match(
      /(?:具体内容|具体化|例如|写成具体剧情内容)[：:]\s*[“"]?(.+?)[”"]?$/
    )
    if (specific?.[1]?.trim()) return cleanBlockValue(specific[1].trim(), field)
    const quoted = normalized.match(/[“"]([^”"]+)[”"]$/)
    if (quoted?.[1]?.trim()) return cleanBlockValue(quoted[1].trim(), field)
  }

  for (const line of [...lines].reverse()) {
    const normalized = stripLinePrefix(line.trim())
    if (normalized) return cleanBlockValue(normalized, field)
  }

  return ''
}

function parseMarkdownReasoningRecord(
  raw: string
): Record<string, unknown> | null {
  const record: Record<string, unknown> = {}
  const sections: Partial<Record<ChapterPlanDraftField, string[]>> = {}
  let activeField: ChapterPlanDraftField | null = null

  for (const line of raw.split(/\r?\n/)) {
    const field = detectMarkdownField(line)
    if (field) {
      activeField = field
      sections[field] = sections[field] ?? []
      const headerValue = extractMarkdownFieldHeaderValue(line, field)
      if (headerValue) {
        sections[field] = [...(sections[field] ?? []), headerValue]
      }
      continue
    }
    if (activeField) {
      sections[activeField] = [...(sections[activeField] ?? []), line]
    }
  }

  for (const field of ['goal', 'conflict', 'turningPoint'] as const) {
    const value = extractBlockValue(sections[field] ?? [], field)
    if (value) record[field] = value
  }

  const hook = extractBlockValue(sections.interestHooks ?? [], 'interestHooks')
  if (hook) record.interestHooks = [hook]

  const beats = (sections.beats ?? [])
    .map((line) => stripLinePrefix(line.trim()))
    .filter((line) => /^\d+[.)、]\s*/.test(line))
    .map(normalizeLabeledItem)
    .filter(Boolean)
  if (beats.length) record.beats = beats

  return Object.keys(record).length ? record : null
}

function extractFieldFocusedLines(
  raw: string,
  field: ChapterPlanDraftField
): string[] {
  const lines = raw.split(/\r?\n/)
  const collected: string[] = []
  let insideField = false

  for (const line of lines) {
    const detectedField = detectMarkdownField(line)
    if (detectedField) {
      insideField = detectedField === field
      const headerValue =
        insideField ? extractMarkdownFieldHeaderValue(line, field) : ''
      if (headerValue) collected.push(headerValue)
      else if (insideField) collected.push(line)
      continue
    }

    if (insideField) collected.push(line)
  }

  return collected
}

function isInstructionLikeLine(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) return true
  return (
    normalized.includes('JSON') ||
    normalized.includes('json') ||
    normalized.includes('字段说明') ||
    normalized.includes('字符串数组') ||
    normalized.includes('输入框内容') ||
    normalized.includes('用户要求') ||
    normalized.includes('基于大纲') ||
    normalized.includes('关键元素包括') ||
    /^首先[，,]/.test(normalized) ||
    /^现在[，,]/.test(normalized)
  )
}

function getFieldDisplayLabel(field: ChapterPlanDraftField): string {
  const labels: Record<ChapterPlanDraftField, string> = {
    goal: '本章目标',
    conflict: '核心冲突',
    turningPoint: '关键转折',
    beats: '剧情节拍',
    mustInclude: '必须出现',
    avoid: '避免出现',
    characters: '出场角色',
    characterStateDeltas: '角色状态变化',
    plotThreadActions: '剧情线',
    foreshadowingActions: '伏笔',
    interestHooks: '兴趣钩子',
    continuityRisks: '连续性风险',
    pacing: '情绪节奏',
    protocol: '称谓设定'
  }
  return labels[field]
}

function normalizeFallbackText(value?: string | null): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasUsableOutlineText(value?: string | null): boolean {
  const text = normalizeFallbackText(value)
  if (text.length < 6) return false
  const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const placeholderCount = (text.match(/[?？]/g) || []).length
  return chineseCount >= 4 && placeholderCount < Math.max(3, text.length / 3)
}

function selectFallbackOutlineSource(
  context: ChapterPlanFieldFallbackContext
): string {
  if (hasUsableOutlineText(context.chapterOutline)) {
    return normalizeFallbackText(context.chapterOutline)
  }

  const outlines = context.outlines || []
  const current = outlines.find(
    (outline) =>
      outline.chapterNumber === context.chapterNumber &&
      hasUsableOutlineText(outline.description)
  )
  if (current) return normalizeFallbackText(current.description)

  const nearest = outlines
    .filter((outline) => hasUsableOutlineText(outline.description))
    .sort(
      (left, right) =>
        Math.abs(left.chapterNumber - (context.chapterNumber || 0)) -
        Math.abs(right.chapterNumber - (context.chapterNumber || 0))
    )[0]
  if (nearest) return normalizeFallbackText(nearest.description)

  return normalizeFallbackText(
    `第${context.chapterNumber || ''}章${context.chapterTitle ? `「${context.chapterTitle}」` : ''}`
  )
}

function splitFallbackSentences(source: string): string[] {
  const sentences = source
    .split(/(?<=[。！？!?；;])/)
    .map((sentence) => normalizeFallbackText(sentence))
    .filter((sentence) => sentence.length >= 4)
  return sentences.length ? sentences : [source].filter(Boolean)
}

function truncateFallbackSentence(value: string, maxLength = 90): string {
  const text = normalizeFallbackText(value)
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).replace(/[，、；：:][^，、；：:]*$/, '')}。`
}

function findFallbackSentence(
  sentences: readonly string[],
  keywords: readonly string[]
): string {
  return (
    sentences.find((sentence) =>
      keywords.some((keyword) => sentence.includes(keyword))
    ) || ''
  )
}

function inferFallbackActor(source: string): string {
  const patterns = [
    /(?:主角|女主|男主)[「“]?([\u4e00-\u9fff]{2,4})/,
    /(?:^|[，。；、\s])([\u4e00-\u9fff]{2,4})(?=在|从|于|被|将|必须|需要|试图|发现|意识到|压下|以)/
  ]
  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (match?.[1]) return match[1]
  }
  return '主角'
}

function buildFallbackBeats(sentences: readonly string[]): string[] {
  return sentences
    .slice(0, 5)
    .map((sentence) => truncateFallbackSentence(sentence, 70))
    .filter(Boolean)
    .slice(0, 4)
}

function buildFallbackMustInclude(
  source: string,
  sentences: readonly string[]
) {
  const items = [
    findFallbackSentence(sentences, ['苏醒', '醒来']),
    findFallbackSentence(sentences, ['倒计时', '斩首', '死局', '危机']),
    findFallbackSentence(sentences, ['驾临', '出现', '审视', '试探']),
    findFallbackSentence(sentences, ['转机', '生机', '一瞥', '发现'])
  ]
    .map((sentence) => truncateFallbackSentence(sentence, 44))
    .filter(Boolean)

  return Array.from(new Set(items)).slice(0, 4).length ?
      Array.from(new Set(items)).slice(0, 4)
    : buildFallbackBeats(sentences).slice(0, 3)
}

function buildFallbackProtocol(source: string): string {
  if (/[皇帝后宫冷宫嫔妃宫女太监]/.test(source)) {
    return '皇帝、后宫、冷宫、嫔妃等称谓保持古言礼制，不使用现代口吻称呼身份。'
  }
  if (/[魔法武技血脉神秘]/.test(source)) {
    return '血脉、魔法、武技等设定保持前后一致，称谓和身份关系不要跳脱当前世界观。'
  }
  return '称谓、身份关系和世界设定保持前后一致，不加入与当前章节无关的新规则。'
}

export function buildChapterPlanFieldFallback(
  context: ChapterPlanFieldFallbackContext
): ChapterPlanFieldValue {
  const source = selectFallbackOutlineSource(context)
  const sentences = splitFallbackSentences(source)
  const actor = inferFallbackActor(source)
  const crisis =
    findFallbackSentence(sentences, [
      '必须',
      '面临',
      '斩首',
      '死局',
      '危机',
      '倒计时'
    ]) ||
    sentences[0] ||
    source
  const turn =
    findFallbackSentence(sentences, [
      '一瞥',
      '意识到',
      '发现',
      '突然',
      '忽',
      '转折',
      '离开前',
      '生机'
    ]) ||
    sentences[sentences.length - 1] ||
    crisis

  if (context.field === 'goal') {
    return `${actor}要主动应对${truncateFallbackSentence(crisis, 56)}，抓住关键人物或事件带来的缝隙争取转机。`
  }
  if (context.field === 'conflict') {
    return `${actor}既要处理${truncateFallbackSentence(crisis, 58)}，又要承受外部审视、既定处境和自保需求之间的拉扯。`
  }
  if (context.field === 'turningPoint') {
    return truncateFallbackSentence(turn, 100)
  }
  if (context.field === 'beats') {
    return buildFallbackBeats(sentences)
  }
  if (context.field === 'mustInclude') {
    return buildFallbackMustInclude(source, sentences)
  }
  if (context.field === 'avoid') {
    return [
      '不要提前解除核心危机。',
      '不要让主角无代价脱险。',
      '不要加入偏离当前章节的支线。'
    ]
  }
  if (context.field === 'interestHooks') {
    return [
      `${truncateFallbackSentence(turn, 70)}，让后续局面留下未解决的危险和转机。`
    ]
  }
  if (context.field === 'pacing') {
    return '压迫感逐步升高，关键对峙处放慢节奏，结尾保留未解决的危机和微弱转机。'
  }
  if (context.field === 'protocol') {
    return buildFallbackProtocol(source)
  }
  return []
}

function hasMetaAnalysisMarker(value: string): boolean {
  const normalized = value.trim()
  return (
    normalized.includes('用户要求') ||
    normalized.includes('用户需要') ||
    normalized.includes('我需要') ||
    normalized.includes('我必须') ||
    normalized.includes('用户提供') ||
    normalized.includes('输入是') ||
    normalized.includes('输入框') ||
    normalized.includes('不要JSON') ||
    normalized.includes('不能使用JSON') ||
    normalized.includes('这很重要') ||
    normalized.includes('深层需求') ||
    normalized.includes('从章节大纲') ||
    normalized.includes('从大纲') ||
    normalized.includes('所以，') ||
    normalized.includes('好的，') ||
    /^首先[，,]/.test(normalized)
  )
}

function extractExplicitFinalText(value: string): string {
  const patterns = [
    /(?:最终内容|最终结果|可填内容|输入框内容|正文内容|输出内容)[：:]\s*([\s\S]+)$/,
    /(?:可以写成|应写成|应该写成|建议写成)[：:]\s*[“"]?([\s\S]+?)[”"]?$/
  ]
  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return ''
}

function cleanCandidateText(value: string): string {
  return value
    .replace(/^[：:\s“"]+/, '')
    .replace(/[”"]$/, '')
    .trim()
}

function splitCandidateAfterLastMarker(
  value: string,
  markers: readonly RegExp[]
): string {
  let result = value
  let lastIndex = -1
  let lastLength = 0
  for (const marker of markers) {
    const matches = [...value.matchAll(marker)]
    const match = matches.at(-1)
    const index = match?.index ?? -1
    if (index >= lastIndex) {
      lastIndex = index
      lastLength = match?.[0]?.length ?? 0
    }
  }
  if (lastIndex >= 0) {
    result = value.slice(lastIndex + lastLength)
  }
  return cleanCandidateText(result)
}

function isQuestionCandidate(value: string): boolean {
  return /^(什么|谁|哪|如何|怎么)[？?]?/.test(value.trim())
}

function isUsableTextCandidate(value: string): boolean {
  return (
    !!value.trim() &&
    !hasMetaAnalysisMarker(value) &&
    !isQuestionCandidate(value)
  )
}

function extractFieldCandidateAfterColon(
  line: string,
  field: ChapterPlanDraftField,
  nouns: readonly string[]
): string {
  const markers = [...CHAPTER_PLAN_FIELD_ALIASES[field], ...nouns]
  if (!markers.some((marker) => line.includes(marker))) return ''
  if (
    !/(?:可以这样设计|具体设计|需要保持|需要遵守|应保持|应遵守|保持|遵守)/.test(
      line
    )
  ) {
    return ''
  }
  const separatorIndex = Math.max(line.lastIndexOf('：'), line.lastIndexOf(':'))
  if (separatorIndex === -1) return ''
  const candidate = cleanCandidateText(line.slice(separatorIndex + 1))
  return isUsableTextCandidate(candidate) ? candidate : ''
}

function extractTextFieldCandidate(
  raw: string,
  field: ChapterPlanDraftField
): string {
  const aliases = CHAPTER_PLAN_FIELD_ALIASES[field]
  const fieldNounPatterns: Record<ChapterPlanDraftField, string[]> = {
    goal: ['目标'],
    conflict: ['冲突', '矛盾'],
    turningPoint: ['转折点', '转折', '关键变化'],
    beats: [],
    mustInclude: [],
    avoid: [],
    characters: [],
    characterStateDeltas: [],
    plotThreadActions: [],
    foreshadowingActions: [],
    interestHooks: [],
    continuityRisks: [],
    pacing: [],
    protocol: ['称谓设定', '称谓', '礼制', '身份关系', '设定补充']
  }
  const directivePatterns: Partial<Record<ChapterPlanDraftField, RegExp[]>> = {
    conflict: [
      /(?:核心冲突|冲突)(?:应该|应|需要)?(?:聚焦于|描述|写清)/g,
      /(?:外部压力和人物两难)[：:，,]?/g
    ],
    turningPoint: [
      /(?:关键转折|转折点|转折)(?:应该|应|需要)?(?:描述|写清)/g,
      /(?:具体事件或发现)[：:，,]?/g
    ],
    pacing: [
      /(?:情绪推进|情绪节奏|节奏控制)(?:应该|应|需要)?(?:分几个阶段|描述|写清|分为)?[：:，,]?/g
    ],
    protocol: [
      /(?:称谓设定|称谓|礼制|身份关系|设定补充)(?:应该|应|需要)?(?:保持|遵守|写清|描述)?[：:，,]?/g
    ]
  }
  for (const line of raw.split(/\r?\n/).reverse()) {
    const normalized = line.trim()
    if (!normalized) continue
    const colonCandidate = extractFieldCandidateAfterColon(
      normalized,
      field,
      fieldNounPatterns[field]
    )
    const directiveCandidate = splitCandidateAfterLastMarker(
      normalized,
      directivePatterns[field] ?? []
    )
    if (
      directiveCandidate !== normalized &&
      isUsableTextCandidate(directiveCandidate)
    ) {
      return directiveCandidate
    }
    if (colonCandidate) return colonCandidate
    for (const alias of aliases) {
      const pattern = new RegExp(
        `${escapeRegExp(alias)}(?:应该是|应是|可能是|可以是|可写为|写成|为)[：:\\s]*[“"]?(.+?)[”"]?$`,
        'i'
      )
      const match = normalized.match(pattern)
      const candidate = cleanCandidateText(match?.[1] ?? '')
      if (isUsableTextCandidate(candidate)) return candidate
    }
    for (const noun of fieldNounPatterns[field]) {
      const markerPattern = new RegExp(
        `${escapeRegExp(noun)}(?:应该|应|可能)?是`,
        'g'
      )
      const markerMatches = [...normalized.matchAll(markerPattern)].reverse()
      for (const markerMatch of markerMatches) {
        const markerIndex = markerMatch.index ?? -1
        if (markerIndex === -1) continue
        const value = cleanCandidateText(
          normalized.slice(markerIndex + markerMatch[0].length)
        )
        if (isUsableTextCandidate(value)) return value
      }
    }
  }
  return ''
}

function cleanGeneratedFieldText(value: string): string {
  return value
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.)、]\s*/, '')
    .replace(/^角色ID\s*\d+\s*[：:]\s*/, '')
    .replace(/^\*+[^*：:]+\*+\s*[：:]\s*/, '')
    .trim()
}

function cleanListCategoryItem(value: string): string {
  const match = value.match(/^[^：:]{1,12}[：:]\s*(.+)$/)
  const item = cleanGeneratedFieldText(match?.[1] ?? value)
  if (!match) return item
  return (
      /(?:大纲|用户|应该|需要|要求|提到|描述|包括|应该是|我需要)/.test(item)
    ) ?
      ''
    : item
}

function parsePlanTextField(raw: string, field: ChapterPlanDraftField): string {
  const focusedLines = extractFieldFocusedLines(raw, field)
  const sourceText = focusedLines.length ? focusedLines.join('\n') : raw
  const explicitFinal = extractExplicitFinalText(sourceText)
  const candidate = extractTextFieldCandidate(sourceText, field)
  const value =
    explicitFinal ||
    candidate ||
    extractBlockValue(focusedLines.length ? focusedLines : [raw], field)
  const cleaned = cleanGeneratedFieldText(value)
  if (!cleaned || hasMetaAnalysisMarker(cleaned)) {
    throw new Error(`${getFieldDisplayLabel(field)}缺少可填表正文`)
  }
  return cleaned
}

function parsePlanListField(
  raw: string,
  field: ChapterPlanDraftField
): string[] {
  const focusedLines = extractFieldFocusedLines(raw, field)
  const sourceLines = focusedLines.length ? focusedLines : raw.split(/\r?\n/)
  const values: string[] = []

  for (const line of sourceLines) {
    const normalized = stripLinePrefix(line.trim())
    if (!normalized) continue
    if (!/^([-*]|\d+[.)、])\s*/.test(line.trim())) continue
    const item = cleanListCategoryItem(normalizeLabeledItem(normalized))
    if (!item || isInstructionLikeLine(item)) continue
    if (hasMetaAnalysisMarker(item)) continue
    values.push(item)
  }

  if (values.length) return values

  const fallbackValues = sourceLines
    .map((line) => cleanGeneratedFieldText(line.trim()))
    .filter(
      (line) =>
        line &&
        !isInstructionLikeLine(line) &&
        !hasMetaAnalysisMarker(line) &&
        !/^[^：:]{1,12}[：:]/.test(line)
    )

  if (!fallbackValues.length) {
    throw new Error(`${getFieldDisplayLabel(field)}缺少可填表条目`)
  }

  return fallbackValues
}

function parsePlanNumberListField(
  raw: string,
  allowedIds: ReadonlySet<number>
): number[] {
  const result: number[] = []
  const seen = new Set<number>()

  for (const match of raw.matchAll(/(?:ID\s*)?(\d+)/gi)) {
    const value = Number(match[1])
    if (!Number.isInteger(value) || !allowedIds.has(value) || seen.has(value)) {
      continue
    }
    seen.add(value)
    result.push(value)
  }

  return result
}

export function parseChapterPlanFieldValue(
  raw: string,
  options: {
    field: ChapterPlanDraftField
    kind: ChapterPlanFieldValueKind
    allowedIds?: ReadonlySet<number>
  }
): ChapterPlanFieldValue {
  if (options.kind === 'text') return parsePlanTextField(raw, options.field)
  if (options.kind === 'list') return parsePlanListField(raw, options.field)
  return parsePlanNumberListField(raw, options.allowedIds ?? new Set())
}

function collectJsonObjectCandidates(raw: string): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let index = 0; index < raw.length; index++) {
    const char = raw[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') {
      if (depth === 0) start = index
      depth++
      continue
    }
    if (char === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        try {
          const parsed = JSON.parse(raw.slice(start, index + 1)) as unknown
          const record = asRecord(parsed)
          if (Object.keys(record).length) candidates.push(record)
        } catch {
          /* 不是完整 JSON 对象则跳过 */
        }
        start = -1
      }
    }
  }

  return candidates
}

function selectBestPartialRecord(
  raw: string,
  allowedFields: readonly ChapterPlanDraftField[]
): Record<string, unknown> | null {
  const candidates = collectJsonObjectCandidates(raw)
  const parsed = parseJsonObjectLike(raw)
  if (parsed) candidates.push(asRecord(parsed))
  const labeled = parseLabeledPlanRecord(raw)
  if (labeled) candidates.push(labeled)
  const reasoning = parseReasoningPlanRecord(raw)
  if (reasoning) candidates.push(reasoning)
  const markdownReasoning = parseMarkdownReasoningRecord(raw)
  if (markdownReasoning) candidates.push(markdownReasoning)

  let bestRecord: Record<string, unknown> | null = null
  let bestScore = 0
  for (const candidate of candidates) {
    const record = selectReadablePlanRecord(candidate, allowedFields)
    const score = countReadableFields(record, allowedFields)
    if (score > bestScore) {
      bestScore = score
      bestRecord = record
    }
  }

  return (
    bestRecord ??
    markdownReasoning ??
    reasoning ??
    labeled ??
    (parsed ? asRecord(parsed) : null)
  )
}

export function parseChapterPlanPartialDraft(
  raw: string,
  allowedFields: readonly ChapterPlanDraftField[]
): ChapterPlanPartialDraft {
  const parsedRecord = selectBestPartialRecord(raw, allowedFields)
  if (!parsedRecord) {
    throw new Error('AI 未返回可用的剧情计划：未找到 JSON 对象')
  }
  const record = parsedRecord
  const partial: ChapterPlanPartialDraft = {}

  for (const field of allowedFields) {
    const value = CHAPTER_PLAN_FIELD_READERS[field](record)
    if (!hasPartialValue(value) && !isReferenceOnlyPartial(allowedFields)) {
      continue
    }
    if (field === 'goal') partial.goal = value as string
    if (field === 'conflict') partial.conflict = value as string
    if (field === 'turningPoint') partial.turningPoint = value as string
    if (field === 'beats') partial.beats = value as string[]
    if (field === 'mustInclude') partial.mustInclude = value as string[]
    if (field === 'avoid') partial.avoid = value as string[]
    if (field === 'characters') partial.characters = value as number[]
    if (field === 'characterStateDeltas') {
      partial.characterStateDeltas = value as string[]
    }
    if (field === 'plotThreadActions') {
      partial.plotThreadActions = value as number[]
    }
    if (field === 'foreshadowingActions') {
      partial.foreshadowingActions = value as number[]
    }
    if (field === 'interestHooks') partial.interestHooks = value as string[]
    if (field === 'continuityRisks') {
      partial.continuityRisks = value as string[]
    }
    if (field === 'pacing') partial.pacing = value as string
    if (field === 'protocol') partial.protocol = value as string
  }

  if (Object.keys(partial).length === 0) {
    throw new Error(
      `AI 未返回可用的剧情计划：${getPartialErrorLabel(allowedFields)}缺少可用字段`
    )
  }

  return partial
}

export function mergeChapterPlanPartials(
  partials: readonly ChapterPlanPartialDraft[]
): ChapterPlanDraft {
  const merged: ChapterPlanPartialDraft = Object.assign({}, ...partials)
  return {
    goal: merged.goal ?? '',
    conflict: merged.conflict ?? '',
    turningPoint: merged.turningPoint ?? '',
    beats: merged.beats ?? [],
    mustInclude: merged.mustInclude ?? [],
    avoid: merged.avoid ?? [],
    characters: merged.characters ?? [],
    characterStateDeltas: merged.characterStateDeltas ?? [],
    plotThreadActions: merged.plotThreadActions ?? [],
    foreshadowingActions: merged.foreshadowingActions ?? [],
    interestHooks: merged.interestHooks ?? [],
    continuityRisks: merged.continuityRisks ?? [],
    pacing: merged.pacing ?? '',
    protocol: merged.protocol ?? ''
  }
}

export function parseChapterPlanDraft(raw: string): ChapterPlanDraft {
  const parsed = parseJsonObjectLike(raw)
  if (!parsed) {
    throw new Error('AI 未返回可用的剧情计划：未找到 JSON 对象')
  }
  const record = selectPlanRecord(asRecord(parsed))

  const plan = {
    goal: CHAPTER_PLAN_FIELD_READERS.goal(record),
    conflict: CHAPTER_PLAN_FIELD_READERS.conflict(record),
    turningPoint: CHAPTER_PLAN_FIELD_READERS.turningPoint(record),
    beats: CHAPTER_PLAN_FIELD_READERS.beats(record),
    mustInclude: CHAPTER_PLAN_FIELD_READERS.mustInclude(record),
    avoid: CHAPTER_PLAN_FIELD_READERS.avoid(record),
    characters: CHAPTER_PLAN_FIELD_READERS.characters(record),
    characterStateDeltas:
      CHAPTER_PLAN_FIELD_READERS.characterStateDeltas(record),
    plotThreadActions: CHAPTER_PLAN_FIELD_READERS.plotThreadActions(record),
    foreshadowingActions:
      CHAPTER_PLAN_FIELD_READERS.foreshadowingActions(record),
    interestHooks: CHAPTER_PLAN_FIELD_READERS.interestHooks(record),
    continuityRisks: CHAPTER_PLAN_FIELD_READERS.continuityRisks(record),
    pacing: CHAPTER_PLAN_FIELD_READERS.pacing(record),
    protocol: CHAPTER_PLAN_FIELD_READERS.protocol(record)
  }

  if (
    !plan.goal &&
    !plan.conflict &&
    !plan.turningPoint &&
    !plan.beats.length &&
    !plan.interestHooks.length
  ) {
    throw new Error('AI 未返回可用的剧情计划：JSON 缺少可用剧情字段')
  }

  return plan
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}

function hasItems(values: string[]): boolean {
  return values.some((value) => hasText(value))
}

function hasHighRisk(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    normalized.includes('高风险') ||
    normalized.includes('high risk') ||
    normalized.includes('严重') ||
    normalized.includes('阻断')
  )
}

const TEMPLATE_PLACEHOLDERS = new Set([
  '本章要推进的核心目标',
  '本章核心冲突或两难选择',
  '本章关键转折',
  '剧情节拍1',
  '剧情节拍2',
  '剧情节拍3',
  '必须出现的人物、事件、物件',
  '需要避免提前揭露或避免出场的内容',
  '角色状态变化',
  '章末或段落中的悬念/爽点/反转',
  '可能破坏连续性的风险；没有则空数组',
  '情绪与节奏要求',
  '称谓、身份、礼制或设定补充'
])

function containsTemplatePlaceholder(values: string[]): boolean {
  return values.some((value) => TEMPLATE_PLACEHOLDERS.has(value.trim()))
}

function pushIssue(
  issues: ChapterPlanIssue[],
  code: ChapterPlanIssue['code'],
  severity: ChapterPlanIssueSeverity,
  message: string
) {
  issues.push({ code, severity, message })
}

export function validateChapterPlanDraft(
  plan: ChapterPlanDraft,
  context: ChapterPlanReferenceContext
): ChapterPlanValidationResult {
  const issues: ChapterPlanIssue[] = []

  if (!hasText(plan.goal)) {
    pushIssue(
      issues,
      'missing_goal',
      'error',
      `第 ${context.chapterNumber} 章计划缺少明确目标`
    )
  }
  if (!hasText(plan.conflict)) {
    pushIssue(
      issues,
      'missing_conflict',
      'error',
      `第 ${context.chapterNumber} 章计划缺少核心冲突`
    )
  }
  if (!hasText(plan.turningPoint)) {
    pushIssue(
      issues,
      'missing_turning_point',
      'error',
      `第 ${context.chapterNumber} 章计划缺少关键转折`
    )
  }
  if (!hasItems(plan.beats)) {
    pushIssue(
      issues,
      'missing_beat',
      'error',
      `第 ${context.chapterNumber} 章计划缺少可执行剧情节拍`
    )
  }
  if (!hasItems(plan.interestHooks)) {
    pushIssue(
      issues,
      'missing_interest_hook',
      'warning',
      `第 ${context.chapterNumber} 章计划缺少吸引读者继续阅读的钩子`
    )
  }

  for (const characterId of plan.characters) {
    if (!context.characterIds.has(characterId)) {
      pushIssue(
        issues,
        'unknown_character',
        'error',
        `计划引用了不存在或不属于本书的角色：${characterId}`
      )
    }
  }
  for (const plotPointId of plan.plotThreadActions) {
    if (!context.plotPointIds.has(plotPointId)) {
      pushIssue(
        issues,
        'unknown_plot_point',
        'error',
        `计划引用了不存在或不属于本书的情节线索：${plotPointId}`
      )
    }
  }
  for (const foreshadowingId of plan.foreshadowingActions) {
    if (!context.foreshadowingIds.has(foreshadowingId)) {
      pushIssue(
        issues,
        'unknown_foreshadowing',
        'error',
        `计划引用了不存在或不属于本书的伏笔：${foreshadowingId}`
      )
    }
  }
  if (plan.continuityRisks.some(hasHighRisk)) {
    pushIssue(
      issues,
      'high_continuity_risk',
      'error',
      `第 ${context.chapterNumber} 章计划存在高风险连续性问题，需先修订`
    )
  }
  if (
    containsTemplatePlaceholder([
      plan.goal,
      plan.conflict,
      plan.turningPoint,
      ...plan.beats,
      ...plan.mustInclude,
      ...plan.avoid,
      ...plan.characterStateDeltas,
      ...plan.interestHooks,
      ...plan.continuityRisks,
      plan.pacing,
      plan.protocol
    ])
  ) {
    pushIssue(
      issues,
      'template_placeholder',
      'error',
      `第 ${context.chapterNumber} 章计划仍包含字段说明或模板占位内容`
    )
  }

  return {
    blocked: issues.some((issue) => issue.severity === 'error'),
    issues
  }
}
