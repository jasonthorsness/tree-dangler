import { useCallback } from "react";

import { useTreeDanglerState } from "../state/store";
import { CanvasPane } from "../ui/CanvasPane";

function colorFromId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

interface TracedPolygonsPaneProps {
  width: number;
  height: number;
  className?: string;
}

export function TracedPolygonsPane({
  width,
  height,
  className,
}: TracedPolygonsPaneProps) {
  const {
    state: { piecePolygons },
  } = useTreeDanglerState();

  const drawPane = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      piecePolygons.forEach((polygon) => {
        if (polygon.points.length < 3) {
          return;
        }
        ctx.beginPath();
        ctx.moveTo(polygon.points[0].x, polygon.points[0].y);
        for (let i = 1; i < polygon.points.length; i += 1) {
          ctx.lineTo(polygon.points[i].x, polygon.points[i].y);
        }
        ctx.closePath();
        const color = colorFromId(polygon.id);
        ctx.fillStyle = color;
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
      });
    },
    [height, piecePolygons, width]
  );

  return (
    <CanvasPane
      width={width}
      height={height}
      className={className}
      onDraw={drawPane}
    />
  );
}

export default TracedPolygonsPane;
