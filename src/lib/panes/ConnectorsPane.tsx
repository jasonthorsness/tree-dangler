import { useCallback, useState } from "react";
import type { KeyboardEvent } from "react";

import type { LineSegment, Point } from "../types";
import { useTreeDanglerState } from "../state/store";
import { CanvasPane, type PointerEventData } from "../ui/CanvasPane";
import {
  createConnectorAtPoint,
  hitTestConnectorEndpoint,
  hitTestConnectorSegment,
  moveConnector,
  moveConnectorEndpoint,
  mmToPx,
} from "../logic/connectors";

const ENDPOINT_RADIUS = 8;

interface DragInfo {
  mode: "segment" | "start" | "end";
  segmentIndex: number;
  origin: LineSegment;
  startPointer: Point;
}

interface ConnectorsPaneProps {
  width: number;
  height: number;
  className?: string;
}

export function ConnectorsPane({ width, height, className }: ConnectorsPaneProps) {
  const {
    state: { mask, connectors, connectorLength, piecePolygons },
    dispatch,
  } = useTreeDanglerState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);

  const updateConnectors = useCallback(
    (next: LineSegment[]) => dispatch({ type: "SET_CONNECTORS", payload: next }),
    [dispatch]
  );

  const pxLength = mmToPx(connectorLength);

  const drawPane = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      if (piecePolygons.length) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.05)";
        ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
        ctx.lineWidth = 1.5;
        piecePolygons.forEach((poly) => {
          if (poly.points.length < 3) return;
          ctx.beginPath();
          ctx.moveTo(poly.points[0].x, poly.points[0].y);
          for (let i = 1; i < poly.points.length; i += 1) {
            ctx.lineTo(poly.points[i].x, poly.points[i].y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      } else if (mask.points.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(mask.points[0].x, mask.points[0].y);
        for (let i = 1; i < mask.points.length; i += 1) {
          ctx.lineTo(mask.points[i].x, mask.points[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      }

      connectors.forEach((segment) => {
        const selected = segment.id === selectedId;
        ctx.strokeStyle = selected ? "#f97316" : "#e2e8f0";
        ctx.lineWidth = selected ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(segment.start.x, segment.start.y);
        ctx.lineTo(segment.end.x, segment.end.y);
        ctx.stroke();

        ctx.fillStyle = selected ? "#0f172a" : "#1e293b";
        ctx.strokeStyle = selected ? "#f97316" : "#94a3b8";
        [segment.start, segment.end].forEach((point) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, ENDPOINT_RADIUS, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      });
    },
    [connectors, mask.points, piecePolygons, selectedId, height, width]
  );

  const handlePointerDown = useCallback(
    (event: PointerEventData) => {
      const point = { x: event.x, y: event.y };
      const endpointHit = hitTestConnectorEndpoint(connectors, point);
      if (endpointHit) {
        const segment = connectors[endpointHit.segmentIndex];
        setSelectedId(segment.id);
        setDragInfo({
          mode: endpointHit.endpoint,
          segmentIndex: endpointHit.segmentIndex,
          origin: segment,
          startPointer: point,
        });
        return;
      }

      const segmentIndex = hitTestConnectorSegment(connectors, point);
      if (segmentIndex !== -1) {
        const segment = connectors[segmentIndex];
        setSelectedId(segment.id);
        setDragInfo({
          mode: "segment",
          segmentIndex,
          origin: segment,
          startPointer: point,
        });
        return;
      }

      const newConnector = createConnectorAtPoint(mask, point, pxLength);
      if (newConnector) {
        updateConnectors([...connectors, newConnector]);
        setSelectedId(newConnector.id);
      } else {
        setSelectedId(null);
      }
    },
    [connectors, mask, pxLength, updateConnectors]
  );

  const handlePointerMove = useCallback(
    (event: PointerEventData) => {
      if (!dragInfo) return;
      const pointer = { x: event.x, y: event.y };
      const { mode, segmentIndex, origin, startPointer } = dragInfo;

      if (mode === "segment") {
        const delta = { x: pointer.x - startPointer.x, y: pointer.y - startPointer.y };
        const moved = moveConnector(origin, delta, mask);
        if (moved) {
          const next = connectors.slice();
          next[segmentIndex] = moved;
          updateConnectors(next);
        }
        return;
      }

      const updated = moveConnectorEndpoint(origin, mode, pointer, mask, pxLength);
      if (updated) {
        const next = connectors.slice();
        next[segmentIndex] = updated;
        updateConnectors(next);
      }
    },
    [connectors, dragInfo, mask, pxLength, updateConnectors]
  );

  const handlePointerUp = useCallback(() => {
    setDragInfo(null);
  }, []);

  const handlePointerLeave = useCallback(() => setDragInfo(null), []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLCanvasElement>) => {
      if (!selectedId) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      const filtered = connectors.filter((c) => c.id !== selectedId);
      updateConnectors(filtered);
      setSelectedId(null);
    },
    [connectors, selectedId, updateConnectors]
  );

  return (
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
  );
}

export default ConnectorsPane;
