/**
 * 角色抽取：解析 AI 从章节正文里抽出的角色 JSON 数组，结构非法的条目丢弃。
 *
 * 统一了原先在 task-queue（后处理任务）与 extract-characters 端点（手动触发）各写一份的
 * 重复实现。内部用 parsePartialJsonArray 做容错 + 截断 salvage —— 长章节角色多、被 token
 * 上限截断时，也能取出已写完的前 N 个完整角色，而非整批丢失（这正是 task-queue 旧实现裸
 * JSON.parse 抛错 → 任务重试 3 次后放弃 → 该章角色记忆全丢的 E2 bug）。纯函数，便于单测。
 */
import { parsePartialJsonArray } from './json-salvage'

export type ExtractedCharacterRole = 'main' | 'supporting' | 'mentioned'

export interface ExtractedAppearance {
  snippet: string | null
  positionStart: number | null
  positionEnd: number | null
  background: string | null
}

export interface ExtractedCharacter {
  name: string
  description: string | null
  traits: string | null
  currentState: string | null
  role: ExtractedCharacterRole
  appearances: ExtractedAppearance[]
}

function normalizeRole(value: unknown): ExtractedCharacterRole {
  return value === 'main' || value === 'mentioned' ? value : 'supporting'
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function parseExtractedCharacters(result: string): ExtractedCharacter[] {
  return parsePartialJsonArray(result)
    .map((item): ExtractedCharacter | null => {
      if (!item || typeof item !== 'object') return null
      const source = item as Record<string, unknown>
      const name = normalizeNullableString(source.name)
      if (!name) return null

      const rawAppearances = Array.isArray(source.appearances)
        ? source.appearances
        : []
      const appearances = rawAppearances
        .map((appearance): ExtractedAppearance | null => {
          if (!appearance || typeof appearance !== 'object') return null
          const s = appearance as Record<string, unknown>
          return {
            snippet: normalizeNullableString(s.snippet),
            positionStart: normalizeNullableNumber(s.positionStart),
            positionEnd: normalizeNullableNumber(s.positionEnd),
            background: normalizeNullableString(s.background)
          }
        })
        .filter((a): a is ExtractedAppearance => Boolean(a))

      return {
        name,
        description: normalizeNullableString(source.description),
        traits: normalizeNullableString(source.traits),
        currentState: normalizeNullableString(source.currentState),
        role: normalizeRole(source.role),
        appearances
      }
    })
    .filter((item): item is ExtractedCharacter => Boolean(item))
}
