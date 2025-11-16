import { createContext, useContext, useReducer, useEffect, useRef, type Dispatch, type ReactNode } from 'react';
import { makeNoise2D } from 'open-simplex-noise';
import { TreeDanglerState, MaskPolygon, LineSegment, Polygon, BinaryBitmap } from '../types';
import { rasterizeVoronoiMask, computeDistanceField } from '../logic/distanceField';

// Action types
type Action =
  | { type: 'SET_MASK'; payload: MaskPolygon }
  | { type: 'SET_SEGMENTS'; payload: TreeDanglerState['segments'] }
  | { type: 'SET_VORONOI_POLYGONS'; payload: TreeDanglerState['voronoiPolygons'] }
  | { type: 'SET_VORONOI_RASTER'; payload: BinaryBitmap | undefined }
  | { type: 'SET_DISTANCE_FIELD'; payload: { data?: Float32Array; width?: number; height?: number; max?: number } }
  | { type: 'SET_DISTANCE_PREVIEW'; payload: BinaryBitmap | undefined }
  | { type: 'SET_THRESHOLD_BITMAP'; payload: Uint8ClampedArray }
  | { type: 'SET_PIECE_POLYGONS'; payload: TreeDanglerState['piecePolygons'] }
  | { type: 'SET_CONNECTORS'; payload: TreeDanglerState['connectors'] }
  | { type: 'SET_DISTANCE_CONFIG'; payload: Partial<Pick<TreeDanglerState, 'shrinkThreshold' | 'growThreshold' | 'noiseAmplitude' | 'noiseSeed'>> }
  | { type: 'SET_CONNECTOR_LENGTH'; payload: number };

// Initial state with a default triangle mask
const initialState: TreeDanglerState = {
  mask: {
    id: 'default-mask',
    points: [
      { x: 200, y: 100 },
      { x: 100, y: 300 },
      { x: 300, y: 300 },
    ],
  },
  segments: [],
  voronoiPolygons: [],
  voronoiRaster: undefined,
  piecePolygons: [],
  connectors: [],
  shrinkThreshold: 16,
  growThreshold: 10,
  noiseAmplitude: 5,
  noiseSeed: 0,
  connectorLength: 30,
  distancePreview: undefined,
};

// Reducer
function reducer(state: TreeDanglerState, action: Action): TreeDanglerState {
  switch (action.type) {
    case 'SET_MASK':
      return { ...state, mask: action.payload };
    case 'SET_SEGMENTS':
      return { ...state, segments: action.payload };
    case 'SET_VORONOI_POLYGONS':
      return { ...state, voronoiPolygons: action.payload };
    case 'SET_VORONOI_RASTER':
      return { ...state, voronoiRaster: action.payload };
    case 'SET_DISTANCE_FIELD':
      return {
        ...state,
        distanceField: action.payload.data,
        distanceFieldDimensions: action.payload.data
          ? { width: action.payload.width ?? state.distanceFieldDimensions?.width ?? 0, height: action.payload.height ?? state.distanceFieldDimensions?.height ?? 0 }
          : undefined,
        distanceFieldMax: action.payload.data ? action.payload.max ?? state.distanceFieldMax : undefined,
      };
    case 'SET_THRESHOLD_BITMAP':
      return { ...state, thresholdBitmap: action.payload };
    case 'SET_PIECE_POLYGONS':
      return { ...state, piecePolygons: action.payload };
    case 'SET_CONNECTORS':
      return { ...state, connectors: action.payload };
    case 'SET_DISTANCE_CONFIG':
      return { ...state, ...action.payload };
    case 'SET_DISTANCE_PREVIEW':
      return { ...state, distancePreview: action.payload };
    case 'SET_CONNECTOR_LENGTH':
      return { ...state, connectorLength: action.payload };
    default:
      return state;
  }
}

// Context
type TreeDanglerContextValue = {
  state: TreeDanglerState;
  dispatch: Dispatch<Action>;
};

const TreeDanglerContext = createContext<TreeDanglerContextValue | undefined>(undefined);

// Provider component
export function TreeDanglerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  useVoronoiAutoCompute(state.mask, state.segments, dispatch);
  useVoronoiRasterize(state.mask, state.voronoiPolygons, dispatch);
  useDistanceProcessing(
    state.voronoiRaster,
    {
      shrinkThreshold: state.shrinkThreshold,
      growThreshold: state.growThreshold,
      noiseAmplitude: state.noiseAmplitude,
      noiseSeed: state.noiseSeed,
    },
    dispatch,
  );

  return (
    <TreeDanglerContext.Provider value={{ state, dispatch }}>
      {children}
    </TreeDanglerContext.Provider>
  );
}

// Hook to access state and dispatch
export function useTreeDanglerState() {
  const context = useContext(TreeDanglerContext);
  if (!context) {
    throw new Error('useTreeDanglerState must be used within a TreeDanglerProvider');
  }
  return context;
}

interface VoronoiWorkerMessage {
  id: number;
  polygons?: Polygon[];
  error?: string;
}

function useVoronoiAutoCompute(mask: MaskPolygon, segments: LineSegment[], dispatch: Dispatch<Action>) {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const latestCompletedRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const worker = new Worker(new URL('../workers/voronoiWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<VoronoiWorkerMessage>) => {
      const { id, polygons, error } = event.data;
      if (error) {
        console.error('Voronoi worker error:', error);
        return;
      }
      if (!polygons || id < latestCompletedRef.current) {
        return;
      }
      latestCompletedRef.current = id;
      dispatch({ type: 'SET_VORONOI_POLYGONS', payload: polygons });
    };
    return () => {
      workerRef.current = null;
      worker.terminate();
    };
  }, [dispatch]);

  useEffect(() => {
    if (!workerRef.current) return;
    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    workerRef.current.postMessage({
      id,
      mask,
      segments,
    });
  }, [mask, segments]);
}

const DEFAULT_RASTER_SIZE = 600;

function useVoronoiRasterize(
  mask: MaskPolygon,
  polygons: Polygon[],
  dispatch: Dispatch<Action>,
) {
  useEffect(() => {
    if (!polygons.length) {
      dispatch({ type: "SET_VORONOI_RASTER", payload: undefined });
      dispatch({ type: "SET_DISTANCE_FIELD", payload: {} });
      dispatch({ type: "SET_DISTANCE_PREVIEW", payload: undefined });
      return;
    }
    const maskBitmap = rasterizeVoronoiMask(polygons, mask, {
      width: DEFAULT_RASTER_SIZE,
      height: DEFAULT_RASTER_SIZE,
      strokeWidth: 2,
    });
    if (maskBitmap) {
      dispatch({ type: "SET_VORONOI_RASTER", payload: maskBitmap });
    }
  }, [mask, polygons, dispatch]);
}

interface DistanceProcessingConfig {
  shrinkThreshold: number;
  growThreshold: number;
  noiseAmplitude: number;
  noiseSeed: number;
}

function useDistanceProcessing(
  raster: BinaryBitmap | undefined,
  config: DistanceProcessingConfig,
  dispatch: Dispatch<Action>,
) {
  const noise2DRef = useRef<((x: number, y: number) => number) | null>(null);
  const seedRef = useRef<number | null>(null);

  useEffect(() => {
    if (seedRef.current !== config.noiseSeed || !noise2DRef.current) {
      noise2DRef.current = makeNoise2D(config.noiseSeed);
      seedRef.current = config.noiseSeed;
    }

    if (!raster) {
      dispatch({ type: "SET_DISTANCE_FIELD", payload: {} });
      dispatch({ type: "SET_DISTANCE_PREVIEW", payload: undefined });
      return;
    }

    const { width, height } = raster;
    const total = width * height;

    const inward = computeDistanceField(raster);
    dispatch({
      type: "SET_DISTANCE_FIELD",
      payload: {
        data: inward.field,
        width,
        height,
        max: inward.maxDistance,
      },
    });

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

    if (config.noiseAmplitude > 0 && noise2DRef.current) {
      for (let i = 0; i < outward.field.length; i += 1) {
        const x = i % width;
        const y = Math.floor(i / width);
        const baseNoise = noise2DRef.current(x * 0.01, y * 0.01);
        const secondNoise = noise2DRef.current(x * 0.02 + 100, y * 0.02 + 100);
        const thirdNoise = noise2DRef.current(x * 0.03 + 200, y * 0.03 + 200);
        const combinedNoise = (baseNoise + secondNoise * 0.5 + thirdNoise * 0.25) / 1.75;
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
        previewData[offset + 3] = 255;
      }
    }
    dispatch({
      type: "SET_DISTANCE_PREVIEW",
      payload: {
        width,
        height,
        data: previewData,
      },
    });
  }, [
    raster,
    config.shrinkThreshold,
    config.growThreshold,
    config.noiseAmplitude,
    config.noiseSeed,
    dispatch,
  ]);
}
