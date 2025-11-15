import type { MaskPolygon, Point } from '../types'

const MIN_POINTS = 3

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

export function hitTestMaskPoint(mask: MaskPolygon, point: Point, radius: number) {
  const { points } = mask
  if (!points.length) return -1

  for (let i = 0; i < points.length; i += 1) {
    if (distance(points[i], point) <= radius) {
      return i
    }
  }

  return -1
}

export function hitTestMaskSegment(
  mask: MaskPolygon,
  point: Point,
  tolerance: number,
) {
  const { points } = mask
  const count = points.length
  if (count < 2) return -1

  let closestIndex = -1
  let closestDistance = Number.POSITIVE_INFINITY

  for (let i = 0; i < count; i += 1) {
    const start = points[i]
    const end = points[(i + 1) % count]
    const dist = distanceToSegment(point, start, end)
    if (dist <= tolerance && dist < closestDistance) {
      closestDistance = dist
      closestIndex = i
    }
  }

  return closestIndex
}

export function insertPointIntoSegment(
  mask: MaskPolygon,
  segmentIndex: number,
  point: Point,
): MaskPolygon {
  const { points } = mask
  if (points.length === 0) return mask

  const index = ((segmentIndex % points.length) + points.length) % points.length
  const insertAt = index + 1
  const newPoints = [
    ...points.slice(0, insertAt),
    point,
    ...points.slice(insertAt),
  ]

  return {
    ...mask,
    points: newPoints,
  }
}

export function deleteMaskPoint(
  mask: MaskPolygon,
  pointIndex: number,
): MaskPolygon {
  const { points } = mask
  if (points.length <= MIN_POINTS) {
    return mask
  }
  if (pointIndex < 0 || pointIndex >= points.length) {
    return mask
  }

  const newPoints = points.filter((_, idx) => idx !== pointIndex)

  if (newPoints.length < MIN_POINTS) {
    return mask
  }

  return {
    ...mask,
    points: newPoints,
  }
}
