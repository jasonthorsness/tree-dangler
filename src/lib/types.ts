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

export interface TreeDanglerState {
  mask: MaskPolygon;
  segments: LineSegment[];
  piecePolygons: Polygon[];
  connectors: LineSegment[];
  // UI-level config
  gap: number;
  round: number;
  noiseAmplitude: number;
  noiseSeed: number;
  connectorLength: number;
  svgString?: string;
}

export interface BinaryBitmap {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
