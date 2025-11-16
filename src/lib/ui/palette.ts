import type { LineSegment } from '../types'

export const SEGMENT_COLORS = ['#38bdf8', '#34d399', '#f472b6', '#facc15', '#c084fc', '#fb7185', '#f97316', '#22d3ee']

export function getPaletteColor(index: number) {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length]
}

export function getSegmentColor(segmentId: string, segments: LineSegment[]) {
  const index = segments.findIndex((segment) => segment.id === segmentId)
  if (index === -1) {
    return getPaletteColor(0)
  }
  return getPaletteColor(index)
}
