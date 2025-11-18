import ImageTracer from "imagetracerjs";

import type { BinaryBitmap, Point, Polygon } from "../types";

const TRACE_OPTIONS = {
  ltres: 0.1,
  qtres: 0.1,
  pathomit: 8,
  rightangleenhance: false,
  colorsampling: 0,
  numberofcolors: 2,
  mincolorratio: 0,
  linefilter: true,
};

export function traceBinaryBitmap(bitmap: BinaryBitmap): Polygon[] {
  const tracedOptions = TRACE_OPTIONS;

  try {
    const traced = ImageTracer.imagedataToTracedata(
      {
        width: bitmap.width,
        height: bitmap.height,
        data: bitmap.data,
      },
      tracedOptions
    );

    const polygons: Polygon[] = [];
    const seen = new Set<string>();
    traced.layers.forEach((layer: any[], layerIndex: number) => {
      layer.forEach((path: any, pathIndex: number) => {
        if (!path || !path.segments || path.segments.length === 0) {
          return;
        }

        let points: Point[] = [];
        path.segments.forEach((segment: any, segmentIndex: number) => {
          if (segmentIndex === 0) {
            points.push({
              x: segment.x1,
              y: segment.y1,
            });
          }
          points.push({
            x: segment.x2,
            y: segment.y2,
          });
        });

        if (points.length >= 3) {
          const key = points
            .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
            .join("|");
          if (seen.has(key)) {
            return;
          }
          seen.add(key);
          polygons.push({
            id: `piece-${layerIndex}-${pathIndex}`,
            points,
          });
        }
      });
    });

    polygons.shift();
    return polygons;
  } catch (error) {
    console.error("Failed to trace bitmap into polygons:", error);
    return [];
  }
}
