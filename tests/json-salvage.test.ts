import { describe, it, expect } from 'vitest'
import {
  parseJsonArrayLike,
  parsePartialJsonArray,
  parseJsonObjectLike
} from '../server/utils/json-salvage'

describe('parsePartialJsonArray', () => {
  it('解析干净的 JSON 数组', () => {
    const r = parsePartialJsonArray('[{"a":1},{"a":2}]')
    expect(r).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('剥离 ```json 代码围栏', () => {
    const r = parsePartialJsonArray('```json\n[{"x":"y"}]\n```')
    expect(r).toEqual([{ x: 'y' }])
  })

  it('忽略数组后跟的解释性文字（贪婪匹配到最后一个 ]）', () => {
    const r = parsePartialJsonArray('[{"n":1}]\n\n以上是结果，仅供参考。')
    expect(r).toEqual([{ n: 1 }])
  })

  it('从对象包装字段里取出数组（outlines/data 等）', () => {
    expect(parsePartialJsonArray('{"outlines":[{"chapterNumber":1}]}')).toEqual(
      [{ chapterNumber: 1 }]
    )
    // 贪婪匹配会先撞上非法子串、回退到整体解析取 data 字段
    expect(parsePartialJsonArray('{"data":[{"a":1}],"extra":[2]}')).toEqual([
      { a: 1 }
    ])
    expect(parseJsonArrayLike('{"suggestions":[{"name":"角色"}]}')).toEqual([
      { name: '角色' }
    ])
    expect(parseJsonArrayLike('{"issues":[{"type":"plot_hole"}]}')).toEqual([
      { type: 'plot_hole' }
    ])
  })

  it('截断 salvage：从半截数组里救回已写完的前 N 个对象', () => {
    // 模拟 token 上限把第二个对象切到一半、且没有收尾的 ]
    const truncated =
      '[{"chapterNumber":1,"description":"第一章完整"},{"chapterNumber":2,"description":"第二章还没写'
    const r = parsePartialJsonArray(truncated)
    expect(r).toEqual([{ chapterNumber: 1, description: '第一章完整' }])
  })

  it('截断 salvage：丢掉末尾的逗号/不完整片段', () => {
    const truncated = '[{"a":1},{"a":2},'
    expect(parsePartialJsonArray(truncated)).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('空数组返回空数组', () => {
    expect(parsePartialJsonArray('[]')).toEqual([])
  })

  it('非数组对象、垃圾、空串都返回 []', () => {
    expect(parsePartialJsonArray('{"foo":"bar"}')).toEqual([])
    expect(parsePartialJsonArray('这根本不是 JSON')).toEqual([])
    expect(parsePartialJsonArray('')).toEqual([])
    expect(parsePartialJsonArray('   ')).toEqual([])
  })
})

describe('parseJsonObjectLike', () => {
  it('解析干净的 JSON 对象', () => {
    expect(
      parseJsonObjectLike('{"worldSetting":"宫廷","styleGuide":"克制"}')
    ).toEqual({
      worldSetting: '宫廷',
      styleGuide: '克制'
    })
  })

  it('剥离代码围栏和前后解释文字', () => {
    const raw = '好的，结果如下：\n```json\n{"a":1,"b":"x"}\n```\n请查收。'
    expect(parseJsonObjectLike(raw)).toEqual({ a: 1, b: 'x' })
  })

  it('可从对象包装字段中取出内部对象', () => {
    expect(parseJsonObjectLike('{"data":{"description":"本章大纲"}}')).toEqual({
      description: '本章大纲'
    })
  })

  it('数组、半截对象和垃圾内容返回 null', () => {
    expect(parseJsonObjectLike('[{"a":1}]')).toBeNull()
    expect(parseJsonObjectLike('{"worldSetting":"未闭合')).toBeNull()
    expect(parseJsonObjectLike('不是 JSON')).toBeNull()
  })
})
