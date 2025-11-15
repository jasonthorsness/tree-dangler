export const PX_PER_MM = 5
export const PX_PER_CM = PX_PER_MM * 10

export function drawMetricBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.fillStyle = '#020617'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)'
  ctx.lineWidth = 1

  for (let x = 0; x <= width; x += PX_PER_CM) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  for (let y = 0; y <= height; y += PX_PER_CM) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawMetricRulers(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  const rulerThickness = 28
  ctx.fillStyle = 'rgba(2, 6, 23, 0.82)'
  ctx.fillRect(0, 0, width, rulerThickness)
  ctx.fillRect(0, 0, rulerThickness, height)

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'
  ctx.lineWidth = 1
  ctx.font = '10px "JetBrains Mono", monospace'
  ctx.fillStyle = 'rgba(148, 163, 184, 0.75)'

  for (let x = 0; x <= width; x += PX_PER_MM) {
    const isCm = x % PX_PER_CM === 0
    const tickHeight = isCm ? 14 : 7
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, tickHeight)
    ctx.stroke()

    if (isCm) {
      const cmValue = x / PX_PER_CM
      ctx.fillText(`${cmValue} cm`, x + 4, 20)
    }
  }

  for (let y = 0; y <= height; y += PX_PER_MM) {
    const isCm = y % PX_PER_CM === 0
    const tickWidth = isCm ? 14 : 7
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(tickWidth, y)
    ctx.stroke()

    if (isCm) {
      const cmValue = y / PX_PER_CM
      ctx.save()
      ctx.translate(16, y + 4)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(`${cmValue} cm`, 0, 0)
      ctx.restore()
    }
  }
  ctx.restore()
}

export function drawMetricGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  drawMetricBackground(ctx, width, height)
  drawMetricRulers(ctx, width, height)
}
