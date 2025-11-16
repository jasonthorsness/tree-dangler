import { useCallback } from 'react'

import { useTreeDanglerState } from '../state/store'
import { CanvasPane } from '../ui/CanvasPane'

export interface DistancePreviewPaneProps {
  width: number
  height: number
  className?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function sampleColor(t: number): [number, number, number] {
  const clamped = clamp(t, 0, 1)
  const intensity = Math.round(clamped * 255)
  return [intensity, intensity, intensity]
}

export function DistancePreviewPane({ width, height, className }: DistancePreviewPaneProps) {
  const {
    state: { distancePreview, distanceField, distanceFieldDimensions, distanceFieldMax },
  } = useTreeDanglerState()

  const drawPane = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)

      if (distancePreview) {
        const previewData = new Uint8ClampedArray(distancePreview.data)
        const previewImage = new ImageData(previewData, distancePreview.width, distancePreview.height)
        if (distancePreview.width === width && distancePreview.height === height) {
          ctx.putImageData(previewImage, 0, 0)
        } else {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = distancePreview.width
          tempCanvas.height = distancePreview.height
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.putImageData(previewImage, 0, 0)
            ctx.drawImage(tempCanvas, 0, 0, width, height)
          }
        }
        return
      }

      if (!distanceField || !distanceFieldDimensions || !distanceFieldMax || distanceFieldMax === 0) {
        return
      }

      const { width: srcWidth, height: srcHeight } = distanceFieldDimensions
      const imageData = ctx.createImageData(srcWidth, srcHeight)
      const maxDistance = distanceFieldMax

      for (let i = 0; i < distanceField.length; i += 1) {
        const value = distanceField[i]
        const intensity = sampleColor(value / maxDistance)
        const offset = i * 4
        imageData.data[offset] = intensity[0]
        imageData.data[offset + 1] = intensity[1]
        imageData.data[offset + 2] = intensity[2]
        imageData.data[offset + 3] = 255
      }

      if (srcWidth === width && srcHeight === height) {
        ctx.putImageData(imageData, 0, 0)
      } else {
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = srcWidth
        tempCanvas.height = srcHeight
        const tempCtx = tempCanvas.getContext('2d')
        if (tempCtx) {
          tempCtx.putImageData(imageData, 0, 0)
          ctx.drawImage(tempCanvas, 0, 0, width, height)
        }
      }
    },
    [distancePreview, distanceField, distanceFieldDimensions, distanceFieldMax, height, width],
  )

  return <CanvasPane width={width} height={height} className={className} onDraw={drawPane} />
}

export default DistancePreviewPane
