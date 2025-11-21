import { line, curveCatmullRomClosed } from "d3-shape";
import type { LineSegment, Polygon } from "../types";

const MM_TO_PX = 5;
const HOLE_RADIUS_MM = 1;
const MIN_POINT_GAP_PX = 0.5;

function pxToMm(px: number) {
  return px / MM_TO_PX;
}

function smoothPoints(points: { x: number; y: number }[]) {
  if (points.length < 3) return points;
  const n = points.length;
  const smoothed: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    smoothed.push({
      x: (prev.x + 2 * curr.x + next.x) / 4,
      y: (prev.y + 2 * curr.y + next.y) / 4,
    });
  }
  return smoothed;
}

function preprocessPoints(points: { x: number; y: number }[]) {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const closed =
    Math.hypot(first.x - last.x, first.y - last.y) < 0.5
      ? points.slice(0, points.length - 1)
      : points;

  const deduped: { x: number; y: number }[] = [];
  for (let i = 0; i < closed.length; i += 1) {
    const prev = deduped[deduped.length - 1];
    const p = closed[i];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > MIN_POINT_GAP_PX) {
      deduped.push(p);
    }
  }
  const smoothed = smoothPoints(deduped);
  // const simplified = simplifyPolyline(smoothed, SIMPLIFY_EPSILON_PX);
  return smoothed;
}

// --- replaced manual Catmull–Rom with d3-shape ---

function catmullRomPath(points: { x: number; y: number }[]): string {
  const pts = preprocessPoints(points);
  if (pts.length < 2) return "";

  const lineGen = line<{ x: number; y: number }>()
    .x((p: { x: number; y: number }) => pxToMm(p.x))
    .y((p: { x: number; y: number }) => pxToMm(p.y))
    .curve(curveCatmullRomClosed.alpha(0.5)); // centripetal, closed

  const d = lineGen(pts);
  // d3’s closed curve already loops back to the start; add Z to close the path for SVG fills
  return d ? `${d} Z` : "";
}

export function generateSVG(
  polygons: Polygon[],
  connectors: LineSegment[],
  segments: LineSegment[],
  width: number,
  height: number
): string {
  const svgWidth = pxToMm(width);
  const svgHeight = pxToMm(height);
  const primaryStroke = "#4DE2FF"; // cyan accent
  const secondaryStroke = "#7E6CFF"; // indigo accent

  const polygonPaths = polygons
    .map((polygon) => {
      if (!polygon.points.length) return "";
      const pathD = catmullRomPath(polygon.points);
      return pathD ? `<path d="${pathD}" />` : "";
    })
    .filter(Boolean)
    .join("\n");

  const holes = connectors
    .flatMap((connector) => [connector.start, connector.end])
    .map(
      (point) =>
        `<circle cx="${pxToMm(point.x).toFixed(2)}" cy="${pxToMm(
          point.y
        ).toFixed(
          2
        )}" r="${HOLE_RADIUS_MM}" fill="none" stroke="${secondaryStroke}" stroke-width="0.18" />`
    )
    .join("\n");

  const segmentLabels = segments
    .filter((s) => s.text && s.text.trim().length > 0)
    .map((segment) => {
      const midX = (segment.start.x + segment.end.x) / 2;
      const midY = (segment.start.y + segment.end.y) / 2;
      const angle = Math.atan2(
        segment.end.y - segment.start.y,
        segment.end.x - segment.start.x
      );
      const rotate = (angle * 180) / Math.PI;
      const fontSizeMm = pxToMm(8); // match canvas text sizing
      const text = segment.text
        ? segment.text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        : "";
      return `<text x="${pxToMm(midX).toFixed(2)}" y="${pxToMm(midY).toFixed(
        2
      )}" fill="${secondaryStroke}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rotate.toFixed(
        2
      )} ${pxToMm(midX).toFixed(2)} ${pxToMm(midY).toFixed(
        2
      )})" font-size="${fontSizeMm.toFixed(3)}mm">${text}</text>`;
    })
    .join("\n");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}mm" height="${svgHeight}mm" viewBox="0 0 ${svgWidth} ${svgHeight}" style="background: transparent">
  <g fill="none" stroke="${primaryStroke}" stroke-width="${pxToMm(0.5).toFixed(
    2
  )}">
    ${polygonPaths}
  </g>
  ${holes}
  ${segmentLabels}
</svg>
`.trim();
}
