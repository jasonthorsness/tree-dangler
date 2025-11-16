import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'

import {
  createDefaultSegmentAtPoint,
  moveEndpoint,
  moveSegment,
  hitTestEndpoint,
  hitTestSegment,
} from '../logic/segments'
import { useTreeDanglerState } from '../state/store'
import { CanvasPane, type PointerEventData } from '../ui/CanvasPane'
import { drawMetricBackground, drawMetricRulers } from '../ui/metricGrid'
import type { LineSegment, Point } from '../types'

export interface SegmentInputPaneProps {
  width: number
  height: number
  className?: string
}

const LABEL_STUB_LENGTH_PX = 10 // 2mm at 5 px per mm

interface DragInfo {
  mode: 'segment' | 'start' | 'end'
  segmentIndex: number
  origin: LineSegment
  pointerStart: Point
}

export function SegmentInputPane({ width, height, className }: SegmentInputPaneProps) {
  const {
    state: { mask, segments },
    dispatch,
  } = useTreeDanglerState()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null)
  const [lastClick, setLastClick] = useState<{ id: string; timestamp: number } | null>(null)
  const [labelEditor, setLabelEditor] = useState<{ id: string; value: string } | null>(null)

  const setSegments = useCallback(
    (next: LineSegment[]) => dispatch({ type: 'SET_SEGMENTS', payload: next }),
    [dispatch],
  )

  const drawPane = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, width, height)
      drawMetricBackground(ctx, width, height)

      if (mask.points.length >= 3) {
        ctx.beginPath()
        ctx.moveTo(mask.points[0].x, mask.points[0].y)
        for (let i = 1; i < mask.points.length; i += 1) {
          ctx.lineTo(mask.points[i].x, mask.points[i].y)
        }
        ctx.closePath()
        ctx.fillStyle = 'rgba(148, 163, 184, 0.08)'
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
        ctx.lineWidth = 2
        ctx.fill()
        ctx.stroke()
      }

      segments.forEach((segment) => {
        const selected = segment.id === selectedId
        const hasText = !!segment.text
        ctx.strokeStyle = selected ? '#fcd34d' : '#94a3b8'
        ctx.lineWidth = selected ? 4 : 2
        ctx.beginPath()
        if (!hasText) {
          ctx.moveTo(segment.start.x, segment.start.y)
          ctx.lineTo(segment.end.x, segment.end.y)
        } else {
          const dx = segment.end.x - segment.start.x
          const dy = segment.end.y - segment.start.y
          const len = Math.hypot(dx, dy)
          const stub = Math.min(LABEL_STUB_LENGTH_PX, len / 2)
          if (len > 0 && stub > 0) {
            const ux = dx / len
            const uy = dy / len
            ctx.moveTo(segment.start.x, segment.start.y)
            ctx.lineTo(segment.start.x + ux * stub, segment.start.y + uy * stub)
            ctx.moveTo(segment.end.x, segment.end.y)
            ctx.lineTo(segment.end.x - ux * stub, segment.end.y - uy * stub)
          }
        }
        ctx.stroke()

        ctx.fillStyle = selected ? '#0f172a' : '#1e293b'
        ctx.strokeStyle = selected ? '#fcd34d' : '#94a3b8'
        ctx.lineWidth = selected ? 3 : 1.5
        ;[segment.start, segment.end].forEach((point) => {
          ctx.beginPath()
          ctx.arc(point.x, point.y, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        })

        if (segment.text) {
          const midX = (segment.start.x + segment.end.x) / 2
          const midY = (segment.start.y + segment.end.y) / 2
          const angle = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x)
          const textPadding = 6

          // Draw the line in two halves, leaving a gap behind the label.
          const halfWidth = ctx.measureText(segment.text).width / 2 + textPadding
          const dx = Math.cos(angle)
          const dy = Math.sin(angle)
          const gapStartX = midX - dx * halfWidth
          const gapStartY = midY - dy * halfWidth
          const gapEndX = midX + dx * halfWidth
          const gapEndY = midY + dy * halfWidth

          ctx.strokeStyle = selected ? '#fcd34d' : '#94a3b8'
          ctx.lineWidth = selected ? 4 : 2
          ctx.beginPath()
          ctx.moveTo(segment.start.x, segment.start.y)
          ctx.lineTo(gapStartX, gapStartY)
          ctx.moveTo(gapEndX, gapEndY)
          ctx.lineTo(segment.end.x, segment.end.y)
          ctx.stroke()

          ctx.save()
          ctx.translate(midX, midY)
          ctx.rotate(angle)
          ctx.font = '12px "JetBrains Mono", monospace'
          ctx.fillStyle = selected ? '#fcd34d' : '#cbd5f5'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(segment.text, 0, 0)
          ctx.restore()
        }
      })

      drawMetricRulers(ctx, width, height)
    },
    [mask.points, segments, selectedId, height, width],
  )

  const handlePointerDown = useCallback(
    (event: PointerEventData) => {
      const point = { x: event.x, y: event.y }
      const endpointHit = hitTestEndpoint(segments, point)
      if (endpointHit) {
        const segment = segments[endpointHit.segmentIndex]
        setSelectedId(segment.id)
        setLabelEditor(null)
        setDragInfo({
          mode: endpointHit.endpoint,
          segmentIndex: endpointHit.segmentIndex,
          origin: segment,
          pointerStart: point,
        })
        return
      }

      const segmentIndex = hitTestSegment(segments, point)
      if (segmentIndex !== -1) {
        const segment = segments[segmentIndex]
        const now = Date.now()
        if (selectedId === segment.id && lastClick && lastClick.id === segment.id && now - lastClick.timestamp < 350) {
          setLabelEditor({ id: segment.id, value: segment.text ?? '' })
          setDragInfo(null)
          setLastClick(null)
          return
        }
        setLastClick({ id: segment.id, timestamp: now })
        setSelectedId(segment.id)
        setLabelEditor(null)
        setDragInfo({
          mode: 'segment',
          segmentIndex,
          origin: segment,
          pointerStart: point,
        })
        return
      }

      setDragInfo(null)
      const newSegment = createDefaultSegmentAtPoint(mask, point)
      if (newSegment) {
        setSegments([...segments, newSegment])
        setSelectedId(newSegment.id)
        setLabelEditor(null)
        setLastClick(null)
        return
      }

      setSelectedId(null)
      setLabelEditor(null)
    },
    [lastClick, mask, segments, selectedId, setSegments],
  )

  const handlePointerMove = useCallback(
    (event: PointerEventData) => {
      if (!dragInfo) return
      const pointer = { x: event.x, y: event.y }
      const { mode, segmentIndex, origin, pointerStart } = dragInfo

      if (mode === 'segment') {
        const delta = { x: pointer.x - pointerStart.x, y: pointer.y - pointerStart.y }
        const updated = moveSegment(origin, delta, mask)
        if (updated) {
          const next = segments.slice()
          next[segmentIndex] = updated
          setSegments(next)
        }
        return
      }

      const updated = moveEndpoint(origin, mode === 'start' ? 'start' : 'end', pointer, mask)
      if (updated) {
        const next = segments.slice()
        next[segmentIndex] = updated
        setSegments(next)
      }
    },
    [dragInfo, mask, segments, setSegments],
  )

  const handlePointerUp = useCallback(() => {
    setDragInfo(null)
  }, [])

  const handlePointerLeave = useCallback(() => {
    setDragInfo(null)
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLCanvasElement>) => {
      if (!selectedId) return
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      event.preventDefault()
      const filtered = segments.filter((segment) => segment.id !== selectedId)
      if (filtered.length === segments.length) return
      setSegments(filtered)
      setSelectedId(null)
      setLabelEditor((prev) => (prev?.id === selectedId ? null : prev))
    },
    [selectedId, segments, setSegments],
  )

  const editorPosition = useMemo(() => {
    if (!labelEditor) return null
    const index = segments.findIndex((segment) => segment.id === labelEditor.id)
    if (index === -1) return null
    const segment = segments[index]
    return {
      x: (segment.start.x + segment.end.x) / 2,
      y: (segment.start.y + segment.end.y) / 2,
    }
  }, [labelEditor, segments])

  const handleLabelCommit = useCallback(() => {
    if (!labelEditor) return
    const index = segments.findIndex((segment) => segment.id === labelEditor.id)
    if (index === -1) {
      setLabelEditor(null)
      return
    }
    const next = segments.slice()
    next[index] = { ...next[index], text: labelEditor.value }
    setSegments(next)
    setLabelEditor(null)
  }, [labelEditor, segments, setSegments])

  return (
    <div className="relative">
      <CanvasPane
        width={width}
        height={height}
        className={className}
        onDraw={drawPane}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
      />
      {labelEditor && editorPosition ? (
        <input
          autoFocus
          className="absolute rounded border border-slate-500 bg-slate-900/95 px-2 py-1 text-xs text-slate-100 shadow-lg"
          style={{
            top: editorPosition.y - 12,
            left: editorPosition.x - 60,
            width: 120,
          }}
          value={labelEditor.value}
          onChange={(event) => setLabelEditor({ ...labelEditor, value: event.target.value })}
          onBlur={handleLabelCommit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleLabelCommit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setLabelEditor(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}

export default SegmentInputPane
