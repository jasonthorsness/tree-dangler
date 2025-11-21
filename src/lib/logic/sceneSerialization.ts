import type {
  LineSegment,
  MaskPolygon,
  Point,
  TreeDanglerState,
} from "../types";

type SerializedPoint = { x: number; y: number };
type SerializedSegment = {
  start: SerializedPoint;
  end: SerializedPoint;
  text?: string;
};
type SerializedConnector = {
  start: SerializedPoint;
  end: SerializedPoint;
};

export type SerializedScene = {
  mask: { points: SerializedPoint[] };
  segments: SerializedSegment[];
  connectors: SerializedConnector[];
  noise: {
    gap: number;
    round: number;
    noiseAmplitude: number;
    noiseSeed: number;
    connectorLength: number;
  };
};

export type NormalizedScene = {
  mask: MaskPolygon;
  segments: LineSegment[];
  connectors: LineSegment[];
  noise: SerializedScene["noise"];
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const roundToTwoDecimals = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const serializePoint = (point: Point): SerializedPoint => ({
  x: roundToTwoDecimals(point.x),
  y: roundToTwoDecimals(point.y),
});

const parsePoint = (input: unknown): Point | null => {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as any).x !== "number" ||
    typeof (input as any).y !== "number"
  ) {
    return null;
  }
  return {
    x: roundToTwoDecimals((input as any).x),
    y: roundToTwoDecimals((input as any).y),
  };
};

export function serializeScene(state: TreeDanglerState): SerializedScene {
  return {
    mask: {
      points: state.mask.points.map(serializePoint),
    },
    segments: state.segments.map((segment) => {
      const base = {
        start: serializePoint(segment.start),
        end: serializePoint(segment.end),
      };
      if (segment.text !== undefined) {
        return { ...base, text: segment.text };
      }
      return base;
    }),
    connectors: state.connectors.map((connector) => ({
      start: serializePoint(connector.start),
      end: serializePoint(connector.end),
    })),
    noise: {
      gap: roundToTwoDecimals(state.gap),
      round: roundToTwoDecimals(state.round),
      noiseAmplitude: roundToTwoDecimals(state.noiseAmplitude),
      noiseSeed: roundToTwoDecimals(state.noiseSeed),
      connectorLength: roundToTwoDecimals(state.connectorLength),
    },
  };
}

export function deserializeScene(input: unknown): NormalizedScene | null {
  if (!input || typeof input !== "object") return null;
  const data = input as SerializedScene;
  if (
    !Array.isArray(data.mask?.points) ||
    !Array.isArray(data.segments) ||
    !Array.isArray(data.connectors) ||
    typeof data.noise !== "object"
  ) {
    return null;
  }
  const maskPoints = data.mask.points
    .map(parsePoint)
    .filter((point): point is Point => Boolean(point));
  if (maskPoints.length < 3) return null;

  const segments: LineSegment[] = data.segments
    .map((segment) => {
      const start = parsePoint(segment?.start);
      const end = parsePoint(segment?.end);
      if (!start || !end) return null;
      return {
        id: crypto.randomUUID(),
        start,
        end,
        text: typeof segment?.text === "string" ? segment.text : undefined,
      };
    })
    .filter((segment): segment is LineSegment => Boolean(segment));

  const connectors: LineSegment[] = data.connectors
    .map((connector) => {
      const start = parsePoint(connector?.start);
      const end = parsePoint(connector?.end);
      if (!start || !end) return null;
      return {
        id: crypto.randomUUID(),
        start,
        end,
      };
    })
    .filter((connector): connector is LineSegment => Boolean(connector));

  const { noise } = data;
  const normalizedNoise = {
    gap: roundToTwoDecimals(typeof noise.gap === "number" ? noise.gap : 1.5),
    round: roundToTwoDecimals(
      typeof noise.round === "number" ? noise.round : 2
    ),
    noiseAmplitude: roundToTwoDecimals(
      typeof noise.noiseAmplitude === "number" ? noise.noiseAmplitude : 3
    ),
    noiseSeed: roundToTwoDecimals(
      typeof noise.noiseSeed === "number" ? noise.noiseSeed : 0
    ),
    connectorLength: roundToTwoDecimals(
      typeof noise.connectorLength === "number" ? noise.connectorLength : 8
    ),
  };

  return {
    mask: {
      id: crypto.randomUUID(),
      points: maskPoints,
    },
    segments,
    connectors,
    noise: normalizedNoise,
  };
}

const toBase64Url = (raw: string) =>
  raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (raw: string) => {
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const paddingNeeded = (4 - (normalized.length % 4)) % 4;
  return normalized + "=".repeat(paddingNeeded);
};

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return toBase64Url(btoa(binary));
};

const base64UrlToBytes = (value: string): Uint8Array => {
  const base64 = fromBase64Url(value);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const compressString = async (value: string): Promise<Uint8Array> => {
  const cs = new CompressionStream("gzip");

  // Turn the input string into a ReadableStream
  const input = new Blob([value]).stream();

  // Pipe it through gzip, then read it back
  const compressed = input.pipeThrough(cs);
  const buffer = await new Response(compressed).arrayBuffer();

  return new Uint8Array(buffer);
};

const decompressToString = async (data: Uint8Array): Promise<string | null> => {
  // No DecompressionStream support: just try plain text decode
  if (typeof DecompressionStream === "undefined") {
    try {
      return textDecoder.decode(data);
    } catch (err) {
      console.error("Failed to decode scene payload", err);
      return null;
    }
  }

  try {
    const ds = new DecompressionStream("gzip");

    // Make a readable stream from the compressed bytes
    const inputStream = new Blob([data]).stream();

    // Pipe through the decompressor
    const decompressedStream = inputStream.pipeThrough(ds);
    const buffer = await new Response(decompressedStream).arrayBuffer();

    return textDecoder.decode(buffer);
  } catch (err) {
    console.warn("Gzip decompression failed, attempting plain decode", err);
    try {
      return textDecoder.decode(data);
    } catch (decodeErr) {
      console.error("Failed to decode scene payload", decodeErr);
      return null;
    }
  }
};

export async function encodeSceneToHash(
  state: TreeDanglerState
): Promise<string> {
  console.log("assa");
  const serialized = serializeScene(state);
  console.log("aasssa");
  const json = JSON.stringify(serialized);
  const compressed = await compressString(json);
  console.log("asssa");
  return bytesToBase64Url(compressed);
}

export async function decodeSceneFromHash(
  fragment: string
): Promise<NormalizedScene | null> {
  if (!fragment) return null;
  try {
    const bytes = base64UrlToBytes(fragment);
    const json = await decompressToString(bytes);
    if (!json) return null;
    const payload = JSON.parse(json);
    return deserializeScene(payload);
  } catch (err) {
    console.error("Failed to decode scene from URL hash", err);
    return null;
  }
}
