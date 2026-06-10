import { isActiveChapterRef, type ChapterRef } from './chapter-refs'

type PlotPointRef = {
  chapter?: ChapterRef | number | null
}

export function filterUsablePlotPoints<T extends PlotPointRef>(
  plotPoints: T[]
): T[] {
  return plotPoints.filter((point) => isActiveChapterRef(point.chapter))
}
