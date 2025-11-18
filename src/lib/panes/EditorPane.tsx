import { useCallback, useMemo, useState, type KeyboardEvent } from "react";

import { useTreeDanglerState } from "../state/store";
import { CanvasPane, type PointerEventData } from "../ui/CanvasPane";
import { drawMetricRulers } from "../ui/metricGrid";
import {
  hitTestMaskPoint,
  hitTestMaskSegment,
  insertPointIntoSegment,
  deleteMaskPoint,
} from "../logic/mask";
import {
  createDefaultSegmentAtPoint,
  hitTestEndpoint,
  hitTestSegment,
  moveEndpoint,
  moveSegment,
} from "../logic/segments";
import {
  createConnectorAtPoint,
  hitTestConnectorEndpoint,
  hitTestConnectorSegment,
  moveConnector,
  moveConnectorEndpoint,
  mmToPx,
} from "../logic/connectors";
import type { LineSegment, Point } from "../types";

interface DragInfo {
  kind: "mask" | "segment" | "connector";
  segmentIndex?: number;
  endpoint?: "start" | "end";
  maskIndex?: number;
  origin?: LineSegment;
  startPointer?: Point;
}

export interface EditorPaneProps {
  width: number;
  height: number;
  className?: string;
}

const ENDPOINT_RADIUS = 7.5;
const CONNECTOR_ENDPOINT_RADIUS = 6;

export function EditorPane({ width, height, className }: EditorPaneProps) {
  const {
    state: { mask, segments, connectors, piecePolygons, connectorLength },
    dispatch,
  } = useTreeDanglerState();

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null
  );
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    null
  );
  const [maskSelection, setMaskSelection] = useState<number | null>(null);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [labelEditor, setLabelEditor] = useState<{
    id: string;
    value: string;
  } | null>(null);
  const [lastClick, setLastClick] = useState<{
    id: string;
    timestamp: number;
  } | null>(null);
  const [labelAnchor, setLabelAnchor] = useState<{
    u: number;
    v: number;
  } | null>(null);

  const pxLength = mmToPx(connectorLength);

  const setSegments = useCallback(
    (next: LineSegment[]) => dispatch({ type: "SET_SEGMENTS", payload: next }),
    [dispatch]
  );
  const setConnectors = useCallback(
    (next: LineSegment[]) =>
      dispatch({ type: "SET_CONNECTORS", payload: next }),
    [dispatch]
  );

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

      // Mask handles
      if (mask.points.length) {
        ctx.beginPath();
        ctx.moveTo(mask.points[0].x, mask.points[0].y);
        for (let i = 1; i < mask.points.length; i += 1) {
          ctx.lineTo(mask.points[i].x, mask.points[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = "rgba(16, 185, 129, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        mask.points.forEach((point, index) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
          if (index === maskSelection) {
            ctx.fillStyle = "#f0fdf4";
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2;
          } else {
            ctx.fillStyle = "#0f172a";
            ctx.strokeStyle = "rgba(15, 118, 110, 0.9)";
            ctx.lineWidth = 1.5;
          }
          ctx.fill();
          ctx.stroke();
        });
      }

      // Segments
      segments.forEach((segment) => {
        const selected = segment.id === selectedSegmentId;
        const hasText = !!segment.text;
        ctx.strokeStyle = selected ? "#fcd34d" : "#94a3b8";
        ctx.lineWidth = selected ? 4 : 2;
        ctx.beginPath();
        if (!hasText) {
          ctx.moveTo(segment.start.x, segment.start.y);
          ctx.lineTo(segment.end.x, segment.end.y);
        } else {
          const dx = segment.end.x - segment.start.x;
          const dy = segment.end.y - segment.start.y;
          const len = Math.hypot(dx, dy);
          const stub = Math.min(20, len / 2);
          if (len > 0 && stub > 0) {
            const ux = dx / len;
            const uy = dy / len;
            ctx.moveTo(segment.start.x, segment.start.y);
            ctx.lineTo(
              segment.start.x + ux * stub,
              segment.start.y + uy * stub
            );
            ctx.moveTo(segment.end.x, segment.end.y);
            ctx.lineTo(segment.end.x - ux * stub, segment.end.y - uy * stub);
          }
        }
        ctx.stroke();

        // Draw equilateral triangles at endpoints pointing toward the segment midline.
        const angle = Math.atan2(
          segment.end.y - segment.start.y,
          segment.end.x - segment.start.x
        );
        const drawTriangle = (point: Point, pointTowardMid: boolean) => {
          const size = ENDPOINT_RADIUS * 1.2;
          const baseAngle = pointTowardMid ? angle + Math.PI : angle; // flip for far end
          const a1 = baseAngle + (2 * Math.PI) / 3;
          const a2 = baseAngle - (2 * Math.PI) / 3;
          const p1 = {
            x: point.x + Math.cos(baseAngle) * size,
            y: point.y + Math.sin(baseAngle) * size,
          };
          const p2 = {
            x: point.x + Math.cos(a1) * size,
            y: point.y + Math.sin(a1) * size,
          };
          const p3 = {
            x: point.x + Math.cos(a2) * size,
            y: point.y + Math.sin(a2) * size,
          };
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fillStyle = selected ? "#0f172a" : "#1e293b";
          ctx.strokeStyle = selected ? "#fcd34d" : "#94a3b8";
          ctx.lineWidth = selected ? 3 : 1.5;
          ctx.fill();
          ctx.stroke();
        };
        // Start points toward end; end points back toward start (flipped).
        drawTriangle(segment.start, false);
        drawTriangle(segment.end, true);

        if (segment.text) {
          const midX = (segment.start.x + segment.end.x) / 2;
          const midY = (segment.start.y + segment.end.y) / 2;
          const angle = Math.atan2(
            segment.end.y - segment.start.y,
            segment.end.x - segment.start.x
          );
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(angle);
          ctx.font = '14px "JetBrains Mono", monospace';
          ctx.fillStyle = selected ? "#fcd34d" : "#cbd5f5";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(segment.text, 0, 0);
          ctx.restore();
        }
      });

      // Connectors
      connectors.forEach((segment) => {
        const selected = segment.id === selectedConnectorId;
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
          ctx.arc(point.x, point.y, CONNECTOR_ENDPOINT_RADIUS, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      });

      drawMetricRulers(ctx, width, height);
    },
    [
      connectors,
      mask.points,
      maskSelection,
      piecePolygons,
      segments,
      selectedConnectorId,
      selectedSegmentId,
      height,
      width,
    ]
  );

  const handlePointerDown = useCallback(
    (event: PointerEventData) => {
      const point = { x: event.x, y: event.y };
      const isRightClick = event.buttons === 2;

      // Mask point?
      const maskIdx = hitTestMaskPoint(mask, point, 12);
      if (maskIdx !== -1) {
        setMaskSelection(maskIdx);
        setDragInfo({ kind: "mask", maskIndex: maskIdx });
        setSelectedSegmentId(null);
        setSelectedConnectorId(null);
        setLabelEditor(null);
        return;
      }
      // Mask edge insert
      const maskSegIdx = hitTestMaskSegment(mask, point, 10);
      if (maskSegIdx !== -1) {
        const updated = insertPointIntoSegment(mask, maskSegIdx, point);
        dispatch({ type: "SET_MASK", payload: updated });
        setMaskSelection(maskSegIdx + 1);
        setDragInfo({ kind: "mask", maskIndex: maskSegIdx + 1 });
        setSelectedSegmentId(null);
        setSelectedConnectorId(null);
        setLabelEditor(null);
        return;
      }

      // Clear mask selection if clicking elsewhere.
      setMaskSelection(null);

      // Segment endpoints
      const endpointHit = hitTestEndpoint(segments, point);
      if (endpointHit) {
        const segment = segments[endpointHit.segmentIndex];
        setSelectedSegmentId(segment.id);
        setSelectedConnectorId(null);
        setMaskSelection(null);
        setLabelEditor(null);
        setDragInfo({
          kind: "segment",
          segmentIndex: endpointHit.segmentIndex,
          endpoint: endpointHit.endpoint,
          origin: segment,
        });
        return;
      }

      // Connector endpoints
      const connectorEndpoint = hitTestConnectorEndpoint(connectors, point);
      if (connectorEndpoint) {
        const connector = connectors[connectorEndpoint.segmentIndex];
        setSelectedConnectorId(connector.id);
        setSelectedSegmentId(null);
        setMaskSelection(null);
        setLabelEditor(null);
        setDragInfo({
          kind: "connector",
          segmentIndex: connectorEndpoint.segmentIndex,
          endpoint: connectorEndpoint.endpoint,
          origin: connector,
          startPointer: point,
        });
        return;
      }

      // Segment body (for move / label)
      const segmentIndex = hitTestSegment(segments, point);
      if (segmentIndex !== -1) {
        const segment = segments[segmentIndex];
        setSelectedSegmentId(segment.id);
        setSelectedConnectorId(null);
        setMaskSelection(null);
        const now = Date.now();
        if (
          lastClick &&
          lastClick.id === segment.id &&
          now - lastClick.timestamp < 350
        ) {
          setLabelEditor({ id: segment.id, value: segment.text ?? "" });
          setLabelAnchor({ u: point.x / width, v: point.y / height });
          setLastClick(null);
        } else {
          setLastClick({ id: segment.id, timestamp: now });
        }
        setDragInfo({
          kind: "segment",
          segmentIndex,
          origin: segment,
          startPointer: point,
        });
        return;
      }

      // Connector body
      const connectorIndex = hitTestConnectorSegment(connectors, point);
      if (connectorIndex !== -1) {
        const connector = connectors[connectorIndex];
        setSelectedConnectorId(connector.id);
        setSelectedSegmentId(null);
        setMaskSelection(null);
        setLabelEditor(null);
        setDragInfo({
          kind: "connector",
          segmentIndex: connectorIndex,
          origin: connector,
          startPointer: point,
        });
        return;
      }

      // Create new on click: left => segment, right => connector
      if (isRightClick) {
        const conn = createConnectorAtPoint(mask, point, pxLength);
        if (conn) {
          setConnectors([...connectors, conn]);
          setSelectedConnectorId(conn.id);
          setMaskSelection(null);
          setSelectedSegmentId(null);
          setLabelEditor(null);
        }
      } else {
        const seg = createDefaultSegmentAtPoint(mask, point);
        if (seg) {
          setSegments([...segments, seg]);
          setSelectedSegmentId(seg.id);
          setMaskSelection(null);
          setSelectedConnectorId(null);
          setLabelEditor(null);
        }
      }
    },
    [
      lastClick,
      connectors,
      dispatch,
      mask,
      pxLength,
      segments,
      setConnectors,
      setSegments,
    ]
  );

  const handlePointerMove = useCallback(
    (event: PointerEventData) => {
      if (!dragInfo) return;
      const pointer = { x: event.x, y: event.y };
      if (dragInfo.kind === "mask" && dragInfo.maskIndex !== undefined) {
        const idx = dragInfo.maskIndex;
        const nextPoints = mask.points.map((pt, i) =>
          i === idx ? pointer : pt
        );
        dispatch({
          type: "SET_MASK",
          payload: { ...mask, points: nextPoints },
        });
        return;
      }

      if (
        dragInfo.kind === "segment" &&
        dragInfo.segmentIndex !== undefined &&
        dragInfo.origin
      ) {
        if (dragInfo.endpoint) {
          const updated = moveEndpoint(
            dragInfo.origin,
            dragInfo.endpoint,
            pointer,
            mask
          );
          if (updated) {
            const next = segments.slice();
            next[dragInfo.segmentIndex] = updated;
            setSegments(next);
          }
          return;
        }
        if (dragInfo.startPointer) {
          const delta = {
            x: pointer.x - dragInfo.startPointer.x,
            y: pointer.y - dragInfo.startPointer.y,
          };
          const moved = moveSegment(dragInfo.origin, delta, mask);
          if (moved) {
            const next = segments.slice();
            next[dragInfo.segmentIndex] = moved;
            setSegments(next);
          }
        }
        return;
      }

      if (
        dragInfo.kind === "connector" &&
        dragInfo.segmentIndex !== undefined &&
        dragInfo.origin
      ) {
        if (dragInfo.endpoint) {
          const updated = moveConnectorEndpoint(
            dragInfo.origin,
            dragInfo.endpoint,
            pointer,
            mask,
            pxLength
          );
          if (updated) {
            const next = connectors.slice();
            next[dragInfo.segmentIndex] = updated;
            setConnectors(next);
          }
          return;
        }
        if (dragInfo.startPointer) {
          const delta = {
            x: pointer.x - dragInfo.startPointer.x,
            y: pointer.y - dragInfo.startPointer.y,
          };
          const moved = moveConnector(dragInfo.origin, delta, mask);
          if (moved) {
            const next = connectors.slice();
            next[dragInfo.segmentIndex] = moved;
            setConnectors(next);
          }
        }
      }
    },
    [
      connectors,
      dragInfo,
      dispatch,
      mask,
      pxLength,
      segments,
      setConnectors,
      setSegments,
    ]
  );

  const clearDrag = useCallback(() => setDragInfo(null), []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLCanvasElement>) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (maskSelection !== null) {
        event.preventDefault();
        const updated = deleteMaskPoint(mask, maskSelection);
        if (updated !== mask) {
          dispatch({ type: "SET_MASK", payload: updated });
          setMaskSelection((prev) =>
            prev === null ? null : Math.min(prev, updated.points.length - 1)
          );
        }
        return;
      }
      if (selectedSegmentId) {
        event.preventDefault();
        const filtered = segments.filter((s) => s.id !== selectedSegmentId);
        setSegments(filtered);
        setSelectedSegmentId(null);
        setLabelEditor((prev) =>
          prev?.id === selectedSegmentId ? null : prev
        );
        return;
      }
      if (selectedConnectorId) {
        event.preventDefault();
        const filtered = connectors.filter((c) => c.id !== selectedConnectorId);
        setConnectors(filtered);
        setSelectedConnectorId(null);
      }
    },
    [
      connectors,
      dispatch,
      mask,
      maskSelection,
      selectedConnectorId,
      selectedSegmentId,
      segments,
      setConnectors,
      setSegments,
    ]
  );

  const editorPosition = useMemo(() => {
    if (!labelEditor) return null;
    const index = segments.findIndex(
      (segment) => segment.id === labelEditor.id
    );
    if (labelAnchor) {
      return {
        x: labelAnchor.u * width,
        y: labelAnchor.v * height,
      };
    }
    if (index === -1) return null;
    const segment = segments[index];
    return {
      x: (segment.start.x + segment.end.x) / 2,
      y: (segment.start.y + segment.end.y) / 2,
    };
  }, [labelAnchor, labelEditor, segments, width, height]);

  const handleLabelCommit = useCallback(() => {
    if (!labelEditor) return;
    const index = segments.findIndex(
      (segment) => segment.id === labelEditor.id
    );
    if (index === -1) {
      setLabelEditor(null);
      return;
    }
    const next = segments.slice();
    next[index] = { ...next[index], text: labelEditor.value };
    setSegments(next);
    setLabelEditor(null);
    setLabelAnchor(null);
  }, [labelEditor, segments, setSegments]);

  return (
    <div className="relative">
      <CanvasPane
        width={width}
        height={height}
        className={className}
        fitContainer
        onDraw={drawPane}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearDrag}
        onPointerLeave={clearDrag}
        onKeyDown={handleKeyDown}
      />
      {labelEditor && editorPosition ? (
        <input
          autoFocus
          className="absolute rounded border border-slate-500 bg-slate-900/95 px-2 py-1 text-sm text-slate-100 shadow-lg"
          style={{
            top: `${(editorPosition.y / height) * 100}%`,
            left: `${(editorPosition.x / width) * 100}%`,
            width: 120,
            transform: "translate(calc(-50% + 10px), calc(-120% + 20px))",
          }}
          value={labelEditor.value}
          onChange={(event) =>
            setLabelEditor({ ...labelEditor, value: event.target.value })
          }
          onBlur={() => {
            handleLabelCommit();
            setLabelAnchor(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleLabelCommit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setLabelEditor(null);
              setLabelAnchor(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

export default EditorPane;
