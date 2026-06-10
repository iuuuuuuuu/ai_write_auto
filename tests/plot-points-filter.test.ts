import { describe, expect, it } from 'vitest'
import { filterUsablePlotPoints } from '../server/utils/plot-points'

describe('filterUsablePlotPoints', () => {
  it('keeps global and active-chapter plot points while excluding deleted chapters', () => {
    const activeChapter = {
      id: 1,
      deletedAt: null
    }
    const deletedChapter = {
      id: 2,
      deletedAt: new Date('2026-06-10T00:00:00Z')
    }

    const result = filterUsablePlotPoints([
      {
        id: 1,
        chapter: null,
        description: '全局主线',
        type: 'setup',
        status: 'introduced'
      },
      {
        id: 2,
        chapter: activeChapter,
        description: '有效章节线索',
        type: 'conflict',
        status: 'developing'
      },
      {
        id: 3,
        chapter: deletedChapter,
        description: '删除章节线索',
        type: 'twist',
        status: 'introduced'
      }
    ])

    expect(result.map((point) => point.description)).toEqual([
      '全局主线',
      '有效章节线索'
    ])
  })
})
