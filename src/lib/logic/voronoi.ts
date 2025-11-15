import { Delaunay } from 'd3-delaunay'
import { union } from 'martinez-polygon-clipping'

import type { LineSegment, MaskPolygon, Point, Polygon } from '../types'

export interface SampledPoint {
  point: Point
  segmentId: string
}

export function sampleSegmentPoints(
  segment: LineSegment,
  spacing = 20,
): SampledPoint[] {
  const { start, end } = segment
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  const steps = Math.max(2, Math.ceil(length / spacing))
  const samples: SampledPoint[] = []

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    samples.push({
      point: {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      },
      segmentId: segment.id,
    })
  }

  return samples
}

export function buildSampledPoints(segments: LineSegment[], spacing = 20) {
  const points: Point[] = []
  const segmentIds: string[] = []

  segments.forEach((segment) => {
    const samples = sampleSegmentPoints(segment, spacing)
    samples.forEach((sample) => {
      points.push(sample.point)
      segmentIds.push(sample.segmentId)
    })
  })

  return { points, segmentIds }
}

function maskBounds(mask: MaskPolygon) {
  const xs = mask.points.map((p) => p.x)
  const ys = mask.points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { minX, maxX, minY, maxY }
}

function martinezToPolygons(geometry: number[][][] | number[][][][], baseId: string): Polygon[] {
  const multiPolygon: number[][][][] = Array.isArray(geometry[0][0][0])
    ? (geometry as number[][][][])
    : ([geometry] as number[][][][])

  return multiPolygon.map((poly, index) => {
    const ring = poly[0] ?? []
    const points = ring.map(([x, y]) => ({ x, y }))
    return {
      id: `${baseId}-${index}`,
      points,
    }
  })
}

export function computeVoronoiPolygons(
  segments: LineSegment[],
  mask: MaskPolygon,
  spacing = 20,
): Polygon[] {
  if (!segments.length) return []

  const { points, segmentIds } = buildSampledPoints(segments, spacing)
  if (!points.length) return []

  const bounds = maskBounds(mask)
  const coordinatePairs = points.map((p) => [p.x, p.y] as [number, number])
  const delaunay = Delaunay.from(coordinatePairs)
  const voronoi = delaunay.voronoi([
    bounds.minX,
    bounds.minY,
    bounds.maxX,
    bounds.maxY,
  ])

  const grouped: Record<string, number[][][][]> = {}

  points.forEach((_, index) => {
    const polygon = voronoi.cellPolygon(index)
    if (!polygon) return

    const coords: number[][] = []
    for (let i = 0; i < polygon.length; i += 1) {
      const [x, y] = polygon[i]
      if (Number.isFinite(x) && Number.isFinite(y)) {
        coords.push([x, y])
      }
    }
    if (!coords.length) return

    const poly: number[][][] = [coords]
    const segmentId = segmentIds[index]
    if (!grouped[segmentId]) {
      grouped[segmentId] = [poly]
    } else {
      grouped[segmentId].push(poly)
    }
  })

  const result: Polygon[] = []

  Object.entries(grouped).forEach(([segmentId, geometries]) => {
    let current: number[][][] | number[][][][] | null = null
    geometries.forEach((geometry) => {
      if (!current) {
        current = geometry
      } else {
        current = union(current, geometry)
      }
    })

    if (current) {
      const polys = martinezToPolygons(current as number[][][][], segmentId)
      polys.forEach((polygon) => result.push(polygon))
    }
  })

  return result
}
