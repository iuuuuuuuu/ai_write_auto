import { describe, expect, it } from 'vitest'
import { buildCharacterAppearancePayload } from '../server/utils/character-appearances'

describe('buildCharacterAppearancePayload', () => {
  it('excludes deleted chapters when deriving appearance bounds and recent appearances', () => {
    const character = { id: 7 }
    const firstChapter = {
      id: 11,
      chapterNumber: 1,
      title: '初遇',
      deletedAt: null
    }
    const recentChapter = {
      id: 12,
      chapterNumber: 2,
      title: '再会',
      deletedAt: null
    }
    const deletedChapter = {
      id: 13,
      chapterNumber: 3,
      title: '已删除章节',
      deletedAt: new Date('2026-06-10T00:00:00Z')
    }

    const result = buildCharacterAppearancePayload(character, {
      appearances: [
        {
          id: 1,
          character,
          chapter: firstChapter,
          role: 'main',
          snippet: '初次登场',
          background: null,
          positionStart: 1,
          positionEnd: 4,
          createdAt: new Date('2026-06-09T00:00:00Z')
        },
        {
          id: 2,
          character,
          chapter: deletedChapter,
          role: 'main',
          snippet: '这条不应出现',
          background: null,
          positionStart: 1,
          positionEnd: 4,
          createdAt: new Date('2026-06-10T00:00:00Z')
        }
      ],
      assignments: [
        {
          id: 3,
          character,
          chapter: recentChapter,
          role: 'supporting',
          chapterStory: '有效的最近出场'
        },
        {
          id: 4,
          character,
          chapter: deletedChapter,
          role: 'supporting',
          chapterStory: '删除章节里的出场不应计入'
        },
        {
          id: 5,
          character,
          chapter: firstChapter,
          role: 'mentioned',
          chapterStory: '同章节已有抽取出场时不重复补 assignment'
        }
      ]
    })

    expect(result.firstAppearanceChapter).toBe(1)
    expect(result.lastAppearanceChapter).toBe(2)
    expect(result.appearances.map((item) => item.chapterNumber)).toEqual([2, 1])
    expect(result.appearances.map((item) => item.chapterId)).not.toContain(
      deletedChapter.id
    )
  })
})
