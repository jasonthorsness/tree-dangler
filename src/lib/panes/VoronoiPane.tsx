import { useCallback } from 'react'

import type { Polygon } from '../types'
import { useTreeDanglerState } from '../state/store'
import { CanvasPane } from '../ui/CanvasPane'
import { drawMetricBackground, drawMetricRulers } from '../ui/metricGrid'

export interface VoronoiPaneProps {
  width: number
  height: number
  className?: string
}

const palette = ['#38bdf8', '#34d399', '#f472b6', '#facc15', '#c084fc']

function drawPolygons(ctx: CanvasRenderingContext2D, polygons: Polygon[]) {
  polygons.forEach((polygon, index) => {
    if (!polygon.points.length) return
    ctx.beginPath()
    ctx.moveTo(polygon.points[0].x, polygon.points[0].y)
    for (let i = 1; i < polygon.points.length; i += 1) {
      ctx.lineTo(polygon.points[i].x, polygon.points[i].y)
    }
    ctx.closePath()

    const fill = palette[index % palette.length]
    ctx.fillStyle = `${fill}30`
    ctx.strokeStyle = fill
    ctx.lineWidth = 2
    ctx.fill()
    ctx.stroke()
  })
}

export function VoronoiPane({ width, height, className }: VoronoiPaneProps) {
  const {
    state: { mask, voronoiPolygons },
  } = useTreeDanglerState()

  const drawPane = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      drawMetricBackground(ctx, width, height)

      if (mask.points.length >= 3) {
        ctx.beginPath()
        ctx.moveTo(mask.points[0].x, mask.points[0].y)
        for (let i = 1; i < mask.points.length; i += 1) {
          ctx.lineTo(mask.points[i].x, mask.points[i].y)
        }
        ctx.closePath()
        ctx.fillStyle = 'rgba(14, 165, 233, 0.08)'
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.4)'
        ctx.lineWidth = 2
        ctx.fill()
        ctx.stroke()
      }

      drawPolygons(ctx, voronoiPolygons)
      drawMetricRulers(ctx, width, height)
    },
    [mask.points, voronoiPolygons, height, width],
  )

  return <CanvasPane width={width} height={height} className={className} onDraw={drawPane} />
}

export default VoronoiPane
