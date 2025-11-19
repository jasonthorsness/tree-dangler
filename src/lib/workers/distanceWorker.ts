/// <reference lib="webworker" />

import { makeNoise2D } from "open-simplex-noise";
import { computeDistanceField } from "../logic/distanceField";
import { traceBinaryBitmap } from "../logic/tracing";
import { generateSVG } from "../logic/svgExport";
import type { BinaryBitmap, LineSegment, Polygon } from "../types";

interface DistanceWorkerConfig {
  shrinkThreshold: number;
  growThreshold: number;
  noiseAmplitude: number;
  noiseSeed: number;
}

interface DistanceWorkerRequest {
  id: number;
  raster: BinaryBitmap;
  connectors: LineSegment[];
  segments: LineSegment[];
  config: DistanceWorkerConfig;
}

interface DistanceWorkerResponse {
  id: number;
  distanceField?: {
    data: Float32Array;
    width: number;
    height: number;
    max: number;
  };
  preview?: BinaryBitmap;
  piecePolygons?: Polygon[];
  svgString?: string;
  error?: string;
}

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

// --- queue-collapsing scheduler state ---
let isComputing = false;
let latestPending: DistanceWorkerRequest | null = null;

ctx.addEventListener(
  "message",
  (event: MessageEvent<DistanceWorkerRequest>) => {
    console.log("AAA");
    // Always overwrite with the latest request
    latestPending = event.data;

    // If we're already computing, just wait; when the current job finishes,
    // we'll process only the latestPending request.
    if (isComputing) return;

    runNextComputation();
  }
);

function runNextComputation() {
  if (!latestPending) return;

  const request = latestPending;
  latestPending = null;
  isComputing = true;

  const { id, raster, connectors, segments, config } = request;

  // Yield to allow additional messages to enqueue before heavy work starts
  Promise.resolve().then(() => {
    try {
      const { width, height } = raster;
      const total = width * height;

      const inward = computeDistanceField(raster);

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

      if (config.noiseAmplitude > 0) {
        const noise2D = makeNoise2D(config.noiseSeed);
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
        if (shrinkMask[i]) {
          finalMask[i] = 1;
        } else if (outward.field[i] <= config.growThreshold) {
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

      ctx.postMessage(
        {
          id,
          distanceField: {
            data: inward.field,
            width,
            height,
            max: inward.maxDistance,
          },
          preview: previewBitmap,
          piecePolygons: tracedPolygons,
          svgString: svgOutput,
        } satisfies DistanceWorkerResponse,
        [inward.field.buffer, previewData.buffer]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.postMessage({ id, error: message } satisfies DistanceWorkerResponse);
    } finally {
      isComputing = false;

      // If new messages arrived during this computation, process only the latest
      if (latestPending) {
        runNextComputation();
      }
    }
  });
}

export {};
