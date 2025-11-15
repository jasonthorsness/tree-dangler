import { useCallback, useState, type KeyboardEvent } from 'react'

import type { Point } from '../types'
import {
  deleteMaskPoint,
  hitTestMaskPoint,
  hitTestMaskSegment,
  insertPointIntoSegment,
} from '../logic/mask'
import { useTreeDanglerState } from '../state/store'
import { CanvasPane, type PointerEventData } from '../ui/CanvasPane'

const POINT_HIT_RADIUS = 12
const SEGMENT_TOLERANCE = 10
const POINT_DRAW_RADIUS = 6

export interface MaskPaneProps {
  width: number
  height: number
  className?: string
}

export function MaskPane({ width, height, className }: MaskPaneProps) {
  const {
    state: { mask },
    dispatch,
  } = useTreeDanglerState()
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [draggingPoint, setDraggingPoint] = useState<number | null>(null)

  const updatePoint = useCallback(
    (index: number, position: Point) => {
      const { points } = mask
      if (index < 0 || index >= points.length) return
      const nextPoints = points.map((pt, idx) =>
        idx === index ? { x: position.x, y: position.y } : pt,
      )
      if (
        nextPoints[index].x === points[index].x &&
        nextPoints[index].y === points[index].y
      ) {
        return
      }
      dispatch({
        type: 'SET_MASK',
        payload: {
          ...mask,
          points: nextPoints,
        },
      })
    },
    [dispatch, mask],
  )

  const drawMask = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!mask.points.length) return

      ctx.clearRect(0, 0, width, height)

      // Background grid
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, width, height)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
      ctx.lineWidth = 1
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Mask polygon fill
      ctx.beginPath()
      ctx.moveTo(mask.points[0].x, mask.points[0].y)
      for (let i = 1; i < mask.points.length; i += 1) {
        ctx.lineTo(mask.points[i].x, mask.points[i].y)
      }
      ctx.closePath()

      ctx.fillStyle = 'rgba(16, 185, 129, 0.18)'
      ctx.fill()

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // Points
      mask.points.forEach((point, index) => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, POINT_DRAW_RADIUS, 0, Math.PI * 2)
        if (index === selectedPoint) {
          ctx.fillStyle = '#f0fdf4'
          ctx.strokeStyle = '#10b981'
          ctx.lineWidth = 2
        } else {
          ctx.fillStyle = '#0f172a'
          ctx.strokeStyle = 'rgba(15, 118, 110, 0.9)'
          ctx.lineWidth = 1.5
        }
        ctx.fill()
        ctx.stroke()
      })
    },
    [mask.points, height, width, selectedPoint],
  )

  const handlePointer = useCallback(
    (event: PointerEventData) => {
      const clickPoint: Point = { x: event.x, y: event.y }
      const pointIndex = hitTestMaskPoint(mask, clickPoint, POINT_HIT_RADIUS)
      if (pointIndex !== -1) {
        setSelectedPoint(pointIndex)
        setDraggingPoint(pointIndex)
        updatePoint(pointIndex, clickPoint)
        return
      }

      const segmentIndex = hitTestMaskSegment(mask, clickPoint, SEGMENT_TOLERANCE)
      if (segmentIndex !== -1) {
        const updatedMask = insertPointIntoSegment(mask, segmentIndex, clickPoint)
        dispatch({ type: 'SET_MASK', payload: updatedMask })
        setSelectedPoint(segmentIndex + 1)
        setDraggingPoint(segmentIndex + 1)
        return
      }

      setSelectedPoint(null)
      setDraggingPoint(null)
    },
    [dispatch, mask, updatePoint],
  )

  const handlePointerMove = useCallback(
    (event: PointerEventData) => {
      if (draggingPoint === null) return
      updatePoint(draggingPoint, { x: event.x, y: event.y })
    },
    [draggingPoint, updatePoint],
  )

  const handlePointerUp = useCallback(() => {
    setDraggingPoint(null)
  }, [])

  const handlePointerLeave = useCallback(() => {
    setDraggingPoint(null)
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLCanvasElement>) => {
      if (selectedPoint === null) return
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      event.preventDefault()

      const updatedMask = deleteMaskPoint(mask, selectedPoint)
      if (updatedMask === mask) return
      dispatch({ type: 'SET_MASK', payload: updatedMask })
      setSelectedPoint((prev) => {
        if (prev === null) return null
        return Math.min(prev, updatedMask.points.length - 1)
      })
      setDraggingPoint(null)
    },
    [dispatch, mask, selectedPoint],
  )

  return (
    <CanvasPane
      width={width}
      height={height}
      className={className}
      onDraw={drawMask}
      onPointerDown={handlePointer}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    />
  )
}

export default MaskPane
