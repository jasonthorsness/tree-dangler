import type { LineSegment, MaskPolygon, Point } from '../types'

const ENDPOINT_RADIUS = 10
const SEGMENT_TOLERANCE = 8

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y

  if (dx === 0 && dy === 0) {
    return distance(point, start)
  }

  const t =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)
  const clampedT = Math.max(0, Math.min(1, t))
  const closest = {
    x: start.x + clampedT * dx,
    y: start.y + clampedT * dy,
  }

  return distance(point, closest)
}

export function isPointInsideMask(point: Point, mask: MaskPolygon): boolean {
  const { points } = mask
  if (points.length < 3) return false

  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const pi = points[i]
    const pj = points[j]

    const intersect =
      pi.y > point.y !== pj.y > point.y &&
      point.x <
        ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y + Number.EPSILON) + pi.x
    if (intersect) {
      inside = !inside
    }
  }

  return inside
}

export function clampPointToMask(point: Point, mask: MaskPolygon): Point | null {
  if (isPointInsideMask(point, mask)) {
    return point
  }
  return null
}

export function createDefaultSegmentAtPoint(
  mask: MaskPolygon,
  click: Point,
): LineSegment | null {
  const span = 20
  const start: Point = { x: click.x - span, y: click.y }
  const end: Point = { x: click.x + span, y: click.y }

  if (!isPointInsideMask(start, mask) || !isPointInsideMask(end, mask)) {
    return null
  }

  return {
    id: crypto.randomUUID(),
    start,
    end,
    text: '',
  }
}

export function hitTestSegment(
  segments: LineSegment[],
  point: Point,
  tolerance = SEGMENT_TOLERANCE,
) {
  let closestIndex = -1
  let closestDistance = Number.POSITIVE_INFINITY

  segments.forEach((segment, index) => {
    const dist = distanceToSegment(point, segment.start, segment.end)
    if (dist <= tolerance && dist < closestDistance) {
      closestIndex = index
      closestDistance = dist
    }
  })

  return closestIndex
}

export function hitTestEndpoint(
  segments: LineSegment[],
  point: Point,
  radius = ENDPOINT_RADIUS,
):
  | {
      segmentIndex: number
      endpoint: 'start' | 'end'
    }
  | null {
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]
    if (distance(segment.start, point) <= radius) {
      return { segmentIndex: i, endpoint: 'start' }
    }
    if (distance(segment.end, point) <= radius) {
      return { segmentIndex: i, endpoint: 'end' }
    }
  }

  return null
}

export function moveSegment(
  segment: LineSegment,
  delta: Point,
  mask: MaskPolygon,
): LineSegment | null {
  const newStart = { x: segment.start.x + delta.x, y: segment.start.y + delta.y }
  const newEnd = { x: segment.end.x + delta.x, y: segment.end.y + delta.y }

  if (!isPointInsideMask(newStart, mask) || !isPointInsideMask(newEnd, mask)) {
    return null
  }

  return { ...segment, start: newStart, end: newEnd }
}

export function moveEndpoint(
  segment: LineSegment,
  endpoint: 'start' | 'end',
  newPoint: Point,
  mask: MaskPolygon,
): LineSegment | null {
  if (!isPointInsideMask(newPoint, mask)) {
    return null
  }

  if (endpoint === 'start') {
    return { ...segment, start: newPoint }
  }
  return { ...segment, end: newPoint }
}
