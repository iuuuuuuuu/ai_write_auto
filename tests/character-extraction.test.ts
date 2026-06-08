import { describe, it, expect } from 'vitest'
import { parseExtractedCharacters } from '../server/utils/character-extraction'

describe('parseExtractedCharacters', () => {
  it('解析干净数组并归一化字段', () => {
    const raw = JSON.stringify([
      {
        name: '林轩',
        description: '主角',
        traits: '坚毅',
        currentState: '受伤',
        role: 'main',
        appearances: [
          { snippet: '林轩握紧剑', positionStart: 10, positionEnd: 20, background: '初登场' }
        ]
      }
    ])
    const r = parseExtractedCharacters(raw)
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({
      name: '林轩',
      description: '主角',
      traits: '坚毅',
      currentState: '受伤',
      role: 'main',
      appearances: [
        { snippet: '林轩握紧剑', positionStart: 10, positionEnd: 20, background: '初登场' }
      ]
    })
  })

  it('剥离 ```json 围栏', () => {
    const inner = JSON.stringify([{ name: '苏璃', role: 'supporting', appearances: [] }])
    const r = parseExtractedCharacters('```json\n' + inner + '\n```')
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('苏璃')
  })

  it('截断时救回已写完的前 N 个完整角色（E2 修复点）', () => {
    // 长章节角色多、被 token 上限截断：第二个角色写到一半、没有收尾的 ]
    const truncated =
      '[{"name":"完整角色甲","role":"main","appearances":[]},{"name":"还没写完的乙","role":"sup'
    const r = parseExtractedCharacters(truncated)
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('完整角色甲')
    expect(r[0].role).toBe('main')
  })

  it('丢弃无 name 的非法条目，保留合法条目', () => {
    const raw = JSON.stringify([
      { name: '', role: 'main', appearances: [] },
      { description: '没有名字', appearances: [] },
      { name: '有效角色', role: 'mentioned', appearances: [] }
    ])
    const r = parseExtractedCharacters(raw)
    expect(r.map((c) => c.name)).toEqual(['有效角色'])
    expect(r[0].role).toBe('mentioned')
  })

  it('未知 role 归一化为 supporting，缺省字段归一化为 null', () => {
    const raw = JSON.stringify([
      { name: '路人', role: '反派', description: '   ', traits: 42, appearances: [] }
    ])
    const r = parseExtractedCharacters(raw)
    expect(r[0].role).toBe('supporting')
    expect(r[0].description).toBeNull() // 空白串 → null
    expect(r[0].traits).toBeNull() // 非字符串 → null
    expect(r[0].currentState).toBeNull()
  })

  it('过滤非法 appearance 项并归一化其数值/可空字段', () => {
    const raw = JSON.stringify([
      {
        name: '主角',
        role: 'main',
        appearances: [
          { snippet: '正常出场', positionStart: 5, positionEnd: '末尾', background: null },
          null,
          'not-an-object'
        ]
      }
    ])
    const r = parseExtractedCharacters(raw)
    expect(r[0].appearances).toHaveLength(1)
    expect(r[0].appearances[0]).toEqual({
      snippet: '正常出场',
      positionStart: 5,
      positionEnd: null, // 非数字 → null
      background: null
    })
  })

  it('appearances 缺失或非数组时回落为空数组', () => {
    const raw = JSON.stringify([{ name: '无出场', role: 'mentioned' }])
    const r = parseExtractedCharacters(raw)
    expect(r[0].appearances).toEqual([])
  })

  it('垃圾/空输入返回 []（不抛错）', () => {
    expect(parseExtractedCharacters('抱歉，无法识别')).toEqual([])
    expect(parseExtractedCharacters('')).toEqual([])
    expect(parseExtractedCharacters('{"not":"array"}')).toEqual([])
  })
})
