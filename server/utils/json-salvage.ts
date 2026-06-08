/**
 * 容错解析 LLM 输出里的「JSON 数组」。统一了原先散落四处的同源实现：
 * plot-threads 的 parsePlotThreads、extract-characters 端点、outline-autofill 的
 * parseOutlineArray、ai-stream 的 parseJsonResult。
 *
 * 解析分三档逐级兜底：
 *   1) 剥 ```json fence 后贪婪匹配 [...] 整体解析（最常见：干净数组，或数组后跟解释文字）
 *   2) 整体解析：直接是数组则返回；是对象则取已知包装字段里的数组
 *   3) 截断 salvage：从首个 '[' 截到最后一个完整对象的 '}'，补未闭合的引号/花括号/方括号
 *
 * 任何情况都不抛错，彻底失败返回 []。逐项结构校验交给调用方（各方已有自己的 map/filter）。
 * 纯函数，便于单测。
 */

/** AI 偶尔把数组裹进对象里返回，按优先级在这些字段里找数组。 */
const WRAPPER_KEYS = ['outlines', 'chapters', 'items', 'data', 'results'] as const

export function parsePartialJsonArray(raw: string): unknown[] {
  if (!raw) return []
  const cleaned = raw
    .replace(/^```(?:json|JSON)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim()
  if (!cleaned) return []

  // 1) 贪婪匹配 [...] 整体解析
  const greedy = cleaned.match(/\[[\s\S]*\]/)
  if (greedy) {
    try {
      const arr = JSON.parse(greedy[0])
      if (Array.isArray(arr)) return arr
    } catch {
      /* 落到下一档 */
    }
  }

  // 2) 整体解析：数组直接返回；对象则取包装字段里的数组
  try {
    const whole = JSON.parse(cleaned)
    if (Array.isArray(whole)) return whole
    if (whole && typeof whole === 'object') {
      for (const key of WRAPPER_KEYS) {
        const v = (whole as Record<string, unknown>)[key]
        if (Array.isArray(v)) return v
      }
    }
  } catch {
    /* 落到下一档 */
  }

  // 3) 截断 salvage：截到最后一个完整对象，补齐括号再解析，取已写完的前 N 个
  const open = cleaned.indexOf('[')
  const lastClose = cleaned.lastIndexOf('}')
  if (open >= 0 && lastClose > open) {
    let fix = cleaned.slice(open, lastClose + 1)
    if (fix.split('"').length % 2 === 0) fix += '"' // 引号成奇数 → 补一个收尾
    const opens = (fix.match(/\{/g) || []).length
    const closes = (fix.match(/\}/g) || []).length
    for (let i = 0; i < opens - closes; i++) fix += '}'
    fix += ']'
    try {
      const arr = JSON.parse(fix)
      if (Array.isArray(arr)) return arr
    } catch {
      /* 仍失败 → 返回空 */
    }
  }

  return []
}
