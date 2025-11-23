import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

export interface PointerEventData {
  x: number
  y: number
  buttons: number
  originalEvent: PointerEvent
}

export interface WheelEventData {
  deltaX: number
  deltaY: number
  deltaMode: number
  originalEvent: WheelEvent
}

export interface CanvasPaneProps {
  width: number
  height: number
  className?: string
  tabIndex?: number
  fitContainer?: boolean
  onDraw?: (ctx: CanvasRenderingContext2D) => void
  onPointerDown?: (event: PointerEventData) => void
  onPointerMove?: (event: PointerEventData) => void
  onPointerUp?: (event: PointerEventData) => void
  onPointerLeave?: (event: PointerEventData) => void
  onWheel?: (event: WheelEventData) => void
  onKeyDown?: (event: KeyboardEvent<HTMLCanvasElement>) => void
}

export function CanvasPane({
  width,
  height,
  className,
  tabIndex,
  fitContainer = false,
  onDraw,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onWheel,
  onKeyDown,
}: CanvasPaneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !onDraw) return

    // Disable DPR scaling to keep canvas pixels 1:1 with CSS pixels.
    const dpr = 1
    const targetWidth = width
    const targetHeight = height

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth
      canvas.height = targetHeight
      if (fitContainer) {
        canvas.style.width = '100%'
        canvas.style.height = '100%'
      } else {
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
      }
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.scale(dpr, dpr)
    onDraw(ctx)
    ctx.restore()
  }, [width, height, onDraw])

  const buildPointerEvent = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): PointerEventData => {
      const rect = event.currentTarget.getBoundingClientRect()
      const scaleX = width / rect.width
      const scaleY = height / rect.height
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
        buttons: event.buttons,
        originalEvent: event.nativeEvent,
      }
    },
    [width, height],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!onPointerDown) return
      event.preventDefault()
      event.currentTarget.focus()
      onPointerDown(buildPointerEvent(event))
    },
    [buildPointerEvent, onPointerDown],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!onPointerMove) return
      event.preventDefault()
      onPointerMove(buildPointerEvent(event))
    },
    [buildPointerEvent, onPointerMove],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!onPointerUp) return
      event.preventDefault()
      onPointerUp(buildPointerEvent(event))
    },
    [buildPointerEvent, onPointerUp],
  )

  const handlePointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!onPointerLeave) return
      event.preventDefault()
      onPointerLeave(buildPointerEvent(event))
    },
    [buildPointerEvent, onPointerLeave],
  )

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
  }, [])

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      if (!onWheel) return
      event.preventDefault()
      onWheel({
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        originalEvent: event.nativeEvent,
      })
    },
    [onWheel],
  )

  const resolvedTabIndex = tabIndex ?? (onKeyDown ? 0 : undefined)

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      tabIndex={resolvedTabIndex}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
      onKeyDown={onKeyDown}
    />
  )
}
