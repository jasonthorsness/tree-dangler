export interface Point {
  x: number;
  y: number;
}

export interface LineSegment {
  id: string;
  start: Point;
  end: Point;
  text?: string;
}

export interface Polygon {
  id: string;
  points: Point[];
  meta?: Record<string, unknown>;
}

export type MaskPolygon = Polygon;

export interface Connector {
  id: string;
  a: Point;       // endpoint in world coordinates
  b: Point;       // endpoint in world coordinates
  length: number; // fixed length
  attachments: {
    endpoint: "a" | "b";
    polygonId: string;
    localPoint: Point; // polygon-local or world with a flag
  }[];
}

export interface TreeDanglerState {
  mask: MaskPolygon;
  segments: LineSegment[];
  voronoiPolygons: Polygon[];
  voronoiRaster?: BinaryBitmap;
  distanceField?: Float32Array;
  distanceFieldDimensions?: { width: number; height: number };
  distanceFieldMax?: number;
  thresholdBitmap?: Uint8ClampedArray;
  piecePolygons: Polygon[];
  connectors: Connector[];
  // UI-level config
  shrinkThreshold: number;
  growThreshold: number;
  noiseAmplitude: number;
  noiseSeed: number;
  connectorLength: number;
  distancePreview?: BinaryBitmap;
}

export interface BinaryBitmap {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
