import ImageTracer from "imagetracerjs";

import type { BinaryBitmap, Point, Polygon } from "../types";

const TRACE_OPTIONS = {
  ltres: 0.01,
  qtres: 0.01,
  pathomit: 0,
  rightangleenhance: false,
  colorsampling: 0,
  numberofcolors: 2,
  mincolorratio: 0,
  blurradius: 5,
  blurdelta: 64,
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
    traced.layers.forEach((layer: any[], layerIndex: number) => {
      layer.forEach((path: any, pathIndex: number) => {
        if (!path || !path.segments || path.segments.length === 0) {
          return;
        }

        const points: Point[] = [];
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
          polygons.push({
            id: `piece-${layerIndex}-${pathIndex}`,
            points,
          });
        }
      });
    });

    return polygons;
  } catch (error) {
    console.error("Failed to trace bitmap into polygons:", error);
    return [];
  }
}
