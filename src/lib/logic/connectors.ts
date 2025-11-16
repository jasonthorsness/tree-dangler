import type { LineSegment, MaskPolygon, Point } from "../types";
import {
  hitTestEndpoint as baseHitTestEndpoint,
  hitTestSegment as baseHitTestSegment,
  isPointInsideMask,
  moveSegment,
} from "./segments";

export const PX_PER_MM = 5;

export function mmToPx(mm: number) {
  return mm * PX_PER_MM;
}

export function createConnectorAtPoint(
  mask: MaskPolygon,
  click: Point,
  lengthPx: number
): LineSegment | null {
  const half = lengthPx / 2;
  const start: Point = { x: click.x, y: click.y - half };
  const end: Point = { x: click.x, y: click.y + half };

  if (!isPointInsideMask(start, mask) || !isPointInsideMask(end, mask)) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    start,
    end,
  };
}

export function moveConnector(
  segment: LineSegment,
  delta: Point,
  mask: MaskPolygon
) {
  return moveSegment(segment, delta, mask);
}

export function hitTestConnectorSegment(
  segments: LineSegment[],
  point: Point,
  tolerance?: number
) {
  return baseHitTestSegment(segments, point, tolerance);
}

export function hitTestConnectorEndpoint(
  segments: LineSegment[],
  point: Point,
  radius?: number
) {
  return baseHitTestEndpoint(segments, point, radius);
}

function pointOnLineWithLength(
  anchor: Point,
  target: Point,
  lengthPx: number
): Point | null {
  const dir = { x: target.x - anchor.x, y: target.y - anchor.y };
  const mag = Math.hypot(dir.x, dir.y);
  if (mag === 0) {
    return null;
  }
  const scale = lengthPx / mag;
  return {
    x: anchor.x + dir.x * scale,
    y: anchor.y + dir.y * scale,
  };
}

export function resizeConnectorFromStart(
  segment: LineSegment,
  lengthPx: number,
  mask: MaskPolygon
): LineSegment {
  const end = pointOnLineWithLength(segment.start, segment.end, lengthPx);
  if (!end) {
    return segment;
  }
  if (!isPointInsideMask(segment.start, mask) || !isPointInsideMask(end, mask)) {
    return segment;
  }
  return { ...segment, end };
}

export function moveConnectorEndpoint(
  segment: LineSegment,
  endpoint: "start" | "end",
  pointer: Point,
  mask: MaskPolygon,
  lengthPx: number
): LineSegment | null {
  const anchor = endpoint === "start" ? segment.end : segment.start;
  const newPoint = pointOnLineWithLength(anchor, pointer, lengthPx);
  if (!newPoint) {
    return null;
  }
  if (
    !isPointInsideMask(anchor, mask) ||
    !isPointInsideMask(newPoint, mask)
  ) {
    return null;
  }
  if (endpoint === "start") {
    return { ...segment, start: newPoint };
  }
  return { ...segment, end: newPoint };
}
