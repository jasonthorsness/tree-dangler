/// <reference lib="webworker" />

import { makeNoise2D } from "open-simplex-noise";
import {
  computeDistanceField,
  rasterizeVoronoiMask,
} from "../logic/distanceField";
import { traceBinaryBitmap } from "../logic/tracing";
import { generateSVG } from "../logic/svgExport";
import { computeVoronoiPolygons } from "../logic/voronoi";
import type { BinaryBitmap, LineSegment, MaskPolygon, Polygon } from "../types";

const DEFAULT_RASTER_WIDTH = 600;
const DEFAULT_RASTER_HEIGHT = 800;
let cachedNoiseSeed: number | null = null;
let cachedNoise2D: ((x: number, y: number) => number) | null = null;

interface WorkerRequest {
  id: number;
  mask: MaskPolygon;
  segments: LineSegment[];
  connectors: LineSegment[];
  config: {
    shrinkThreshold: number;
    roundThreshold: number;
    noiseAmplitude: number;
    noiseSeed: number;
  };
  spacing?: number;
}

interface WorkerResponse {
  id: number;
  piecePolygons?: Polygon[];
  svgString?: string;
  error?: string;
}

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

// Queue-collapsing state: only ever process the latest request.
let isComputing = false;
let latestPending: WorkerRequest | null = null;
let pendingTimeout: number | null = null;

// Schedule a run with a 100ms debounce to allow more deduping.
function scheduleNextComputation() {
  if (!latestPending) return;
  if (isComputing) return;
  if (pendingTimeout !== null) return;

  pendingTimeout = setTimeout(() => {
    pendingTimeout = null;
    if (!isComputing && latestPending) {
      runNextComputation();
    }
  }, 0) as unknown as number;
}

ctx.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  // Always keep only the latest request
  latestPending = event.data;
  scheduleNextComputation();
});

function runNextComputation() {
  if (!latestPending) return;

  const request = latestPending;
  latestPending = null;
  isComputing = true;

  const { id, mask, segments, connectors, config, spacing } = request;

  // We already waited 100ms before calling this via scheduleNextComputation.
  // Use a microtask to keep the event loop responsive.
  Promise.resolve().then(() => {
    try {
      const polygons = computeVoronoiPolygons(segments, mask, spacing);

      if (!polygons.length) {
        ctx.postMessage({
          id,
          piecePolygons: [],
          svgString: "",
        } satisfies WorkerResponse);
        return;
      }

      const maskBitmap = rasterizeVoronoiMask(polygons, mask, {
        width: DEFAULT_RASTER_WIDTH,
        height: DEFAULT_RASTER_HEIGHT,
        strokeWidth: 2,
      });

      if (!maskBitmap) {
        ctx.postMessage({
          id,
          piecePolygons: [],
          svgString: "",
        } satisfies WorkerResponse);
        return;
      }

      const { width, height } = maskBitmap;
      const total = width * height;

      if (cachedNoiseSeed !== config.noiseSeed || !cachedNoise2D) {
        cachedNoise2D = makeNoise2D(config.noiseSeed);
        cachedNoiseSeed = config.noiseSeed;
      }
      const noise2D = cachedNoise2D;

      const inward = computeDistanceField(maskBitmap);
      const shrinkMask = new Uint8Array(total);
      for (let i = 0; i < total; i += 1) {
        shrinkMask[i] = inward.field[i] >= config.shrinkThreshold ? 1 : 0;
      }

      const invertedData = new Uint8ClampedArray(total * 4);
      for (let i = 0; i < total; i += 1) {
        const value = shrinkMask[i] ? 0 : 255;
        const offset = i * 4;
        invertedData[offset] = value;
        invertedData[offset + 1] = value;
        invertedData[offset + 2] = value;
        invertedData[offset + 3] = 255;
      }

      const outward = computeDistanceField({
        width,
        height,
        data: invertedData,
      });

      if (config.noiseAmplitude > 0 && noise2D) {
        for (let i = 0; i < outward.field.length; i += 1) {
          const x = i % width;
          const y = Math.floor(i / width);
          const baseNoise = noise2D(x * 0.01, y * 0.01);
          const secondNoise = noise2D(x * 0.02 + 100, y * 0.02 + 100);
          const thirdNoise = noise2D(x * 0.03 + 200, y * 0.03 + 200);
          const combinedNoise =
            (baseNoise + secondNoise * 0.5 + thirdNoise * 0.25) / 1.75;
          outward.field[i] = Math.max(
            0,
            outward.field[i] + combinedNoise * config.noiseAmplitude
          );
        }
      }

      const finalMask = new Uint8Array(total);
      for (let i = 0; i < total; i += 1) {
        if (outward.field[i] <= config.roundThreshold) {
          finalMask[i] = 1;
        }
      }

      const previewData = new Uint8ClampedArray(total * 4);
      for (let i = 0; i < total; i += 1) {
        const offset = i * 4;
        if (finalMask[i]) {
          previewData[offset] = 255;
          previewData[offset + 1] = 255;
          previewData[offset + 2] = 255;
          previewData[offset + 3] = 255;
        } else {
          previewData[offset] = 0;
          previewData[offset + 1] = 0;
          previewData[offset + 2] = 0;
          // Transparent background so tracing focuses on the foreground only.
          previewData[offset + 3] = 0;
        }
      }

      const previewBitmap: BinaryBitmap = {
        width,
        height,
        data: previewData,
      };

      const tracedPolygons = traceBinaryBitmap(previewBitmap);
      const svgOutput = generateSVG(
        tracedPolygons,
        connectors,
        segments,
        width,
        height
      );

      ctx.postMessage({
        id,
        piecePolygons: tracedPolygons,
        svgString: svgOutput,
      } satisfies WorkerResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.postMessage({ id, error: message } satisfies WorkerResponse);
    } finally {
      isComputing = false;

      // If more messages came in while we were working,
      // schedule the next run (with another 100ms debounce).
      if (latestPending) {
        scheduleNextComputation();
      }
    }
  });
}

export {};
