import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

export const EXTERNAL_UNDO_EVENT = "tree-dangler-push-undo";

import { useTreeDanglerState } from "../state/store";
import {
  CanvasPane,
  type PointerEventData,
  type WheelEventData,
} from "../ui/CanvasPane";
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
import type {
  LineSegment,
  MaskPolygon,
  Point,
  TreeDanglerState,
} from "../types";

interface DragInfo {
  kind: "mask" | "segment" | "connector" | "pan-all";
  segmentIndex?: number;
  endpoint?: "start" | "end";
  maskIndex?: number;
  origin?: LineSegment;
  startPointer?: Point;
  snapshot?: {
    maskPoints: Point[];
    segments: LineSegment[];
    connectors: LineSegment[];
  };
}

export interface EditorPaneProps {
  width: number;
  height: number;
  className?: string;
}

const ENDPOINT_RADIUS = 7.5;
const CONNECTOR_ENDPOINT_RADIUS = 6;
type EditorSnapshot = {
  mask: MaskPolygon;
  segments: LineSegment[];
  connectors: LineSegment[];
  gap: number;
  round: number;
  noiseAmplitude: number;
  noiseSeed: number;
  connectorLength: number;
  holeDiameter: number;
};

function rotateConnectorNinetyDegrees(segment: LineSegment): LineSegment {
  const midX = (segment.start.x + segment.end.x) / 2;
  const midY = (segment.start.y + segment.end.y) / 2;
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const rotatedDx = -dy;
  const rotatedDy = dx;
  return {
    ...segment,
    start: { x: midX - rotatedDx / 2, y: midY - rotatedDy / 2 },
    end: { x: midX + rotatedDx / 2, y: midY + rotatedDy / 2 },
  };
}

export function EditorPane({ width, height, className }: EditorPaneProps) {
  const {
    state: {
      mask,
      segments,
      connectors,
      piecePolygons,
      connectorLength,
      holeDiameter,
      gap,
      round,
      noiseAmplitude,
      noiseSeed,
    },
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [lastClick, setLastClick] = useState<{
    id: string;
    timestamp: number;
  } | null>(null);
  const [labelAnchor, setLabelAnchor] = useState<{
    u: number;
    v: number;
  } | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<{
    url: string;
    image: HTMLImageElement;
    width: number;
    height: number;
  } | null>(null);
  const backgroundUrlRef = useRef<string | null>(null);
  const dragUndoCapturedRef = useRef(false);

  const pxLength = mmToPx(connectorLength);
  const selectedConnector = useMemo(
    () =>
      connectors.find((connector) => connector.id === selectedConnectorId) ??
      null,
    [connectors, selectedConnectorId]
  );

  const setSegments = useCallback(
    (next: LineSegment[]) => dispatch({ type: "SET_SEGMENTS", payload: next }),
    [dispatch]
  );
  const setConnectors = useCallback(
    (next: LineSegment[]) =>
      dispatch({ type: "SET_CONNECTORS", payload: next }),
    [dispatch]
  );
  const updateDistanceConfig = useCallback(
    (
      patch: Partial<
        Pick<TreeDanglerState, "gap" | "round" | "noiseAmplitude" | "noiseSeed">
      >
    ) => {
      dispatch({ type: "SET_DISTANCE_CONFIG", payload: patch });
    },
    [dispatch]
  );
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const redoStackRef = useRef<EditorSnapshot[]>([]);

  const cloneSnapshot = useCallback((): EditorSnapshot => {
    const clonePoints = (points: Point[]) => points.map((p) => ({ ...p }));
    const cloneSegments = (items: LineSegment[]) =>
      items.map((segment) => ({
        ...segment,
        start: { ...segment.start },
        end: { ...segment.end },
      }));

    return {
      mask: { ...mask, points: clonePoints(mask.points) },
      segments: cloneSegments(segments),
      connectors: cloneSegments(connectors),
      gap,
      round,
      noiseAmplitude,
      noiseSeed,
      connectorLength,
      holeDiameter,
    };
  }, [
    mask,
    segments,
    connectors,
    gap,
    round,
    noiseAmplitude,
    noiseSeed,
    connectorLength,
    holeDiameter,
  ]);
  const pushUndoSnapshot = useCallback(() => {
    redoStackRef.current = [];
    undoStackRef.current.push(cloneSnapshot());
  }, [cloneSnapshot]);
  const ensureDragUndoSnapshot = useCallback(() => {
    if (dragUndoCapturedRef.current) return;
    pushUndoSnapshot();
    dragUndoCapturedRef.current = true;
  }, [pushUndoSnapshot]);
  const setConnectorMode = useCallback(
    (mode: "tension" | "compression") => {
      if (!selectedConnectorId) return;
      const index = connectors.findIndex(
        (connector) => connector.id === selectedConnectorId
      );
      if (index === -1) return;
      pushUndoSnapshot();
      const next = connectors.slice();
      next[index] = { ...next[index], mode };
      setConnectors(next);
    },
    [connectors, selectedConnectorId, setConnectors, pushUndoSnapshot]
  );
  const handleSliderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLInputElement>) => {
      if (event.button !== 0) return;
      pushUndoSnapshot();
    },
    [pushUndoSnapshot]
  );

  const restoreSnapshot = useCallback(
    (snapshot: EditorSnapshot) => {
      dispatch({ type: "SET_MASK", payload: snapshot.mask });
      dispatch({ type: "SET_SEGMENTS", payload: snapshot.segments });
      dispatch({ type: "SET_CONNECTORS", payload: snapshot.connectors });
      dispatch({
        type: "SET_DISTANCE_CONFIG",
        payload: {
          gap: snapshot.gap,
          round: snapshot.round,
          noiseAmplitude: snapshot.noiseAmplitude,
          noiseSeed: snapshot.noiseSeed,
        },
      });
      dispatch({
        type: "SET_CONNECTOR_LENGTH",
        payload: snapshot.connectorLength,
      });
      dispatch({
        type: "SET_HOLE_DIAMETER",
        payload: snapshot.holeDiameter,
      });
      setSelectedSegmentId(null);
      setSelectedConnectorId(null);
      setMaskSelection(null);
      setLabelEditor(null);
      setDragInfo(null);
    },
    [dispatch]
  );

  useEffect(() => {
    const handleExternalSnapshot = () => {
      pushUndoSnapshot();
    };
    window.addEventListener(EXTERNAL_UNDO_EVENT, handleExternalSnapshot);
    return () => {
      window.removeEventListener(EXTERNAL_UNDO_EVENT, handleExternalSnapshot);
    };
  }, [pushUndoSnapshot]);
  const handleUndo = useCallback(() => {
    if (!undoStackRef.current.length) return;
    const current = cloneSnapshot();
    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push(current);
    restoreSnapshot(previous);
  }, [cloneSnapshot, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length) return;
    const current = cloneSnapshot();
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(current);
    restoreSnapshot(next);
  }, [cloneSnapshot, restoreSnapshot]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        handleUndo();
      } else if (key === "y") {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleRedo, handleUndo]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const items = clipboard.items;
      let file: File | null = null;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          file = item.getAsFile();
          break;
        }
      }
      if (!file && clipboard.files?.length) {
        file =
          Array.from(clipboard.files).find((entry) =>
            entry.type.startsWith("image/")
          ) ?? null;
      }
      if (!file) return;
      event.preventDefault();
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (backgroundUrlRef.current) {
          URL.revokeObjectURL(backgroundUrlRef.current);
        }
        backgroundUrlRef.current = url;
        setBackgroundImage({
          url,
          image: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
      };
      img.src = url;
    };
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
      if (backgroundUrlRef.current) {
        URL.revokeObjectURL(backgroundUrlRef.current);
      }
    };
  }, []);

  const drawPane = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      if (backgroundImage) {
        const scale = Math.min(
          width / backgroundImage.width,
          height / backgroundImage.height
        );
        const drawWidth = backgroundImage.width * scale;
        const drawHeight = backgroundImage.height * scale;
        const offsetX = (width - drawWidth) / 2;
        const offsetY = (height - drawHeight) / 2;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.drawImage(
          backgroundImage.image,
          offsetX,
          offsetY,
          drawWidth,
          drawHeight
        );
        ctx.restore();
      }

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

        if (segment.mode === "compression") {
          const midX = (segment.start.x + segment.end.x) / 2;
          const midY = (segment.start.y + segment.end.y) / 2;
          const size = 12;
          ctx.beginPath();
          ctx.moveTo(midX, midY - size / 2);
          ctx.lineTo(midX + size / 2, midY);
          ctx.lineTo(midX, midY + size / 2);
          ctx.lineTo(midX - size / 2, midY);
          ctx.closePath();
          ctx.fillStyle = selected ? "#f97316" : "#94a3b8";
          ctx.strokeStyle = selected ? "#f97316" : "#94a3b8";
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
        }
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
      backgroundImage,
    ]
  );

  const handlePointerDown = useCallback(
    (event: PointerEventData) => {
      const point = { x: event.x, y: event.y };
      const isRightClick = event.buttons === 2;
      const isMiddleClick =
        event.originalEvent.button === 1 || (event.buttons & 4) === 4;

      if (isMiddleClick) {
        const snapshot = {
          maskPoints: mask.points.map((pt) => ({ ...pt })),
          segments: segments.map((seg) => ({
            ...seg,
            start: { ...seg.start },
            end: { ...seg.end },
          })),
          connectors: connectors.map((conn) => ({
            ...conn,
            start: { ...conn.start },
            end: { ...conn.end },
          })),
        };
        setMaskSelection(null);
        setSelectedSegmentId(null);
        setSelectedConnectorId(null);
        setLabelEditor(null);
        dragUndoCapturedRef.current = false;
        setDragInfo({
          kind: "pan-all",
          startPointer: point,
          snapshot,
        });
        return;
      }

      // Mask point?
      const maskIdx = hitTestMaskPoint(mask, point, 12);
      if (maskIdx !== -1) {
        setMaskSelection(maskIdx);
        dragUndoCapturedRef.current = false;
        setDragInfo({ kind: "mask", maskIndex: maskIdx });
        setSelectedSegmentId(null);
        setSelectedConnectorId(null);
        setLabelEditor(null);
        return;
      }
      // Mask edge insert
      const maskSegIdx = hitTestMaskSegment(mask, point, 10);
      if (maskSegIdx !== -1) {
        pushUndoSnapshot();
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
        dragUndoCapturedRef.current = false;
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
        if (isRightClick) {
          pushUndoSnapshot();
          const rotated = rotateConnectorNinetyDegrees(connector);
          const next = connectors.slice();
          next[connectorEndpoint.segmentIndex] = rotated;
          setConnectors(next);
          return;
        }
        setSelectedConnectorId(connector.id);
        setSelectedSegmentId(null);
        setMaskSelection(null);
        setLabelEditor(null);
        dragUndoCapturedRef.current = false;
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
        dragUndoCapturedRef.current = false;
        return;
      }

      // Connector body
      const connectorIndex = hitTestConnectorSegment(connectors, point);
      if (connectorIndex !== -1) {
        const connector = connectors[connectorIndex];
        if (isRightClick) {
          pushUndoSnapshot();
          const rotated = rotateConnectorNinetyDegrees(connector);
          const next = connectors.slice();
          next[connectorIndex] = rotated;
          setConnectors(next);
          return;
        }
        setSelectedConnectorId(connector.id);
        setSelectedSegmentId(null);
        setMaskSelection(null);
        setLabelEditor(null);
        dragUndoCapturedRef.current = false;
        setDragInfo({
          kind: "connector",
          segmentIndex: connectorIndex,
          origin: connector,
          startPointer: point,
        });
        return;
      }

      // Create new on click: left => segment, right => connector
      if (labelEditor) {
        // If we're mid-label edit, ignore canvas clicks so we don't create new elements by accident.
        return;
      }
      if (isRightClick) {
        pushUndoSnapshot();
        const conn = createConnectorAtPoint(mask, point, pxLength);
        if (conn) {
          setConnectors([...connectors, conn]);
          setSelectedConnectorId(conn.id);
          setMaskSelection(null);
          setSelectedSegmentId(null);
          setLabelEditor(null);
        }
      } else {
        pushUndoSnapshot();
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
      pushUndoSnapshot,
      labelEditor,
    ]
  );

  const handlePointerMove = useCallback(
    (event: PointerEventData) => {
      if (!dragInfo) return;
      const pointer = { x: event.x, y: event.y };
      if (
        dragInfo.kind === "pan-all" &&
        dragInfo.startPointer &&
        dragInfo.snapshot
      ) {
        const delta = {
          x: pointer.x - dragInfo.startPointer.x,
          y: pointer.y - dragInfo.startPointer.y,
        };
        ensureDragUndoSnapshot();
        const nextMask = {
          ...mask,
          points: dragInfo.snapshot.maskPoints.map((pt) => ({
            x: pt.x + delta.x,
            y: pt.y + delta.y,
          })),
        };
        const nextSegments = dragInfo.snapshot.segments.map((seg) => ({
          ...seg,
          start: { x: seg.start.x + delta.x, y: seg.start.y + delta.y },
          end: { x: seg.end.x + delta.x, y: seg.end.y + delta.y },
        }));
        const nextConnectors = dragInfo.snapshot.connectors.map((conn) => ({
          ...conn,
          start: { x: conn.start.x + delta.x, y: conn.start.y + delta.y },
          end: { x: conn.end.x + delta.x, y: conn.end.y + delta.y },
        }));
        dispatch({ type: "SET_MASK", payload: nextMask });
        setSegments(nextSegments);
        setConnectors(nextConnectors);
        return;
      }
      if (dragInfo.kind === "mask" && dragInfo.maskIndex !== undefined) {
        const idx = dragInfo.maskIndex;
        ensureDragUndoSnapshot();
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
            ensureDragUndoSnapshot();
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
            ensureDragUndoSnapshot();
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
            ensureDragUndoSnapshot();
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
            ensureDragUndoSnapshot();
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
      ensureDragUndoSnapshot,
      mask,
      pxLength,
      segments,
      setConnectors,
      setSegments,
    ]
  );

  const handleWheel = useCallback(
    (event: WheelEventData) => {
      const zoomIn = event.deltaY < 0;
      const scaleFactor = zoomIn ? 1.05 : 0.95;
      pushUndoSnapshot();
      const scalePoint = (pt: Point) => ({
        x: pt.x * scaleFactor,
        y: pt.y * scaleFactor,
      });
      const nextMask = { ...mask, points: mask.points.map(scalePoint) };
      const nextSegments = segments.map((seg) => ({
        ...seg,
        start: scalePoint(seg.start),
        end: scalePoint(seg.end),
      }));
      const nextConnectors = connectors.map((conn) => ({
        ...conn,
        start: scalePoint(conn.start),
        end: scalePoint(conn.end),
      }));
      dispatch({ type: "SET_MASK", payload: nextMask });
      setSegments(nextSegments);
      const normalizedConnectors = nextConnectors.map((conn) => {
        const dx = conn.end.x - conn.start.x;
        const dy = conn.end.y - conn.start.y;
        const len = Math.hypot(dx, dy) || 1;
        const factor = pxLength / len;
        return {
          ...conn,
          end: {
            x: conn.start.x + dx * factor,
            y: conn.start.y + dy * factor,
          },
        };
      });
      setConnectors(normalizedConnectors);
    },
    [
      connectors,
      dispatch,
      mask,
      pxLength,
      segments,
      setConnectors,
      setSegments,
      pushUndoSnapshot,
    ]
  );

  const clearDrag = useCallback(() => {
    setDragInfo(null);
    dragUndoCapturedRef.current = false;
  }, []);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      pushUndoSnapshot();
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
      handleRedo,
      handleUndo,
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
    pushUndoSnapshot();
    const next = segments.slice();
    next[index] = { ...next[index], text: labelEditor.value };
    setSegments(next);
    setLabelEditor(null);
    setLabelAnchor(null);
  }, [labelEditor, segments, setSegments, pushUndoSnapshot]);

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
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      />
      <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        <button
          type="button"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-[rgba(8,26,54,0.85)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-50 shadow-lg shadow-cyan-500/15 transition hover:border-cyan-200/70 hover:bg-[rgba(18,48,88,0.95)]"
          onClick={() => setPanelOpen((prev) => !prev)}
        >
          Settings
          <span className="text-lg leading-none font-mono">
            {panelOpen ? "▲" : "▼"}
          </span>
        </button>
        {panelOpen ? (
          <div className="pointer-events-auto w-64 rounded-2xl border border-cyan-300/30 bg-[rgba(4,12,28,0.95)] p-4 text-xs text-[var(--ink)] shadow-2xl backdrop-blur">
            <div className="mt-3 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-cyan-100/70">
                  Gap
                  <span>{gap.toFixed(1)} mm</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.1}
                  value={gap}
                  onPointerDown={handleSliderPointerDown}
                  onChange={(event) =>
                    updateDistanceConfig({
                      gap: Number(event.target.value),
                    })
                  }
                  className="w-full accent-cyan-200"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-cyan-100/70">
                  Round
                  <span>{round.toFixed(1)} mm</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.1}
                  value={round}
                  onPointerDown={handleSliderPointerDown}
                  onChange={(event) =>
                    updateDistanceConfig({
                      round: Number(event.target.value),
                    })
                  }
                  className="w-full accent-indigo-200"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-cyan-100/70">
                  Noise
                  <span>{noiseAmplitude.toFixed(1)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={0.1}
                  value={noiseAmplitude}
                  onPointerDown={handleSliderPointerDown}
                  onChange={(event) =>
                    updateDistanceConfig({
                      noiseAmplitude: Number(event.target.value),
                    })
                  }
                  className="w-full accent-cyan-300"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/70">
                  Noise Seed
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={noiseSeed}
                  onChange={(event) => {
                    pushUndoSnapshot();
                    updateDistanceConfig({
                      noiseSeed: Number(event.target.value),
                    });
                  }}
                  className="rounded-lg border border-cyan-300/35 bg-[rgba(7,20,44,0.85)] px-2 py-1 text-[var(--ink)] outline-none transition focus:border-cyan-200/70"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/70">
                  Connector Length
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={2}
                    step={0.5}
                    value={connectorLength}
                    onChange={(event) => {
                      pushUndoSnapshot();
                      dispatch({
                        type: "SET_CONNECTOR_LENGTH",
                        payload: Number(event.target.value),
                      });
                    }}
                    className="w-24 rounded-lg border border-cyan-300/35 bg-[rgba(7,20,44,0.85)] px-2 py-1 text-[var(--ink)] outline-none transition focus:border-cyan-200/70"
                  />
                  <span className="text-cyan-100/70">mm</span>
                </div>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/70">
                  Hole Diameter
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0.5}
                    step={0.1}
                    value={holeDiameter}
                    onChange={(event) => {
                      pushUndoSnapshot();
                      dispatch({
                        type: "SET_HOLE_DIAMETER",
                        payload: Number(event.target.value),
                      });
                    }}
                    className="w-24 rounded-lg border border-cyan-300/35 bg-[rgba(7,20,44,0.85)] px-2 py-1 text-[var(--ink)] outline-none transition focus:border-cyan-200/70"
                  />
                  <span className="text-cyan-100/70">mm</span>
                </div>
              </label>
            </div>
          </div>
        ) : null}
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 z-10">
        {backgroundImage ? (
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-[rgba(4,12,28,0.9)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-50 shadow-lg shadow-cyan-500/15 transition hover:border-cyan-200/70 hover:bg-[rgba(12,32,64,0.95)]"
            onClick={() => {
              if (backgroundUrlRef.current) {
                URL.revokeObjectURL(backgroundUrlRef.current);
                backgroundUrlRef.current = null;
              }
              setBackgroundImage(null);
            }}
          >
            Remove background
          </button>
        ) : (
          <div className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-100/70 ">
            Paste image with CTRL+V to set background
          </div>
        )}
      </div>
      {labelEditor && editorPosition ? (
        <input
          autoFocus
          className="absolute rounded border border-cyan-300/35 bg-[rgba(4,12,28,0.95)] px-2 py-1 text-sm text-[var(--ink)] shadow-lg shadow-cyan-500/20 outline-none focus:border-cyan-200/70"
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
      {selectedConnector ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-cyan-300/35 bg-[rgba(4,12,28,0.9)] px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-cyan-100/80 shadow-lg shadow-cyan-500/15">
            <span className="font-semibold text-cyan-50">Connector Mode</span>
            <label className="flex items-center gap-1 text-[10px] tracking-[0.15em] text-cyan-100/80">
              <input
                type="radio"
                name="connector-mode"
                className="accent-cyan-300"
                checked={selectedConnector.mode !== "compression"}
                onChange={() => setConnectorMode("tension")}
              />
              <span className="normal-case text-[11px] tracking-[0.05em]">
                Tension
              </span>
            </label>
            <label className="flex items-center gap-1 text-[10px] tracking-[0.15em] text-cyan-100/80">
              <input
                type="radio"
                name="connector-mode"
                className="accent-cyan-300"
                checked={selectedConnector.mode === "compression"}
                onChange={() => setConnectorMode("compression")}
              />
              <span className="normal-case text-[11px] tracking-[0.05em]">
                Compression
              </span>
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default EditorPane;
