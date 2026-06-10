type CharacterRef = {
  id: number
}

type ChapterRef = {
  id: number
  chapterNumber: number
  title: string
  deletedAt?: Date | string | null
}

type CharacterAppearanceRef = {
  id: number
  character: CharacterRef
  chapter: ChapterRef
  role: 'main' | 'supporting' | 'mentioned'
  snippet: string | null
  background: string | null
  positionStart: number | null
  positionEnd: number | null
  createdAt: Date | string | null
}

type ChapterCharacterRef = {
  id: number
  character: CharacterRef
  chapter: ChapterRef
  role: 'main' | 'supporting' | 'mentioned'
  chapterStory: string | null
}

export interface CharacterAppearancePayloadItem {
  id: number
  chapterId: number
  chapterNumber: number
  chapterTitle: string
  role: 'main' | 'supporting' | 'mentioned'
  chapterStory?: string | null
  snippet: string | null
  background: string | null
  positionStart: number | null
  positionEnd: number | null
  createdAt: Date | string | null
}

export interface CharacterAppearancePayload {
  firstAppearanceChapter: number | null
  lastAppearanceChapter: number | null
  appearances: CharacterAppearancePayloadItem[]
}

function isActiveChapter(chapter: ChapterRef) {
  return !chapter.deletedAt
}

export function buildCharacterAppearancePayload(
  character: CharacterRef,
  sources: {
    appearances: CharacterAppearanceRef[]
    assignments: ChapterCharacterRef[]
  }
): CharacterAppearancePayload {
  const appearanceItems = sources.appearances
    .filter(
      (appearance) =>
        appearance.character.id === character.id &&
        isActiveChapter(appearance.chapter)
    )
    .map((appearance) => ({
      id: appearance.id,
      chapterId: appearance.chapter.id,
      chapterNumber: appearance.chapter.chapterNumber,
      chapterTitle: appearance.chapter.title,
      role: appearance.role,
      snippet: appearance.snippet,
      background: appearance.background,
      positionStart: appearance.positionStart,
      positionEnd: appearance.positionEnd,
      createdAt: appearance.createdAt
    }))

  const appearanceChapterIds = new Set(
    appearanceItems.map((appearance) => appearance.chapterId)
  )
  const assignmentItems = sources.assignments
    .filter(
      (assignment) =>
        assignment.character.id === character.id &&
        isActiveChapter(assignment.chapter) &&
        !appearanceChapterIds.has(assignment.chapter.id)
    )
    .map((assignment) => ({
      id: assignment.id,
      chapterId: assignment.chapter.id,
      chapterNumber: assignment.chapter.chapterNumber,
      chapterTitle: assignment.chapter.title,
      role: assignment.role,
      chapterStory: assignment.chapterStory,
      snippet: null,
      background: null,
      positionStart: null,
      positionEnd: null,
      createdAt: null
    }))

  const appearances = [...appearanceItems, ...assignmentItems].sort(
    (left, right) =>
      right.chapterNumber - left.chapterNumber || right.id - left.id
  )
  const chapterNumbers = appearances.map(
    (appearance) => appearance.chapterNumber
  )

  return {
    firstAppearanceChapter:
      chapterNumbers.length ? Math.min(...chapterNumbers) : null,
    lastAppearanceChapter:
      chapterNumbers.length ? Math.max(...chapterNumbers) : null,
    appearances
  }
}
