import type { BinaryBitmap, MaskPolygon, Point, Polygon } from "../types";

export interface RasterizeOptions {
  width: number;
  height: number;
  strokeWidth?: number;
}

type AnyCanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

function buildPath(ctx: AnyCanvasContext, points: Point[]) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

function createContext(width: number, height: number) {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    return ctx;
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext("2d");
  }
  return null;
}

export function rasterizeVoronoiMask(
  polygons: Polygon[],
  mask: MaskPolygon,
  options: RasterizeOptions
): BinaryBitmap | null {
  const { width, height, strokeWidth = 2 } = options;
  const ctx = createContext(width, height);
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  if (mask.points.length >= 3) {
    buildPath(ctx, mask.points);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  if (polygons.length) {
    ctx.save();
    if (mask.points.length >= 3) {
      buildPath(ctx, mask.points);
      ctx.clip();
    }
    ctx.strokeStyle = "#000";
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    polygons.forEach((polygon) => {
      buildPath(ctx, polygon.points);
      ctx.stroke();
    });
    ctx.restore();
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const dataCopy = new Uint8ClampedArray(imageData.data);
  return {
    width,
    height,
    data: dataCopy,
  };
}


const INF = 1e20;

function distanceTransform1D(
  input: Float32Array,
  n: number,
  output: Float32Array
) {
  const v = new Int32Array(n);
  const z = new Float32Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;

  for (let q = 1; q < n; q += 1) {
    let s: number;
    do {
      const p = v[k];
      s = (input[q] + q * q - (input[p] + p * p)) / (2 * q - 2 * p);
      if (s <= z[k]) {
        k -= 1;
      } else {
        break;
      }
    } while (k >= 0);
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }

  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) {
      k += 1;
    }
    const val = v[k];
    output[q] = (q - val) * (q - val) + input[val];
  }
}

export interface DistanceFieldResult {
  field: Float32Array;
  maxDistance: number;
}

export function computeDistanceField(
  bitmap: BinaryBitmap
): DistanceFieldResult {
  const { width, height, data } = bitmap;
  const total = width * height;
  const initial = new Float32Array(total);
  const temp = new Float64Array(total);
  const output = new Float32Array(total);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const pixelOffset = idx * 4;
      const isWhite = data[pixelOffset] > 127;
      initial[idx] = isWhite ? INF : 0;
    }
  }

  const columnInput = new Float32Array(height);
  const columnOutput = new Float32Array(height);
  const rowInput = new Float32Array(width);
  const rowOutput = new Float32Array(width);

  // columns
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      columnInput[y] = initial[y * width + x];
    }
    distanceTransform1D(columnInput, height, columnOutput);
    for (let y = 0; y < height; y += 1) {
      temp[y * width + x] = columnOutput[y];
    }
  }

  // rows
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      rowInput[x] = temp[rowOffset + x];
    }
    distanceTransform1D(rowInput, width, rowOutput);
    for (let x = 0; x < width; x += 1) {
      output[rowOffset + x] = Math.sqrt(rowOutput[x]);
    }
  }

  let maxDistance = 0;
  for (let i = 0; i < total; i += 1) {
    if (Number.isFinite(output[i]) && output[i] > maxDistance) {
      maxDistance = output[i];
    }
  }

  return {
    field: output,
    maxDistance,
  };
}
