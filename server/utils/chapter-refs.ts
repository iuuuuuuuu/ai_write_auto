export type ChapterRef = {
  id: number
  chapterNumber?: number
  title?: string
  deletedAt?: Date | string | null
}

export function isPopulatedChapter(
  chapter: ChapterRef | number | null | undefined
): chapter is ChapterRef {
  return typeof chapter === 'object' && chapter !== null
}

export function isActiveChapterRef(
  chapter: ChapterRef | number | null | undefined
) {
  return !isPopulatedChapter(chapter) || !chapter.deletedAt
}
