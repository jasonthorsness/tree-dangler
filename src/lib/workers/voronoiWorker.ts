/// <reference lib="webworker" />

import { computeVoronoiPolygons } from '../logic/voronoi'
import type { LineSegment, MaskPolygon, Polygon } from '../types'

interface WorkerRequest {
  id: number
  mask: MaskPolygon
  segments: LineSegment[]
  spacing?: number
}

interface WorkerResponse {
  id: number
  polygons?: Polygon[]
  error?: string
}

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope

ctx.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, mask, segments, spacing } = event.data
  try {
    const polygons = computeVoronoiPolygons(segments, mask, spacing)
    ctx.postMessage({ id, polygons } satisfies WorkerResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.postMessage({ id, error: message } satisfies WorkerResponse)
  }
})

export {}
